import { createHash } from "node:crypto";
import { DefaultExecutor } from "./default.js";
import { getCachedFreepiVersion, getFreepiClientVersion } from "../services/freepiModels.js";

const RESET_URL = "https://api.freepi.ai/session/reset";
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
    const result = await super.execute(args);
    const status = result?.response?.status;
    if (![400, 403, 409, 426].includes(status)) return result;

    const text = await peek(result.response);
    const token = args.credentials?.accessToken || args.credentials?.apiKey;
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
