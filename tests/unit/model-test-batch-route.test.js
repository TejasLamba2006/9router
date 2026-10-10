import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  connection: { id: "conn-a", provider: "openai", isActive: true },
  hidden: [],
}));
const mocks = vi.hoisted(() => ({ probe: vi.fn(), disable: vi.fn(), capabilityGroup: vi.fn(), persist: vi.fn() }));

vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: async () => fx.connection,
  upsertModelCapabilityEvidence: mocks.persist,
  getCustomModels: async () => [
    { providerAlias: "openai", id: "a", type: "llm" },
    { providerAlias: "openai", id: "b", type: "llm" },
    { providerAlias: "openai", id: "hidden", type: "llm" },
    { providerAlias: "openai", id: "gone", type: "llm" },
  ],
}));
vi.mock("@/shared/constants/models", () => ({ getModelsByProviderId: () => [] }));
vi.mock("@/lib/modelProbe", () => ({ runModelProbe: mocks.probe }));
vi.mock("@/lib/modelCapabilityProbe", () => ({ runModelCapabilityProbeGroup: mocks.capabilityGroup }));
vi.mock("@/sse/services/modelVisibility", () => ({
  getDisabledModelIds: async () => fx.hidden,
  disableCanonicalModels: mocks.disable,
}));

const { POST } = await import("../../src/app/api/models/test-batch/route.js");

async function run(body, signal) {
  const request = new Request("http://localhost/api/models/test-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const response = await POST(request);
  if (response.headers.get("content-type")?.includes("ndjson")) {
    const events = (await response.text()).trim().split("\n").filter(Boolean).map(JSON.parse);
    return { response, events };
  }
  return { response, json: await response.json() };
}

beforeEach(() => {
  vi.clearAllMocks();
  fx.connection = { id: "conn-a", provider: "openai", isActive: true };
  fx.hidden = [];
  mocks.probe.mockImplementation(async ({ model }) => ({ modelId: model, classification: "healthy", ok: true, status: 200, latencyMs: 1, retryAfterMs: 0, message: "" }));
  mocks.capabilityGroup.mockResolvedValue({
    text: { provider: "openai", model: "a", connectionId: "conn-a", capability: "text", outcome: "verified", checkedAt: "now", evidence: {}, probeVersion: 1 },
  });
});

describe("model test batch route", () => {
  it("uses the selected connection sequentially and excludes hidden models", async () => {
    fx.hidden = ["hidden"];
    const { response, events } = await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a", "hidden", "b"], cooldownMs: 0 });
    expect(response.status).toBe(200);
    expect(mocks.probe.mock.calls.map(([arg]) => [arg.model, arg.connectionId])).toEqual([["a", "conn-a"], ["b", "conn-a"]]);
    expect(events[0]).toMatchObject({ type: "start", total: 2, skippedHidden: 1 });
    expect(events.at(-1)).toMatchObject({ type: "done", done: 2 });
  });

  it("rejects mismatched connections and invalid cooldowns", async () => {
    fx.connection.provider = "anthropic";
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"] })).response.status).toBe(400);
    fx.connection.provider = "openai";
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], cooldownMs: 60001 })).response.status).toBe(400);
  });

  it("accepts the browser origin when Next rewrites the internal request URL host", async () => {
    const request = new Request("http://internal:3000/api/models/test-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:20128", Host: "localhost:20128" },
      body: JSON.stringify({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], cooldownMs: 0 }),
    });
    expect((await POST(request)).status).toBe(200);
  });

  it("rejects cross-origin starts", async () => {
    const request = new Request("http://internal:3000/api/models/test-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example", Host: "localhost:20128" },
      body: JSON.stringify({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"] }),
    });
    expect((await POST(request)).status).toBe(403);
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("runs and persists capability probes on the selected connection", async () => {
    const { events } = await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], cooldownMs: 0, verifyCapabilities: true });
    expect(mocks.capabilityGroup).toHaveBeenCalledWith(expect.objectContaining({
      provider: "openai", model: "a", connectionId: "conn-a",
    }));
    expect(mocks.persist).toHaveBeenCalledWith([expect.objectContaining({ capability: "text", connectionId: "conn-a" })]);
    expect(events.find((event) => event.type === "result")?.result.capabilities.text.outcome).toBe("verified");
  });

  it("does not run capability probes when basic health fails", async () => {
    mocks.probe.mockResolvedValue({ modelId: "a", classification: "rate_limited", ok: false, status: 429, latencyMs: 1, retryAfterMs: 0, message: "limited" });
    await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], cooldownMs: 0, verifyCapabilities: true });
    expect(mocks.capabilityGroup).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("validates configurable auto-hide classifications", async () => {
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], autoHideClassifications: "hard_model_failure" })).response.status).toBe(400);
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], autoHideClassifications: ["healthy"] })).response.status).toBe(400);
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], autoHideClassifications: Array(10).fill("timeout") })).response.status).toBe(400);
    expect((await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"], autoHideHardFailures: "yes" })).response.status).toBe(400);
  });

  it("auto-hides selected classifications and reports hidden immediately", async () => {
    mocks.probe.mockResolvedValue({ modelId: "a", classification: "auth_or_account", ok: false, status: 401, latencyMs: 1, retryAfterMs: 0, message: "expired" });
    const { events } = await run({
      providerId: "openai", connectionId: "conn-a", modelIds: ["a"], cooldownMs: 0,
      autoHideClassifications: ["auth_or_account", "auth_or_account"],
    });
    expect(mocks.disable).toHaveBeenCalledTimes(1);
    expect(mocks.disable).toHaveBeenCalledWith("openai", ["a"]);
    expect(events.find((event) => event.type === "result")).toMatchObject({
      hidden: true,
      hideAttempted: true,
      hideFailed: false,
    });
  });

  it("new auto-hide array overrides legacy hard-failure flag", async () => {
    mocks.probe.mockResolvedValue({ modelId: "gone", classification: "hard_model_failure", ok: false, status: 404, latencyMs: 1, retryAfterMs: 0, message: "gone" });
    await run({
      providerId: "openai", connectionId: "conn-a", modelIds: ["gone"], cooldownMs: 0,
      autoHideClassifications: [], autoHideHardFailures: true,
    });
    expect(mocks.disable).not.toHaveBeenCalled();
  });

  it("keeps legacy hard-failure auto-hide working", async () => {
    mocks.probe.mockResolvedValue({ modelId: "gone", classification: "hard_model_failure", ok: false, status: 404, latencyMs: 1, retryAfterMs: 0, message: "gone" });
    await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["gone"], cooldownMs: 0, autoHideHardFailures: true });
    expect(mocks.disable).toHaveBeenCalledWith("openai", ["gone"]);
  });
});
