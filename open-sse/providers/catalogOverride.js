// Read side of the model catalog synced from models.dev.
//
// The file is the source of truth; the only thing held in memory is a parsed
// copy dropped as soon as the file's mtime changes. getCapabilitiesForModel is
// synchronous and runs per request, so the hot path is one stat (~1us) and the
// parse (~0.1ms on a ~18KB file) only reruns after a sync.

import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/lib/dataDir.js";

export const CATALOG_FILE = path.join(DATA_DIR, "model-catalog.json");
// Trimmed upstream catalog, read by the add-models skill (not by the router).
export const CATALOG_RAW_FILE = path.join(DATA_DIR, "model-catalog-raw.json");

// Schema of the file this module reads. The writer stamps it; a file carrying an
// older value predates provider-scoped modality keys, and its flat keys are not
// looked up here, so the sync rebuilds it instead of asking upstream for a 304.
export const CATALOG_VERSION = 5;

const EMPTY = {
  models: {}, providers: {}, providerMap: {}, reported: {},
  canonicalPricing: {}, uniqueCanonicalBasename: {}, syncedAt: null,
};
let cache = EMPTY;
let cachedMtime = -1;

// "zai-org/GLM-4.6V:free" -> "glm-4.6v"
function baseId(model) {
  if (!model) return "";
  const withoutVendor = model.includes("/") ? model.split("/").pop() : model;
  return withoutVendor.toLowerCase().split(":")[0];
}

// Generate normalized basename candidates for Azure/dated/vendor-prefixed model IDs
// e.g. "gpt-5-mini-2025-08-07" -> ["gpt-5-mini-2025-08-07", "gpt-5-mini"]
//      "gpt-35-turbo-0125" -> ["gpt-35-turbo-0125", "gpt-3.5-turbo-0125", "gpt-3.5-turbo"]
//      "Meta-Llama-3.3-70B-Instruct-2" -> [..., "llama-3.3-70b-instruct"]
function candidateBasenames(model) {
  const b = baseId(model);
  if (!b) return [];
  const out = new Set([b]);
  if (b.startsWith("gpt-35-")) out.add(`gpt-3.5-${b.slice("gpt-35-".length)}`);
  for (const s of [...out]) {
    out.add(s.replace(/-\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+)*$/, ""));
    out.add(s.replace(/-\d{2}-\d{4}$/, ""));
    out.add(s.replace(/-(?:0\d{3}|1\d{3}|\d{4})(?:-preview)?$/, ""));
    out.add(s.replace(/(?<=-instruct|-chat|-vision|-mini|-large|-small|-medium)-\d{1,2}$/, ""));
  }
  for (const s of [...out]) {
    if (s.startsWith("meta-llama-")) out.add(s.slice("meta-".length));
    if (s.startsWith("cohere-")) out.add(s.slice("cohere-".length));
    if (s.startsWith("ai21-")) out.add(s.slice("ai21-".length));
  }
  return [...out].filter(Boolean);
}

function load() {
  let mtime;
  try {
    mtime = fs.statSync(CATALOG_FILE).mtimeMs;
  } catch {
    cache = EMPTY;
    cachedMtime = -1;
    return cache;
  }
  if (mtime === cachedMtime) return cache;

  cachedMtime = mtime;
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8"));
    cache = {
      models: parsed?.models || {},
      providers: parsed?.providers || {},
      providerMap: parsed?.providerMap || {},
      reported: parsed?.reported || {},
      canonicalPricing: parsed?.canonicalPricing || {},
      uniqueCanonicalBasename: parsed?.uniqueCanonicalBasename || {},
      syncedAt: parsed?.syncedAt || null,
    };
  } catch {
    cache = EMPTY;
  }
  return cache;
}

// Modalities are recorded per gateway upstream, and gateways disagree about the
// same weights — some do not proxy images at all — so the key is provider +
// model, in the local provider id space, exactly like the limits below. Keying
// by model id alone made short ids collide across vendors: "auto", "free" and
// "efficient" are router modes in one catalog and model names in another, and a
// request to the router mode inherited a stranger's vision.
export function getCatalogModalities(provider, model) {
  if (!provider) return null;
  return load().models[`${provider}:${baseId(model)}`] || null;
}

// Context and output limits are a property of the gateway too: each one
// truncates differently, so these stay keyed by provider + model.
export function getCatalogLimits(provider, model) {
  const byProvider = provider && load().providers[provider];
  if (!byProvider) return null;
  return byProvider[model] || byProvider[baseId(model)] || null;
}

function normalizeRates(pricing) {
  if (!pricing || !Number.isFinite(pricing.input) || !Number.isFinite(pricing.output)
    || pricing.input < 0 || pricing.output < 0) return null;
  return {
    input: pricing.input,
    output: pricing.output,
    ...(Number.isFinite(pricing.cached) ? { cached: pricing.cached } : {}),
    ...(Number.isFinite(pricing.cacheCreation) ? { cache_creation: pricing.cacheCreation } : {}),
    ...(Number.isFinite(pricing.reasoning) ? { reasoning: pricing.reasoning } : {}),
  };
}

export function getCatalogReported(provider, model) {
  const data = load();
  const upstreamProvider = data.providerMap[provider] || provider;
  const byProvider = data.reported[upstreamProvider];
  const candidates = candidateBasenames(model);
  let record = byProvider?.[model];
  if (!record && byProvider) {
    for (const cand of candidates) {
      if (byProvider[cand]) { record = byProvider[cand]; break; }
    }
  }
  if (record) return record;
  for (const cand of candidates) {
    const canonicalId = data.uniqueCanonicalBasename[cand];
    if (!canonicalId) continue;
    const separator = canonicalId.indexOf("/");
    const found = data.reported[canonicalId.slice(0, separator)]?.[canonicalId.slice(separator + 1)];
    if (found) return found;
  }
  return null;
}

export function getCatalogPricing(provider, model) {
  if (!model) return null;
  const data = load();
  const upstreamProvider = data.providerMap[provider] || provider;
  const candidates = candidateBasenames(model);
  let record = data.reported[upstreamProvider]?.[model];
  if (!record && data.reported[upstreamProvider]) {
    for (const cand of candidates) {
      if (data.reported[upstreamProvider][cand]) {
        record = data.reported[upstreamProvider][cand];
        break;
      }
    }
  }
  const providerRates = normalizeRates(record?.pricing);
  if (providerRates) {
    return {
      rates: providerRates,
      source: "models.dev-provider",
      syncedAt: data.syncedAt,
      upstreamProvider,
      upstreamModel: model,
    };
  }

  let canonicalId = record?.canonicalModelId;
  if (!canonicalId || !data.canonicalPricing[canonicalId]) {
    for (const cand of candidates) {
      const cid = data.uniqueCanonicalBasename[cand];
      if (cid && data.canonicalPricing[cid]) {
        canonicalId = cid;
        break;
      }
    }
  }
  const canonicalRates = normalizeRates(data.canonicalPricing[canonicalId]);
  if (!canonicalRates) return null;
  return {
    rates: canonicalRates,
    source: "models.dev-canonical",
    syncedAt: data.syncedAt,
    upstreamProvider: canonicalId.split("/")[0],
    upstreamModel: canonicalId.slice(canonicalId.indexOf("/") + 1),
  };
}

export function getCatalogSnapshot() {
  return load();
}

export function getCatalogRevision() {
  const data = load();
  return { version: CATALOG_VERSION, syncedAt: data.syncedAt };
}

// Force a re-read on the next lookup (called right after a sync writes the file).
export function invalidateCatalog() {
  cachedMtime = -1;
}

// Hand the reader to capabilities.js. That module is bundled into the browser
// too, so it cannot import this file directly — the server pushes it in.
export async function installCatalogSource() {
  const { setCatalogSource } = await import("./capabilities.js");
  setCatalogSource({ getModalities: getCatalogModalities, getLimits: getCatalogLimits, getReported: getCatalogReported });
}
