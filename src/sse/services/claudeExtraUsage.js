import { getProviderConnectionById, updateProviderConnection } from "@/lib/db/index.js";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy.js";
import {
  buildClaudeExtraUsageConnectionUpdate,
  isClaudeExtraUsageBlockEnabled,
} from "@/lib/providers/claudeExtraUsage.js";
import { getUsageForProvider } from "open-sse/services/usage.js";

function buildProxyOptions(config) {
  return {
    connectionProxyEnabled: config.connectionProxyEnabled === true,
    connectionProxyUrl: config.connectionProxyUrl || "",
    connectionNoProxy: config.connectionNoProxy || "",
    vercelRelayUrl: config.vercelRelayUrl || "",
    strictProxy: false,
  };
}

export async function syncClaudeExtraUsageStateAfterRequest(connection, deps = {}) {
  if (
    !connection?.id
    || !isClaudeExtraUsageBlockEnabled(connection.provider, connection.providerSpecificData)
  ) return;

  const getConnection = deps.getProviderConnectionById || getProviderConnectionById;
  const resolveProxy = deps.resolveConnectionProxyConfig || resolveConnectionProxyConfig;
  const fetchUsage = deps.getUsageForProvider || getUsageForProvider;
  const updateConnection = deps.updateProviderConnection || updateProviderConnection;

  try {
    const currentConnection = await getConnection(connection.id) || connection;
    const proxyConfig = await resolveProxy(currentConnection.providerSpecificData || {});
    const usage = await fetchUsage(currentConnection, buildProxyOptions(proxyConfig));
    const update = buildClaudeExtraUsageConnectionUpdate(currentConnection, usage);
    if (update) await updateConnection(connection.id, update);
  } catch (error) {
    console.warn(`[Claude Usage] Request-time extra-usage sync failed: ${error.message}`);
  }
}
