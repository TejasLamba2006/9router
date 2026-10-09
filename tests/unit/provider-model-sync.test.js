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

  it("strips the current provider alias from qualified ids", () => {
    const out = normalizeModelList([{ id: "qoder/auto" }, { id: "qd/plus" }, { id: "other/vendor-model" }], ["qoder", "qd"]);
    expect(out.map((m) => m.id)).toEqual(["auto", "plus", "other/vendor-model"]);
  });
});

describe("syncConnectionModels", () => {
  const conn = { id: "c1", provider: "groq" };
  const deps = (over = {}) => ({
    fetchModels: vi.fn(async () => [{ id: "new-1", owned_by: "vendor" }, { id: "built-in" }, { id: "have-it" }]),
    alias: "groq",
    builtinIds: new Set(["built-in"]),
    upsertModels: vi.fn(async ({ models }) => ({ fetched: models.length, added: models.length, updated: 0, unchanged: 0, invalid: 0, stale: 0 })),
    ...over,
  });

  it("persists all non-built-in models with one batch call", async () => {
    const d = deps();
    const res = await syncConnectionModels(conn, d);
    expect(d.upsertModels).toHaveBeenCalledTimes(1);
    expect(d.upsertModels).toHaveBeenCalledWith(expect.objectContaining({
      providerAlias: "groq",
      connectionId: "c1",
      models: [
        { id: "new-1", name: "new-1", reported: { owned_by: "vendor" } },
        { id: "have-it", name: "have-it", reported: {} },
      ],
      authoritative: true,
    }));
    expect(res).toMatchObject({ provider: "groq", fetched: 3, added: 2 });
  });

  it("never writes when the fetch fails", async () => {
    const d = deps({ fetchModels: vi.fn(async () => { throw new Error("401"); }) });
    const res = await syncConnectionModels(conn, d);
    expect(d.upsertModels).not.toHaveBeenCalled();
    expect(res).toMatchObject({ provider: "groq", added: 0, error: "401" });
  });

  it("uses an authoritative empty custom subset when a non-empty catalog contains only built-ins", async () => {
    const d = deps({ fetchModels: vi.fn(async () => [{ id: "built-in" }]) });
    const res = await syncConnectionModels(conn, d);
    expect(d.upsertModels).toHaveBeenCalledWith(expect.objectContaining({ models: [], authoritative: true }));
    expect(res).toMatchObject({ fetched: 1 });
  });

  it("treats an empty list as a no-op, not an error", async () => {
    const d = deps({ fetchModels: vi.fn(async () => []) });
    const res = await syncConnectionModels(conn, d);
    expect(d.upsertModels).not.toHaveBeenCalled();
    expect(res).toMatchObject({ fetched: 0, added: 0 });
    expect(res.error).toBeUndefined();
  });
});
