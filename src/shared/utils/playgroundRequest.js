// Unified Playground: pure request building, SSE reduction and result
// normalisation. No React, no fetch, no DOM — the client decides how to send.

export const PLAYGROUND_MODES = ["chat", "image", "tts", "stt", "embedding", "video"];

const API_BASE = "/api/v1";

const PATHS = {
  chat: "/chat/completions",
  image: "/images/generations",
  tts: "/audio/speech",
  stt: "/audio/transcriptions",
  embedding: "/embeddings",
  video: "/videos/generations",
};

const DEFAULTS = {
  chat: { stream: true, system: "", temperature: null, max_tokens: null },
  image: { n: 1, size: "1024x1024" },
  tts: { response_format: "mp3" },
  stt: { response_format: "json" },
  embedding: { encoding_format: "float" },
  video: { duration: 5, aspect_ratio: "16:9" },
};

// Keys the playground owns. Advanced JSON and settings can never set them.
const PROTECTED_KEYS = new Set([
  "model", "messages", "input", "prompt", "file", "files", "stream", "stream_options", "voice",
  "url", "endpoint", "base_url", "baseurl", "api_base", "headers", "provider",
  "connection_id", "connectionid", "x-connection-id", "x-9router-connection-id",
  "request_id", "id", "job_id", "jobid",
  "__proto__", "constructor", "prototype",
]);
const PROTECTED_PATTERN = /authorization|api[-_]?key|cookie/i;

const isProtected = (key) => PROTECTED_KEYS.has(key.toLowerCase()) || PROTECTED_PATTERN.test(key);
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function assertMode(mode) {
  if (!PLAYGROUND_MODES.includes(mode)) throw new Error(`Unknown playground mode: ${mode}`);
}

export function getDefaultSettings(mode) {
  assertMode(mode);
  return { ...DEFAULTS[mode] };
}

/** Parse the Advanced JSON textarea. Blank means {}. */
export function parseAdvancedJson(text) {
  if (text == null || String(text).trim() === "") return { ok: true, value: {} };
  let value;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }
  if (!isPlainObject(value)) return { ok: false, error: "Advanced JSON must be an object" };
  return { ok: true, value };
}

/** Merge advanced over base, skipping protected keys. Inputs are not mutated. */
export function mergeAdvanced(base, advanced = {}) {
  const body = { ...base };
  const ignored = [];
  for (const key of Object.keys(advanced || {})) {
    if (isProtected(key)) ignored.push(key);
    else body[key] = advanced[key];
  }
  return { body, ignored };
}

// Settings are UI-controlled, but still never allowed to reach protected keys.
function cleanSettings(mode, settings) {
  const out = {};
  for (const [key, value] of Object.entries({ ...DEFAULTS[mode], ...settings })) {
    if (value == null || (isProtected(key) && !(mode === "stt" && key === "prompt"))) continue;
    out[key] = value;
  }
  return out;
}

function nonEmptyText(value) {
  return typeof value === "string" ? value.trim() !== "" : false;
}

/**
 * Build a request spec for one playground run.
 * @returns {{method, path, headers, bodyType: "json"|"form", body?, formFields?, responseType: "sse"|"json"|"blob", ignored: string[]}}
 */
export function buildPlaygroundRequest({ mode, model, settings = {}, input = {}, advanced, limits = {} } = {}) {
  assertMode(mode);
  if (typeof model !== "string" || model.trim() === "") throw new Error("A model is required");

  let advancedObj = advanced;
  if (!isPlainObject(advanced)) {
    const parsed = parseAdvancedJson(advanced);
    if (!parsed.ok) throw new Error(`Advanced JSON: ${parsed.error}`);
    advancedObj = parsed.value;
  }

  const opts = cleanSettings(mode, settings);
  let base;
  let responseType = "json";

  switch (mode) {
    case "chat": {
      const messages = Array.isArray(input.messages) ? input.messages : [];
      if (messages.length === 0) throw new Error("Chat needs at least one message");
      const { system, ...rest } = opts;
      if (Number.isFinite(limits.maxOutput) && Number.isFinite(rest.max_tokens)) {
        rest.max_tokens = Math.min(rest.max_tokens, limits.maxOutput);
      }
      // stream is protected from Advanced JSON, but the UI toggle owns it.
      const isStream = settings.stream !== false;
      base = {
        ...rest,
        model,
        messages: nonEmptyText(system) ? [{ role: "system", content: system }, ...messages] : messages,
        stream: isStream,
      };
      if (isStream) base.stream_options = { include_usage: true };
      responseType = isStream ? "sse" : "json";
      break;
    }
    case "image":
    case "video":
      if (!nonEmptyText(input.prompt)) throw new Error("A prompt is required");
      base = { ...opts, model, prompt: input.prompt };
      break;
    case "tts":
      if (!nonEmptyText(input.text)) throw new Error("Some text is required");
      base = { ...opts, model, input: input.text };
      responseType = "blob";
      break;
    case "embedding": {
      const text = input.text;
      const valid = Array.isArray(text) ? text.length > 0 && text.every(nonEmptyText) : nonEmptyText(text);
      if (!valid) throw new Error("Embedding text is required");
      base = { ...opts, model, input: text };
      break;
    }
    case "stt": {
      if (!input.file) throw new Error("An audio file is required");
      const { body, ignored } = mergeAdvanced({ model, ...opts }, advancedObj);
      const formFields = Object.entries(body).map(([name, value]) => ({
        name,
        value: typeof value === "string" ? value : isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : String(value),
      }));
      formFields.push({ name: "file", value: input.file, fileName: input.fileName || input.file.name || "audio" });
      // No Content-Type: the browser must set the multipart boundary itself.
      return { method: "POST", path: API_BASE + PATHS.stt, headers: {}, bodyType: "form", formFields, responseType, ignored };
    }
  }

  const { body, ignored } = mergeAdvanced(base, advancedObj);
  return {
    method: "POST",
    path: API_BASE + PATHS[mode] + (mode === "tts" && body.response_format ? `?response_format=${encodeURIComponent(body.response_format)}` : ""),
    headers: { "Content-Type": "application/json" },
    bodyType: "json",
    body,
    responseType,
    ignored,
  };
}

/** GET spec to poll an async video job using the opaque token returned by the dashboard gateway. */
export function buildVideoPollRequest(jobId, pollToken) {
  if (typeof jobId !== "string" || jobId === "") throw new Error("A video job id is required");
  return {
    method: "GET",
    path: `${API_BASE}/videos/${encodeURIComponent(jobId)}`,
    headers: pollToken ? { "x-playground-video-token": String(pollToken) } : {},
    bodyType: "none",
    responseType: "json",
  };
}

export function toFormData(fields, FormDataCtor = globalThis.FormData) {
  const fd = new FormDataCtor();
  for (const f of fields) {
    if (f.fileName) fd.append(f.name, f.value, f.fileName);
    else fd.append(f.name, f.value);
  }
  return fd;
}

// ---- SSE ----------------------------------------------------------------

/** Split buffered SSE text into complete event data strings; `rest` is the unfinished tail. */
export function splitSseEvents(buffer) {
  const normalized = buffer.replace(/\r\n?/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop();
  const events = [];
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (data.length) events.push(data.join("\n"));
  }
  return { events, rest };
}

export function createStreamState() {
  return { content: "", reasoningContent: "", toolCalls: [], usage: null, finishReason: null, error: null, done: false, malformed: 0 };
}

function errorMessage(err) {
  if (typeof err === "string") return err;
  return err?.message || JSON.stringify(err);
}

/** Pure reducer: fold one SSE data payload into a new state. */
export function reduceStreamEvent(state, data) {
  if (data === "[DONE]") return { ...state, done: true };
  if (!data) return state;
  let chunk;
  try {
    chunk = JSON.parse(data);
  } catch {
    return { ...state, malformed: state.malformed + 1 };
  }
  if (!isPlainObject(chunk)) return state;

  const next = { ...state };
  if (chunk.error) next.error = errorMessage(chunk.error);
  if (chunk.usage) next.usage = chunk.usage;

  const choice = chunk.choices?.[0];
  if (!choice) return next;
  if (choice.finish_reason) next.finishReason = choice.finish_reason;

  const delta = choice.delta || {};
  if (typeof delta.content === "string") next.content += delta.content;
  const reasoning = delta.reasoning_content ?? delta.reasoning;
  if (typeof reasoning === "string") next.reasoningContent += reasoning;

  if (Array.isArray(delta.tool_calls)) {
    const calls = [...state.toolCalls];
    delta.tool_calls.forEach((tc, pos) => {
      const i = Number.isInteger(tc.index) ? tc.index : pos;
      const prev = calls[i] || { id: "", type: "function", function: { name: "", arguments: "" } };
      calls[i] = {
        id: tc.id || prev.id,
        type: tc.type || prev.type,
        function: {
          name: prev.function.name + (tc.function?.name || ""),
          arguments: prev.function.arguments + (tc.function?.arguments || ""),
        },
      };
    });
    next.toolCalls = calls;
  }
  return next;
}

export function reduceSseBuffer(state, buffer, final = false) {
  const split = splitSseEvents(buffer);
  let next = split.events.reduce((current, event) => reduceStreamEvent(current, event), state);
  let rest = split.rest;
  if (final && rest.trim()) {
    const data = rest.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (data.length) next = reduceStreamEvent(next, data.join("\n"));
    rest = "";
  }
  return { state: next, rest };
}

/** Assistant message to append to history after a stream ends. */
export function finalizeAssistantMessage(state) {
  const msg = { role: "assistant", content: state.content || null };
  if (state.reasoningContent) msg.reasoning_content = state.reasoningContent;
  const calls = state.toolCalls.filter(Boolean);
  if (calls.length) msg.tool_calls = calls;
  return msg;
}

/** Manual tool result the user types in reply to a tool call. */
export function buildToolResultMessage(toolCallId, result) {
  if (!toolCallId) throw new Error("tool_call_id is required");
  const content = typeof result === "string" ? result : result === undefined ? "" : JSON.stringify(result);
  return { role: "tool", tool_call_id: toolCallId, content };
}

// ---- Results ------------------------------------------------------------

const VIDEO_STATUS = {
  completed: "completed", done: "completed", succeeded: "completed",
  failed: "failed", expired: "failed", cancelled: "failed", canceled: "failed", error: "failed",
};

/**
 * Normalise a parsed response (JSON object, text, Blob, or final stream state).
 * kinds: error | chat | image | audio | text | embedding | video | json
 */
export function normalizeResponse(mode, data) {
  assertMode(mode);
  if (isPlainObject(data) && data.error) return { kind: "error", message: errorMessage(data.error) };

  switch (mode) {
    case "chat": {
      if (isPlainObject(data) && "reasoningContent" in data) {
        return { kind: "chat", message: finalizeAssistantMessage(data), finishReason: data.finishReason, usage: data.usage };
      }
      const choice = data?.choices?.[0];
      if (!choice) break;
      return { kind: "chat", message: choice.message, finishReason: choice.finish_reason ?? null, usage: data.usage ?? null };
    }
    case "image": {
      if (!isPlainObject(data)) break;
      const images = (data.data || [])
        .map((d) => ({ src: d.url || (d.b64_json ? `data:image/${d.output_format || data.output_format || "png"};base64,${d.b64_json}` : null), revisedPrompt: d.revised_prompt ?? null }))
        .filter((img) => img.src);
      return { kind: "image", images };
    }
    case "tts":
      if (data && typeof data.arrayBuffer === "function") {
        return { kind: "audio", blob: data, mimeType: data.type || "application/octet-stream" };
      }
      break;
    case "stt":
      if (typeof data === "string") return { kind: "text", text: data, raw: data };
      if (isPlainObject(data) && typeof data.text === "string") return { kind: "text", text: data.text, raw: data };
      break;
    case "embedding":
      if (!isPlainObject(data)) break;
      return {
        kind: "embedding",
        vectors: (data.data || []).map((d) => Array.isArray(d.embedding)
          ? { index: d.index, dimensions: d.embedding.length, preview: d.embedding.slice(0, 8), values: d.embedding }
          : { index: d.index, dimensions: null, preview: [], values: d.embedding }),
        usage: data.usage ?? null,
      };
    case "video": {
      if (!isPlainObject(data)) break;
      const status = VIDEO_STATUS[String(data.status || "").toLowerCase()] || "pending";
      const urls = [...(data.videos || []), data.video].map((v) => (typeof v === "string" ? v : v?.url)).filter(Boolean);
      return { kind: "video", id: data.id || data.request_id || null, status, done: status !== "pending", videos: [...new Set(urls)], error: null };
    }
  }
  return { kind: "json", data };
}
