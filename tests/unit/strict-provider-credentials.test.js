import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({ connection: null }));
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getProxyPools: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
  pickProxyPoolId: vi.fn(),
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: async () => fx.connection,
  getProviderConnections: vi.fn(),
  validateApiKey: vi.fn(),
  updateProviderConnection: vi.fn(),
  getSettings: mocks.getSettings,
  getProxyPools: mocks.getProxyPools,
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
  pickProxyPoolId: mocks.pickProxyPoolId,
}));

const { getProviderCredentialsById } = await import("../../src/sse/services/auth.js");

beforeEach(() => {
  vi.clearAllMocks();
  fx.connection = {
    id: "conn-a",
    provider: "openai",
    authType: "apikey",
    apiKey: "secret",
    isActive: true,
    name: "A",
    providerSpecificData: {},
  };
  mocks.getSettings.mockResolvedValue({
    providerStrategies: {
      opencode: { rotateStrategy: "random", proxyPoolId: "saved-pool" },
    },
  });
  mocks.getProxyPools.mockResolvedValue([
    { id: "pool-a", proxyUrl: "http://a.example" },
    { id: "pool-b", proxyUrl: "http://b.example" },
  ]);
  mocks.pickProxyPoolId.mockReturnValue("pool-b");
  mocks.resolveConnectionProxyConfig.mockResolvedValue({
    connectionProxyEnabled: true,
    connectionProxyUrl: "http://proxy:8080",
    connectionNoProxy: "localhost",
    proxyPoolId: "pool-1",
    strictProxy: true,
    vercelRelayUrl: "",
  });
});

describe("strict provider credential selection", () => {
  it("loads only the exact active matching connection", async () => {
    const credentials = await getProviderCredentialsById("openai", "conn-a");
    expect(credentials).toMatchObject({
      connectionId: "conn-a",
      apiKey: "secret",
      connectionName: "A",
      providerSpecificData: {
        connectionProxyEnabled: true,
        connectionProxyUrl: "http://proxy:8080",
        strictProxy: true,
      },
    });
  });

  it("rejects inactive, missing and provider-mismatched rows", async () => {
    fx.connection.isActive = false;
    expect(await getProviderCredentialsById("openai", "conn-a")).toBeNull();
    fx.connection = null;
    expect(await getProviderCredentialsById("openai", "conn-a")).toBeNull();
    fx.connection = { id: "conn-a", provider: "anthropic", isActive: true };
    expect(await getProviderCredentialsById("openai", "conn-a")).toBeNull();
  });

  it("uses configured proxy rotation for strict no-auth credentials", async () => {
    fx.connection = null;
    const credentials = await getProviderCredentialsById("opencode", "noauth");

    expect(mocks.pickProxyPoolId).toHaveBeenCalledWith(
      ["pool-a", "pool-b"],
      "random",
      "opencode"
    );
    expect(mocks.resolveConnectionProxyConfig).toHaveBeenCalledWith({
      proxyPoolId: "pool-b",
    });
    expect(credentials).toMatchObject({
      connectionId: "noauth",
      accessToken: "public",
      providerSpecificData: { connectionProxyEnabled: true },
    });
  });
});
