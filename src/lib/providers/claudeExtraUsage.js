const EXTRA_USAGE_FALLBACK_BLOCK_MS = 5 * 60 * 1000;
const SESSION_RESET_WINDOW_KEYS = ["session (5h)", "session", "five_hour"];

export const CLAUDE_EXTRA_USAGE_ERROR_SOURCE = "extra_usage";
export const CLAUDE_EXTRA_USAGE_ERROR_MESSAGE =
  "Claude extra usage was detected and blocked by this connection policy.";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toFutureIso(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() ? value : null;
}

export function isClaudeExtraUsageBlockEnabled(provider, providerSpecificData) {
  return provider === "claude" && asRecord(providerSpecificData).blockExtraUsage !== false;
}

export function isClaudeExtraUsageAllowed(provider, providerSpecificData) {
  return provider === "claude" && asRecord(providerSpecificData).blockExtraUsage === false;
}

export function isClaudeExtraUsageState(connection) {
  return connection?.lastErrorSource === CLAUDE_EXTRA_USAGE_ERROR_SOURCE;
}

export function buildClaudeExtraUsageStateClearUpdate(connection) {
  if (!isClaudeExtraUsageState(connection)) return null;
  return {
    testStatus: "active",
    lastError: null,
    lastErrorAt: null,
    lastErrorType: null,
    lastErrorSource: null,
    errorCode: null,
    rateLimitedUntil: null,
    backoffLevel: 0,
  };
}

function resolveResetAt(usage) {
  const quotas = asRecord(asRecord(usage).quotas);
  for (const key of SESSION_RESET_WINDOW_KEYS) {
    const resetAt = toFutureIso(asRecord(quotas[key]).resetAt);
    if (resetAt) return resetAt;
  }

  return Object.values(quotas)
    .map((quota) => toFutureIso(asRecord(quota).resetAt))
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || null;
}

export function buildClaudeExtraUsageConnectionUpdate(connection, usage) {
  const snapshot = asRecord(usage);
  const hasTrustedSnapshot = Object.hasOwn(snapshot, "extraUsage") || !!snapshot.quotas;
  if (connection?.provider !== "claude" || !hasTrustedSnapshot) return null;

  if (!isClaudeExtraUsageBlockEnabled(connection.provider, connection.providerSpecificData)) {
    return buildClaudeExtraUsageStateClearUpdate(connection);
  }

  if (asRecord(snapshot.extraUsage).queued !== true) {
    return buildClaudeExtraUsageStateClearUpdate(connection);
  }

  const rateLimitedUntil = resolveResetAt(snapshot)
    || new Date(Date.now() + EXTRA_USAGE_FALLBACK_BLOCK_MS).toISOString();
  if (
    isClaudeExtraUsageState(connection)
    && connection.testStatus === "unavailable"
    && connection.lastErrorType === "quota_exhausted"
    && connection.rateLimitedUntil === rateLimitedUntil
  ) {
    return null;
  }

  return {
    testStatus: "unavailable",
    lastError: CLAUDE_EXTRA_USAGE_ERROR_MESSAGE,
    lastErrorAt: new Date().toISOString(),
    lastErrorType: "quota_exhausted",
    lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
    errorCode: 429,
    rateLimitedUntil,
    backoffLevel: Math.max(1, Number(connection.backoffLevel) || 0),
  };
}
