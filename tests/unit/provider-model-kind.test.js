import { describe, expect, it, vi } from "vitest";
import {
  classifyProviderModelKind,
  syncConnectionModels,
} from "../../src/lib/providerModelSync.js";

describe("provider model kind classification", () => {
  it.each([
    ["gemini", { name: "models/gemini-embedding-2", supportedGenerationMethods: ["embedContent"] }, "embedding"],
    ["gemini", { name: "models/gemini-3.8-flash-tts" }, "tts"],
    ["gemini", { name: "models/gemini-3.1-flash-image" }, "image"],
    ["gemini", { name: "models/gemini-3.8-flash" }, "llm"],
    ["groq", { id: "whisper-large-v3" }, "stt"],
    ["groq", { id: "canopylabs/orpheus-v1-english" }, "tts"],
    ["groq", { id: "llama-3.3-70b-versatile" }, "llm"],
    ["openai", { id: "text-embedding-3-small" }, "embedding"],
    ["openai", { id: "sora-2" }, "video"],
    ["openai", { id: "gpt-image-2" }, "image"],
    ["openai", { id: "gpt-4o-mini-transcribe" }, "stt"],
    ["openai", { id: "gpt-4.1" }, "llm"],
    ["tokenrouter", { id: "x", supported_endpoint_types: ["embeddings"] }, "embedding"],
    ["tokenrouter", { id: "x", supported_endpoint_types: ["image-generation"] }, "image"],
    ["tokenrouter", { id: "x", supported_endpoint_types: ["audio-chat"] }, "tts"],
    ["openrouter", { id: "x", architecture: { output_modalities: ["image", "text"] } }, "image"],
    ["openrouter", { id: "x", architecture: { output_modalities: ["text"] } }, "llm"],
    ["nvidia", { id: "nvidia/embed-qa-4" }, "embedding"],
  ])("classifies %s model %j as %s", (provider, model, expected) => {
    expect(classifyProviderModelKind(provider, model)).toBe(expected);
  });

  it("does not import safety and guard models into chat", () => {
    expect(classifyProviderModelKind("groq", { id: "openai/gpt-oss-safeguard-20b" })).toBeNull();
    expect(classifyProviderModelKind("openrouter", { id: "meta-llama/llama-guard-4-12b" })).toBeNull();
  });
});

describe("model sync by kind", () => {
  it("persists each model under its classified kind", async () => {
    const upsertModels = vi.fn(async ({ models }) => ({
      fetched: models.length,
      added: models.length,
      updated: 0,
      unchanged: 0,
      invalid: 0,
      stale: 0,
    }));
    const result = await syncConnectionModels(
      { id: "c1", provider: "gemini" },
      {
        fetchModels: async () => ({
          models: [
            { name: "models/gemini-3.8-flash", type: "model" },
            { name: "models/gemini-embedding-2", supportedGenerationMethods: ["embedContent"] },
            { name: "models/gemini-3.8-flash-tts" },
          ],
          authoritative: true,
        }),
        alias: "gemini",
        builtinIds: new Set(),
        upsertModels,
      },
    );

    expect(upsertModels).toHaveBeenCalledTimes(3);
    expect(upsertModels.mock.calls.map(([input]) => input.type).sort()).toEqual(["embedding", "llm", "tts"]);
    expect(result).toMatchObject({ fetched: 3, added: 3 });
  });

  it("stales an imported kind that disappears from an authoritative catalog", async () => {
    const upsertModels = vi.fn(async ({ models }) => ({
      fetched: models.length,
      added: 0,
      updated: 0,
      unchanged: 0,
      invalid: 0,
      stale: models.length === 0 ? 1 : 0,
    }));

    const result = await syncConnectionModels(
      { id: "c1", provider: "openai" },
      {
        fetchModels: async () => ({
          models: [{ id: "gpt-5" }],
          authoritative: true,
        }),
        alias: "openai",
        builtinIds: new Set(),
        builtinKinds: new Set(),
        trackedKinds: new Set(["llm", "tts"]),
        upsertModels,
      },
    );

    expect(upsertModels).toHaveBeenCalledWith(expect.objectContaining({
      type: "tts",
      models: [],
      authoritative: true,
    }));
    expect(result.stale).toBe(1);
  });

  it("does not re-import an id already built in for the same kind", async () => {
    const upsertModels = vi.fn(async ({ models }) => ({
      fetched: models.length,
      added: models.length,
      updated: 0,
      unchanged: 0,
      invalid: 0,
      stale: 0,
    }));

    await syncConnectionModels(
      { id: "c1", provider: "gemini" },
      {
        fetchModels: async () => ({
          models: [{ name: "models/gemini-2.5-pro" }],
          authoritative: true,
        }),
        alias: "gemini",
        builtinIds: new Set(["gemini-2.5-pro"]),
        builtinKinds: new Set([
          "llm:gemini-2.5-pro",
          "stt:gemini-2.5-pro",
        ]),
        upsertModels,
      },
    );

    expect(upsertModels).toHaveBeenCalledWith(expect.objectContaining({
      type: "llm",
      models: [],
    }));
  });
});
