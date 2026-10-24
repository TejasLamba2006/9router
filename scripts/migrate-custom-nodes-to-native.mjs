// Idempotent: re-bind public custom-compatible nodes to native providers (id === prefix).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const { PROVIDERS } = await import(pathToFileURL(path.join(root, "open-sse/config/providers.js")).href);

const KEEP = new Set(["personal", "personal2", "personal3", "personal4", "personal5", "utim", "gs"]);
const dbPath = path.join(process.env.APPDATA, "9router", "db", "data.sqlite");
const bak = dbPath + ".bak-native-migration";
if (!fs.existsSync(bak)) fs.copyFileSync(dbPath, bak);

const db = new Database(dbPath);
const nodes = db.prepare("SELECT id, data FROM providerNodes").all();
const stats = { nodes: 0, conns: 0, kv: 0, kept: [], skipped: [] };
const now = new Date().toISOString();

db.transaction(() => {
  for (const n of nodes) {
    const prefix = JSON.parse(n.data).prefix;
    if (KEEP.has(prefix)) { stats.kept.push(prefix); continue; }
    if (!PROVIDERS[prefix]) { stats.skipped.push(`${prefix} (no native provider)`); continue; }

    for (const c of db.prepare("SELECT id, data FROM providerConnections WHERE provider = ?").all(n.id)) {
      const d = JSON.parse(c.data);
      d.provider = prefix; d.authType = "apikey";
      if (d.providerSpecificData) delete d.providerSpecificData.nodeId;
      db.prepare("UPDATE providerConnections SET provider=?, authType='apikey', data=?, updatedAt=? WHERE id=?")
        .run(prefix, JSON.stringify(d), now, c.id);
      stats.conns++;
    }

    // customModels: "<nodeId>|<model>|<type>" -> "<prefix>|..." (don't overwrite existing)
    for (const r of db.prepare("SELECT key, value FROM kv WHERE scope='customModels' AND key LIKE ?").all(n.id + "|%")) {
      const v = JSON.parse(r.value); v.providerAlias = prefix;
      db.prepare("INSERT OR IGNORE INTO kv(scope,key,value) VALUES('customModels',?,?)")
        .run(prefix + r.key.slice(n.id.length), JSON.stringify(v));
      db.prepare("DELETE FROM kv WHERE scope='customModels' AND key=?").run(r.key);
      stats.kv++;
    }
    // disabledModels / pricing / liveCatalog-like: merge by key
    for (const scope of ["disabledModels", "pricing", "liveCatalog"]) {
      const r = db.prepare("SELECT value FROM kv WHERE scope=? AND key=?").get(scope, n.id);
      if (!r) continue;
      const old = JSON.parse(r.value);
      const ex = db.prepare("SELECT value FROM kv WHERE scope=? AND key=?").get(scope, prefix);
      const cur = ex ? JSON.parse(ex.value) : null;
      const merged = Array.isArray(old) ? [...new Set([...(cur || []), ...old])] : { ...old, ...(cur || {}) };
      db.prepare("INSERT OR REPLACE INTO kv(scope,key,value) VALUES(?,?,?)").run(scope, prefix, JSON.stringify(merged));
      db.prepare("DELETE FROM kv WHERE scope=? AND key=?").run(scope, n.id);
      stats.kv++;
    }
    db.prepare("DELETE FROM providerNodes WHERE id = ?").run(n.id);
    stats.nodes++;
  }
})();

const left = db.prepare("SELECT id, data FROM providerNodes").all().map((r) => JSON.parse(r.data).prefix);
console.log(`providerNodes migrated: ${stats.nodes}`);
console.log(`providerConnections re-bound: ${stats.conns}`);
console.log(`kv entries migrated: ${stats.kv}`);
console.log(`Kept as Custom Compatible (${stats.kept.length}): ${stats.kept.join(", ")}`);
console.log(`Skipped, no native provider (${stats.skipped.length}): ${stats.skipped.join(", ")}`);
console.log(`Remaining providerNodes now: ${left.join(", ")}`);
