import { getSettings } from "@/lib/localDb";
import { getInternalHeaders } from "@/lib/internalApiAuth.js";
import {
  createPlaygroundVideoToken,
  verifyPlaygroundVideoToken,
} from "@/lib/auth/playgroundVideoToken.js";
import { buildModelsList } from "@/app/api/v1/models/route.js";
import { handleChat } from "@/sse/handlers/chat.js";
import { handleImageGeneration } from "@/sse/handlers/imageGeneration.js";
import { handleTts } from "@/sse/handlers/tts.js";
import { handleStt } from "@/sse/handlers/stt.js";
import { handleEmbeddings } from "@/sse/handlers/embeddings.js";
import { handleVideoCreate, handleVideoGet } from "@/sse/handlers/videoGeneration.js";
import { initTranslators } from "open-sse/translator/index.js";

export const MAX_PLAYGROUND_BODY_BYTES = 50 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_JOB_ID_LENGTH = 512;
const VIDEO_TOKEN_HEADER = "x-playground-video-token";

const OPERATIONS = Object.freeze({
  chat: { method: "POST", path: "/api/v1/chat/completions", kind: "llm", handler: handleChat, initialize: true },
  image: { method: "POST", path: "/api/v1/images/generations", kind: "image", handler: handleImageGeneration },
  tts: { method: "POST", path: "/api/v1/audio/speech", kind: "tts", handler: handleTts },
  stt: { method: "POST", path: "/api/v1/audio/transcriptions", kind: "stt", handler: handleStt, multipart: true },
  embedding: { method: "POST", path: "/api/v1/embeddings", kind: "embedding", handler: handleEmbeddings },
  video: { method: "POST", path: "/api/v1/videos/generations", kind: "video", handler: (request) => handleVideoCreate(request, "generations") },
});

const SAFE_HEADERS = new Set([
  "accept",
  "anthropic-beta",
  "content-type",
  "idempotency-key",
  "x-claude-code-session-id",
  "x-opencode-session",
  "x-session-id",
]);

function jsonError(error, status, extraHeaders = {}) {
  return Response.json({ error }, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extraHeaders },
  });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
  try {
    return Boolean(host) && new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

async function readBoundedBody(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PLAYGROUND_BODY_BYTES) return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PLAYGROUND_BODY_BYTES) {
      await reader.cancel("Playground body too large").catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function copySafeHeaders(request, trusted, contentType) {
  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (SAFE_HEADERS.has(name.toLowerCase())) headers.set(name, value);
  }
  headers.delete("authorization");
  headers.delete("x-api-key");
  headers.delete("x-connection-id");
  headers.delete("x-9router-connection-id");
  headers.delete("x-9r-cli-token");
  if (contentType) headers.set("content-type", contentType);
  for (const [name, value] of Object.entries(trusted)) headers.set(name, value);
  return headers;
}

function internalRequest(request, path, headers, body) {
  const url = new URL(path, request.url);
  return new Request(url, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : body,
    signal: request.signal,
  });
}

async function parseAndValidateBody(request, config, body) {
  const contentType = request.headers.get("content-type") || "";
  if (config.multipart) {
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return { error: jsonError("Multipart form data is required", 415) };
    }
    let form;
    try {
      form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body }).formData();
    } catch {
      return { error: jsonError("Invalid multipart form data", 400) };
    }
    const files = [...form.values()].filter((value) => typeof value !== "string");
    if (files.length > MAX_FILES || files.some((file) => file.size > MAX_FILE_BYTES)) {
      return { error: jsonError("Attachment limits exceeded", 413) };
    }
    if (files.length !== 1) return { error: jsonError("Transcription requires exactly one audio file", 400) };
    return { model: form.get("model"), contentType };
  }

  if (!/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    return { error: jsonError("JSON body is required", 415) };
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body));
    return { model: parsed?.model, parsed, contentType: "application/json" };
  } catch {
    return { error: jsonError("Invalid JSON body", 400) };
  }
}

async function validateModel(model, kind) {
  if (typeof model !== "string" || !model.trim()) return false;
  const models = await buildModelsList([kind]);
  return models.some((entry) => entry?.id === model);
}

function responseWithoutConnectionId(response, token = null) {
  const headers = new Headers(response.headers);
  headers.delete("x-9router-connection-id");
  headers.delete("x-connection-id");
  if (token) headers.set(VIDEO_TOKEN_HEADER, token);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function secureVideoCreateResponse(response) {
  const connectionId = response.headers.get("x-9router-connection-id");
  if (!connectionId || !response.ok) return responseWithoutConnectionId(response);

  let payload = null;
  try { payload = await response.clone().json(); } catch {}
  const jobId = payload?.request_id || payload?.id;
  if (typeof jobId !== "string" || !jobId) return responseWithoutConnectionId(response);
  const token = await createPlaygroundVideoToken({ connectionId, jobId });
  return responseWithoutConnectionId(response, token);
}

async function dispatchVideoPoll(request, jobId, trustedHeaders) {
  if (typeof jobId !== "string" || !jobId || jobId.length > MAX_JOB_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(jobId)) {
    return jsonError("Invalid video job id", 400);
  }
  const token = request.headers.get(VIDEO_TOKEN_HEADER);
  const claims = await verifyPlaygroundVideoToken(token);
  if (!claims || claims.jobId !== jobId) return jsonError("Invalid video poll token", 401);

  const headers = copySafeHeaders(request, trustedHeaders, null);
  headers.set("x-connection-id", claims.connectionId);
  const forwarded = internalRequest(request, `/api/v1/videos/${encodeURIComponent(jobId)}`, headers);
  const response = await handleVideoGet(forwarded, jobId);
  return responseWithoutConnectionId(response, token);
}

export async function dispatchPlaygroundRequest(request, operationParts) {
  const parts = Array.isArray(operationParts) ? operationParts : [];
  const operation = parts[0];
  const isVideoPoll = operation === "video" && parts.length === 2;
  const config = OPERATIONS[operation];
  if (!config || parts.length !== (isVideoPoll ? 2 : 1)) return jsonError("Playground operation not found", 404);

  const expectedMethod = isVideoPoll ? "GET" : config.method;
  if (request.method !== expectedMethod) return jsonError("Method not allowed", 405, { Allow: expectedMethod });
  if (request.method === "POST" && !sameOrigin(request)) return jsonError("Origin not allowed", 403);

  const trustedHeaders = await getInternalHeaders({ contentType: null });
  const settings = await getSettings().catch(() => null);
  if (settings?.requireApiKey && !trustedHeaders.Authorization) {
    return jsonError("No active unrestricted API key is available for Playground", 503);
  }

  if (isVideoPoll) return dispatchVideoPoll(request, parts[1], trustedHeaders);

  let body;
  try { body = await readBoundedBody(request); } catch (error) {
    if (error?.name === "AbortError") return jsonError("Request aborted", 499);
    return jsonError("Unable to read request body", 400);
  }
  if (body === null) return jsonError("Playground request exceeds 50 MB", 413);

  const parsed = await parseAndValidateBody(request, config, body);
  if (parsed.error) return parsed.error;
  if (!(await validateModel(parsed.model, config.kind))) {
    return jsonError(`Model is not available for ${operation}`, 400);
  }

  let path = config.path;
  if (operation === "tts" && typeof parsed.parsed?.response_format === "string" && /^[a-z0-9_-]{1,32}$/i.test(parsed.parsed.response_format)) {
    path += `?response_format=${encodeURIComponent(parsed.parsed.response_format)}`;
  }
  const headers = copySafeHeaders(request, trustedHeaders, parsed.contentType);
  const forwarded = internalRequest(request, path, headers, body);
  if (config.initialize) await initTranslators();
  const response = await config.handler(forwarded);
  return operation === "video" ? secureVideoCreateResponse(response) : response;
}
