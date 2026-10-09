import { describe, expect, it } from "vitest";
import { buildPricingView, changePricingField } from "../../src/lib/pricingView.js";

describe("pricing API view", () => {
  it("includes dynamic-only models with source and unknown rates", () => {
    const view = buildPricingView({
      hardcoded: { openai: { known: { input: 1, output: 2 } } },
      manual: { openai: { known: { input: 9 } } },
      catalog: {
        syncedAt: 123,
        reported: {
          openai: {
            known: { pricing: { input: 3, output: 4 } },
            dynamic: { pricing: { input: 5, output: 6, cached: 0.5, cacheCreation: 7 } },
            unknown: { pricing: { input: undefined, output: undefined } },
          },
        },
      },
    });

    expect(view.pricing.openai.known).toMatchObject({ rates: { input: 9, output: 4 }, source: "manual" });
    expect(view.pricing.openai.dynamic).toEqual({
      rates: { input: 5, output: 6, cached: 0.5, cache_creation: 7 },
      source: "models.dev-provider",
      syncedAt: 123,
    });
    expect(view.pricing.openai.unknown).toEqual({ rates: null, source: "unknown", syncedAt: 123 });
  });

  it("keeps displayed sibling rates when one field changes", () => {
    const pricing = {
      openai: {
        dynamic: {
          rates: { input: 1, output: 2, cache_creation: 3 },
          source: "models.dev-provider",
          syncedAt: 123,
        },
      },
    };

    expect(changePricingField(pricing, "openai", "dynamic", "input", 9).openai.dynamic).toEqual({
      rates: { input: 9, output: 2, cache_creation: 3 },
      source: "manual",
      syncedAt: null,
    });
  });

  it("falls back to hardcoded rates when synced pricing is incomplete", () => {
    const view = buildPricingView({
      hardcoded: { openai: { known: { input: 1, output: 2 } } },
      manual: {},
      catalog: { syncedAt: 123, reported: { openai: { known: { pricing: { input: 9 } } } } },
    });

    expect(view.pricing.openai.known).toEqual({
      rates: { input: 1, output: 2 }, source: "hardcoded", syncedAt: null,
    });
  });
});
