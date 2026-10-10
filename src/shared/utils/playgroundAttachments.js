// Attachment intake for the Unified Playground: classify, enforce limits, extract text.
// Records never carry data URLs; bytes live in the blob store (see playgroundStorage.js).

const MB = 1024 * 1024;

export const ATTACHMENT_LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 20 * MB,
  maxTotalBytes: 50 * MB,
  maxTextBytes: 200 * 1024,
});

// ZIP-bomb guard for OOXML. Real documents stay far below these.
const DECOMPRESSION_LIMITS = Object.freeze({ maxUncompressedBytes: 100 * MB, maxZipEntries: 2000 });

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "heic", "heif"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"]);
const OFFICE_EXT = { docx: "docx", xlsx: "xlsx", pptx: "pptx" };
const LEGACY_OFFICE_EXT = new Set(["doc", "xls", "ppt", "dot", "xlt", "pot", "pps"]);
const TEXT_EXT = new Set([
  "txt", "md", "markdown", "mdx", "rst", "log", "csv", "tsv", "json", "jsonl", "ndjson", "yaml", "yml", "toml",
  "ini", "cfg", "conf", "env", "xml", "html", "htm", "css", "scss", "sass", "less", "svg", "js", "mjs", "cjs",
  "jsx", "ts", "mts", "cts", "tsx", "vue", "svelte", "py", "pyi", "rb", "php", "java", "kt", "kts", "scala",
  "go", "rs", "c", "h", "cc", "cpp", "cxx", "hpp", "hh", "cs", "fs", "swift", "m", "mm", "dart", "lua", "pl",
  "r", "jl", "ex", "exs", "erl", "hs", "clj", "elm", "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd", "sql",
  "graphql", "gql", "proto", "tf", "hcl", "gradle", "properties", "diff", "patch", "tex", "bib", "lock",
]);
const TEXT_FILENAMES = new Set(["dockerfile", "makefile", "license", "readme", "procfile", "gemfile", ".gitignore", ".editorconfig"]);
const TEXT_MIME = /^(text\/|application\/(json|xml|javascript|x-sh|x-yaml|yaml|toml|sql|graphql)|image\/svg\+xml)/;
const LEGACY_OFFICE_MIME = /^application\/(msword|vnd\.ms-(word|excel|powerpoint))/;

const IMAGE_MIME_BY_EXT = { jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml" };

function extensionOf(name = "") {
  const base = String(name).toLowerCase().split(/[\\/]/).pop();
  const dot = base.lastIndexOf(".");
  return { base, ext: dot > 0 ? base.slice(dot + 1) : "" };
}

// Extension wins over browser-reported MIME (Windows often reports "" or octet-stream).
export function classifyAttachment({ name, type } = {}) {
  const { base, ext } = extensionOf(name);
  const mime = String(type || "").toLowerCase();

  if (LEGACY_OFFICE_EXT.has(ext) || LEGACY_OFFICE_MIME.test(mime)) return { ok: false, reason: "legacy-office" };
  if (OFFICE_EXT[ext]) return { ok: true, kind: OFFICE_EXT[ext] };
  if (ext === "pdf" || mime === "application/pdf") return { ok: true, kind: "pdf" };
  // SVG is scriptable markup: treat as text, never as a renderable image.
  if (TEXT_EXT.has(ext) || TEXT_FILENAMES.has(base) || TEXT_MIME.test(mime)) return { ok: true, kind: "text" };
  if (IMAGE_EXT.has(ext) || mime.startsWith("image/")) return { ok: true, kind: "image" };
  if (AUDIO_EXT.has(ext) || mime.startsWith("audio/")) return { ok: true, kind: "audio" };
  if (mime.includes("wordprocessingml.document")) return { ok: true, kind: "docx" };
  if (mime.includes("spreadsheetml.sheet")) return { ok: true, kind: "xlsx" };
  if (mime.includes("presentationml.presentation")) return { ok: true, kind: "pptx" };
  return { ok: false, reason: "unsupported-type" };
}

// existing: attachments already on the composer (anything with .size). Order-preserving, first-come wins.
export function validateAttachmentBatch(files, existing = [], limits = ATTACHMENT_LIMITS) {
  const accepted = [];
  const rejected = [];
  let count = existing.length;
  let total = existing.reduce((sum, item) => sum + (Number(item?.size) || 0), 0);

  for (const file of files || []) {
    const name = file?.name || "";
    const size = Number(file?.size) || 0;
    const kind = classifyAttachment(file);
    if (!kind.ok) { rejected.push({ name, reason: kind.reason }); continue; }
    if (size > limits.maxFileBytes) { rejected.push({ name, reason: "file-too-large" }); continue; }
    if (count >= limits.maxFiles) { rejected.push({ name, reason: "too-many-files" }); continue; }
    if (total + size > limits.maxTotalBytes) { rejected.push({ name, reason: "total-too-large" }); continue; }
    count += 1;
    total += size;
    accepted.push({ file, name, size, kind: kind.kind });
  }
  return { accepted, rejected };
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw signal.reason ?? new DOMException("Aborted", "AbortError");
}

// Byte-capped UTF-8 decode; stream mode drops a split trailing multi-byte char instead of emitting U+FFFD.
function capUtf8(bytes, originalBytes, maxBytes) {
  if (originalBytes <= maxBytes) return { text: new TextDecoder().decode(bytes), truncated: false };
  const text = new TextDecoder().decode(bytes.subarray(0, maxBytes), { stream: true });
  return { text, truncated: true, originalBytes };
}

const defaultLoadParser = async () => (await import("officeparser")).parseOffice;

export async function extractAttachmentText(file, { kind, signal, loadParser = defaultLoadParser, limits = ATTACHMENT_LIMITS } = {}) {
  throwIfAborted(signal);
  if (kind === "image" || kind === "audio") return { text: null, truncated: false };

  if (kind === "text") {
    const bytes = new Uint8Array(await file.slice(0, limits.maxTextBytes).arrayBuffer());
    throwIfAborted(signal);
    if (bytes.includes(0)) throw new Error(`${file.name}: looks binary, not text`);
    return capUtf8(bytes, file.size, limits.maxTextBytes);
  }

  if (kind === "pdf" || kind === "docx" || kind === "xlsx" || kind === "pptx") {
    const parseOffice = await loadParser();
    throwIfAborted(signal);
    const input = new Uint8Array(await file.arrayBuffer());
    const ast = await parseOffice(input, {
      fileType: kind,
      ocr: false,
      extractAttachments: false,
      includeRawContent: false,
      decompressionLimits: { ...DECOMPRESSION_LIMITS },
      abortSignal: signal ?? null,
    });
    throwIfAborted(signal);
    const out = await ast.to("text");
    const encoded = new TextEncoder().encode(String(out?.value ?? ""));
    return capUtf8(encoded, encoded.length, limits.maxTextBytes);
  }

  throw new Error(`Unsupported attachment kind: ${kind}`);
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// Plain JSON-safe metadata. UI renders previews from blob-store object URLs, only when previewable.
export async function createAttachmentRecord(file, { id = newId(), now = Date.now, signal, loadParser, limits = ATTACHMENT_LIMITS } = {}) {
  const classified = classifyAttachment(file);
  if (!classified.ok) throw new Error(`${file?.name}: ${classified.reason}`);
  if (file.size > limits.maxFileBytes) throw new Error(`${file.name}: file-too-large`);

  const { ext } = extensionOf(file.name);
  const extracted = await extractAttachmentText(file, { kind: classified.kind, signal, loadParser, limits });
  return {
    id,
    name: file.name,
    mimeType: file.type || IMAGE_MIME_BY_EXT[ext] || (classified.kind === "text" ? "text/plain" : "application/octet-stream"),
    size: file.size,
    kind: classified.kind,
    previewable: classified.kind === "image",
    ...extracted,
    createdAt: now(),
  };
}
