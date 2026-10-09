import { getCustomModels, getModelCapabilityEvidence, getProviderConnectionById } from "@/lib/localDb.js";
import { MODEL_CAPABILITY_PROBE_VERSION } from "@/lib/modelCapabilityProbe.js";
import { resolveCapabilityProvenance } from "@/lib/modelCapabilityResolver.js";
import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";
import { getModelsByProviderId } from "@/shared/constants/models.js";
import { getCatalogReported } from "open-sse/providers/catalogOverride.js";

const MAX_ID = 512;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider")?.trim();
  const connectionId = searchParams.get("connectionId")?.trim();
  if (!provider || !connectionId || provider.length > 256 || connectionId.length > MAX_ID) {
    return Response.json({ error: "Invalid provider or connectionId" }, { status: 400 });
  }
  const connection = await getProviderConnectionById(connectionId);
  if (!connection || connection.isActive === false || connection.provider !== provider) {
    return Response.json({ error: "Selected connection does not match provider" }, { status: 400 });
  }

  const [evidence, customModels] = await Promise.all([
    getModelCapabilityEvidence({ provider, connectionId }),
    getCustomModels(),
  ]);
  const providerCustomModels = customModels.filter((row) => row.providerAlias === provider && (row.type || row.kind || "llm") === "llm");
  const customById = new Map(providerCustomModels.map((row) => [row.id, row]));
  const modelIds = [...new Set([
    ...getModelsByProviderId(provider).map((row) => row.id),
    ...evidence.map((row) => row.model),
    ...providerCustomModels.map((row) => row.id),
  ])];
  const models = {};
  for (const model of modelIds) {
    models[model] = resolveCapabilityProvenance({
      evidence: evidence.filter((row) => row.model === model),
      reported: getCatalogReported(provider, model),
      builtin: getCapabilitiesForModel(provider, model),
      user: customById.get(model)?.caps || {},
      currentProbeVersion: MODEL_CAPABILITY_PROBE_VERSION,
    });
  }
  return Response.json({ provider, connectionId, probeVersion: MODEL_CAPABILITY_PROBE_VERSION, models });
}
