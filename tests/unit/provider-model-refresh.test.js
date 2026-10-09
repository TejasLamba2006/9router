import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  upsertCustomModels: vi.fn(),
  routeGet: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
  upsertCustomModels: mocks.upsertCustomModels,
}));
vi.mock("@/app/api/providers/[id]/models/route.js", () => ({ GET: mocks.routeGet }));

const { refreshProviderModels } = await import("../../src/lib/providerModelRefresh.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderConnections.mockResolvedValue([
    { id: "conn-1", provider: "openai-compatible-chat-test", isActive: true, providerSpecificData: { prefix: "test" } },
  ]);
  mocks.routeGet.mockResolvedValue(Response.json({
    provider: "openai-compatible-chat-test",
    connectionId: "conn-1",
    models: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    authoritative: true,
  }));
  mocks.upsertCustomModels.mockResolvedValue({ fetched: 3, added: 3, updated: 0, unchanged: 0, invalid: 0, stale: 0 });
});

describe("provider model refresh", () => {
  it("fetches once and batch-upserts once for a connection", async () => {
    const result = await refreshProviderModels({ connectionId: "conn-1" });
    expect(mocks.routeGet).toHaveBeenCalledTimes(1);
    expect(mocks.upsertCustomModels).toHaveBeenCalledTimes(1);
    expect(mocks.upsertCustomModels).toHaveBeenCalledWith(expect.objectContaining({
      providerAlias: "openai-compatible-chat-test",
      connectionId: "conn-1",
      models: [{ id: "m1", name: "m1", reported: {} }, { id: "m2", name: "m2", reported: {} }, { id: "m3", name: "m3", reported: {} }],
    }));
    expect(result[0]).toMatchObject({ fetched: 3, added: 3, stale: 0 });
  });

  it("does not write when the upstream route fails", async () => {
    mocks.routeGet.mockResolvedValue(Response.json({ error: "HTTP 401" }, { status: 401 }));
    const result = await refreshProviderModels({ connectionId: "conn-1" });
    expect(mocks.upsertCustomModels).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ added: 0, error: "HTTP 401" });
  });

  it("does not write or stale entries on an empty upstream response", async () => {
    mocks.routeGet.mockResolvedValue(Response.json({ models: [], authoritative: true }));
    const result = await refreshProviderModels({ connectionId: "conn-1" });
    expect(mocks.upsertCustomModels).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ fetched: 0, added: 0, stale: 0 });
  });

  it("imports fallback catalogs without treating them as authoritative", async () => {
    mocks.routeGet.mockResolvedValue(Response.json({
      models: [{ id: "static-fallback" }],
      warning: "Live model fetch failed; falling back to static catalog.",
      authoritative: false,
    }));
    const result = await refreshProviderModels({ connectionId: "conn-1" });
    expect(mocks.upsertCustomModels).toHaveBeenCalledWith(expect.objectContaining({
      models: [{ id: "static-fallback", name: "static-fallback", reported: {} }],
      authoritative: false,
    }));
    expect(result[0]).toMatchObject({ fetched: 1 });
  });

  it("does not persist a catalog after the request is aborted", async () => {
    const controller = new AbortController();
    mocks.routeGet.mockImplementation(async () => {
      controller.abort();
      return Response.json({ models: [{ id: "late" }] });
    });
    const result = await refreshProviderModels({ connectionId: "conn-1", signal: controller.signal });
    expect(mocks.upsertCustomModels).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ added: 0, error: "Import cancelled" });
  });

  it("coalesces duplicate refreshes for the same connection", async () => {
    let release;
    mocks.routeGet.mockImplementation(() => new Promise((resolve) => { release = () => resolve(Response.json({ models: [{ id: "m1" }], authoritative: true })); }));
    const first = refreshProviderModels({ connectionId: "conn-1" });
    const second = refreshProviderModels({ connectionId: "conn-1" });
    await vi.waitFor(() => expect(mocks.routeGet).toHaveBeenCalledTimes(1));
    release();
    await expect(Promise.all([first, second])).resolves.toEqual([
      [expect.objectContaining({ added: 3 })],
      [expect.objectContaining({ added: 3 })],
    ]);
    expect(mocks.upsertCustomModels).toHaveBeenCalledTimes(1);
  });

  it("coalesces a full refresh with a manual refresh of the same connection", async () => {
    let release;
    mocks.routeGet.mockImplementation(() => new Promise((resolve) => { release = () => resolve(Response.json({ models: [{ id: "m1" }], authoritative: true })); }));
    const full = refreshProviderModels();
    const manual = refreshProviderModels({ connectionId: "conn-1" });
    await vi.waitFor(() => expect(mocks.routeGet).toHaveBeenCalledTimes(1));
    release();
    await expect(Promise.all([full, manual])).resolves.toEqual([
      [expect.objectContaining({ added: 3 })],
      [expect.objectContaining({ added: 3 })],
    ]);
    expect(mocks.upsertCustomModels).toHaveBeenCalledTimes(1);
  });
});
