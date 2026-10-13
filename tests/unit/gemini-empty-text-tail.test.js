import { describe, it, expect } from "vitest";
import { normalizeGeminiContents } from "open-sse/translator/formats/gemini.js";

describe("normalizeGeminiContents empty-text turns", () => {
  it("drops empty-text parts so a blank trailing user turn does not leave a model turn last", () => {
    const out = normalizeGeminiContents([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "ok" }] },
      { role: "user", parts: [{ text: "" }] },
    ]);
    expect(out.at(-1).role).toBe("user");
    expect(out.at(-1).parts.every((p) => p.text !== "")).toBe(true);
    expect(out.at(-1).parts.length).toBeGreaterThan(0);
  });

  it("keeps whitespace-only and functionResponse parts", () => {
    const out = normalizeGeminiContents([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ functionCall: { name: "a", args: {} } }] },
      { role: "user", parts: [{ functionResponse: { name: "a", response: { r: 1 } } }, { text: "" }] },
    ]);
    expect(out.at(-1).parts).toHaveLength(1);
    expect(out.at(-1).parts[0].functionResponse).toBeDefined();
  });
});
