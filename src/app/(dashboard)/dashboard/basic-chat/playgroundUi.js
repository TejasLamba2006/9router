// Pure UI helpers for the Unified Playground page. No React, no fetch, no DOM.
import { getDefaultSettings, PLAYGROUND_MODES } from "@/shared/utils/playgroundRequest";
import { createAttachmentRecord, validateAttachmentBatch } from "@/shared/utils/playgroundAttachments";

export const MODE_TABS = [
  { mode: "chat", label: "Chat", icon: "chat", kindFilter: null },
  { mode: "image", label: "Image", icon: "image", kindFilter: "image" },
  { mode: "tts", label: "Speech", icon: "record_voice_over", kindFilter: "tts" },
  { mode: "stt", label: "Transcribe", icon: "mic", kindFilter: "stt" },
  { mode: "embedding", label: "Embeddings", icon: "data_array", kindFilter: "embedding" },
  { mode: "video", label: "Video", icon: "movie", kindFilter: "video" },
];

export const tabFor = (mode) => MODE_TABS.find((t) => t.mode === mode) || MODE_TABS[0];

// Modes that can bill per generation: ask once per conversation before the first run.
const CONFIRM_MODES = new Set(["image", "tts", "video"]);
export const needsConfirmation = ({ mode, confirmed } = {}) => CONFIRM_MODES.has(mode) && !confirmed;

// playgroundRequest builds /api/v1 paths; the dashboard talks to the cookie-authed proxy instead.
const DASHBOARD_BASE = "/api/dashboard/playground";
const OPERATIONS = {
  "/api/v1/chat/completions": "chat",
  "/api/v1/images/generations": "image",
  "/api/v1/audio/speech": "tts",
  "/api/v1/audio/transcriptions": "stt",
  "/api/v1/embeddings": "embedding",
  "/api/v1/videos/generations": "video",
};

export function toDashboardPath(path) {
  if (OPERATIONS[path]) return `${DASHBOARD_BASE}/${OPERATIONS[path]}`;
  const poll = /^\/api\/v1\/videos\/([^/]+)$/.exec(path);
  if (poll) return `${DASHBOARD_BASE}/video/${poll[1]}`; // already encodeURIComponent'd by the builder
  throw new Error(`No dashboard playground operation for ${path}`);
}

export function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `pg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createSession({ mode, model = "" }) {
  const now = Date.now();
  return {
    id: newId(),
    mode,
    model,
    title: `New ${tabFor(mode).label.toLowerCase()}`,
    settings: getDefaultSettings(mode),
    advanced: "",
    tools: "",
    confirmed: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function sessionTitle(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "Untitled";
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

/** UI history to OpenAI messages. dataUrls maps image attachment id to a data: URL. */
export function toApiMessages(messages, dataUrls = {}) {
  const out = [];
  for (const m of messages || []) {
    if (m.role === "user") {
      const parts = [];
      for (const a of m.attachments || []) {
        if (a.kind === "image" && dataUrls[a.id]) parts.push({ type: "image_url", image_url: { url: dataUrls[a.id] } });
        else if (a.kind === "text" && typeof a.text === "string") parts.push({ type: "text", text: `--- ${a.name} ---\n${a.text}` });
      }
      const text = typeof m.content === "string" ? m.content : "";
      out.push({ role: "user", content: parts.length ? [...(text ? [{ type: "text", text }] : []), ...parts] : text });
    } else if (m.role === "assistant") {
      if (m.status === "error" || m.status === "streaming") continue;
      const calls = Array.isArray(m.tool_calls) && m.tool_calls.length ? m.tool_calls : null;
      if (!calls && !m.content) continue;
      out.push(calls ? { role: "assistant", content: m.content ?? null, tool_calls: calls } : { role: "assistant", content: m.content });
    } else if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.tool_call_id, content: m.content ?? "" });
    }
  }
  return out;
}

export function trimTrailingAssistant(messages) {
  const out = [...messages];
  while (out.length && out[out.length - 1].role === "assistant") out.pop();
  return out;
}

/** Tool calls from the latest assistant turn that have no tool result yet. */
export function pendingToolCalls(messages) {
  const answered = new Set();
  for (let i = (messages || []).length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role === "tool") { answered.add(m.tool_call_id); continue; }
    if (m.role !== "assistant" || !Array.isArray(m.tool_calls)) return [];
    return m.tool_calls.filter((c) => c?.id && !answered.has(c.id));
  }
  return [];
}

export function parseToolsJson(text) {
  if (text == null || String(text).trim() === "") return { ok: true, value: null };
  let value;
  try { value = JSON.parse(text); } catch (err) { return { ok: false, error: `Invalid JSON: ${err.message}` }; }
  if (!Array.isArray(value)) return { ok: false, error: "Tools must be a JSON array" };
  const bad = value.findIndex((t) => !t || typeof t !== "object" || typeof t.function?.name !== "string" || !t.function.name);
  if (bad !== -1) return { ok: false, error: `Tool #${bad + 1} needs a function name` };
  return { ok: true, value };
}

export function pendingVideoJobs(sessions) {
  const jobs = [];
  for (const s of sessions || []) {
    for (const m of s.messages || []) {
      if (m.result?.kind === "video" && !m.result.done && m.job?.id) {
        jobs.push({ sessionId: s.id, messageId: m.id, jobId: m.job.id, connectionId: m.job.connectionId ?? null });
      }
    }
  }
  return jobs;
}

/**
 * Composer intake: validate the batch, extract text, keep bytes in the blob store.
 * Records are JSON-safe (no data URLs) and can be saved with the session.
 */
export async function preparePlaygroundAttachments(files, { blobStore, existing = [], only, signal } = {}) {
  const { accepted, rejected } = validateAttachmentBatch(files, existing);
  const records = [];
  const errors = [];
  for (const item of accepted) {
    if (only && item.kind !== only) { rejected.push({ name: item.name, reason: `${only}-only` }); continue; }
    try {
      const record = await createAttachmentRecord(item.file, { signal });
      await blobStore.put(record.id, item.file);
      records.push(record);
    } catch (err) {
      if (err?.name === "AbortError") throw err;
      errors.push({ name: item.name, message: err?.message || String(err) });
    }
  }
  return { records, rejected, errors };
}

/** Upgrade a stored (or migrated basic-chat) session to the current shape. */
export function normalizeLoadedSession(raw) {
  const mode = PLAYGROUND_MODES.includes(raw?.mode) ? raw.mode : "chat";
  const base = createSession({ mode, model: raw?.model || raw?.modelId || "" });
  return {
    ...base,
    ...raw,
    mode,
    model: base.model,
    settings: { ...base.settings, ...(raw?.settings || {}) },
    advanced: typeof raw?.advanced === "string" ? raw.advanced : "",
    tools: typeof raw?.tools === "string" ? raw.tools : "",
    confirmed: raw?.confirmed === true,
    messages: (Array.isArray(raw?.messages) ? raw.messages : []).map((m) => ({
      id: m.id || newId(),
      ...m,
      ...(m.status === "streaming" ? { status: "stopped" } : {}),
    })),
  };
}

// Media from model output: only network, blob and inline media URLs. Blocks javascript: and friends.
export function safeMediaSrc(src) {
  const s = String(src || "");
  return /^(https?:|blob:|data:(image|audio|video)\/)/i.test(s) && !/^data:image\/svg/i.test(s) ? s : null;
}
