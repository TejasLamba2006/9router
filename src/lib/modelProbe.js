import { getProviderCredentialsById } from "@/sse/services/auth.js";
import { checkAndRefreshToken, updateProviderCredentials } from "@/sse/services/tokenRefresh.js";
import { getSettings } from "@/lib/localDb";
import { handleChatCore } from "open-sse/handlers/chatCore.js";
import { getModelInfo } from "@/sse/services/model.js";
import { enforceModelEnabled } from "@/sse/services/modelVisibility.js";
import * as log from "@/sse/utils/logger.js";

const MODEL_FAILURE = /(?:model|deployment).{0,80}(?:not found|does not exist|unknown|unsupported|invalid)|(?:not found|unknown|unsupported|invalid).{0,80}(?:model|deployment)/i;
const RATE_LIMIT = /rate.?limit|too many requests/i;
const QUOTA = /quota|credits?|balance|billing|spending|payment required/i;
const AUTH = /invalid|expired|revoked|unauthorized|authentication|account (?:disabled|suspended|blocked)/i;
const CONTENT = /content.?filter|safety policy|blocked by policy|moderation/i;
const BOT_BLOCK = /cloudflare|captcha|bot detection|access denied/i;

export function classifyProbeResult({ ok = false, status = null, message = "", timedOut = false, networkError = false, finishReason = null } = {}) {
  const text = String(message || "");
  if (ok) return finishReason === "content_filter" ? "content_filtered" : "healthy";
  if (timedOut) return "timeout";
  if (finishReason === "content_filter" || CONTENT.test(text)) return "content_filtered";
  if (Number(status) === 429 || RATE_LIMIT.test(text)) return "rate_limited";
  if (Number(status) === 402 || QUOTA.test(text)) return "quota";
  if (Number(status) === 401 || (Number(status) === 403 && !CONTENT.test(text)) || AUTH.test(text)) return "auth_or_account";
  if (BOT_BLOCK.test(text)) return "inconclusive";
  if ([400, 404, 406].includes(Number(status)) && MODEL_FAILURE.test(text)) return "hard_model_failure";
  if (networkError || [408, 425].includes(Number(status)) || Number(status) >= 500) return "transient_provider";
  return "inconclusive";
}

export function parseRetryAfterMs(value, now = Date.now()) {
  if (value == null || value === "") return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

export function sanitizeProbeMessage(message, secrets = []) {
  let safe = String(message || "").replace(/Bearer\s+[^\s,;]+/gi, "Bearer [REDACTED]");
  for (const secret of secrets) {
    if (typeof secret === "string" && secret.length >= 4) safe = safe.split(secret).join("[REDACTED]");
  }
  return safe.replace(/[\r\n]+/g, " ").slice(0, 500);
}

export function extractProbeEvidence(payload) {
  const choice = payload?.choices?.[0];
  if (choice) {
    return {
      text: typeof choice.message?.content === "string" ? choice.message.content : "",
      finishReason: choice.finish_reason || null,
      toolCalls: choice.message?.tool_calls || [],
      reasoning: choice.message?.reasoning_content || choice.message?.reasoning || "",
      usage: payload.usage || null,
    };
  }
  if (payload?.type === "message") {
    return {
      text: (payload.content || []).filter((b) => b.type === "text").map((b) => b.text || "").join(""),
      finishReason: payload.stop_reason || null,
      toolCalls: (payload.content || []).filter((b) => b.type === "tool_use"),
      reasoning: (payload.content || []).filter((b) => b.type === "thinking").map((b) => b.thinking || "").join(""),
      usage: payload.usage || null,
    };
  }
  if (Array.isArray(payload?.output)) {
    return {
      text: payload.output.flatMap((item) => item.content || []).map((part) => part.text || "").join(""),
      finishReason: payload.status || null,
      toolCalls: payload.output.filter((item) => item.type === "function_call" || item.type === "custom_tool_call"),
      reasoning: payload.output.filter((item) => item.type === "reasoning").flatMap((item) => item.summary || []).map((part) => part.text || "").join(""),
      usage: payload.usage || null,
    };
  }
  return { text: "", finishReason: null, toolCalls: [], reasoning: "", usage: payload?.usage || null };
}

export async function runModelProbe({ provider, model, kind = "llm", connectionId, signal, timeoutMs = 30000, origin = "model_health", body }) {
  const startedAt = Date.now();
  if (kind !== "llm") {
    return { modelId: model, kind, classification: "skipped", ok: false, status: null, latencyMs: 0, retryAfterMs: 0, message: "Only LLM health probes are supported", evidence: null };
  }

  const resolved = await getModelInfo(`${provider}/${model}`);
  const hidden = await enforceModelEnabled(resolved.provider, resolved.model);
  if (hidden) {
    return { modelId: model, kind, classification: "skipped", ok: false, status: 409, latencyMs: 0, retryAfterMs: 0, message: "Model is hidden", evidence: null };
  }

  const credentials = await getProviderCredentialsById(resolved.provider, connectionId);
  if (!credentials) {
    return { modelId: model, kind, classification: "auth_or_account", ok: false, status: 404, latencyMs: Date.now() - startedAt, retryAfterMs: 0, message: "Selected connection is unavailable", evidence: null };
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const probeSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const secrets = [credentials.apiKey, credentials.accessToken, credentials.refreshToken];
  try {
    const refreshed = await checkAndRefreshToken(resolved.provider, credentials);
    const settings = await getSettings();
    const result = await handleChatCore({
      body: {
        ...(body || {
          messages: [{ role: "user", content: "Reply with exactly OK." }],
          max_tokens: 32,
          stream: false,
        }),
        model: `${resolved.provider}/${resolved.model}`,
      },
      modelInfo: resolved,
      credentials: refreshed,
      log,
      connectionId,
      sourceFormatOverride: "openai",
      clientRawRequest: { endpoint: `/internal/${origin}`, body: null, headers: {} },
      providerOverrides: (settings.providerOverrides || {})[resolved.provider] || null,
      signal: probeSignal,
      recordTelemetry: false,
      onCredentialsRefreshed: async (newCreds) => updateProviderCredentials(connectionId, {
        ...newCreds,
        existingProviderSpecificData: credentials.providerSpecificData,
      }),
    });

    if (!result.success) {
      const message = sanitizeProbeMessage(result.error, secrets);
      const timedOut = timeoutSignal.aborted && !signal?.aborted;
      return {
        modelId: model, kind, classification: classifyProbeResult({ status: result.status, message, timedOut }), ok: false,
        status: result.status || null, latencyMs: Date.now() - startedAt,
        retryAfterMs: parseRetryAfterMs(result.response?.headers?.get?.("retry-after")), message, evidence: null,
      };
    }

    const payload = await result.response.json();
    const evidence = extractProbeEvidence(payload);
    const ok = Boolean(evidence.text.trim() || evidence.toolCalls.length || evidence.reasoning);
    const classification = classifyProbeResult({ ok, status: result.response.status, finishReason: evidence.finishReason });
    return {
      modelId: model, kind, classification, ok: classification === "healthy", status: result.response.status,
      latencyMs: Date.now() - startedAt, retryAfterMs: 0,
      message: ok ? "" : "Provider returned no completion evidence", evidence,
    };
  } catch (error) {
    const timedOut = timeoutSignal.aborted && !signal?.aborted;
    const message = sanitizeProbeMessage(error?.message || error, secrets);
    return {
      modelId: model, kind,
      classification: signal?.aborted ? "skipped" : classifyProbeResult({ timedOut, networkError: !timedOut, message }),
      ok: false, status: null, latencyMs: Date.now() - startedAt, retryAfterMs: 0, message, evidence: null,
    };
  }
}
