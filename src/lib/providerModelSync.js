// Pulls each connected provider's live model list and stores the models the
// built-in registry does not already know as custom models, so routing,
// /v1/models and the pickers all see them. Additive only: a failed or empty
// fetch never removes anything, and built-in models stay as the fallback.

import { PROVIDERS } from "open-sse/config/providers.js";

const TYPES_WITH_OWN_FETCH = ["openai-compatible", "anthropic-compatible"];

// Most OpenAI-style providers serve /models next to /chat/completions.
export function genericModelsConfig(providerId) {
  const base = PROVIDERS[providerId]?.baseUrl || PROVIDERS[providerId]?.transport?.baseUrl;
  if (typeof base !== "string" || !base.endsWith("/chat/completions")) return null;
  return {
    url: base.replace(/\/chat\/completions$/, "/models"),
    method: "GET",
    headers: { "Content-Type": "application/json" },
    authHeader: "Authorization",
    authPrefix: "Bearer ",
    parseResponse: (data) => (Array.isArray(data) ? data : data?.data || data?.models || []),
  };
}

const REPORTED_FIELDS = [
  "owned_by", "created", "description", "capabilities", "architecture",
  "context_length", "max_completion_tokens", "pricing", "supportedGenerationMethods",
];

// Providers answer with {id}, {name: "models/x"} (Gemini) or {model}. Keep
// useful, bounded metadata for Phase 4 without treating it as verified here.
export function normalizeModelList(list, prefixes = []) {
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== "object") continue;
    if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes("generateContent")) continue;
    const raw = m.id || m.name || m.model;
    let id = typeof raw === "string" ? raw.replace(/^models\//, "").trim() : "";
    for (const prefix of Array.isArray(prefixes) ? prefixes : [prefixes]) {
      if (prefix && id.startsWith(`${prefix}/`)) { id = id.slice(prefix.length + 1); break; }
    }
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const reported = {};
    for (const field of REPORTED_FIELDS) if (m[field] !== undefined) reported[field] = m[field];
    const display = m.displayName || ((m.id || m.model) && m.name) || id;
    out.push({ id, name: typeof display === "string" && display.trim() ? display.trim() : id, reported });
  }
  return out;
}

// `fetchModels(conn)` returns one raw list; `upsertModels` persists the whole
// normalized catalog in one transaction. Built-ins stay registry-owned.
export async function syncConnectionModels(conn, { fetchModels, alias, builtinIds, upsertModels, signal }) {
  const empty = { provider: conn.provider, connectionId: conn.id, fetched: 0, added: 0, updated: 0, unchanged: 0, invalid: 0, stale: 0 };
  if (signal?.aborted) return { ...empty, error: "Import cancelled" };
  let raw;
  try {
    raw = await fetchModels(conn);
  } catch (error) {
    return { ...empty, error: signal?.aborted ? "Import cancelled" : (error?.message || String(error)) };
  }
  if (signal?.aborted) return { ...empty, error: "Import cancelled" };
  const models = normalizeModelList(raw, [conn.provider, alias]);
  if (models.length === 0) return { ...empty, fetched: Array.isArray(raw) ? raw.length : 0 };
  const imported = models.filter(({ id }) => !builtinIds.has(id));
  const saved = await upsertModels({
    providerAlias: alias,
    connectionId: conn.id,
    models: imported,
    // A non-empty upstream catalog is authoritative even when every returned
    // id is built in: prior imported extras absent from it can become stale.
    authoritative: true,
  });
  return { provider: conn.provider, connectionId: conn.id, ...saved, fetched: models.length };
}

export { TYPES_WITH_OWN_FETCH };
