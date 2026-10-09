import { describe, expect, it, vi } from "vitest";
import { runModelTestBatch } from "../../src/lib/modelTestBatch.js";

describe("model test batch loop", () => {
  it("runs sequentially and waits only between models", async () => {
    const calls = [];
    const waits = [];
    const result = await runModelTestBatch({
      models: ["a", "b", "c"],
      cooldownMs: 5000,
      probe: async (model) => { calls.push(model); return { modelId: model, classification: "healthy", ok: true, retryAfterMs: 0 }; },
      wait: async (ms) => { waits.push(ms); },
    });
    expect(calls).toEqual(["a", "b", "c"]);
    expect(waits).toEqual([5000, 5000]);
    expect(result.stopReason).toBeNull();
  });

  it("honors larger Retry-After and stops after three consecutive rate limits", async () => {
    const waits = [];
    const probe = vi.fn(async (model) => ({ modelId: model, classification: "rate_limited", ok: false, retryAfterMs: 9000 }));
    const result = await runModelTestBatch({
      models: ["a", "b", "c", "d"],
      cooldownMs: 5000,
      probe,
      wait: async (ms) => { waits.push(ms); },
    });
    expect(probe).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([9000, 9000]);
    expect(result.stopReason).toBe("rate_limited");
  });

  it("auto-hides only hard model failures", async () => {
    const hidden = [];
    const classifications = ["hard_model_failure", "rate_limited", "timeout", "quota", "auth_or_account", "transient_provider", "content_filtered", "inconclusive"];
    await runModelTestBatch({
      models: classifications,
      cooldownMs: 0,
      autoHideHardFailures: true,
      probe: async (classification) => ({ modelId: classification, classification, ok: false, retryAfterMs: 0 }),
      hide: async (model) => hidden.push(model),
      wait: async () => {},
    });
    expect(hidden).toEqual(["hard_model_failure"]);
  });

  it("stops before the next model when aborted", async () => {
    const controller = new AbortController();
    const calls = [];
    const result = await runModelTestBatch({
      models: ["a", "b"],
      signal: controller.signal,
      cooldownMs: 0,
      probe: async (model) => { calls.push(model); controller.abort(); return { modelId: model, classification: "healthy", ok: true, retryAfterMs: 0 }; },
      wait: async () => {},
    });
    expect(calls).toEqual(["a"]);
    expect(result.stopReason).toBe("cancelled");
  });
});
