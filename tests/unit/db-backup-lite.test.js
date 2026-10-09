import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;
let backup;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-backup-lite-"));
  process.env.DATA_DIR = tempDir;
  delete global._dbAdapter;
  vi.resetModules();
  ({ initDb: db } = await import("../../src/lib/db/index.js"));
  backup = await import("../../src/lib/db/backup.js");
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("lightweight database backup", () => {
  it("copies tables declared with IF NOT EXISTS", async () => {
    await db();
    const adapter = global._dbAdapter.instance;
    const output = path.join(tempDir, "backup");
    fs.mkdirSync(output);
    expect(() => backup.backupDbLite(adapter, output)).not.toThrow();
    expect(fs.statSync(path.join(output, "data.sqlite")).size).toBeGreaterThan(0);
  });
});
