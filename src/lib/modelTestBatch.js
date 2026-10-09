function abortableWait(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export async function runModelTestBatch({ models, cooldownMs = 5000, autoHideHardFailures = false, signal, probe, hide = async () => {}, wait = abortableWait, onResult = async () => {}, onWait = async () => {} }) {
  const results = [];
  let consecutiveRateLimits = 0;
  let stopReason = null;

  for (let index = 0; index < models.length; index += 1) {
    if (signal?.aborted) { stopReason = "cancelled"; break; }
    const model = models[index];
    const result = await probe(model);
    results.push(result);
    await onResult(result, index);

    consecutiveRateLimits = result.classification === "rate_limited" ? consecutiveRateLimits + 1 : 0;
    if (autoHideHardFailures && result.classification === "hard_model_failure") await hide(model);
    if (consecutiveRateLimits >= 3) { stopReason = "rate_limited"; break; }
    if (signal?.aborted) { stopReason = "cancelled"; break; }
    if (index < models.length - 1) {
      const delay = Math.max(cooldownMs, result.retryAfterMs || 0);
      await onWait(delay, model, index);
      await wait(delay, signal);
    }
  }

  return { results, stopReason };
}
