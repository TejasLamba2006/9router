import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-disabled-validation-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  db = await import("../../src/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("disabled model input validation", () => {
  it("deduplicates valid IDs", async () => {
    await db.disableModels("openai", ["a", "a", "b"]);
    expect(await db.getDisabledByProvider("openai")).toEqual(["a", "b"]);
  });

  it("rejects oversized or malformed inputs", async () => {
    await expect(db.disableModels("x".repeat(257), ["a"])).rejects.toThrow("Invalid disabled model input");
    await expect(db.disableModels("openai", ["x".repeat(513)])).rejects.toThrow("Invalid disabled model input");
    await expect(db.disableModels("openai", Array.from({ length: 1001 }, (_, i) => `m${i}`))).rejects.toThrow("Invalid disabled model input");
    await expect(db.enableModels("openai", [null])).rejects.toThrow("Invalid disabled model input");
  });
});
