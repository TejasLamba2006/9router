// Custom node providers (openai-compatible-* / custom-embedding-*) — baseUrl from credentials
import createOpenAIEmbeddingAdapter from "./openai.js";
import { customNodeMediaUrl } from "../customMediaNode.js";

const baseAdapter = createOpenAIEmbeddingAdapter("openai");

export default function createOpenAICompatibleNodeEmbeddingAdapter(provider) {
  return {
    ...baseAdapter,
    buildUrl: (_model, credentials) => customNodeMediaUrl(
      provider,
      credentials,
      "embedding",
      "embeddings",
      { legacyEmbedding: true }
    ),
  };
}
