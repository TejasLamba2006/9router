import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-model-batch-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("../../src/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  // node:sqlite keeps the file open on Windows; close the adapter before rm.
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  if (global._dbAdapter) {
    global._dbAdapter.instance = null;
    global._dbAdapter.initPromise = null;
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("custom model batch upsert", () => {
  it("writes a 1,000-model catalog in one transaction", async () => {
    const adapter = global._dbAdapter.instance;
    const originalTransaction = adapter.transaction;
    let transactions = 0;
    adapter.transaction = (fn) => {
      transactions += 1;
      return originalTransaction(fn);
    };
    try {
      const models = Array.from({ length: 1000 }, (_, i) => ({ id: `bulk-${i}` }));
      const result = await db.upsertCustomModels({
        providerAlias: "bulk",
        connectionId: "conn-bulk",
        models,
        fetchedAt: "2026-10-10T00:00:00.000Z",
      });
      expect(result).toMatchObject({ fetched: 1000, added: 1000, invalid: 0 });
      expect(transactions).toBe(1);
      expect((await db.getCustomModels()).filter((m) => m.providerAlias === "bulk")).toHaveLength(1000);
    } finally {
      adapter.transaction = originalTransaction;
    }
  });

  it("normalizes, deduplicates and writes a catalog atomically", async () => {
    const result = await db.upsertCustomModels({
      providerAlias: "personal",
      connectionId: "conn-1",
      models: [
        { id: "model-a", name: "Model A", reported: { owned_by: "vendor" } },
        { id: "model-b", name: "Model B" },
        { id: "model-a", name: "Duplicate loses" },
        { id: " " },
        null,
      ],
      fetchedAt: "2026-10-10T00:00:00.000Z",
    });

    expect(result).toEqual({ fetched: 5, added: 2, updated: 0, unchanged: 0, invalid: 2, stale: 0 });
    const models = (await db.getCustomModels()).filter((m) => m.providerAlias === "personal");
    expect(models).toHaveLength(2);
    expect(models.find((m) => m.id === "model-a")).toMatchObject({
      name: "Model A",
      source: "upstream",
      connectionId: "conn-1",
      firstSeenAt: "2026-10-10T00:00:00.000Z",
      lastSeenAt: "2026-10-10T00:00:00.000Z",
      stale: false,
      reported: { owned_by: "vendor" },
    });
  });

  it("is idempotent and preserves manual fields while refreshing upstream-owned fields", async () => {
    await db.addCustomModel({
      providerAlias: "keep",
      id: "m1",
      type: "llm",
      name: "Manual name",
      caps: { vision: true },
    });

    const first = await db.upsertCustomModels({
      providerAlias: "keep",
      connectionId: "conn-2",
      models: [{ id: "m1", name: "Upstream name", created: 123 }],
      fetchedAt: "2026-10-10T01:00:00.000Z",
    });
    const second = await db.upsertCustomModels({
      providerAlias: "keep",
      connectionId: "conn-2",
      models: [{ id: "m1", name: "Upstream name", created: 123 }],
      fetchedAt: "2026-10-10T01:05:00.000Z",
    });

    expect(first).toMatchObject({ added: 0, updated: 1, stale: 0 });
    // Refreshing only lastSeenAt is a successful unchanged record, not a
    // metadata update shown as "Updated" in the dashboard summary.
    expect(second).toMatchObject({ added: 0, updated: 0, unchanged: 1, stale: 0 });
    const model = (await db.getCustomModels()).find((m) => m.providerAlias === "keep" && m.id === "m1");
    expect(model.name).toBe("Manual name");
    expect(model.caps).toEqual({ vision: true });
    expect(model.reported).toEqual({ created: 123 });
    expect(model.source).toBe("manual");
    expect(model.lastSeenAt).toBe("2026-10-10T01:05:00.000Z");
  });

  it("marks only absent upstream models stale and clears stale on reappearance", async () => {
    await db.upsertCustomModels({
      providerAlias: "stale-test",
      connectionId: "conn-3",
      models: [{ id: "a" }, { id: "b" }],
      fetchedAt: "2026-10-10T02:00:00.000Z",
    });
    const missing = await db.upsertCustomModels({
      providerAlias: "stale-test",
      connectionId: "conn-3",
      models: [{ id: "a" }],
      fetchedAt: "2026-10-10T03:00:00.000Z",
    });
    expect(missing.stale).toBe(1);
    let models = (await db.getCustomModels()).filter((m) => m.providerAlias === "stale-test");
    expect(models.find((m) => m.id === "a").stale).toBe(false);
    expect(models.find((m) => m.id === "b")).toMatchObject({
      stale: true,
      lastSeenAt: "2026-10-10T02:00:00.000Z",
    });

    const back = await db.upsertCustomModels({
      providerAlias: "stale-test",
      connectionId: "conn-3",
      models: [{ id: "a" }, { id: "b" }],
      fetchedAt: "2026-10-10T04:00:00.000Z",
    });
    expect(back).toMatchObject({ updated: 1, unchanged: 1 });
    models = (await db.getCustomModels()).filter((m) => m.providerAlias === "stale-test");
    expect(models.every((m) => m.stale === false)).toBe(true);
  });

  it("does not mark models discovered through another connection stale", async () => {
    await db.upsertCustomModels({
      providerAlias: "multi-account",
      connectionId: "conn-a",
      models: [{ id: "only-a" }],
      fetchedAt: "2026-10-10T04:30:00.000Z",
    });
    await db.upsertCustomModels({
      providerAlias: "multi-account",
      connectionId: "conn-b",
      models: [{ id: "only-b" }],
      fetchedAt: "2026-10-10T04:31:00.000Z",
    });

    const result = await db.upsertCustomModels({
      providerAlias: "multi-account",
      connectionId: "conn-a",
      models: [{ id: "only-a" }],
      fetchedAt: "2026-10-10T04:32:00.000Z",
    });
    expect(result.stale).toBe(0);
    const other = (await db.getCustomModels()).find((m) => m.providerAlias === "multi-account" && m.id === "only-b");
    expect(other.stale).toBe(false);
  });

  it("treats an empty catalog as non-authoritative and changes nothing", async () => {
    await db.upsertCustomModels({
      providerAlias: "empty-test",
      connectionId: "conn-4",
      models: [{ id: "keep" }],
      fetchedAt: "2026-10-10T05:00:00.000Z",
    });
    const result = await db.upsertCustomModels({
      providerAlias: "empty-test",
      connectionId: "conn-4",
      models: [],
      fetchedAt: "2026-10-10T06:00:00.000Z",
    });
    expect(result).toEqual({ fetched: 0, added: 0, updated: 0, unchanged: 0, invalid: 0, stale: 0 });
    const model = (await db.getCustomModels()).find((m) => m.providerAlias === "empty-test" && m.id === "keep");
    expect(model.stale).toBe(false);
    expect(model.lastSeenAt).toBe("2026-10-10T05:00:00.000Z");
  });

  it("can mark all prior imports stale when a non-empty authoritative catalog has no custom ids", async () => {
    await db.upsertCustomModels({
      providerAlias: "builtin-only",
      connectionId: "conn-5",
      models: [{ id: "old-custom" }],
      fetchedAt: "2026-10-10T06:30:00.000Z",
    });
    const result = await db.upsertCustomModels({
      providerAlias: "builtin-only",
      connectionId: "conn-5",
      models: [],
      authoritative: true,
      fetchedAt: "2026-10-10T07:00:00.000Z",
    });
    expect(result.stale).toBe(1);
    const model = (await db.getCustomModels()).find((m) => m.providerAlias === "builtin-only" && m.id === "old-custom");
    expect(model.stale).toBe(true);
  });
});
