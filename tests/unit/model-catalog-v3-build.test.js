import { describe, expect, it } from "vitest";
import { build } from "../../src/lib/modelCatalog/sync.js";

describe("model catalog v3 transform", () => {
  it("preserves reported metadata and canonical pricing", () => {
    const result = build({
      openai: {
        models: {
          "gpt-x": {
            name: "GPT X",
            canonical_model_id: "openai/gpt-x",
            family: "gpt-x",
            status: "active",
            release_date: "2026-01-01",
            last_updated: "2026-02-01",
            open_weights: false,
            reasoning: true,
            tool_call: true,
            structured_output: true,
            temperature: false,
            modalities: { input: ["text", "image"], output: ["text"] },
            limit: { context: 200000, input: 180000, output: 32000 },
            cost: { input: 1, output: 4, cache_read: 0.1, cache_write: 1.25, reasoning: 4 },
          },
        },
      },
    }, [{ provider: "openai", model: "gpt-x", contextLength: 200000, current: { contextWindow: 200000, maxOutput: 32000 } }]);

    expect(result.reported.openai["gpt-x"]).toMatchObject({
      name: "GPT X",
      canonicalModelId: "openai/gpt-x",
      family: "gpt-x",
      status: "active",
      capabilities: { reasoning: true, tools: true, structuredOutput: true, temperature: false },
      modalities: { input: ["text", "image"], output: ["text"] },
      limits: { context: 200000, input: 180000, output: 32000 },
      pricing: { input: 1, output: 4, cached: 0.1, cacheCreation: 1.25, reasoning: 4 },
    });
    expect(result.canonicalPricing["openai/gpt-x"]).toMatchObject({ input: 1, output: 4 });
    expect(result.uniqueCanonicalBasename["gpt-x"]).toBe("openai/gpt-x");
  });

  it("maps declared output modalities without confusing them with inputs", () => {
    const result = build({
      openai: {
        models: {
          "multimodal-output": {
            modalities: {
              input: ["text", "audio"],
              output: ["text", "image", "audio", "video"],
            },
          },
        },
      },
    }, []);

    expect(result.models["openai:multimodal-output"]).toEqual({
      audioInput: true,
      imageOutput: true,
      audioOutput: true,
      videoOutput: true,
    });
  });

  it("derives canonical owner IDs when models.dev omits canonical_model_id", () => {
    const result = build({
      openai: {
        models: {
          "gpt-owner": {
            name: "GPT Owner",
            cost: { input: 2, output: 8 },
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 100000, output: 16000 },
          },
        },
      },
    }, []);
    expect(result.reported.openai["gpt-owner"].canonicalModelId).toBe("openai/gpt-owner");
    expect(result.canonicalPricing["openai/gpt-owner"]).toEqual({
      input: 2,
      output: 8,
      cached: undefined,
      cacheCreation: undefined,
      reasoning: undefined,
    });
    expect(result.uniqueCanonicalBasename["gpt-owner"]).toBe("openai/gpt-owner");
  });
});
