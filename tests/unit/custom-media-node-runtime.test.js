import { describe, expect, it } from "vitest";
import { getImageAdapter } from "../../open-sse/handlers/imageProviders/index.js";
import { getTtsAdapter } from "../../open-sse/handlers/ttsProviders/index.js";
import { getEmbeddingAdapter } from "../../open-sse/handlers/embeddingProviders/index.js";
import { getVideoConfig } from "../../open-sse/handlers/videoCore.js";
import { customNodeSttConfig } from "../../open-sse/handlers/sttCore.js";

const provider = "openai-compatible-chat-node";
const credentials = (serviceKinds, baseUrl = "https://media.example/v1") => ({
  apiKey: "secret",
  providerSpecificData: { baseUrl, serviceKinds },
});

describe("custom compatible media node runtime", () => {
  it("routes only explicitly enabled image endpoints", () => {
    const adapter = getImageAdapter(provider);
    expect(adapter.buildUrl("image-model", credentials(["image"]))).toBe("https://media.example/v1/images/generations");
    expect(() => adapter.buildUrl("image-model", credentials(["tts"]))).toThrow("not enabled for image");
    expect(() => adapter.buildUrl("image-model", credentials(["image"], ""))).toThrow("base URL");
  });

  it("routes only explicitly enabled TTS endpoints", async () => {
    const adapter = getTtsAdapter(provider);
    expect(adapter).toBeTruthy();
    await expect(adapter.synthesize("hello", "tts-1/alloy", credentials(["image"]))).rejects.toThrow("not enabled for tts");
  });

  it("builds STT config only for explicitly enabled nodes", () => {
    expect(customNodeSttConfig(provider, credentials(["stt"]))).toEqual({
      authType: "apikey",
      baseUrl: "https://media.example/v1/audio/transcriptions",
      format: "openai",
    });
    expect(() => customNodeSttConfig(provider, credentials(["image"]))).toThrow("not enabled for stt");
  });

  it("builds video config only for explicitly enabled nodes", () => {
    expect(getVideoConfig(provider, credentials(["video"]))).toEqual({ baseUrl: "https://media.example/v1/videos" });
    expect(getVideoConfig(provider, credentials(["image"]))).toBeNull();
  });

  it("never falls back custom embeddings to api.openai.com", () => {
    const adapter = getEmbeddingAdapter(provider);
    expect(() => adapter.buildUrl("embed", { apiKey: "secret", providerSpecificData: { serviceKinds: ["embedding"] } })).toThrow("base URL");
  });
});
