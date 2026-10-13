// Layer 0 of the native web_fetch redirect, the fetch twin of webSearchIntercept.js.
// webSearchFallback.js turned the client's `web_fetch_*` server tool into the
// 9router_web_fetch function tool; when the upstream model calls it, this validates the
// URL against Anthropic's web_fetch rules, runs it through 9router's own /v1/web/fetch
// handler (credentials, combos, per-key access, SSRF guard all live there) and rewrites
// the non-streaming Claude response into server_tool_use + web_fetch_tool_result blocks.
// Fail-open: any unexpected error returns the original response untouched. Fetched page
// content and credentials are never logged.
import { getSettings } from "@/lib/localDb";
import { handleFetch } from "@/sse/handlers/fetch.js";
import { assertPublicUrlResolved } from "@/shared/utils/ssrfGuard.js";
import { FORMATS } from "../../translator/formats.js";
import { CLAUDE_BLOCK } from "../../translator/schema/index.js";
import { normalizeFetchUrl } from "../../services/webSearchFallback.js";
import { extractHandledCalls, rewriteClaudeBlocks, toRecord } from "./webSearchIntercept.js";

const MAX_URL_LENGTH = 250;
const CHARS_PER_TOKEN = 4;
// Applied when the tool declares no max_content_tokens, so one page cannot balloon the body.
const DEFAULT_MAX_CHARACTERS = 100_000;
const HARD_MAX_CHARACTERS = 400_000;

function hostMatches(host, domain) {
  const d = domain.split("/")[0];
  return host === d || host.endsWith(`.${d}`);
}

// Returns an Anthropic error_code, or null when the call may proceed.
function validateCall(rawUrl, policy, priorUrls, usesSoFar) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return "invalid_tool_input";
  if (rawUrl.length > MAX_URL_LENGTH) return "url_too_long";
  if (policy.allowedDomains && policy.blockedDomains) return "invalid_tool_input";
  const normalized = normalizeFetchUrl(rawUrl.trim());
  if (!normalized) return "invalid_tool_input";
  if (policy.maxUses && usesSoFar >= policy.maxUses) return "max_uses_exceeded";
  if (!priorUrls.includes(normalized)) return "url_not_in_prior_context";
  const host = new URL(normalized).hostname.toLowerCase();
  if (policy.allowedDomains && !policy.allowedDomains.some((d) => hostMatches(host, d))) return "url_not_allowed";
  if (policy.blockedDomains?.some((d) => hostMatches(host, d))) return "url_not_allowed";
  return null;
}

function statusToErrorCode(status) {
  if (status === 429) return "too_many_requests";
  if (status === 415 || status === 422) return "unsupported_content_type";
  if (status === 403 || status === 401) return "url_not_allowed";
  if (status === 503 || status === 502 || status === 504) return "unavailable";
  return "url_not_accessible";
}

// handleFetch reads the key from the request, so a restricted API key keeps its limits.
function internalRequest(apiKey, providerInput, url, maxCharacters) {
  return new Request("http://127.0.0.1/api/v1/web/fetch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ provider: providerInput, url, format: "markdown", max_characters: maxCharacters }),
  });
}

async function executeFetch(call, plan, apiKey, usesSoFar) {
  const { policy, priorUrls } = plan;
  const url = typeof call.args.url === "string" ? call.args.url.trim() : "";
  const invalid = validateCall(url, policy, priorUrls, usesSoFar);
  if (invalid) return { success: false, code: invalid };

  const settings = await getSettings();
  const providerInput = typeof settings.webFetchFallbackProvider === "string" ? settings.webFetchFallbackProvider.trim() : "";
  if (!providerInput) return { success: false, code: "unavailable", error: "Web fetch redirect is disabled (enable it in profile settings)" };

  try {
    await assertPublicUrlResolved(url);
  } catch {
    return { success: false, code: "url_not_allowed" };
  }

  const maxCharacters = Math.min(
    policy.maxContentTokens ? policy.maxContentTokens * CHARS_PER_TOKEN : DEFAULT_MAX_CHARACTERS,
    HARD_MAX_CHARACTERS,
  );
  const response = await handleFetch(internalRequest(apiKey, providerInput, url, maxCharacters));
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    return { success: false, code: statusToErrorCode(response.status), error: json?.error?.message || `Fetch failed (${response.status})` };
  }
  const text = typeof json?.content?.text === "string" ? json.content.text : "";
  if (!text) return { success: false, code: "unsupported_content_type", error: "No extractable content" };
  return { success: true, url, title: json.title || null, text };
}

function fetchBlocks(toolName, call, outcome, plan) {
  const id = `srvtoolu_${String(call.id).replace(/[^a-zA-Z0-9_]/g, "_")}`;
  const result = outcome.success
    ? {
        type: "web_fetch_result",
        url: outcome.url,
        content: {
          type: "document",
          source: { type: "text", media_type: "text/plain", data: outcome.text },
          title: outcome.title,
          citations: { enabled: !!plan.policy.citations },
        },
        retrieved_at: new Date().toISOString(),
      }
    : { type: "web_fetch_tool_result_error", error_code: outcome.code };
  // The text block carries the page to upstreams that drop server blocks in translation,
  // at the cost of the content appearing twice in this turn's history.
  const payload = outcome.success
    ? { success: true, url: outcome.url, title: outcome.title, content: outcome.text }
    : { success: false, error_code: outcome.code, error: outcome.error };
  return [
    { type: CLAUDE_BLOCK.SERVER_TOOL_USE, id, name: "web_fetch", input: call.args },
    { type: CLAUDE_BLOCK.WEB_FETCH_TOOL_RESULT, tool_use_id: id, content: result },
    { type: CLAUDE_BLOCK.TEXT, text: `[Skill result: ${toolName}]\n${JSON.stringify(payload)}` },
  ];
}

export async function applyWebFetchFallback({ translatedResponse, sourceFormat, fallbackPlan, apiKey, log }) {
  if (!fallbackPlan?.enabled || sourceFormat !== FORMATS.CLAUDE) return translatedResponse;
  if (!translatedResponse || typeof translatedResponse !== "object" || !Array.isArray(translatedResponse.content)) {
    return translatedResponse;
  }
  try {
    const toolName = fallbackPlan.toolName;
    const handled = extractHandledCalls(translatedResponse, sourceFormat, toolName);
    if (handled.length === 0) return translatedResponse;

    log?.debug?.("WEBFETCH", `Intercepting ${handled.length} ${toolName} call(s)`);
    const outcomes = [];
    let uses = 0;
    for (const call of handled) {
      try {
        const outcome = await executeFetch({ ...call, args: toRecord(call.args) }, fallbackPlan, apiKey, uses);
        // max_uses counts attempts that reached execution, matching Anthropic's per-request cap.
        if (outcome.code !== "max_uses_exceeded" && outcome.code !== "invalid_tool_input") uses++;
        outcomes.push(outcome);
      } catch (err) {
        outcomes.push({ success: false, code: "unavailable", error: err?.message || "Fetch execution failed" });
      }
    }
    return rewriteClaudeBlocks(
      translatedResponse,
      handled,
      (call, i) => fetchBlocks(toolName, call, outcomes[i], fallbackPlan),
      "web_fetch_requests",
    );
  } catch (err) {
    log?.warn?.("WEBFETCH", `Intercept failed, passing response through: ${err?.message}`);
    return translatedResponse;
  }
}
