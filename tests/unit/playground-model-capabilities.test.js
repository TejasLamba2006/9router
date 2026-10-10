import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getModelAliases: vi.fn(),
  getCustomModels: vi.fn(),
  createModelVisibilitySnapshot: vi.fn(),
  isModelDisabled: vi.fn(),
  getCapabilitiesForModel: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => Response.json(body, init) },
}));

vi.mock("@/models", () => ({
  getModelAliases: mocks.getModelAliases,
  getCustomModels: mocks.getCustomModels,
  setModelAlias: vi.fn(),
}));

vi.mock("@/sse/services/modelVisibility", () => ({
  createModelVisibilitySnapshot: mocks.createModelVisibilitySnapshot,
  isModelDisabled: mocks.isModelDisabled,
}));

vi.mock("@/shared/constants/config", () => ({
  AI_MODELS: [{ provider: "test", model: "reasoner", name: "Reasoner" }],
}));

vi.mock("@/shared/constants/providers", () => ({
  getProviderAlias: (provider) => provider,
}));

vi.mock("open-sse/providers/capabilities.js", () => ({
  getCapabilitiesForModel: mocks.getCapabilitiesForModel,
}));

const canonicalCaps = {
  vision: true,
  pdf: true,
  audioInput: true,
  videoInput: true,
  imageOutput: false,
  audioOutput: false,
  search: true,
  tools: true,
  reasoning: true,
  thinkingFormat: "gemini-budget",
  thinkingCanDisable: false,
  thinkingRange: { min: 128, max: 24576 },
  thinkingEffortSupported: false,
  contextWindow: 1_000_000,
  maxOutput: 65_536,
};

describe("Playground model capability metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getModelAliases.mockResolvedValue({});
    mocks.getCustomModels.mockResolvedValue([]);
    mocks.createModelVisibilitySnapshot.mockResolvedValue({});
    mocks.isModelDisabled.mockResolvedValue(false);
    mocks.getCapabilitiesForModel.mockReturnValue(canonicalCaps);
  });

  it("returns the canonical multimodal and thinking metadata from /api/models", async () => {
    const { GET } = await import("../../src/app/api/models/route.js");
    const response = await GET();
    const body = await response.json();

    expect(body.models[0].caps).toEqual(canonicalCaps);
  });

  it("keeps every canonical field in the useModelCaps local fallback", async () => {
    vi.resetModules();
    vi.doUnmock("open-sse/providers/capabilities.js");
    const modelCaps = await import("../../src/shared/hooks/useModelCaps.js");

    expect(modelCaps.resolveCaps).toBeTypeOf("function");
    const caps = modelCaps.resolveCaps({}, {}, "google/gemini-2.5-pro");
    expect(caps).toMatchObject({
      vision: true,
      pdf: false,
      audioInput: true,
      videoInput: true,
      tools: true,
      reasoning: true,
      thinkingFormat: "gemini-budget",
      thinkingRange: { min: 0, max: 24576 },
    });
  });
});

describe("ModelSelectModal typed compatible providers", () => {
  const source = fs.readFileSync(
    new URL("../../src/shared/components/ModelSelectModal.js", import.meta.url),
    "utf8",
  );

  it("treats video as a typed model kind", () => {
    const typedKinds = source.match(/const TYPED_KINDS\s*=\s*new Set\(\[([^\]]+)\]\)/)?.[1] || "";
    expect(typedKinds).toContain('"video"');
  });

  it("uses compatible-node serviceKinds when filtering active providers", () => {
    expect(source).toMatch(/matchedNode\?\.serviceKinds/);
    expect(source).toMatch(/providerSpecificData\?\.serviceKinds/);
  });

  it("keeps compatible LLM models in Chat even when the node also declares media kinds", () => {
    expect(source).toMatch(/\["llm", \.\.\.mediaKinds\]/);
  });

  it("filters registered compatible models by their declared kind", () => {
    expect(source).toContain("kind: getModelKind(m)");
    expect(source).toMatch(/registeredCustom\.filter\(\(m\) => getModelKind\(m\) === kindFilter\)/);
    expect(source).not.toContain("Custom (openai/anthropic-compatible) providers are LLM-only");
  });
});
