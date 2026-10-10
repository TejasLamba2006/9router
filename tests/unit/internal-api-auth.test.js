import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ getApiKeys: vi.fn() }));
vi.mock("@/lib/localDb", () => db);
vi.mock("@/shared/utils/machineId", () => ({ getConsistentMachineId: vi.fn(async (salt) => `machine:${salt}`) }));

const { getInternalHeaders } = await import("../../src/lib/internalApiAuth.js");

describe("getInternalHeaders", () => {
  beforeEach(() => db.getApiKeys.mockReset());

  it("prefers an active unrestricted key and adds the CLI token", async () => {
    db.getApiKeys.mockResolvedValue([
      { key: "inactive", isActive: false },
      { key: "restricted", isActive: true, access: { restricted: true } },
      { key: "open", isActive: true },
    ]);
    const headers = await getInternalHeaders();
    expect(headers.Authorization).toBe("Bearer open");
    expect(headers["x-9r-cli-token"]).toBe("machine:9r-cli-auth");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("preserves restricted-key fallback for existing internal callers", async () => {
    db.getApiKeys.mockResolvedValue([
      { key: "restricted", isActive: true, access: { restricted: true } },
      { key: "off", isActive: false },
    ]);
    const headers = await getInternalHeaders();
    expect(headers.Authorization).toBe("Bearer restricted");
    expect(headers["x-9r-cli-token"]).toBe("machine:9r-cli-auth");
  });

  it("can require an unrestricted key for the Playground", async () => {
    db.getApiKeys.mockResolvedValue([{ key: "restricted", isActive: true, access: { restricted: true } }]);
    expect((await getInternalHeaders({ allowRestrictedFallback: false })).Authorization).toBeUndefined();
  });

  it("skips active keys with an empty value", async () => {
    db.getApiKeys.mockResolvedValue([{ key: "", isActive: true }, { key: "usable", isActive: true }]);
    expect((await getInternalHeaders()).Authorization).toBe("Bearer usable");
  });
});
