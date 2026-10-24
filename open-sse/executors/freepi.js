import { createHash } from "node:crypto";
import { DefaultExecutor } from "./default.js";
import { getCachedFreepiVersion, getFreepiClientVersion } from "../services/freepiModels.js";

const RESET_URL = "https://api.freepi.ai/session/reset";
const ADS_URL = "https://api.freepi.ai/ads";
const ADS_TTL_MS = 10 * 60 * 1000;
const ADS_TIMEOUT_MS = 5000;
const adsLastRun = new Map();
const SESSION_RE = /session|lease|another active/i;
const VERSION_RE = /version|outdated|upgrade/i;

// Stable UUID-shaped id per connection so every request shares one session lease.
function stableSessionId(credentials) {
  const seed = credentials?.connectionId || credentials?.accessToken || credentials?.apiKey || "freepi";
  const h = createHash("sha256").update(`freepi:${seed}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function peek(response) {
  try {
    return await response.clone().text();
  } catch {
    return "";
  }
}

export function resetFreepiAdsForTests() {
  adsLastRun.clear();
}

// Mirrors free-pi-cli's pi-ads: GET /ads/next for banner+inline, then POST /ads/impression
// (plus Gravity's imp_url pixel when source=gravity). Server gates chat on this; never throws.
async function pingAds(credentials) {
  const token = credentials?.accessToken || credentials?.apiKey;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-client-version": getCachedFreepiVersion(),
    "x-session-id": stableSessionId(credentials),
  };
  const signal = () => AbortSignal.timeout(ADS_TIMEOUT_MS);
  for (const slot of ["banner", "inline"]) {
    try {
      const res = await fetch(`${ADS_URL}/next?slot=${slot}`, { headers, signal: signal() });
      if (res.status !== 200) continue;
      const ad = await res.json();
      if (!ad?.ad_id || !ad?.click_token) continue;
      let impFired = false;
      if (ad.source === "gravity" && /^https:\/\/([^/]*\.)?trygravity\.(ai|com)\//.test(ad.imp_url || "")) {
        fetch(ad.imp_url, { signal: AbortSignal.timeout(3000) }).catch(() => {});
        impFired = true;
      }
      await fetch(`${ADS_URL}/impression`, {
        method: "POST",
        headers,
        signal: signal(),
        body: JSON.stringify({ ad_id: ad.ad_id, click_token: ad.click_token, ...(impFired ? { imp_fired: true } : {}) }),
      });
    } catch {
      // best-effort
    }
  }
}

async function ensureAds(credentials, force = false) {
  const key = credentials?.connectionId || credentials?.accessToken || credentials?.apiKey || "freepi";
  const last = adsLastRun.get(key) || 0;
  if (!force && Date.now() - last < ADS_TTL_MS) return;
  adsLastRun.set(key, Date.now());
  await pingAds(credentials);
}

export class FreepiExecutor extends DefaultExecutor {
  constructor() {
    super("freepi");
  }

  buildHeaders(credentials, stream = true, url, model, body = null) {
    const headers = super.buildHeaders(credentials, stream, url, model, body);
    headers.Authorization = `Bearer ${credentials?.accessToken || credentials?.apiKey}`;
    headers["x-client-version"] = getCachedFreepiVersion();
    headers["x-session-id"] = stableSessionId(credentials);
    return headers;
  }

  async execute(args) {
    await getFreepiClientVersion(); // warms cache; no-op within TTL
    await ensureAds(args.credentials);
    const result = await super.execute(args);
    const status = result?.response?.status;
    if (![400, 403, 409, 426].includes(status)) return result;

    const text = await peek(result.response);
    const token = args.credentials?.accessToken || args.credentials?.apiKey;
    if (status === 403 && /ads_required/.test(text)) {
      await ensureAds(args.credentials, true);
      return super.execute(args);
    }
    if (status === 426 || (status === 400 && VERSION_RE.test(text) && !SESSION_RE.test(text))) {
      await getFreepiClientVersion(true);
      return super.execute(args);
    }
    if (status === 409 || SESSION_RE.test(text)) {
      try {
        await fetch(RESET_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "x-client-version": getCachedFreepiVersion() },
        });
      } catch {
        return result;
      }
      return super.execute(args);
    }
    return result;
  }
}
