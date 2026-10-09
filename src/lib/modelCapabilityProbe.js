export const MODEL_CAPABILITY_PROBE_VERSION = 1;

const RED_PNG = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGO4I2JDEmIY1TCqYfhqAAAeBCwQ8YdREQAAAABJRU5ErkJggg==";
const TRANSIENT = new Set(["rate_limited", "timeout", "quota", "auth_or_account", "transient_provider"]);
const UNSUPPORTED = /(?:not supported|unsupported|does not support|invalid).{0,80}(?:image|vision|tool|function|json|schema|reasoning)|(?:image|vision|tool|function|json|schema|reasoning).{0,80}(?:not supported|unsupported|invalid)/i;

export function buildCapabilityProbe(capability, nonce) {
  const base = { stream: false, max_tokens: 64 };
  if (capability === "text") {
    return { body: { ...base, messages: [{ role: "user", content: "Reply with exactly CAP_OK." }] } };
  }
  if (capability === "vision") {
    return { body: { ...base, messages: [{ role: "user", content: [
      { type: "text", text: "Reply with exactly RED if the image is red." },
      { type: "image_url", image_url: { url: `data:image/png;base64,${RED_PNG}` } },
    ] }] } };
  }
  if (capability === "tools") {
    const name = `cap_probe_${nonce}`;
    return { body: {
      ...base,
      messages: [{ role: "user", content: "Call the provided function with answer CAP_OK." }],
      tools: [{ type: "function", function: { name, description: "Capability probe", parameters: {
        type: "object", properties: { answer: { type: "string", const: "CAP_OK" } }, required: ["answer"], additionalProperties: false,
      } } }],
      tool_choice: { type: "function", function: { name } },
    } };
  }
  if (capability === "structuredOutput") {
    return { body: {
      ...base,
      messages: [{ role: "user", content: "Return CAP_OK in the required JSON object." }],
      response_format: { type: "json_schema", json_schema: { name: `cap_probe_${nonce}`, strict: true, schema: {
        type: "object", properties: { answer: { type: "string", const: "CAP_OK" } }, required: ["answer"], additionalProperties: false,
      } } },
    } };
  }
  if (capability === "reasoning") {
    return { body: {
      ...base,
      messages: [{ role: "user", content: "Reason briefly, then reply with exactly CAP_OK." }],
      reasoning_effort: "low",
    } };
  }
  throw new Error(`Unsupported capability probe: ${capability}`);
}

function parseToolArguments(call) {
  const args = call?.function?.arguments ?? call?.input ?? call?.arguments;
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return null; }
  }
  return args && typeof args === "object" ? args : null;
}

export function verifyCapabilityEvidence(capability, evidence = {}, nonce) {
  const text = String(evidence.text || "").trim();
  if (capability === "text") return text === "CAP_OK";
  if (capability === "vision") return text === "RED";
  if (capability === "tools") {
    return (evidence.toolCalls || []).some((call) => {
      const name = call?.function?.name || call?.name;
      return name === `cap_probe_${nonce}` && parseToolArguments(call)?.answer === "CAP_OK";
    });
  }
  if (capability === "structuredOutput") {
    try {
      const parsed = JSON.parse(text);
      return parsed?.answer === "CAP_OK" && Object.keys(parsed).length === 1;
    } catch { return false; }
  }
  if (capability === "reasoning") {
    const usage = evidence.usage || {};
    const tokens = usage.completion_tokens_details?.reasoning_tokens
      ?? usage.output_tokens_details?.reasoning_tokens
      ?? usage.reasoning_tokens;
    return Boolean(String(evidence.reasoning || "").trim()) || Number(tokens) > 0;
  }
  return false;
}

export function classifyCapabilityOutcome(result, verified) {
  if (verified) return "verified";
  if (TRANSIENT.has(result?.classification)) return "transient_failure";
  if ([400, 404, 406].includes(Number(result?.status)) && UNSUPPORTED.test(String(result?.message || ""))) return "unsupported";
  return "inconclusive";
}

function evidenceSummary(capability, result, verified) {
  if (verified) return { summary: `verified ${capability}` };
  if (result?.message) return { summary: String(result.message).slice(0, 300) };
  return {};
}

export async function runModelCapabilityProbeGroup({ provider, model, connectionId, signal, probe }) {
  const capabilities = ["text", "vision", "tools", "structuredOutput", "reasoning"];
  const nonce = Math.random().toString(36).slice(2, 10);
  const checkedAt = new Date().toISOString();
  const rows = {};
  let stopTransient = false;

  for (const capability of capabilities) {
    if (signal?.aborted) return null;
    if (stopTransient) {
      rows[capability] = {
        provider, model, connectionId, capability, outcome: "transient_failure", checkedAt,
        latencyMs: null, status: null, evidence: { summary: "Not attempted after transient failure" },
        probeVersion: MODEL_CAPABILITY_PROBE_VERSION,
      };
      continue;
    }
    const result = await probe({ capability, ...buildCapabilityProbe(capability, nonce), signal });
    if (signal?.aborted) return null;
    const verified = result.classification === "healthy"
      && verifyCapabilityEvidence(capability, result.evidence, nonce);
    const outcome = classifyCapabilityOutcome(result, verified);
    rows[capability] = {
      provider, model, connectionId, capability, outcome, checkedAt,
      latencyMs: result.latencyMs ?? null, status: result.status ?? null,
      evidence: evidenceSummary(capability, result, verified),
      probeVersion: MODEL_CAPABILITY_PROBE_VERSION,
    };
    if (outcome === "transient_failure") stopTransient = true;
  }
  return rows;
}
