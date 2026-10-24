import { describe, expect, it } from "vitest";
import {
  CATEGORY_FILTERS,
  buildFilterSearch,
  buildModelIndex,
  findModelMatches,
  getProviderCategories,
  getSectionId,
  isConfigured,
  matchesCategory,
  matchesMedia,
  matchesSearch,
  normalizeCategory,
  normalizeDisplayMode,
  normalizeMedia,
  readFilterParams,
} from "@/app/(dashboard)/dashboard/providers/providerFiltering.js";

describe("matchesSearch", () => {
  const info = { name: "OpenRouter", alias: "or", aliases: ["open-router"] };
  it("matches name, id, alias and aliases; empty matches all", () => {
    expect(matchesSearch("openrouter", info, "")).toBe(true);
    expect(matchesSearch("openrouter", info, "ROUTER")).toBe(true);
    expect(matchesSearch("x-key", { name: "Foo" }, "x-k")).toBe(true);
    expect(matchesSearch("openrouter", info, "or")).toBe(true);
    expect(matchesSearch("zzz", { name: "Foo", alias: "pref" }, "pref")).toBe(true);
    expect(matchesSearch("zzz", info, "open-r")).toBe(true);
    expect(matchesSearch("zzz", { name: "Foo" }, "nope")).toBe(false);
  });
});

describe("categories", () => {
  it("lists 13 chips with All first", () => {
    expect(CATEGORY_FILTERS).toHaveLength(13);
    expect(CATEGORY_FILTERS[0].id).toBe("all");
  });
  it("classifies by group, id sets and service kinds", () => {
    expect(getProviderCategories("cursor", {}, "oauth")).toEqual(new Set(["oauth", "ide"]));
    expect(getProviderCategories("openrouter", {}, "apikey")).toEqual(new Set(["apikey", "aggregators"]));
    expect(getProviderCategories("opencode", { noAuth: true }, "free")).toEqual(new Set(["free", "noauth"]));
    expect(getProviderCategories("x", { hasFree: true }, "apikey").has("free")).toBe(true);
    expect(getProviderCategories("ollama-local", {}, "apikey").has("local")).toBe(true);
    expect(getProviderCategories("n", {}, "custom").has("custom")).toBe(true);
    expect(getProviderCategories("c", {}, "webCookie").has("webcookie")).toBe(true);
    const media = getProviderCategories("m", { serviceKinds: ["tts", "webSearch"], fetchConfig: {} }, "apikey");
    expect(media.has("audio") && media.has("search") && media.has("fetch")).toBe(true);
  });
  it("matchesCategory treats all/empty as pass-through", () => {
    const cats = new Set(["oauth"]);
    expect(matchesCategory(cats, "all")).toBe(true);
    expect(matchesCategory(cats, "oauth")).toBe(true);
    expect(matchesCategory(cats, "ide")).toBe(false);
  });
});

describe("media + sections", () => {
  it("llm is the default kind; config objects count for search/fetch", () => {
    expect(matchesMedia({}, "image")).toBe(false);
    expect(matchesMedia({ serviceKinds: ["image"] }, "image")).toBe(true);
    expect(matchesMedia({ searchConfig: {} }, "webSearch")).toBe(true);
    expect(matchesMedia({}, "")).toBe(true);
  });
  it("routes non-llm providers to dedicated sections instead of hiding them", () => {
    expect(getSectionId({ serviceKinds: ["webSearch"] }, "apikey", "a")).toBe("search");
    expect(getSectionId({ serviceKinds: ["tts"] }, "apikey", "a")).toBe("audio");
    expect(getSectionId({ serviceKinds: ["image"] }, "apikey", "a")).toBe("image");
    expect(getSectionId({ serviceKinds: ["embedding"] }, "apikey", "a")).toBe("embedding");
    expect(getSectionId({}, "apikey", "comfyui")).toBe("local");
    expect(getSectionId({}, "freeTier", "a")).toBe("free");
    expect(getSectionId({}, "apikey", "a")).toBe("apikey");
    expect(getSectionId({}, "oauth", "a")).toBe("oauth");
  });
  it("isConfigured counts connections or noAuth", () => {
    expect(isConfigured({ total: 1 }, {})).toBe(true);
    expect(isConfigured({ total: 0 }, { noAuth: true })).toBe(true);
    expect(isConfigured({ total: 0 }, {})).toBe(false);
  });
});

describe("model search", () => {
  const index = buildModelIndex({
    staticModels: { cc: [{ id: "claude-sonnet-5", name: "Claude Sonnet 5" }] },
    liveIds: ["cc/claude-haiku-5", "gh/gpt-5", "combo-no-slash"],
    custom: [{ providerAlias: "gh", id: "my-gpt-tune", name: "Tuned" }],
  });
  it("merges static, live and custom sources", () => {
    expect(findModelMatches(index, ["cc"], "claude").count).toBe(2);
    expect(findModelMatches(index, ["gh"], "gpt").samples).toEqual(["gpt-5", "my-gpt-tune"]);
  });
  it("matches by model name and dedupes across alias/id keys", () => {
    expect(findModelMatches(index, ["cc", "cc"], "SONNET").count).toBe(1);
    expect(findModelMatches(index, ["gh"], "tuned").count).toBe(1);
  });
  it("returns nothing for empty query or unknown provider", () => {
    expect(findModelMatches(index, ["cc"], "").count).toBe(0);
    expect(findModelMatches(index, ["zz"], "claude").count).toBe(0);
  });
  it("caps samples", () => {
    expect(findModelMatches(index, ["cc", "gh"], "-", 2).samples).toHaveLength(2);
  });
});

describe("URL / display mode sync", () => {
  it("normalizes invalid values", () => {
    expect(normalizeDisplayMode("bogus")).toBe("all");
    expect(normalizeDisplayMode("compact")).toBe("compact");
    expect(normalizeCategory("nope")).toBe("all");
    expect(normalizeMedia("nope")).toBe("");
    expect(normalizeMedia("webFetch")).toBe("webFetch");
  });
  it("reads params", () => {
    expect(readFilterParams("?search=gpt&model=claude&mode=compact&cat=ide&media=tts")).toEqual({
      search: "gpt", model: "claude", mode: "compact", cat: "ide", media: "tts",
    });
    expect(readFilterParams("").mode).toBeNull();
  });
  it("builds a minimal query string and round-trips", () => {
    expect(buildFilterSearch({ search: "", model: "", mode: "all", cat: "all", media: "" })).toBe("");
    const s = buildFilterSearch({ search: " gpt ", model: "claude", mode: "configured", cat: "free", media: "image" });
    expect(s).toBe("?search=gpt&model=claude&mode=configured&cat=free&media=image");
    expect(readFilterParams(s)).toMatchObject({ search: "gpt", model: "claude", mode: "configured", cat: "free", media: "image" });
  });
});
