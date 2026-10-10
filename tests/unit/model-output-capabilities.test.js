import { describe, expect, it } from "vitest";
import { DEFAULT_CAPABILITIES, getCapabilitiesForModel, setCatalogSource } from "../../open-sse/providers/capabilities.js";
import { CAPACITY_META } from "../../src/shared/constants/models.js";

const OUTPUT_KEYS = ["imageOutput", "audioOutput", "videoOutput"];

describe("declared model output capabilities", () => {
  it("has safe false defaults and UI metadata for every output", () => {
    for (const key of OUTPUT_KEYS) {
      expect(DEFAULT_CAPABILITIES[key]).toBe(false);
      expect(CAPACITY_META[key]).toMatchObject({ icon: expect.any(String), label: expect.any(String) });
    }
  });

  it("adds provider-scoped catalog outputs without disabling builtin support", () => {
    setCatalogSource({
      getModalities: (provider, model) => provider === "demo" && model === "media-model"
        ? { imageOutput: true, audioOutput: true, videoOutput: true }
        : null,
      getLimits: () => null,
    });

    expect(getCapabilitiesForModel("demo", "media-model")).toMatchObject({
      imageOutput: true,
      audioOutput: true,
      videoOutput: true,
    });
    expect(getCapabilitiesForModel("openai", "gpt-image-1").imageOutput).toBe(true);
    setCatalogSource(null);
  });
});
