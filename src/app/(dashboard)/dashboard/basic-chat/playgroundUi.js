// Pure UI helpers for the Unified Playground page. No React, no fetch, no DOM.
import { getDefaultSettings, PLAYGROUND_MODES } from "@/shared/utils/playgroundRequest";
import { createAttachmentRecord, validateAttachmentBatch } from "@/shared/utils/playgroundAttachments";
import { dataUrlToBlob } from "@/shared/utils/playgroundStorage";

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
  const [pathname, query] = String(path).split(/\?(.*)/s);
  if (OPERATIONS[pathname]) return `${DASHBOARD_BASE}/${OPERATIONS[pathname]}${query ? `?${query}` : ""}`;
  const poll = /^\/api\/v1\/videos\/([^/]+)$/.exec(pathname);
  if (poll && !query) return `${DASHBOARD_BASE}/video/${poll[1]}`; // already encodeURIComponent'd by the builder
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

/** UI history to OpenAI messages. dataUrls maps native attachment ids to data URLs. */
export function toApiMessages(messages, dataUrls = {}) {
  const out = [];
  for (const m of messages || []) {
    if (m.role === "user") {
      const parts = [];
      for (const a of m.attachments || []) {
        const dataUrl = dataUrls[a.id];
        if (a.kind === "image" && dataUrl) {
          parts.push({ type: "image_url", image_url: { url: dataUrl } });
        } else if (a.kind === "audio" && dataUrl) {
          const format = String(a.mimeType || "audio/wav").split("/")[1]?.replace("mpeg", "mp3") || "wav";
          parts.push({ type: "input_audio", input_audio: { data: dataUrl.slice(dataUrl.indexOf(",") + 1), format } });
        } else if (a.kind === "pdf" && a.native !== false && dataUrl) {
          parts.push({ type: "file", file: { filename: a.name, file_data: dataUrl } });
        } else if (typeof a.text === "string" && a.text) {
          parts.push({ type: "text", text: `--- ${a.name}${a.truncated ? " (truncated)" : ""} ---\n${a.text}` });
        }
      }
      const text = typeof m.content === "string" ? m.content : "";
      out.push({ role: "user", content: parts.length ? [...(text ? [{ type: "text", text }] : []), ...parts] : text });
    } else if (m.role === "assistant") {
      if (m.status === "error" || m.status === "streaming") continue;
      const calls = Array.isArray(m.tool_calls) && m.tool_calls.length ? m.tool_calls : null;
      if (!calls && !m.content) continue;
      const message = calls
        ? { role: "assistant", content: m.content ?? null, tool_calls: calls }
        : { role: "assistant", content: m.content };
      if (m.reasoning_content) message.reasoning_content = m.reasoning_content;
      out.push(message);
    } else if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.tool_call_id, content: m.content ?? "" });
    }
  }
  return out;
}

export function trimTrailingAssistant(messages) {
  const out = [...messages];
  while (out.length && out[out.length - 1].role === "assistant") out.pop();
  if (!out.length || out[out.length - 1].role !== "tool") return out;
  while (out.length && out[out.length - 1].role === "tool") out.pop();
  if (out[out.length - 1]?.role === "assistant" && out[out.length - 1].tool_calls?.length) out.pop();
  return out;
}

export function trimFromUserMessage(messages, messageId) {
  const index = (messages || []).findIndex((message) => message.id === messageId && message.role === "user");
  return index === -1 ? [...(messages || [])] : messages.slice(0, index);
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

export function applyToolResult(messages, result) {
  const existing = (messages || []).findIndex((message) => message.role === "tool" && message.tool_call_id === result.tool_call_id);
  if (existing === -1) return [...(messages || []), result];
  return messages.map((message, index) => index === existing ? result : message);
}

export function toolContinuationMessageId(messages) {
  let assistant = null;
  const answered = new Set();
  for (let index = (messages || []).length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "tool") {
      answered.add(message.tool_call_id);
      continue;
    }
    if (message.role === "assistant" && message.tool_calls?.length) assistant = message;
    break;
  }
  if (!assistant || assistant.tool_calls.some((call) => !answered.has(call.id))) return null;
  return assistant.id || null;
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
        jobs.push({ sessionId: s.id, messageId: m.id, jobId: m.job.id, pollToken: m.job.pollToken ?? null });
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

export function validateChatAttachments(attachments, caps = {}) {
  const errors = [];
  const prepared = (attachments || []).map((attachment) => {
    if (attachment.kind === "image" && caps.vision !== true) {
      errors.push(`${attachment.name} needs a vision-capable model`);
    } else if (attachment.kind === "audio" && caps.audioInput !== true) {
      errors.push(`${attachment.name} needs an audio-input-capable model`);
    } else if (attachment.kind === "pdf" && caps.pdf !== true) {
      if (attachment.text) return { ...attachment, native: false };
      errors.push(`${attachment.name} needs a PDF-capable model or extractable text`);
    }
    return attachment;
  });
  return { attachments: prepared, errors };
}

export function primaryInputForMode(mode, draft, attachments) {
  if (mode === "image" || mode === "video") return { prompt: draft };
  if (mode === "tts" || mode === "embedding") return { text: draft };
  if (mode === "stt") {
    const audio = attachments?.find((attachment) => attachment.kind === "audio" || attachment.blob);
    return { file: audio?.blob, fileName: audio?.name };
  }
  return {};
}

export async function persistGeneratedResult(result, blobStore, fetchBlob = async (url, options) => {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Media download failed (${response.status})`);
  return response.blob();
}) {
  if (!result || !blobStore) return result;
  if (result.kind === "audio" && result.blob) {
    const blobId = newId();
    await blobStore.put(blobId, result.blob);
    const { blob, src, ...rest } = result;
    return { ...rest, blobId, mimeType: blob.type || result.mimeType };
  }
  if (result.kind === "image") {
    const images = [];
    for (const image of result.images || []) {
      let blob = image.src?.startsWith?.("data:") ? dataUrlToBlob(image.src) : null;
      if (!blob && /^https?:/i.test(image.src || "")) {
        try {
          blob = await fetchBlob(image.src, { credentials: "omit", referrerPolicy: "no-referrer" });
        } catch {
          // CORS or expired URL: keep remote source as fallback.
        }
      }
      if (!blob) { images.push(image); continue; }
      const blobId = newId();
      await blobStore.put(blobId, blob);
      const { src, ...rest } = image;
      images.push({ ...rest, blobId, mimeType: blob.type });
    }
    return { ...result, images };
  }
  if (result.kind === "video") {
    const videos = [];
    for (const video of result.videos || []) {
      if (typeof video !== "string" || !/^https?:/i.test(video)) { videos.push(video); continue; }
      try {
        const blob = await fetchBlob(video, { credentials: "omit", referrerPolicy: "no-referrer" });
        const blobId = newId();
        await blobStore.put(blobId, blob);
        videos.push({ blobId, mimeType: blob.type });
      } catch {
        videos.push(video);
      }
    }
    return { ...result, videos };
  }
  return result;
}

export async function hydrateGeneratedResult(result, blobStore, createObjectUrl = URL.createObjectURL) {
  if (!result || !blobStore) return result;
  if (result.kind === "audio" && result.blobId) {
    const blob = await blobStore.get(result.blobId);
    return blob ? { ...result, src: createObjectUrl(blob) } : result;
  }
  if (result.kind === "image") {
    const images = await Promise.all((result.images || []).map(async (image) => {
      if (!image.blobId) return image;
      const blob = await blobStore.get(image.blobId);
      return blob ? { ...image, src: createObjectUrl(blob) } : image;
    }));
    return { ...result, images };
  }
  if (result.kind === "video") {
    const videos = await Promise.all((result.videos || []).map(async (video) => {
      if (!video?.blobId) return video;
      const blob = await blobStore.get(video.blobId);
      return blob ? createObjectUrl(blob) : video;
    }));
    return { ...result, videos };
  }
  return result;
}

// Media from model output: only network, blob and inline media URLs. Blocks javascript: and friends.
export function safeMediaSrc(src) {
  const s = String(src || "");
  return /^(https?:|blob:|data:(image|audio|video)\/)/i.test(s) && !/^data:image\/svg/i.test(s) ? s : null;
}
