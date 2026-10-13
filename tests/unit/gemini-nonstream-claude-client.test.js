import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/usageDb.js", () => ({ appendRequestLog: vi.fn(), saveRequestDetail: vi.fn(), saveRequestUsage: vi.fn() }));
const { translateNonStreamingResponse } = await import("../../open-sse/handlers/chatCore/nonStreamingHandler.js");

const gemini = (parts) => ({ candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 } });

describe("Gemini/Vertex non-stream response for a Claude client", () => {
  for (const target of ["gemini", "vertex", "gemini-cli", "antigravity"]) {
    it(`${target}: returns an Anthropic message with tool_use blocks`, () => {
      const out = translateNonStreamingResponse(gemini([{ functionCall: { name: "_9router_web_fetch", args: { url: "https://a.com" } } }]), target, "claude");
      expect(out.type).toBe("message");
      expect(out.content[0]).toMatchObject({ type: "tool_use", name: "_9router_web_fetch", input: { url: "https://a.com" } });
      expect(out.stop_reason).toBe("tool_use");
      expect(out.choices).toBeUndefined();
    });
  }

  it("keeps the OpenAI shape for OpenAI clients", () => {
    const out = translateNonStreamingResponse(gemini([{ text: "hi" }]), "gemini", "openai");
    expect(out.object).toBe("chat.completion");
    expect(out.choices[0].message.content).toBe("hi");
  });
});
