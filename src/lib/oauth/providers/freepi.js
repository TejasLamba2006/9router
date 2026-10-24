import { PROVIDER_OAUTH } from "open-sse/providers/index.js";

const CONFIG = { ...PROVIDER_OAUTH["freepi"] };
const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };
const post = (url, body, extra = {}) =>
  fetch(url, { method: "POST", headers: { ...JSON_HEADERS, ...extra }, body: JSON.stringify(body) });

// FreePi: GitHub device flow brokered by api.freepi.ai. session_id doubles as device_code.
const freepi = {
  config: CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config) => {
    const res = await post(config.deviceCodeUrl, {});
    if (!res.ok) throw new Error(`FreePi device flow failed: HTTP ${res.status}`);
    const d = await res.json();
    // Consent must be recorded before /auth/token will issue a JWT.
    const consent = await post(config.consentUrl, {
      session_id: d.session_id,
      consent_version: config.consentVersion,
    });
    if (!consent.ok) throw new Error(`FreePi consent failed: HTTP ${consent.status}`);
    return {
      device_code: d.session_id,
      user_code: d.user_code,
      verification_uri: d.verification_uri,
      verification_uri_complete: d.verification_uri_complete,
      interval: d.interval || 5,
      expires_in: d.expires_in,
    };
  },
  pollToken: async (config, deviceCode) => {
    let res = await post(config.tokenUrl, { session_id: deviceCode });
    let data = await res.json().catch(() => ({}));
    if (res.status === 403 && data?.code === "consent_required") {
      await post(config.consentUrl, {
        session_id: deviceCode,
        consent_version: data.consent_version || config.consentVersion,
      });
      res = await post(config.tokenUrl, { session_id: deviceCode });
      data = await res.json().catch(() => ({}));
    }
    if (res.ok && data?.token) return { ok: true, data: { access_token: data.token } };
    // Anything without a token is "still waiting" unless the server says otherwise.
    const fatal = res.status >= 400 && res.status !== 403 && res.status !== 429 && res.status < 500;
    return {
      ok: true,
      data: {
        error: fatal ? data?.code || `http_${res.status}` : "authorization_pending",
        error_description: data?.message,
      },
    };
  },
  postExchange: async (tokens) => {
    const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" };
    const res = await fetch(CONFIG.meUrl, { headers });
    const me = res.ok ? await res.json().catch(() => ({})) : {};
    if (me?.consent_version == null && res.ok) {
      await post(`${CONFIG.meUrl}/consent`, { consent_version: CONFIG.consentVersion }, headers);
    }
    return { me };
  },
  mapTokens: (tokens, extra) => ({
    accessToken: tokens.access_token,
    apiKey: tokens.access_token,
    expiresIn: 90 * 86400,
    email: extra?.me?.email || extra?.me?.github_login || extra?.me?.login || undefined,
    displayName: extra?.me?.github_login || extra?.me?.login || undefined,
    providerSpecificData: { tier: extra?.me?.tier, lane: extra?.me?.lane },
  }),
};

export default freepi;
