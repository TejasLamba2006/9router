import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-model-sqljs-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  vi.doMock("@/lib/db/adapters/betterSqliteAdapter.js", () => {
    throw new Error("force sql.js");
  });
  vi.doMock("@/lib/db/adapters/nodeSqliteAdapter.js", () => {
    throw new Error("force sql.js");
  });
  db = await import("../../src/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  vi.doUnmock("@/lib/db/adapters/betterSqliteAdapter.js");
  vi.doUnmock("@/lib/db/adapters/nodeSqliteAdapter.js");
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("custom model sql.js parity", () => {
  it("batch-upserts and rolls back atomically", async () => {
    expect(global._dbAdapter.instance.driver).toBe("sql.js");

    await db.upsertCustomModels({
      providerAlias: "sqljs",
      connectionId: "conn-sqljs",
      models: [{ id: "a" }, { id: "b" }],
      authoritative: true,
    });
    expect((await db.getCustomModels()).filter((m) => m.providerAlias === "sqljs")).toHaveLength(2);

    const adapter = global._dbAdapter.instance;
    const originalRun = adapter.run;
    let writes = 0;
    adapter.run = (sql, params) => {
      if (sql.includes("INSERT INTO kv(scope, key, value) VALUES('customModels'")) {
        writes += 1;
        if (writes === 2) throw new Error("simulated sql.js failure");
      }
      return originalRun(sql, params);
    };
    try {
      await expect(db.upsertCustomModels({
        providerAlias: "sqljs-rollback",
        connectionId: "conn-sqljs",
        models: [{ id: "x" }, { id: "y" }],
        authoritative: true,
      })).rejects.toThrow("simulated sql.js failure");
      expect((await db.getCustomModels()).filter((m) => m.providerAlias === "sqljs-rollback")).toEqual([]);
    } finally {
      adapter.run = originalRun;
    }
  });
});
