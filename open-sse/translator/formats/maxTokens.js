import { DEFAULT_MAX_TOKENS, DEFAULT_MIN_TOKENS } from "../../config/runtimeConfig.js";

/**
 * Adjust max_tokens based on request context
 * @param {object} body - Request body
 * @param {number} [ceiling=DEFAULT_MAX_TOKENS] - Upper bound for max_tokens.
 *   Callers with model context (e.g. openai-to-claude) pass the model's real
 *   maxOutput so high-output models (Opus 4.8 = 128000) aren't pre-clamped to
 *   the conservative 64000 default before the model-aware step sees them.
 * @returns {number} Adjusted max_tokens
 */
export function adjustMaxTokens(body, ceiling = DEFAULT_MAX_TOKENS) {
  let maxTokens = body.max_tokens || DEFAULT_MAX_TOKENS;

  // Auto-increase for tool calling to prevent truncated arguments (min never above max)
  if (body.tools && Array.isArray(body.tools) && body.tools.length > 0) {
    if (maxTokens < DEFAULT_MIN_TOKENS) {
      maxTokens = DEFAULT_MIN_TOKENS;
    }
  }

  // Ensure max_tokens > thinking.budget_tokens (Claude API requirement)
  // Claude API requires strictly greater, so add buffer instead of using the
  // ceiling which could equal budget_tokens when budget_tokens >= ceiling
  if (body.thinking?.budget_tokens && maxTokens <= body.thinking.budget_tokens) {
    maxTokens = body.thinking.budget_tokens + 1024;
  }

  // Never exceed the ceiling
  if (maxTokens > ceiling) maxTokens = ceiling;

  return maxTokens;
}


// gpt-5 and newer (gpt-6.1-sol, gpt-10, ...) and the o-series reject max_tokens on
// Chat Completions and want max_completion_tokens (#1745). Anchored so gpt-4o,
// gpt-oss and ids like "pro3" never match.
const MAX_COMPLETION_TOKENS_MODEL = /(?:^|\/)gpt-(?:[5-9]|\d{2,})|(?:^|\/)o[1-9]\d*(?:-|$)/i;

export function usesMaxCompletionTokens(model) {
  return typeof model === "string" && MAX_COMPLETION_TOKENS_MODEL.test(model);
}

// Rename in place; an explicit max_completion_tokens from the client wins.
export function applyMaxCompletionTokens(body, model) {
  if (!body || typeof body !== "object" || body.max_tokens === undefined) return body;
  if (!usesMaxCompletionTokens(model)) return body;
  if (body.max_completion_tokens === undefined) body.max_completion_tokens = body.max_tokens;
  delete body.max_tokens;
  return body;
}

// gpt-5.4 and newer (5.6, 6.x, ...) refuse function tools on /v1/chat/completions ("Function tools with
// reasoning_effort are not supported ... use /v1/responses"), and reject the only
// effort values that would lift it. Tool requests for them must use /v1/responses.
const RESPONSES_ONLY_TOOLS_MODEL = /(?:^|\/)gpt-(?:5[.-](?:[4-9]|\d{2,})|[6-9]|\d{2,})/i;

export function needsResponsesForTools(model, body) {
  return RESPONSES_ONLY_TOOLS_MODEL.test(model || "") && Array.isArray(body?.tools) && body.tools.length > 0;
}
