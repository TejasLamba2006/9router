import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let catalog;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-pricing-precedence-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  db = await import("../../src/lib/db/index.js");
  catalog = await import("../../open-sse/providers/catalogOverride.js");
  await db.initDb();
  fs.writeFileSync(catalog.CATALOG_FILE, JSON.stringify({
    v: 3,
    syncedAt: 456,
    models: {},
    providers: {},
    providerMap: { codex: "openai" },
    reported: { openai: { "gpt-x": { pricing: { input: 1, output: 4 } } } },
    canonicalPricing: {},
    uniqueCanonicalBasename: {},
  }));
  catalog.invalidateCatalog();
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("pricing precedence", () => {
  it("uses synced provider pricing before hardcoded pricing", async () => {
    expect(await db.getPricingForModelWithSource("codex", "gpt-x")).toEqual({
      rates: { input: 1, output: 4 },
      source: "models.dev-provider",
      syncedAt: 456,
    });
  });

  it("manual overrides win", async () => {
    await db.updatePricing({ codex: { "gpt-x": { input: 9, output: 10 } } });
    expect(await db.getPricingForModelWithSource("codex", "gpt-x")).toEqual({
      rates: { input: 9, output: 10 },
      source: "manual",
      syncedAt: null,
    });
  });

  it("merges partial edits into an existing manual override", async () => {
    await db.updatePricing({ codex: { "gpt-x": { input: 11 } } });
    expect(await db.getManualPricing()).toMatchObject({
      codex: { "gpt-x": { input: 11, output: 10 } },
    });
    expect(await db.getPricingForModelWithSource("codex", "gpt-x")).toMatchObject({
      rates: { input: 11, output: 10 },
      source: "manual",
    });
  });

  it("merges a partial manual override over dynamic pricing", async () => {
    await db.resetPricing("codex", "gpt-x");
    await db.updatePricing({ codex: { "gpt-x": { input: 9 } } });
    expect(await db.getPricingForModelWithSource("codex", "gpt-x")).toEqual({
      rates: { input: 9, output: 4 },
      source: "manual",
      syncedAt: null,
    });
  });

  it("ignores incomplete manual pricing without a base instead of producing invalid costs", async () => {
    await db.updatePricing({ codex: { incomplete: { input: 9 } } });
    expect(await db.getPricingForModelWithSource("codex", "incomplete")).toBeNull();
  });

  it("keeps explicit free namespaces free", async () => {
    expect(await db.getPricingForModelWithSource("cline", "cline-free/deepseek-v4.1-flash")).toMatchObject({
      rates: { input: 0, output: 0 },
      source: "hardcoded",
    });
  });
});
