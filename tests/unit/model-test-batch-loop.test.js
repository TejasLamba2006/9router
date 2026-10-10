import { describe, expect, it, vi } from "vitest";
import {
  AUTO_HIDE_CLASSIFICATIONS,
  DEFAULT_AUTO_HIDE_CLASSIFICATIONS,
  runModelTestBatch,
} from "../../src/lib/modelTestBatch.js";

describe("model test batch loop", () => {
  it("exports all non-healthy auto-hide choices with a safe default", () => {
    expect(AUTO_HIDE_CLASSIFICATIONS).toEqual([
      "hard_model_failure", "rate_limited", "timeout", "quota", "auth_or_account",
      "transient_provider", "content_filtered", "skipped", "inconclusive",
    ]);
    expect(DEFAULT_AUTO_HIDE_CLASSIFICATIONS).toEqual(["hard_model_failure"]);
  });

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

  it("legacy auto-hide hides only hard model failures", async () => {
    const hidden = [];
    await runModelTestBatch({
      models: AUTO_HIDE_CLASSIFICATIONS,
      cooldownMs: 0,
      autoHideHardFailures: true,
      probe: async (classification) => ({ modelId: classification, classification, ok: false, retryAfterMs: 0 }),
      hide: async (model) => hidden.push(model),
      wait: async () => {},
    });
    expect(hidden).toEqual(["hard_model_failure"]);
  });

  it("hides every selected classification before emitting its result", async () => {
    const order = [];
    const events = [];
    await runModelTestBatch({
      models: ["hard_model_failure", "auth_or_account", "timeout"],
      cooldownMs: 0,
      autoHideClassifications: ["hard_model_failure", "auth_or_account"],
      probe: async (classification) => ({ modelId: classification, classification, ok: false, retryAfterMs: 0 }),
      hide: async (model) => { order.push(`hide:${model}`); },
      onResult: async (result, _index, hideStatus) => {
        order.push(`result:${result.modelId}`);
        events.push(hideStatus);
      },
      wait: async () => {},
    });
    expect(order).toEqual([
      "hide:hard_model_failure", "result:hard_model_failure",
      "hide:auth_or_account", "result:auth_or_account",
      "result:timeout",
    ]);
    expect(events).toEqual([
      { hideAttempted: true, hidden: true, hideFailed: false },
      { hideAttempted: true, hidden: true, hideFailed: false },
      { hideAttempted: false, hidden: false, hideFailed: false },
    ]);
  });

  it("an empty selection hides nothing", async () => {
    const hide = vi.fn();
    await runModelTestBatch({
      models: ["hard_model_failure"],
      cooldownMs: 0,
      autoHideClassifications: [],
      probe: async () => ({ classification: "hard_model_failure", ok: false, retryAfterMs: 0 }),
      hide,
    });
    expect(hide).not.toHaveBeenCalled();
  });

  it("reports hide failure and continues", async () => {
    const calls = [];
    const statuses = [];
    await runModelTestBatch({
      models: ["a", "b"],
      cooldownMs: 0,
      autoHideClassifications: ["hard_model_failure"],
      probe: async (model) => { calls.push(model); return { modelId: model, classification: "hard_model_failure", ok: false, retryAfterMs: 0 }; },
      hide: async (model) => { if (model === "a") throw new Error("db failed"); },
      onResult: async (_result, _index, status) => statuses.push(status),
      wait: async () => {},
    });
    expect(calls).toEqual(["a", "b"]);
    expect(statuses).toEqual([
      { hideAttempted: true, hidden: false, hideFailed: true },
      { hideAttempted: true, hidden: true, hideFailed: false },
    ]);
  });

  it("stops before hide or next model when aborted", async () => {
    const controller = new AbortController();
    const hide = vi.fn();
    const calls = [];
    const result = await runModelTestBatch({
      models: ["a", "b"],
      signal: controller.signal,
      cooldownMs: 0,
      autoHideClassifications: ["skipped", "hard_model_failure"],
      probe: async (model) => { calls.push(model); controller.abort(); return { modelId: model, classification: "skipped", ok: false, retryAfterMs: 0 }; },
      hide,
      wait: async () => {},
    });
    expect(calls).toEqual(["a"]);
    expect(hide).not.toHaveBeenCalled();
    expect(result.stopReason).toBe("cancelled");
  });
});
