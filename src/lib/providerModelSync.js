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

// Providers answer with {id}, {name: "models/x"} (Gemini) or {model}; keep ids only.
export function normalizeModelList(list) {
  const seen = new Set();
  const out = [];
  for (const m of Array.isArray(list) ? list : []) {
    if (!m || typeof m !== "object") continue;
    if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes("generateContent")) continue;
    const raw = m.id || m.name || m.model;
    const id = typeof raw === "string" ? raw.replace(/^models\//, "").trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: id });
  }
  return out;
}

// `fetchModels(conn)` returns the raw list; `addModel` persists one custom model.
export async function syncConnectionModels(conn, { fetchModels, alias, builtinIds, existingIds, addModel }) {
  const result = { provider: conn.provider, connectionId: conn.id, fetched: 0, added: 0 };
  let models;
  try {
    models = normalizeModelList(await fetchModels(conn));
  } catch (error) {
    return { ...result, error: error?.message || String(error) };
  }
  result.fetched = models.length;
  for (const { id, name } of models) {
    if (builtinIds.has(id) || existingIds.has(id)) continue;
    if (await addModel({ providerAlias: alias, id, type: "llm", name })) result.added += 1;
  }
  return result;
}

export { TYPES_WITH_OWN_FETCH };
