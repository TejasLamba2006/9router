import crypto from "node:crypto";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TOKENS = 1000;
const tokens = globalThis.__9routerPlaygroundVideoTokens ||= new Map();

function prune(now = Date.now()) {
  for (const [token, entry] of tokens) {
    if (entry.expiresAt <= now) tokens.delete(token);
  }
  while (tokens.size >= MAX_TOKENS) tokens.delete(tokens.keys().next().value);
}

export async function createPlaygroundVideoToken({ connectionId, jobId }) {
  if (!connectionId || !jobId) throw new Error("Video token needs a connection and job id");
  prune();
  const token = crypto.randomBytes(32).toString("base64url");
  tokens.set(token, {
    connectionId: String(connectionId),
    jobId: String(jobId),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
  return token;
}

export async function verifyPlaygroundVideoToken(token) {
  if (typeof token !== "string" || !token) return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    tokens.delete(token);
    return null;
  }
  return { connectionId: entry.connectionId, jobId: entry.jobId };
}
