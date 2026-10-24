import { describe, it, expect } from "vitest";
import { PROVIDERS } from "open-sse/config/providers.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";

const PUBLIC_PREFIXES = [
  "0w0", "nara", "poe", "synthetic", "zenmux", "requesty", "routeway", "agentrouter", "evomap",
  "infron", "vsllm", "lumosel", "navy", "v0-vercel", "wafer", "getgoapi", "freemodel-dev",
  "pollinations", "ainative", "aion", "routesme", "openference", "nano-gpt", "gorouter",
  "tokenlayer", "modelscope", "tukenku", "aihubmix", "apinex", "experientiallabs", "cavoti",
  "inceptionlabs", "seekai", "deepinfra", "novita", "aimlapi", "baseten", "scaleway", "volcengine",
];

describe("native providers registry expansion", () => {
  it("registers >= 285 native providers (AI_PROVIDERS; PROVIDERS holds only 250 LLM-routable)", () => {
    expect(Object.keys(AI_PROVIDERS).length).toBeGreaterThanOrEqual(285);
    expect(Object.keys(PROVIDERS).length).toBeGreaterThanOrEqual(250);
  });
  it.each(PUBLIC_PREFIXES)("%s is in PROVIDERS and AI_PROVIDERS", (id) => {
    expect(PROVIDERS[id]).toBeDefined();
    expect(AI_PROVIDERS[id]).toBeDefined();
  });
});
