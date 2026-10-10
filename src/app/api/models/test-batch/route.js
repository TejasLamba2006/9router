import { getCustomModels, getProviderConnectionById, upsertModelCapabilityEvidence } from "@/lib/localDb";
import { runModelCapabilityProbeGroup } from "@/lib/modelCapabilityProbe";
import { getModelsByProviderId } from "@/shared/constants/models";
import { runModelProbe } from "@/lib/modelProbe";
import { AUTO_HIDE_CLASSIFICATIONS, DEFAULT_AUTO_HIDE_CLASSIFICATIONS, runModelTestBatch } from "@/lib/modelTestBatch";
import { disableCanonicalModels, getDisabledModelIds } from "@/sse/services/modelVisibility";

const activeConnections = new Set();
const MAX_MODELS = 1000;
const MAX_MODEL_ID_LENGTH = 512;

function line(controller, payload) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(payload)}\n`));
}

function validateBody(body) {
  if (!body || typeof body !== "object") return "Invalid request body";
  if (typeof body.providerId !== "string" || !body.providerId.trim() || body.providerId.length > 256) return "Invalid providerId";
  if (typeof body.connectionId !== "string" || !body.connectionId.trim() || body.connectionId.length > 128) return "Invalid connectionId";
  if (!Array.isArray(body.modelIds) || body.modelIds.length === 0 || body.modelIds.length > MAX_MODELS) return "Invalid modelIds";
  if (body.modelIds.some((id) => typeof id !== "string" || !id.trim() || id.length > MAX_MODEL_ID_LENGTH)) return "Invalid modelIds";
  const cooldownMs = body.cooldownMs ?? 5000;
  if (!Number.isInteger(cooldownMs) || cooldownMs < 0 || cooldownMs > 60000) return "Invalid cooldownMs";
  if (body.verifyCapabilities !== undefined && typeof body.verifyCapabilities !== "boolean") return "Invalid verifyCapabilities";
  if (body.autoHideHardFailures !== undefined && typeof body.autoHideHardFailures !== "boolean") return "Invalid autoHideHardFailures";
  if (body.autoHideClassifications !== undefined) {
    if (!Array.isArray(body.autoHideClassifications)
      || body.autoHideClassifications.length > AUTO_HIDE_CLASSIFICATIONS.length
      || body.autoHideClassifications.some((classification) => !AUTO_HIDE_CLASSIFICATIONS.includes(classification))) {
      return "Invalid autoHideClassifications";
    }
  }
  return null;
}

export async function POST(request) {
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
    let allowed = false;
    try {
      allowed = Boolean(host) && new URL(origin).origin === `${protocol}://${host}`;
    } catch {}
    if (!allowed) return Response.json({ error: "Origin not allowed" }, { status: 403 });
  }

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const error = validateBody(body);
  if (error) return Response.json({ error }, { status: 400 });

  const providerId = body.providerId.trim();
  const connectionId = body.connectionId.trim();
  const autoHideClassifications = body.autoHideClassifications === undefined
    ? (body.autoHideHardFailures === true ? [...DEFAULT_AUTO_HIDE_CLASSIFICATIONS] : [])
    : [...new Set(body.autoHideClassifications)];
  const connection = await getProviderConnectionById(connectionId);
  if (!connection || connection.isActive === false || connection.provider !== providerId) {
    return Response.json({ error: "Selected connection does not match provider" }, { status: 400 });
  }
  if (activeConnections.has(connectionId)) return Response.json({ error: "A model test is already active for this connection" }, { status: 409 });
  activeConnections.add(connectionId);

  let modelIds;
  try {
    const [hiddenIds, customModels] = await Promise.all([
      getDisabledModelIds(providerId),
      getCustomModels(),
    ]);
    const hidden = new Set(hiddenIds);
    const inventory = new Set([
      ...getModelsByProviderId(providerId).filter((item) => !item.kind || item.kind === "llm").map((item) => item.id),
      ...customModels.filter((item) => item.providerAlias === providerId && (item.type || item.kind || "llm") === "llm").map((item) => item.id),
    ]);
    modelIds = [...new Set(body.modelIds.map((id) => id.trim()))]
      .filter((id) => inventory.has(id) && !hidden.has(id));
    if (modelIds.length === 0) {
      activeConnections.delete(connectionId);
      return Response.json({ error: "No visible models to test" }, { status: 400 });
    }
  } catch (lookupError) {
    activeConnections.delete(connectionId);
    throw lookupError;
  }

  const runController = new AbortController();
  const abort = () => runController.abort(request.signal.reason);
  request.signal.addEventListener("abort", abort, { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        line(controller, { type: "start", total: modelIds.length, skippedHidden: body.modelIds.length - modelIds.length });
        const result = await runModelTestBatch({
          models: modelIds,
          cooldownMs: body.cooldownMs ?? 5000,
          autoHideClassifications,
          signal: runController.signal,
          probe: async (model) => {
            const health = await runModelProbe({ provider: providerId, model, connectionId, signal: runController.signal, origin: "model_health" });
            if (!body.verifyCapabilities || health.classification !== "healthy") return health;
            const capabilities = await runModelCapabilityProbeGroup({
              provider: providerId,
              model,
              connectionId,
              signal: runController.signal,
              probe: ({ capability, body: probeBody, signal }) => runModelProbe({
                provider: providerId,
                model,
                connectionId,
                signal,
                origin: `model_capability_${capability}`,
                body: probeBody,
              }),
            });
            if (!capabilities || runController.signal.aborted) return { ...health, classification: "skipped", ok: false };
            await upsertModelCapabilityEvidence(Object.values(capabilities));
            return { ...health, capabilities };
          },
          hide: (model) => disableCanonicalModels(providerId, [model]),
          onResult: (probeResult, index, hideStatus) => line(controller, {
            type: "result",
            index,
            done: index + 1,
            total: modelIds.length,
            result: probeResult,
            ...hideStatus,
          }),
          onWait: (delayMs, model, index) => line(controller, { type: "wait", delayMs, model, done: index + 1, total: modelIds.length }),
        });
        line(controller, { type: result.stopReason === "cancelled" ? "cancelled" : "done", stopReason: result.stopReason, done: result.results.length, total: modelIds.length });
      } catch (runError) {
        line(controller, { type: "error", error: String(runError?.message || runError).slice(0, 500) });
      } finally {
        activeConnections.delete(connectionId);
        request.signal.removeEventListener("abort", abort);
        controller.close();
      }
    },
    cancel() { runController.abort("stream cancelled"); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
