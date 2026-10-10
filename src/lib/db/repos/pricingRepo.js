import { getAdapter } from "../driver.js";
import { parseJson, stringifyJson } from "../helpers/jsonCol.js";
import { makeKv } from "../helpers/kvStore.js";
import { normalizePricingRates } from "@/lib/pricingView.js";
import { pricingPairKey, repriceUsageSync } from "./usageRepo.js";

const pricingKv = makeKv("pricing");
const CACHE_TTL_MS = 5000;

let cache = { value: null, expiresAt: 0 };

function invalidate() {
  cache = { value: null, expiresAt: 0 };
}

async function getUserPricing() {
  return await pricingKv.getAll();
}

export async function getManualPricing() {
  return await getUserPricing();
}

export async function getPricing() {
  const now = Date.now();
  if (cache.value && cache.expiresAt > now) return cache.value;

  const userPricing = await getUserPricing();
  const { PROVIDER_PRICING } = await import("open-sse/providers/pricing.js");
  const merged = {};

  for (const [provider, models] of Object.entries(PROVIDER_PRICING)) {
    merged[provider] = { ...models };
    if (userPricing[provider]) {
      for (const [model, pricing] of Object.entries(userPricing[provider])) {
        merged[provider][model] = merged[provider][model]
          ? { ...merged[provider][model], ...pricing }
          : pricing;
      }
    }
  }

  for (const [provider, models] of Object.entries(userPricing)) {
    if (!merged[provider]) {
      merged[provider] = { ...models };
    } else {
      for (const [model, pricing] of Object.entries(models)) {
        if (!merged[provider][model]) merged[provider][model] = pricing;
      }
    }
  }

  cache = { value: merged, expiresAt: now + CACHE_TTL_MS };
  return merged;
}

async function loadPricingSources() {
  const [catalog, pricing] = await Promise.all([
    import("open-sse/providers/catalogOverride.js"),
    import("open-sse/providers/pricing.js"),
  ]);
  return { getCatalogPricing: catalog.getCatalogPricing, resolveConst: pricing.getPricingForModel, isFreeModel: pricing.isFreeModel };
}

function resolvePricingSync(sources, userPricing, provider, model) {
  if (!model) return null;
  const { getCatalogPricing, resolveConst, isFreeModel } = sources;
  const synced = !isFreeModel(model) ? getCatalogPricing(provider, model) : null;
  const hardcoded = resolveConst(provider, model);
  const base = synced
    ? { rates: synced.rates, source: synced.source, syncedAt: synced.syncedAt }
    : hardcoded
      ? { rates: hardcoded, source: "hardcoded", syncedAt: null }
      : null;

  const manual = provider && userPricing[provider]?.[model];
  if (!manual) return base;
  const manualRates = normalizePricingRates({ ...(base?.rates || {}), ...manual });
  return manualRates ? { rates: manualRates, source: "manual", syncedAt: null } : base;
}

export async function getPricingForModelWithSource(provider, model) {
  if (!model) return null;
  const [userPricing, sources] = await Promise.all([getUserPricing(), loadPricingSources()]);
  return resolvePricingSync(sources, userPricing, provider, model);
}

export async function getPricingForModelsWithSource(provider, models) {
  const [userPricing, sources] = await Promise.all([getUserPricing(), loadPricingSources()]);
  return Object.fromEntries(models.map((model) => [model, resolvePricingSync(sources, userPricing, provider, model)]));
}

export async function createPricingResolver() {
  const sources = await loadPricingSources();
  return (db, provider, model) => {
    const row = db.get(`SELECT value FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
    const manual = row ? { [provider]: parseJson(row.value, {}) || {} } : {};
    return resolvePricingSync(sources, manual, provider, model)?.rates || null;
  };
}

export async function getPricingForModel(provider, model) {
  return (await getPricingForModelWithSource(provider, model))?.rates || null;
}

function readManualSync(db) {
  const manual = {};
  for (const row of db.all(`SELECT key, value FROM kv WHERE scope = 'pricing'`)) {
    manual[row.key] = parseJson(row.value, {}) || {};
  }
  return manual;
}

function writeProviderSync(db, provider, models) {
  if (Object.keys(models).length === 0) {
    db.run(`DELETE FROM kv WHERE scope = 'pricing' AND key = ?`, [provider]);
    return;
  }
  db.run(
    `INSERT INTO kv(scope, key, value) VALUES('pricing', ?, ?) ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value`,
    [provider, stringifyJson(models)]
  );
}

async function mutatePricing(mutate) {
  const db = await getAdapter();
  const sources = await loadPricingSources();
  db.transaction(() => {
    const manual = readManualSync(db);
    const pairs = mutate(manual);
    for (const provider of new Set(pairs.map(([p]) => p))) {
      writeProviderSync(db, provider, manual[provider] || {});
    }
    const ratesByPair = new Map(pairs.map(([provider, model]) => [
      pricingPairKey(provider, model),
      resolvePricingSync(sources, manual, provider, model)?.rates || null,
    ]));
    repriceUsageSync(db, ratesByPair);
  });
  invalidate();
  return await getUserPricing();
}

export async function updatePricing(pricingData) {
  return await mutatePricing((manual) => {
    const pairs = [];
    for (const [provider, models] of Object.entries(pricingData)) {
      manual[provider] ||= {};
      for (const [model, pricing] of Object.entries(models)) {
        manual[provider][model] = { ...(manual[provider][model] || {}), ...pricing };
        pairs.push([provider, model]);
      }
    }
    return pairs;
  });
}

export async function resetPricing(provider, model) {
  if (!provider) return await getUserPricing();
  return await mutatePricing((manual) => {
    const current = manual[provider] || {};
    const models = model ? (model in current ? [model] : []) : Object.keys(current);
    for (const m of models) delete current[m];
    manual[provider] = current;
    return model ? [[provider, model]] : models.map((m) => [provider, m]);
  });
}

export async function resetAllPricing() {
  await mutatePricing((manual) => {
    const pairs = [];
    for (const [provider, models] of Object.entries(manual)) {
      for (const model of Object.keys(models)) pairs.push([provider, model]);
      manual[provider] = {};
    }
    return pairs;
  });
  return {};
}
