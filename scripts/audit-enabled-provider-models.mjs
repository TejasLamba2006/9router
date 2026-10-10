import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import REGISTRY from "../open-sse/providers/registry/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming"), "9router");
const db = new DatabaseSync(path.join(dataDir, "db", "data.sqlite"), { readOnly: true });
const builtInIds = new Set(REGISTRY.map((provider) => provider.id));
const customNodeIds = new Set(db.prepare("SELECT id FROM providerNodes").all().map((row) => row.id));
const rows = db.prepare("SELECT id, provider, authType, name, isActive, data FROM providerConnections WHERE isActive = 1 ORDER BY provider, priority").all();
db.close();

const providers = rows
  .filter((row) => builtInIds.has(row.provider) && !customNodeIds.has(row.provider))
  .map((row) => {
    const data = JSON.parse(row.data || "{}");
    return {
      id: row.id,
      provider: row.provider,
      authType: row.authType,
      name: row.name || null,
      hasCredential: Boolean(data.apiKey || data.accessToken || data.cookie),
    };
  });

console.log(JSON.stringify({ repoRoot, providers }, null, 2));
