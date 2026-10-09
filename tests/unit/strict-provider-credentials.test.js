import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({ connection: null }));
vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: async () => fx.connection,
  getProviderConnections: vi.fn(),
  validateApiKey: vi.fn(),
  updateProviderConnection: vi.fn(),
  getSettings: vi.fn(),
  getProxyPools: vi.fn(),
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: async () => ({
    connectionProxyEnabled: true,
    connectionProxyUrl: "http://proxy:8080",
    connectionNoProxy: "localhost",
    proxyPoolId: "pool-1",
    strictProxy: true,
    vercelRelayUrl: "",
  }),
  pickProxyPoolId: vi.fn(),
}));

const { getProviderCredentialsById } = await import("../../src/sse/services/auth.js");

beforeEach(() => {
  fx.connection = {
    id: "conn-a",
    provider: "openai",
    authType: "apikey",
    apiKey: "secret",
    isActive: true,
    name: "A",
    providerSpecificData: {},
  };
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
});
