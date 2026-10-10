import { getApiKeys } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

const CLI_TOKEN_SALT = "9r-cli-auth";

export async function getInternalHeaders({ contentType = "application/json", allowRestrictedFallback = true } = {}) {
  let apiKey = null;
  try {
    const activeKeys = (await getApiKeys()).filter((key) => key.isActive !== false && key.key);
    apiKey = (activeKeys.find((key) => !key.access?.restricted) || (allowRestrictedFallback ? activeKeys[0] : null))?.key || null;
  } catch {}

  const headers = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  headers["x-9r-cli-token"] = await getConsistentMachineId(CLI_TOKEN_SALT);
  return headers;
}
