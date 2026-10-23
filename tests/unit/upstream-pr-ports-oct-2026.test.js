import { describe, it, expect } from "vitest";
import { canonicalizeUsage, mergeUsage } from "../../open-sse/utils/usageTracking.js";
import { inspectJsonBody, peekStreamForContent } from "../../open-sse/services/emptyFailover.js";
import { isValidClaudeSignature } from "../../open-sse/utils/claudeSignature.js";
import { isClaudeModel } from "../../open-sse/providers/models/helpers.js";
import { normalizeClaudePassthrough } from "../../open-sse/translator/formats/claude.js";
import { CodexExecutor } from "../../open-sse/executors/codex.js";
import { supportsGrokCliReasoningEffort } from "../../open-sse/config/grokCli.js";
import { antigravityToOpenAIRequest } from "../../open-sse/translator/request/antigravity-to-openai.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";

// Build a minimal valid C-form (0x08) protobuf envelope for Claude CAIS/CAQS signatures:
// field 1 varint = 1 (0x08, 0x01)
// field 2 bytes (0x12, len) -> inner field 1 bytes (0x0a, len) -> inner protobuf message (0x08, 0x01)
function makeCaisSignature() {
  const innerChannel = Buffer.from([0x08, 0x01]);
  const container = Buffer.concat([Buffer.from([0x0a, innerChannel.length]), innerChannel]);
  const envelope = Buffer.concat([Buffer.from([0x08, 0x01, 0x12, container.length]), container]);
  return envelope.toString("base64");
}

describe("Upstream PR ports (Oct 2026)", () => {
  it("PR #5117: canonicalizeUsage does not double-count cache tokens when both prompt_tokens and input_tokens are present", () => {
    const usage = canonicalizeUsage({
      input_tokens: 100,
      cache_read_input_tokens: 400,
      cache_creation_input_tokens: 50,
      prompt_tokens: 550,
      output_tokens: 25,
      completion_tokens: 25,
    });
    expect(usage.prompt_tokens).toBe(550);
    expect(usage.cached_tokens).toBe(400);
    expect(usage.cache_creation_input_tokens).toBe(50);
  });

  it("PR #5058: mergeUsage prefers real provider usage over estimated usage and preserves estimated flag when only estimated exists", () => {
    const est = { prompt_tokens: 500, completion_tokens: 200, estimated: true };
    const real = { prompt_tokens: 120, completion_tokens: 30 };
    expect(mergeUsage(est, real)).toEqual(real);
    expect(mergeUsage(real, est)).toEqual(real);
    const canonEst = canonicalizeUsage(est);
    expect(canonEst.estimated).toBe(true);
  });

  it("PR #5130: inspectJsonBody & peekStreamForContent detect content in JSON-in-SSE body", async () => {
    const raw = JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: "Hello from JSON" }, finish_reason: "stop" }],
    }) + "\ndata: [DONE]\n\n";
    expect(inspectJsonBody(raw)).toEqual({ content: true, finishReason: "stop" });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(raw));
        controller.close();
      },
    });
    const peek = await peekStreamForContent(stream);
    expect(peek.outcome).toBe("content");
    expect(peek.finishReason).toBe("stop");
  });

  it("PR #5129: isValidClaudeSignature accepts C-prefixed CAIS protobuf and normalizeClaudePassthrough strips thinking for non-Claude targets", () => {
    const sig = makeCaisSignature();
    expect(sig.startsWith("C")).toBe(true);
    expect(isValidClaudeSignature(sig)).toBe(true);
    expect(isClaudeModel("cc/claude-sonnet-5-5")).toBe(true);
    expect(isClaudeModel("glm/glm-5.3")).toBe(false);

    const claudeBody = normalizeClaudePassthrough({
      messages: [
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "step 1", signature: sig },
            { type: "text", text: "done" },
          ],
        },
      ],
    }, "claude-sonnet-5-5");
    expect(claudeBody.messages[0].content.some((b) => b.type === "thinking")).toBe(true);

    const nonClaudeBody = normalizeClaudePassthrough({
      messages: [
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "step 1", signature: sig },
            { type: "text", text: "done" },
          ],
        },
      ],
    }, "glm-5.3");
    expect(nonClaudeBody.messages[0].content.some((b) => b.type === "thinking")).toBe(false);
  });

  it("PR #5141: CodexExecutor drops foreign Grok/xAI reasoning items while keeping OpenAI Fernet items", () => {
    const exec = new CodexExecutor();
    const body = exec.transformRequest("gpt-5.3-codex", {
      model: "gpt-5.3-codex",
      input: [
        { type: "reasoning", id: "rs_12345678-1234-1234-1234-123456789abc", encrypted_content: "grok_cipher" },
        { type: "reasoning", id: "rs_abc", encrypted_content: "not_fernet_blob" },
        { type: "reasoning", id: "rs_openai", encrypted_content: "gAAAAABlOpenAIFernetToken" },
        { type: "message", role: "user", content: [{ type: "input_text", text: "hi" }] },
      ],
    }, true, {});
    const reasoningItems = body.input.filter((i) => i.type === "reasoning");
    expect(reasoningItems).toHaveLength(1);
    expect(reasoningItems[0].encrypted_content).toBe("gAAAAABlOpenAIFernetToken");
  });

  it("PR #5134: supportsGrokCliReasoningEffort accepts grok-4.5, grok-4.6, grok-4.7", () => {
    expect(supportsGrokCliReasoningEffort("grok-4.5")).toBe(true);
    expect(supportsGrokCliReasoningEffort("grok-4.6")).toBe(true);
    expect(supportsGrokCliReasoningEffort("grok-4.7-build-fast")).toBe(true);
    expect(supportsGrokCliReasoningEffort("grok-build")).toBe(false);
  });

  it("PR #5082: antigravityToOpenAIRequest coerces Proto3 int64 string constraints to numbers", () => {
    const out = antigravityToOpenAIRequest("gpt-5", {
      request: {
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
        tools: [{
          functionDeclarations: [{
            name: "search",
            parameters: {
              type: "OBJECT",
              minProperties: "1",
              properties: {
                tags: {
                  type: "ARRAY",
                  minItems: "1",
                  maxItems: "10",
                  items: { type: "STRING", minLength: "2", maxLength: "50" },
                },
              },
            },
          }],
        }],
      },
    }, false);
    const params = out.tools[0].function.parameters;
    expect(params.minProperties).toBe(1);
    expect(params.properties.tags.minItems).toBe(1);
    expect(params.properties.tags.maxItems).toBe(10);
    expect(params.properties.tags.items.minLength).toBe(2);
    expect(params.properties.tags.items.maxLength).toBe(50);
  });

  it("PR #5054: checkFallbackError treats 408, 425, 499 as transient fallback-eligible statuses", () => {
    for (const code of [408, 425, 499]) {
      const res = checkFallbackError(code, "gateway timeout");
      expect(res.shouldFallback).toBe(true);
      expect(res.requestScoped).toBeUndefined();
    }
    const badReq = checkFallbackError(422, "unprocessable entity");
    expect(badReq.shouldFallback).toBe(false);
    expect(badReq.requestScoped).toBe(true);
  });
});
