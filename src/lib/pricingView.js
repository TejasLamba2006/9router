export function normalizePricingRates(rates) {
  if (!rates || !Number.isFinite(rates.input) || rates.input < 0
    || !Number.isFinite(rates.output) || rates.output < 0) return null;
  return {
    input: rates.input,
    output: rates.output,
    ...(Number.isFinite(rates.cached) ? { cached: rates.cached } : {}),
    ...(Number.isFinite(rates.cacheCreation ?? rates.cache_creation)
      ? { cache_creation: rates.cacheCreation ?? rates.cache_creation }
      : {}),
    ...(Number.isFinite(rates.reasoning) ? { reasoning: rates.reasoning } : {}),
  };
}

function addModel(target, provider, model, value) {
  (target[provider] ||= {})[model] = value;
}

export function buildPricingView({ hardcoded = {}, manual = {}, catalog = {} }) {
  const pricing = {};
  const syncedAt = catalog.syncedAt ?? null;

  for (const [provider, models] of Object.entries(hardcoded)) {
    for (const [model, rates] of Object.entries(models)) {
      addModel(pricing, provider, model, { rates, source: "hardcoded", syncedAt: null });
    }
  }

  for (const [provider, models] of Object.entries(catalog.reported || {})) {
    for (const [model, record] of Object.entries(models)) {
      const rates = normalizePricingRates(record?.pricing);
      if (rates) {
        addModel(pricing, provider, model, { rates, source: "models.dev-provider", syncedAt });
      } else if (!pricing[provider]?.[model]) {
        addModel(pricing, provider, model, { rates: null, source: "unknown", syncedAt });
      }
    }
  }

  for (const [provider, models] of Object.entries(manual)) {
    for (const [model, override] of Object.entries(models)) {
      const base = pricing[provider]?.[model]?.rates || {};
      const rates = { ...base, ...override };
      addModel(pricing, provider, model, { rates, source: "manual", syncedAt: null });
    }
  }

  return { pricing, manualOverrides: manual, catalog: { syncedAt } };
}

export function editableRates(entry) {
  return entry?.rates || entry || {};
}

export function changePricingField(pricing, provider, model, field, value) {
  return {
    ...pricing,
    [provider]: {
      ...(pricing[provider] || {}),
      [model]: {
        ...(pricing[provider]?.[model] || {}),
        rates: { ...editableRates(pricing[provider]?.[model]), [field]: value },
        source: "manual",
        syncedAt: null,
      },
    },
  };
}
