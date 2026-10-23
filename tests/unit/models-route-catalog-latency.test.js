import { describe, it, expect, vi, beforeEach } from "vitest";

const { kv, connections, resolveKiroModels } = vi.hoisted(() => ({
  kv: new Map(),
  connections: [],
  resolveKiroModels: vi.fn(),
}));

vi.mock("@/lib/db/helpers/kvStore.js", () => ({
  makeKv: () => ({
    get: async (key, fallback = null) => (kv.has(key) ? kv.get(key) : fallback),
    set: async (key, value) => void kv.set(key, value),
    remove: async (key) => void kv.delete(key),
    getAll: async () => Object.fromEntries(kv),
    clear: async () => void kv.clear(),
  }),
}));
vi.mock("@/lib/db/repos/connectionsRepo.js", () => ({
  getProviderConnections: async () => connections,
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnections: async () => connections,
  getProviderNodes: async () => [],
  getCombos: async () => [],
  getCustomModels: async () => [],
  getModelAliases: async () => ({}),
}));
vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: async () => ({}),
}));
vi.mock("@/sse/services/modelVisibility.js", () => ({
  getDisabledModelIds: async () => [],
}));
vi.mock("@/sse/services/keyAccess.js", () => ({
  getKeyAccessContext: async () => null,
  filterModelsListForKey: (_ctx, models) => models,
}));
vi.mock("@/sse/services/tokenRefresh", () => ({
  updateProviderCredentials: vi.fn(),
  refreshGoogleToken: vi.fn(),
  refreshCodexToken: vi.fn(),
}));
vi.mock("open-sse/services/kiroModels.js", () => ({ resolveKiroModels }));

import { buildModelsList } from "@/app/api/v1/models/route.js";
import { invalidateLiveCatalog, refreshLiveCatalogs } from "@/lib/modelCatalog/liveCatalogs.js";

function kiroConnection(id) {
  return {
    id,
    provider: "kiro",
    isActive: true,
    accessToken: "kiro-token",
    providerSpecificData: {},
  };
}

beforeEach(() => {
  kv.clear();
  connections.length = 0;
  resolveKiroModels.mockReset();
  invalidateLiveCatalog();
});

describe("/v1/models - live catalog is off the request path", () => {
  it("never waits for a catalog fetch while building the list", async () => {
    connections.push(kiroConnection("no-fetch-1"));
    resolveKiroModels.mockReturnValue(new Promise(() => {}));

    const startedAt = Date.now();
    const models = await buildModelsList(["llm"]);
    const elapsed = Date.now() - startedAt;

    expect(Array.isArray(models)).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it("lists the catalogs resolved by the background pass", async () => {
    connections.push(kiroConnection("warm-1"));
    resolveKiroModels.mockResolvedValue({
      models: [{ id: "live-model", name: "Live Model" }],
    });

    await refreshLiveCatalogs();
    expect(resolveKiroModels).toHaveBeenCalledTimes(1);

    const models = await buildModelsList(["llm"]);
    expect(models.some((m) => m.id.endsWith("/live-model"))).toBe(true);
    expect(resolveKiroModels).toHaveBeenCalledTimes(1);
    expect(kv.has("live:kiro:warm-1")).toBe(true);
  });

  it("serves the persisted catalog after a restart, without refetching", async () => {
    connections.push(kiroConnection("restart-1"));
    resolveKiroModels.mockResolvedValue({
      models: [{ id: "persisted-model", name: "Persisted Model" }],
    });
    await refreshLiveCatalogs();

    invalidateLiveCatalog();
    resolveKiroModels.mockClear();

    const models = await buildModelsList(["llm"]);

    expect(models.some((m) => m.id.endsWith("/persisted-model"))).toBe(true);
    expect(resolveKiroModels).not.toHaveBeenCalled();
  });
});
