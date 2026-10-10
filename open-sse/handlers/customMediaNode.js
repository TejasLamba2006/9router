import { OPENAI_COMPATIBLE_PREFIX, CUSTOM_EMBEDDING_PREFIX } from "@/shared/constants/providers.js";

export function isOpenAICompatibleNode(provider) {
  return typeof provider === "string" && provider.startsWith(OPENAI_COMPATIBLE_PREFIX);
}

export function isCustomEmbeddingNode(provider) {
  return typeof provider === "string" && provider.startsWith(CUSTOM_EMBEDDING_PREFIX);
}

export function hasCustomNodeService(credentials, kind, { legacyEmbedding = false } = {}) {
  const kinds = credentials?.providerSpecificData?.serviceKinds;
  if (legacyEmbedding && !Array.isArray(kinds)) return true;
  return Array.isArray(kinds) && kinds.includes(kind);
}

export function customNodeMediaUrl(provider, credentials, kind, endpoint, { legacyEmbedding = false } = {}) {
  const isNode = isOpenAICompatibleNode(provider) || (legacyEmbedding && isCustomEmbeddingNode(provider));
  if (!isNode) return null;
  if (!hasCustomNodeService(credentials, kind, { legacyEmbedding })) {
    throw new Error(`Custom provider '${provider}' is not enabled for ${kind}`);
  }
  const raw = credentials?.providerSpecificData?.baseUrl;
  if (!raw || !String(raw).trim()) {
    throw new Error(`Custom provider '${provider}' needs a base URL for ${kind}`);
  }
  const suffix = `/${endpoint.replace(/^\/+/, "")}`;
  const base = String(raw).trim().replace(/\/+$/, "").replace(new RegExp(`${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
  return `${base}${suffix}`;
}
