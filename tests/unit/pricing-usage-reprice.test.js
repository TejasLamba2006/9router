import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let driver;

const M = 1_000_000;
const ts = new Date().toISOString();
const rows = [
  { provider: "openai", model: "gpt-4o", connectionId: "conn-a", apiKey: "sk-test-aaaaaaaaaaaa", endpoint: "/v1/chat/completions", tokens: { prompt_tokens: M, completion_tokens: M / 2 } },
  { provider: "openai", model: "gpt-4o", connectionId: "conn-b", endpoint: "/v1/responses", tokens: { prompt_tokens: 2 * M, completion_tokens: 0 } },
  { provider: "openai", model: "gpt-4o-mini", connectionId: "conn-a", endpoint: "/v1/chat/completions", tokens: { prompt_tokens: M, completion_tokens: M } },
];

const DEFAULT_4O = 2.5 + 5 + 5;
const MINI = 0.15 + 0.6;

async function readState() {
  const adapter = await driver.getAdapter();
  const history = adapter.all(`SELECT provider, model, cost, promptTokens, completionTokens, tokens FROM usageHistory ORDER BY id`);
  const days = adapter.all(`SELECT dateKey, data FROM usageDaily`).map((r) => JSON.parse(r.data));
  const kv = adapter.all(`SELECT key, value FROM kv WHERE scope = 'pricing' ORDER BY key`);
  return { history, days, kv };
}

function sumCost(map) {
  return Object.values(map || {}).reduce((s, v) => s + v.cost, 0);
}

function expectDailyMatchesHistory({ history, days }) {
  const [day] = days;
  const total = history.reduce((s, r) => s + r.cost, 0);
  expect(day.cost).toBeCloseTo(total, 9);
  for (const field of ["byProvider", "byModel", "byAccount", "byApiKey", "byEndpoint"]) {
    expect(sumCost(day[field])).toBeCloseTo(total, 9);
  }
  const fourO = history.filter((r) => r.model === "gpt-4o").reduce((s, r) => s + r.cost, 0);
  expect(day.byModel["gpt-4o|openai"].cost).toBeCloseTo(fourO, 9);
  expect(day.byModel["gpt-4o-mini|openai"].cost).toBeCloseTo(MINI, 9);
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-pricing-reprice-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  db = await import("../../src/lib/db/index.js");
  driver = await import("../../src/lib/db/driver.js");
  await db.initDb();
  for (const r of rows) await db.saveRequestUsage({ ...r, timestamp: ts });
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("pricing mutations reprice historical usage", () => {
  it("starts from default rates", async () => {
    const state = await readState();
    expect(state.history.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(DEFAULT_4O + MINI, 9);
    expectDailyMatchesHistory(state);
  });

  it("PATCH reprices only matching history and every daily cost field", async () => {
    const before = await readState();
    await db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 } } });
    const after = await readState();

    expect(after.history.map((r) => r.cost)).toEqual([
      expect.closeTo(1 + 1, 9),
      expect.closeTo(2, 9),
      expect.closeTo(MINI, 9),
    ]);
    expectDailyMatchesHistory(after);

    const stripCost = (d) => JSON.parse(JSON.stringify(d, (k, v) => (k === "cost" ? undefined : v)));
    expect(after.days.map(stripCost)).toEqual(before.days.map(stripCost));
    expect(after.history.map(({ cost, ...rest }) => rest)).toEqual(before.history.map(({ cost, ...rest }) => rest));

    const stats = await db.getUsageStats("all");
    expect(stats.totalCost).toBeCloseTo(4 + MINI, 9);
    expect(stats.byModel["gpt-4o (openai)"].cost).toBeCloseTo(4, 9);
    expect((await db.getUsageStats("24h")).totalCost).toBeCloseTo(4 + MINI, 9);
    const chart = await db.getChartData("7d");
    expect(chart.at(-1).cost).toBeCloseTo(4 + MINI, 9);
  });

  it("repeating the same price is idempotent", async () => {
    const before = await readState();
    await db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 } } });
    expect(await readState()).toEqual(before);
  });

  it("model reset restores default rates", async () => {
    await db.resetPricing("openai", "gpt-4o");
    const state = await readState();
    expect(state.history.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(DEFAULT_4O + MINI, 9);
    expectDailyMatchesHistory(state);
  });

  it("provider reset restores default rates", async () => {
    await db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 }, "gpt-4o-mini": { input: 0, output: 0 } } });
    await db.resetPricing("openai");
    const state = await readState();
    expect(state.history.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(DEFAULT_4O + MINI, 9);
    expectDailyMatchesHistory(state);
  });

  it("global reset restores default rates", async () => {
    await db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 } } });
    await db.resetAllPricing();
    const state = await readState();
    expect(state.kv).toEqual([]);
    expect(state.history.reduce((s, r) => s + r.cost, 0)).toBeCloseTo(DEFAULT_4O + MINI, 9);
    expectDailyMatchesHistory(state);
  });

  it("mid-transaction failure leaves pricing and usage unchanged", async () => {
    const before = await readState();
    const adapter = await driver.getAdapter();
    const run = adapter.run;
    adapter.run = function (sql, params) {
      if (/UPDATE\s+usageDaily|INSERT INTO usageDaily/i.test(sql)) throw new Error("boom");
      return run.call(this, sql, params);
    };
    try {
      await expect(db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 } } })).rejects.toThrow("boom");
    } finally {
      adapter.run = run;
    }
    expect(await readState()).toEqual(before);
    expect(await db.getPricingForModelWithSource("openai", "gpt-4o")).toMatchObject({ source: "hardcoded" });
  });
});

describe("pricing route model batch", () => {
  it("rejects prototype keys before mutating pricing", async () => {
    const route = await import("../../src/app/api/pricing/route.js");
    const res = await route.PATCH(new Request("http://x/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: '{"__proto__":{"polluted":{"input":1,"output":1}}}',
    }));

    expect(res.status).toBe(400);
    expect({}.polluted).toBeUndefined();
  });

  it("GET ?provider&models returns resolved rates and source per model", async () => {
    const route = await import("../../src/app/api/pricing/route.js");
    await db.updatePricing({ openai: { "gpt-4o": { input: 1, output: 2 } } });
    const res = await route.GET(new Request("http://x/api/pricing?provider=openai&models=gpt-4o&models=gpt-4o-mini&models=nope-xyz"));
    const body = await res.json();
    expect(body["gpt-4o"]).toMatchObject({ rates: { input: 1, output: 2 }, source: "manual" });
    expect(body["gpt-4o-mini"]).toMatchObject({ rates: { input: 0.15, output: 0.6 }, source: "hardcoded" });
    expect(body["nope-xyz"]).toBeNull();
    await db.resetAllPricing();
  });

  it("GET rejects oversized model batches", async () => {
    const route = await import("../../src/app/api/pricing/route.js");
    const qs = Array.from({ length: 1001 }, (_, i) => `models=m${i}`).join("&");
    const res = await route.GET(new Request(`http://x/api/pricing?provider=openai&${qs}`));
    expect(res.status).toBe(400);
  });
});
