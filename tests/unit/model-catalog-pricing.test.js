import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let catalog;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-catalog-pricing-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  catalog = await import("../../open-sse/providers/catalogOverride.js");
});

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

function writeSnapshot(data) {
  fs.writeFileSync(catalog.CATALOG_FILE, JSON.stringify({ v: 3, syncedAt: 123, models: {}, providers: {}, ...data }));
  catalog.invalidateCatalog();
}

describe("models.dev pricing reader", () => {
  it("prefers exact provider pricing and preserves source metadata", () => {
    writeSnapshot({
      providerMap: { codex: "openai" },
      reported: {
        openai: {
          "gpt-x": { pricing: { input: 1, output: 4, cached: 0.1, cacheCreation: 1.25, reasoning: 4 }, canonicalModelId: "openai/gpt-x" },
        },
      },
      canonicalPricing: { "openai/gpt-x": { input: 2, output: 8 } },
    });
    expect(catalog.getCatalogPricing("codex", "gpt-x")).toEqual({
      rates: { input: 1, output: 4, cached: 0.1, cache_creation: 1.25, reasoning: 4 },
      source: "models.dev-provider",
      syncedAt: 123,
      upstreamProvider: "openai",
      upstreamModel: "gpt-x",
    });
  });

  it("uses canonical pricing for an unknown compatible provider", () => {
    writeSnapshot({
      reported: {
        openai: { "gpt-x": { canonicalModelId: "openai/gpt-x", pricing: { input: 2, output: 8 } } },
      },
      canonicalPricing: { "openai/gpt-x": { input: 2, output: 8 } },
      uniqueCanonicalBasename: { "gpt-x": "openai/gpt-x" },
    });
    expect(catalog.getCatalogPricing("openai-compatible-chat-custom", "gpt-x")).toMatchObject({
      rates: { input: 2, output: 8 },
      source: "models.dev-canonical",
    });
  });

  it("uses canonical reported metadata for an unknown compatible provider", () => {
    writeSnapshot({
      reported: { openai: { "gpt-x": { name: "GPT X", canonicalModelId: "openai/gpt-x" } } },
      uniqueCanonicalBasename: { "gpt-x": "openai/gpt-x" },
    });
    expect(catalog.getCatalogReported("openai-compatible-chat-custom", "gpt-x")).toMatchObject({
      name: "GPT X",
      canonicalModelId: "openai/gpt-x",
    });
  });

  it("returns null for unknown or incomplete pricing", () => {
    writeSnapshot({ reported: { openai: { bad: { pricing: { input: 1 } } } } });
    expect(catalog.getCatalogPricing("openai", "bad")).toBeNull();
    expect(catalog.getCatalogPricing("openai", "missing")).toBeNull();
  });
});
