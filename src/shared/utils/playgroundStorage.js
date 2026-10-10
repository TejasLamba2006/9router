// Browser persistence for the Unified Playground.
// - localStorage: small versioned JSON (sessions metadata, settings). Never bytes.
// - IndexedDB: attachment blobs keyed by attachment id. Falls back to memory when unavailable.
// Every entry point takes its storage dependency as an argument so tests (and SSR) never touch globals.

import { classifyAttachment } from "./playgroundAttachments.js";

export const STORAGE_VERSION = 1;
export const STORAGE_KEYS = Object.freeze({
  sessions: "playground.v1.sessions",
  settings: "playground.v1.settings",
  legacySessions: "basic-chat.sessions",
});
export const BLOB_BUDGET_BYTES = 500 * 1024 * 1024;

const DB_NAME = "9router-playground";
const STORE = "blobs";

const browserStorage = () => (typeof window === "undefined" ? undefined : globalThis.localStorage);

function readEnvelope(key, storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(key) ?? "null");
    return parsed?.version === STORAGE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

function writeEnvelope(key, payload, storage) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, ...payload }));
    return true;
  } catch {
    return false; // quota or privacy mode; caller decides whether to surface it
  }
}

// Defense in depth: bytes must never land in localStorage even if a caller forgets to strip them.
function stripInlineData(sessions) {
  return sessions.map((session) => ({
    ...session,
    messages: (session.messages || []).map((message) => (
      Array.isArray(message.attachments)
        ? { ...message, attachments: message.attachments.map(({ dataUrl, ...rest }) => rest) }
        : message
    )),
  }));
}

export function loadSessions(storage = browserStorage()) {
  const sessions = readEnvelope(STORAGE_KEYS.sessions, storage)?.sessions;
  return Array.isArray(sessions) ? sessions : [];
}

export function saveSessions(sessions, storage = browserStorage()) {
  return writeEnvelope(STORAGE_KEYS.sessions, { sessions: stripInlineData(sessions || []) }, storage);
}

export function loadSettings(defaults = {}, storage = browserStorage()) {
  const settings = readEnvelope(STORAGE_KEYS.settings, storage)?.settings;
  return settings && typeof settings === "object" ? { ...defaults, ...settings } : { ...defaults };
}

export function saveSettings(settings, storage = browserStorage()) {
  return writeEnvelope(STORAGE_KEYS.settings, { settings }, storage);
}

// --- blob stores: { persistent, put(id, blob), get(id) -> Blob|null, delete(id), list() -> [{id,size,createdAt}] }

export function createMemoryBlobStore({ now = Date.now } = {}) {
  const map = new Map();
  return {
    persistent: false,
    async put(id, blob) { map.set(id, { id, blob, size: blob.size, createdAt: now() }); },
    async get(id) { return map.get(id)?.blob ?? null; },
    async delete(id) { map.delete(id); },
    async list() { return [...map.values()].map(({ id, size, createdAt }) => ({ id, size, createdAt })); },
  };
}

const settle = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export async function openBlobStore({ indexedDB = globalThis.indexedDB, now = Date.now } = {}) {
  if (!indexedDB) return createMemoryBlobStore({ now });
  let db;
  try {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    db = await settle(request);
  } catch {
    return createMemoryBlobStore({ now }); // private mode / blocked / disabled
  }

  const run = async (mode, op) => {
    const tx = db.transaction(STORE, mode);
    const result = await settle(op(tx.objectStore(STORE)));
    if (mode === "readwrite") {
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return result;
  };

  return {
    persistent: true,
    put: (id, blob) => run("readwrite", (s) => s.put({ id, blob, size: blob.size, createdAt: now() })),
    get: async (id) => (await run("readonly", (s) => s.get(id)))?.blob ?? null,
    delete: (id) => run("readwrite", (s) => s.delete(id)),
    // ponytail: getAll loads blobs too; switch to a cursor over a size index if lists get slow.
    list: async () => (await run("readonly", (s) => s.getAll())).map(({ id, size, createdAt }) => ({ id, size, createdAt })),
  };
}

// Only data: URLs decode; anything else (http, javascript:, blob:) is refused.
export function dataUrlToBlob(dataUrl) {
  const match = /^data:([^,]*?),(.*)$/s.exec(String(dataUrl || ""));
  if (!match) return null;
  const meta = match[1].split(";");
  const mimeType = meta[0] || "text/plain";
  try {
    if (meta.includes("base64")) {
      const binary = atob(match[2]);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new Blob([bytes], { type: mimeType });
    }
    return new Blob([decodeURIComponent(match[2])], { type: mimeType });
  } catch {
    return null;
  }
}

export function collectAttachmentIds(sessions) {
  const ids = new Set();
  for (const session of sessions || []) {
    for (const message of session?.messages || []) {
      for (const attachment of message?.attachments || []) if (attachment?.id) ids.add(attachment.id);
    }
  }
  return ids;
}

// One-shot import of basic-chat sessions. Legacy key is left untouched for BasicChat to keep using.
export async function migrateBasicChatSessions({ storage = browserStorage(), blobStore } = {}) {
  const none = { migrated: false, sessions: 0, blobs: 0 };
  if (!storage || !blobStore || readEnvelope(STORAGE_KEYS.sessions, storage)) return none;

  let legacy;
  try { legacy = JSON.parse(storage.getItem(STORAGE_KEYS.legacySessions) ?? "null"); } catch { legacy = null; }
  if (!Array.isArray(legacy)) return none;

  let blobs = 0;
  const sessions = [];
  for (const session of legacy) {
    if (!session || typeof session !== "object") continue;
    const messages = [];
    for (const message of Array.isArray(session.messages) ? session.messages : []) {
      if (!Array.isArray(message?.attachments)) { messages.push(message); continue; }
      const attachments = [];
      for (const { dataUrl, type, ...attachment } of message.attachments) {
        const blob = dataUrlToBlob(dataUrl);
        const mimeType = blob?.type || type || "application/octet-stream";
        const kind = classifyAttachment({ name: attachment.name, type: mimeType });
        const record = { ...attachment, mimeType, size: blob?.size ?? attachment.size ?? 0, kind: kind.ok ? kind.kind : "unknown" };
        if (blob && attachment.id) {
          await blobStore.put(attachment.id, blob);
          blobs += 1;
        } else {
          record.missing = true;
        }
        attachments.push(record);
      }
      messages.push({ ...message, attachments });
    }
    sessions.push({ ...session, messages });
  }

  // Write the envelope last so a failed blob put retries the whole migration next load.
  if (!saveSessions(sessions, storage)) return none;
  return { migrated: true, sessions: sessions.length, blobs };
}

// Call after removing `session`; deletes blobs that no remaining session references.
export async function releaseSessionBlobs({ blobStore, session, remainingSessions = [] }) {
  const stillUsed = collectAttachmentIds(remainingSessions);
  const deleted = [];
  for (const id of collectAttachmentIds([session])) {
    if (stillUsed.has(id)) continue;
    await blobStore.delete(id);
    deleted.push(id);
  }
  return deleted;
}

// Evicts oldest blobs not referenced by any session (or keepIds, e.g. the pending composer) until under budget.
export async function evictBlobs({ blobStore, sessions = [], keepIds = [], maxBytes = BLOB_BUDGET_BYTES }) {
  const protectedIds = collectAttachmentIds(sessions);
  for (const id of keepIds) protectedIds.add(id);

  const entries = await blobStore.list();
  let totalBytes = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
  const evicted = [];
  const candidates = entries.filter((entry) => !protectedIds.has(entry.id)).sort((a, b) => a.createdAt - b.createdAt);
  for (const entry of candidates) {
    if (totalBytes <= maxBytes) break;
    await blobStore.delete(entry.id);
    totalBytes -= entry.size || 0;
    evicted.push(entry.id);
  }
  return { evicted, totalBytes, overBudget: totalBytes > maxBytes };
}
