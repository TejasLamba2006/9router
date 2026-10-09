import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-capability-evidence-"));
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

describe("model capability evidence repo", () => {
  it("upserts evidence by provider, model, connection, and capability", async () => {
    await db.upsertModelCapabilityEvidence([{
      provider: "claude",
      model: "claude-x",
      connectionId: "conn-a",
      capability: "text",
      outcome: "verified",
      checkedAt: "2026-10-10T00:00:00.000Z",
      latencyMs: 10,
      status: 200,
      evidence: { summary: "exact CAP_OK" },
      probeVersion: 1,
    }]);
    await db.upsertModelCapabilityEvidence([{
      provider: "claude",
      model: "claude-x",
      connectionId: "conn-a",
      capability: "text",
      outcome: "inconclusive",
      checkedAt: "2026-10-10T00:01:00.000Z",
      evidence: { summary: "wrong text" },
      probeVersion: 2,
    }]);

    const rows = await db.getModelCapabilityEvidence({ provider: "claude", model: "claude-x", connectionId: "conn-a" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ capability: "text", outcome: "inconclusive", probeVersion: 2 });
    expect(rows[0].evidence).toEqual({ summary: "wrong text" });
  });

  it("keeps evidence isolated by connection", async () => {
    await db.upsertModelCapabilityEvidence([{
      provider: "claude", model: "claude-x", connectionId: "conn-b", capability: "text",
      outcome: "verified", checkedAt: "2026-10-10T00:02:00.000Z", evidence: {}, probeVersion: 1,
    }]);
    expect(await db.getModelCapabilityEvidence({ provider: "claude", model: "claude-x", connectionId: "conn-b" })).toHaveLength(1);
    expect(await db.getModelCapabilityEvidence({ provider: "claude", model: "claude-x", connectionId: "missing" })).toEqual([]);
  });
});
