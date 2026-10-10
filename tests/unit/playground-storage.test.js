import { describe, it, expect } from "vitest";
import {
  STORAGE_KEYS,
  BLOB_BUDGET_BYTES,
  loadSessions,
  saveSessions,
  loadSettings,
  saveSettings,
  openBlobStore,
  createMemoryBlobStore,
  dataUrlToBlob,
  collectAttachmentIds,
  migrateBasicChatSessions,
  releaseSessionBlobs,
  evictBlobs,
} from "../../src/shared/utils/playgroundStorage.js";

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

// Minimal async IndexedDB stand-in: enough surface for the raw wrapper.
function fakeIndexedDB({ failOpen = false } = {}) {
  const stores = new Map();
  const later = (fn) => setTimeout(fn, 0);
  const request = (compute) => {
    const r = {};
    later(() => {
      try { r.result = compute(); r.onsuccess?.(); } catch (e) { r.error = e; r.onerror?.(); }
    });
    return r;
  };
  const db = {
    objectStoreNames: { contains: (n) => stores.has(n) },
    createObjectStore: (n) => { stores.set(n, new Map()); },
    transaction(name) {
      const data = stores.get(name);
      const tx = {
        objectStore: () => ({
          put: (v) => request(() => { data.set(v.id, v); return v.id; }),
          get: (k) => request(() => data.get(k)),
          delete: (k) => request(() => { data.delete(k); }),
          getAll: () => request(() => [...data.values()]),
        }),
      };
      setTimeout(() => setTimeout(() => tx.oncomplete?.(), 0), 0);
      return tx;
    },
  };
  return {
    open() {
      const r = {};
      later(() => {
        if (failOpen) { r.error = new Error("blocked"); r.onerror?.(); return; }
        r.result = db;
        r.onupgradeneeded?.();
        r.onsuccess?.();
      });
      return r;
    },
  };
}

const blob = (text, type = "text/plain") => new Blob([text], { type });

describe("versioned localStorage metadata", () => {
  it("round-trips sessions under a versioned envelope and strips dataUrl", () => {
    const storage = memoryStorage();
    saveSessions(
      [{ id: "s1", messages: [{ id: "m", attachments: [{ id: "a", name: "x.png", dataUrl: "data:image/png;base64,AAAA" }] }] }],
      storage,
    );
    const raw = JSON.parse(storage.getItem(STORAGE_KEYS.sessions));
    expect(raw.version).toBe(1);
    expect(JSON.stringify(raw)).not.toMatch(/dataUrl/);
    expect(loadSessions(storage)).toEqual([{ id: "s1", messages: [{ id: "m", attachments: [{ id: "a", name: "x.png" }] }] }]);
  });

  it("returns defaults for missing, corrupt, or wrong-version data", () => {
    expect(loadSessions(memoryStorage())).toEqual([]);
    expect(loadSessions(memoryStorage({ [STORAGE_KEYS.sessions]: "{oops" }))).toEqual([]);
    expect(loadSessions(memoryStorage({ [STORAGE_KEYS.sessions]: JSON.stringify({ version: 99, sessions: [{}] }) }))).toEqual([]);
    expect(loadSessions(undefined)).toEqual([]);
  });

  it("merges settings over defaults", () => {
    const storage = memoryStorage();
    expect(loadSettings({ temperature: 1 }, storage)).toEqual({ temperature: 1 });
    expect(saveSettings({ mode: "chat" }, storage)).toBe(true);
    expect(loadSettings({ temperature: 1, mode: "x" }, storage)).toEqual({ temperature: 1, mode: "chat" });
  });

  it("reports write failure instead of throwing (quota)", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(saveSessions([], storage)).toBe(false);
    expect(saveSettings({}, undefined)).toBe(false);
  });
});

describe("blob stores", () => {
  it("IndexedDB wrapper stores, lists, and deletes blobs by attachment id", async () => {
    const store = await openBlobStore({ indexedDB: fakeIndexedDB(), now: () => 5 });
    expect(store.persistent).toBe(true);
    await store.put("a1", blob("hello"));
    expect(await (await store.get("a1")).text()).toBe("hello");
    expect(await store.list()).toEqual([{ id: "a1", size: 5, createdAt: 5 }]);
    await store.delete("a1");
    expect(await store.get("a1")).toBeNull();
  });

  it("falls back to memory when IndexedDB is missing or fails to open", async () => {
    const none = await openBlobStore({ indexedDB: null });
    expect(none.persistent).toBe(false);
    await none.put("x", blob("hi"));
    expect(await (await none.get("x")).text()).toBe("hi");
    const broken = await openBlobStore({ indexedDB: fakeIndexedDB({ failOpen: true }) });
    expect(broken.persistent).toBe(false);
  });
});

describe("dataUrlToBlob", () => {
  it("decodes base64 and percent-encoded data URLs", async () => {
    const b = dataUrlToBlob("data:image/png;base64,aGk=");
    expect(b.type).toBe("image/png");
    expect(await b.text()).toBe("hi");
    expect(await dataUrlToBlob("data:,a%20b").text()).toBe("a b");
    expect(dataUrlToBlob("https://evil/x.png")).toBeNull();
  });
});

describe("migrateBasicChatSessions", () => {
  const legacy = [
    {
      id: "s1",
      title: "Old",
      messages: [
        { id: "m1", role: "user", content: "look", attachments: [{ id: "a1", name: "p.png", type: "image/png", dataUrl: "data:image/png;base64,aGk=" }] },
        { id: "m2", role: "assistant", content: "ok" },
      ],
    },
  ];

  it("moves embedded data URLs into blobs and writes versioned sessions", async () => {
    const storage = memoryStorage({ "basic-chat.sessions": JSON.stringify(legacy) });
    const blobStore = createMemoryBlobStore();
    const result = await migrateBasicChatSessions({ storage, blobStore });

    expect(result).toEqual({ migrated: true, sessions: 1, blobs: 1 });
    expect(await (await blobStore.get("a1")).text()).toBe("hi");
    const sessions = loadSessions(storage);
    expect(sessions[0].title).toBe("Old");
    expect(sessions[0].messages[0].attachments).toEqual([
      { id: "a1", name: "p.png", mimeType: "image/png", size: 2, kind: "image" },
    ]);
    expect(JSON.stringify(storage.dump()[STORAGE_KEYS.sessions])).not.toMatch(/base64/);
    // Legacy key left for the BasicChat UI to own.
    expect(storage.getItem("basic-chat.sessions")).not.toBeNull();
  });

  it("is idempotent", async () => {
    const storage = memoryStorage({ "basic-chat.sessions": JSON.stringify(legacy) });
    const blobStore = createMemoryBlobStore();
    await migrateBasicChatSessions({ storage, blobStore });
    expect(await migrateBasicChatSessions({ storage, blobStore })).toEqual({ migrated: false, sessions: 0, blobs: 0 });
  });

  it("marks attachments missing when the data URL is unusable", async () => {
    const bad = [{ id: "s", messages: [{ id: "m", attachments: [{ id: "b", name: "x", dataUrl: "javascript:alert(1)" }] }] }];
    const storage = memoryStorage({ "basic-chat.sessions": JSON.stringify(bad) });
    const blobStore = createMemoryBlobStore();
    await migrateBasicChatSessions({ storage, blobStore });
    expect(loadSessions(storage)[0].messages[0].attachments[0]).toMatchObject({ id: "b", missing: true });
    expect(await blobStore.get("b")).toBeNull();
  });
});

describe("reference cleanup and eviction", () => {
  const session = (id, ids) => ({ id, messages: [{ id: `${id}m`, attachments: ids.map((a) => ({ id: a })) }] });

  it("collects attachment ids across sessions", () => {
    expect([...collectAttachmentIds([session("s1", ["a", "b"]), session("s2", ["c"])])].sort()).toEqual(["a", "b", "c"]);
  });

  it("releases only blobs no other session references", async () => {
    const store = createMemoryBlobStore();
    for (const id of ["a", "b"]) await store.put(id, blob(id));
    const deleted = await releaseSessionBlobs({ blobStore: store, session: session("s1", ["a", "b"]), remainingSessions: [session("s2", ["b"])] });
    expect(deleted).toEqual(["a"]);
    expect(await store.get("a")).toBeNull();
    expect(await store.get("b")).not.toBeNull();
  });

  it("evicts oldest unreferenced blobs until under budget, never referenced ones", async () => {
    let t = 0;
    const store = createMemoryBlobStore({ now: () => ++t });
    await store.put("old", blob("x".repeat(40)));
    await store.put("ref", blob("x".repeat(40)));
    await store.put("mid", blob("x".repeat(40)));
    await store.put("new", blob("x".repeat(40)));

    const result = await evictBlobs({ blobStore: store, sessions: [session("s", ["ref"])], keepIds: ["new"], maxBytes: 100 });
    expect(result).toEqual({ evicted: ["old", "mid"], totalBytes: 80, overBudget: false });

    const stuck = await evictBlobs({ blobStore: store, sessions: [session("s", ["ref"])], keepIds: ["new"], maxBytes: 10 });
    expect(stuck).toEqual({ evicted: [], totalBytes: 80, overBudget: true });
  });

  it("defaults to a ~500MB budget", () => {
    expect(BLOB_BUDGET_BYTES).toBe(500 * 1024 * 1024);
  });
});
