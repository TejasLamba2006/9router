import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  connection: { id: "conn-a", provider: "openai", isActive: true },
  hidden: [],
}));
const mocks = vi.hoisted(() => ({ probe: vi.fn(), disable: vi.fn() }));

vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: async () => fx.connection,
  getCustomModels: async () => [
    { providerAlias: "openai", id: "a", type: "llm" },
    { providerAlias: "openai", id: "b", type: "llm" },
    { providerAlias: "openai", id: "hidden", type: "llm" },
    { providerAlias: "openai", id: "gone", type: "llm" },
  ],
}));
vi.mock("@/shared/constants/models", () => ({ getModelsByProviderId: () => [] }));
vi.mock("@/lib/modelProbe", () => ({ runModelProbe: mocks.probe }));
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

  it("rejects cross-origin starts", async () => {
    const request = new Request("http://localhost/api/models/test-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ providerId: "openai", connectionId: "conn-a", modelIds: ["a"] }),
    });
    expect((await POST(request)).status).toBe(403);
    expect(mocks.probe).not.toHaveBeenCalled();
  });

  it("auto-hides only hard model failures", async () => {
    mocks.probe.mockResolvedValue({ modelId: "gone", classification: "hard_model_failure", ok: false, status: 404, latencyMs: 1, retryAfterMs: 0, message: "gone" });
    await run({ providerId: "openai", connectionId: "conn-a", modelIds: ["gone"], cooldownMs: 0, autoHideHardFailures: true });
    expect(mocks.disable).toHaveBeenCalledWith("openai", ["gone"]);
  });
});
