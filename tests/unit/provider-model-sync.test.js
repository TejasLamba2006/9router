import { describe, expect, it, vi } from "vitest";
import {
  genericModelsConfig,
  normalizeModelList,
  syncConnectionModels,
} from "../../src/lib/providerModelSync.js";

describe("genericModelsConfig", () => {
  it("derives /models from a chat completions base URL", () => {
    const cfg = genericModelsConfig("groq");
    expect(cfg.url).toBe("https://api.groq.com/openai/v1/models");
    expect(cfg.authHeader).toBe("Authorization");
    expect(cfg.authPrefix).toBe("Bearer ");
  });

  it("returns null for providers with no OpenAI-style models endpoint", () => {
    expect(genericModelsConfig("anthropic")).toBeNull();
    expect(genericModelsConfig("no-such-provider")).toBeNull();
  });

  it("parses data, models and bare-array shapes", () => {
    const cfg = genericModelsConfig("groq");
    expect(cfg.parseResponse({ data: [{ id: "a" }] })).toEqual([{ id: "a" }]);
    expect(cfg.parseResponse({ models: [{ id: "b" }] })).toEqual([{ id: "b" }]);
    expect(cfg.parseResponse([{ id: "c" }])).toEqual([{ id: "c" }]);
    expect(cfg.parseResponse({})).toEqual([]);
  });
});

describe("normalizeModelList", () => {
  it("reads id, name or model, strips the models/ prefix, drops blanks and duplicates", () => {
    const out = normalizeModelList([
      { id: "gpt-x" }, { name: "models/gemini-9" }, { model: "m1" }, { id: "gpt-x" }, { id: " " }, null, {},
    ]);
    expect(out.map((m) => m.id)).toEqual(["gpt-x", "gemini-9", "m1"]);
  });

  it("skips Gemini models that cannot generate content", () => {
    const out = normalizeModelList([
      { name: "models/embed-1", supportedGenerationMethods: ["embedContent"] },
      { name: "models/chat-1", supportedGenerationMethods: ["generateContent"] },
    ]);
    expect(out.map((m) => m.id)).toEqual(["chat-1"]);
  });
});

describe("syncConnectionModels", () => {
  const conn = { id: "c1", provider: "groq" };
  const deps = (over = {}) => ({
    fetchModels: vi.fn(async () => [{ id: "new-1" }, { id: "built-in" }, { id: "have-it" }]),
    alias: "groq",
    builtinIds: new Set(["built-in"]),
    existingIds: new Set(["have-it"]),
    addModel: vi.fn(async () => true),
    ...over,
  });

  it("adds only models that are neither built in nor already stored", async () => {
    const d = deps();
    const res = await syncConnectionModels(conn, d);
    expect(d.addModel).toHaveBeenCalledTimes(1);
    expect(d.addModel).toHaveBeenCalledWith({ providerAlias: "groq", id: "new-1", type: "llm", name: "new-1" });
    expect(res).toMatchObject({ provider: "groq", fetched: 3, added: 1 });
  });

  it("never removes anything when the fetch fails", async () => {
    const d = deps({ fetchModels: vi.fn(async () => { throw new Error("401"); }) });
    const res = await syncConnectionModels(conn, d);
    expect(d.addModel).not.toHaveBeenCalled();
    expect(res).toMatchObject({ provider: "groq", added: 0, error: "401" });
  });

  it("treats an empty list as a no-op, not an error", async () => {
    const d = deps({ fetchModels: vi.fn(async () => []) });
    const res = await syncConnectionModels(conn, d);
    expect(res).toMatchObject({ fetched: 0, added: 0 });
    expect(res.error).toBeUndefined();
  });
});
