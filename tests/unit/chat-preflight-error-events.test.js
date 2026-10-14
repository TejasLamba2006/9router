// Failures decided inside handleChat, before chatCore runs, must also raise a request
// error event so the dashboard toast shows them (no credentials, all accounts
// unavailable, disabled model).
import { describe, it, expect, vi, beforeEach } from "vitest";

const fx = vi.hoisted(() => ({ disabled: {}, events: [] }));
const mocks = vi.hoisted(() => ({ getProviderCredentials: vi.fn(), handleChatCore: vi.fn() }));

vi.mock("@/lib/localDb", () => ({
  getSettings: async () => ({ requireApiKey: false, comboStrategy: "fallback" }),
  getModelAliases: async () => ({}),
  getComboByName: async () => null,
  getProviderNodes: async () => [],
  getCombos: async () => [],
  getProviderConnections: async () => [],
  getProviderConnectionById: async () => null,
  getCustomModels: async () => [],
}));
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: async () => fx.disabled }));
vi.mock("@/lib/db/repos/combosRepo.js", () => ({ getCombos: async () => [] }));
vi.mock("@/lib/db/repos/apiKeysRepo.js", () => ({ getApiKeyByKey: async () => null }));
vi.mock("@/lib/usageDb.js", () => ({
  saveRequestUsage: vi.fn(),
  emitRequestError: (e) => fx.events.push(e),
}));
vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: vi.fn(async () => ({ shouldFallback: false })),
  clearAccountError: vi.fn(),
  extractApiKey: () => null,
  isValidApiKey: async () => true,
}));
vi.mock("@/sse/services/tokenRefresh.js", () => ({ checkAndRefreshToken: async (_p, c) => c, updateProviderCredentials: vi.fn() }));
vi.mock("@/sse/services/claudeExtraUsage.js", () => ({ syncClaudeExtraUsageStateAfterRequest: vi.fn() }));
vi.mock("open-sse/handlers/chatCore.js", () => ({ handleChatCore: mocks.handleChatCore }));

const { handleChat } = await import("../../src/sse/handlers/chat.js");

const req = (model) => new Request("http://localhost/v1/chat/completions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }] }),
});

beforeEach(() => {
  fx.disabled = {};
  fx.events.length = 0;
  mocks.getProviderCredentials.mockReset();
});

describe("handleChat pre-flight failures emit request errors", () => {
  it("reports missing credentials with 404 and the message the client gets", async () => {
    mocks.getProviderCredentials.mockResolvedValue(null);
    const res = await handleChat(req("openai/gpt-x"));
    expect(res.status).toBe(404);
    expect(fx.events).toHaveLength(1);
    expect(fx.events[0]).toMatchObject({ provider: "openai", model: "gpt-x", status: 404 });
    expect(fx.events[0].message).toContain("No active credentials for provider: openai");
  });

  it("reports an all-accounts-rate-limited outage with its status", async () => {
    mocks.getProviderCredentials.mockResolvedValue({ allRateLimited: true, lastError: "quota hit", retryAfter: "x", retryAfterHuman: "in 5m" });
    const res = await handleChat(req("openai/gpt-x"));
    expect(res.status).toBe(503);
    expect(fx.events).toHaveLength(1);
    expect(fx.events[0]).toMatchObject({ provider: "openai", model: "gpt-x", status: 503 });
    expect(fx.events[0].message).toContain("quota hit");
  });

  it("reports an invalid model format as 400", async () => {
    const res = await handleChat(req("not-a-model"));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fx.events.length).toBeGreaterThanOrEqual(1);
    expect(fx.events[0].status).toBe(res.status);
  });

  it("does not emit for a successful request", async () => {
    mocks.getProviderCredentials.mockResolvedValue({ connectionId: "c1", accessToken: "t" });
    mocks.handleChatCore.mockResolvedValue({ success: true, response: new Response("{}") });
    const res = await handleChat(req("openai/gpt-x"));
    expect(res.status).toBe(200);
    expect(fx.events).toHaveLength(0);
  });
});
