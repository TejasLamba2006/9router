import { beforeEach, describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  disabled: {},
  nodes: [{ id: "openai-compatible-chat-node", type: "openai-compatible", prefix: "mock" }],
}));

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: async () => fx.disabled,
  disableModels: vi.fn(),
  enableModels: vi.fn(),
}));
vi.mock("@/lib/localDb", () => ({
  getProviderNodes: async () => fx.nodes,
}));

const visibility = await import("../../src/sse/services/modelVisibility.js");

beforeEach(() => {
  fx.disabled = {};
});

describe("model visibility", () => {
  it("unifies provider id and registry aliases", async () => {
    fx.disabled = { cf: ["hidden"] };
    const snapshot = await visibility.createModelVisibilitySnapshot();
    expect(await visibility.isModelDisabled("cloudflare-ai", "hidden", snapshot)).toBe(true);
    expect(await visibility.isModelDisabled("cf", "hidden", snapshot)).toBe(true);
  });

  it("unifies compatible node id and prefix", async () => {
    fx.disabled = { mock: ["hidden"] };
    const snapshot = await visibility.createModelVisibilitySnapshot();
    expect(await visibility.isModelDisabled("openai-compatible-chat-node", "hidden", snapshot)).toBe(true);
  });

  it("returns exact model_disabled 409 response", async () => {
    fx.disabled = { openai: ["hidden"] };
    const response = await visibility.enforceModelEnabled("openai", "hidden");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        message: "Model 'openai/hidden' is disabled",
        type: "model_disabled",
        code: "model_disabled",
      },
    });
  });

  it("filters hidden combo seats and rejects all-hidden combos", async () => {
    fx.disabled = { openai: ["a", "b"] };
    const oneVisible = await visibility.filterEnabledModels(["openai/a", "openai/c"]);
    expect(oneVisible.models).toEqual(["openai/c"]);
    expect(oneVisible.response).toBeNull();

    const allHidden = await visibility.filterEnabledModels(["openai/a", "openai/b"], { comboName: "Main" });
    expect(allHidden.models).toEqual([]);
    expect(allHidden.response.status).toBe(409);
    expect(await allHidden.response.json()).toEqual({
      error: {
        message: "Combo 'Main' has no enabled models",
        type: "model_disabled",
        code: "model_disabled",
      },
    });
  });

  it("drops nested combos whose every seat is hidden", async () => {
    fx.disabled = { openai: ["a", "b"] };
    const combos = { Inner: ["openai/a", "openai/b"] };
    const result = await visibility.filterEnabledModels(["Inner", "openai/c"], {
      comboName: "Outer",
      resolveCombo: async (name) => combos[name] || null,
    });
    expect(result.models).toEqual(["openai/c"]);
  });
});
