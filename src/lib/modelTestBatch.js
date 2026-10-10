export const AUTO_HIDE_CLASSIFICATIONS = Object.freeze([
  "hard_model_failure",
  "rate_limited",
  "timeout",
  "quota",
  "auth_or_account",
  "transient_provider",
  "content_filtered",
  "skipped",
  "inconclusive",
]);

export const DEFAULT_AUTO_HIDE_CLASSIFICATIONS = Object.freeze(["hard_model_failure"]);

function abortableWait(ms, signal) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export async function runModelTestBatch({
  models,
  cooldownMs = 5000,
  autoHideClassifications,
  autoHideHardFailures = false,
  signal,
  probe,
  hide = async () => {},
  wait = abortableWait,
  onResult = async () => {},
  onWait = async () => {},
}) {
  const results = [];
  const hideSet = new Set(
    autoHideClassifications === undefined
      ? (autoHideHardFailures ? DEFAULT_AUTO_HIDE_CLASSIFICATIONS : [])
      : autoHideClassifications
  );
  let consecutiveRateLimits = 0;
  let stopReason = null;

  for (let index = 0; index < models.length; index += 1) {
    if (signal?.aborted) { stopReason = "cancelled"; break; }
    const model = models[index];
    const result = await probe(model);
    results.push(result);

    const hideStatus = { hideAttempted: false, hidden: false, hideFailed: false };
    if (!signal?.aborted && hideSet.has(result.classification)) {
      hideStatus.hideAttempted = true;
      try {
        await hide(model);
        hideStatus.hidden = true;
      } catch {
        hideStatus.hideFailed = true;
      }
    }
    await onResult(result, index, hideStatus);

    consecutiveRateLimits = result.classification === "rate_limited" ? consecutiveRateLimits + 1 : 0;
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
