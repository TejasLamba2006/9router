// Server-side driver for the model refresh: walks the active connections, asks
// each provider for its live model list through the existing per-connection
// route (so every provider-specific fetcher is reused) and stores the new ones.

import { getProviderConnections, upsertCustomModels } from "@/lib/localDb";
import { getProviderAlias, isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";
import { syncConnectionModels } from "@/lib/providerModelSync";

let running = null;
const runningByConnection = new Map();

async function fetchViaRoute(conn, signal) {
  const { GET } = await import("@/app/api/providers/[id]/models/route.js");
  const res = await GET(new Request("http://localhost/internal", { signal }), { params: Promise.resolve({ id: conn.id }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.models;
}

// Refresh one connection, or every active one (one per provider) when none is given.
export async function refreshProviderModels({ connectionId, signal } = {}) {
  if (running && !connectionId) return running;
  if (connectionId && runningByConnection.has(connectionId)) return runningByConnection.get(connectionId);
  const job = (async () => {
    const all = await getProviderConnections({ isActive: true });
    const conns = connectionId
      ? all.filter((c) => c.id === connectionId)
      : [...new Map(all.map((c) => [c.provider, c])).values()];
    const results = [];
    for (const conn of conns) {
      const compat = isOpenAICompatibleProvider(conn.provider) || isAnthropicCompatibleProvider(conn.provider);
      const alias = compat ? conn.provider : getProviderAlias(conn.provider);
      results.push(await syncConnectionModels(conn, {
        fetchModels: (connection) => fetchViaRoute(connection, signal),
        alias,
        builtinIds: new Set(getModelsByProviderId(conn.provider).map((m) => m.id)),
        upsertModels: upsertCustomModels,
        signal,
      }));
    }
    return results;
  })();
  if (!connectionId) {
    running = job.finally(() => { running = null; });
    return running;
  }
  const tracked = job.finally(() => { runningByConnection.delete(connectionId); });
  runningByConnection.set(connectionId, tracked);
  return tracked;
}

// Daily background refresh, same shape as the catalog sync timer. MODEL_REFRESH=off disables it.
const DAY_MS = 24 * 60 * 60 * 1000;
let timer = null;
export function startProviderModelRefresh() {
  if (timer || String(process.env.MODEL_REFRESH || "").toLowerCase() === "off") return;
  const tick = (delay) => {
    timer = setTimeout(async () => {
      try { await refreshProviderModels(); } catch (e) { console.log("[modelRefresh]", e?.message || e); }
      tick(DAY_MS);
    }, delay);
    timer.unref?.();
  };
  tick(2 * 60 * 1000);
}
