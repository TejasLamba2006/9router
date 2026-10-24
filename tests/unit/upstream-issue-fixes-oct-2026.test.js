import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
  saveRequestUsage: vi.fn(async () => {}),
  emitRequestError: vi.fn(),
}));

import { DefaultExecutor } from "../../open-sse/executors/default.js";
import { openaiToClaudeRequest } from "../../open-sse/translator/request/openai-to-claude.js";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { detectRequiredCapabilities } from "../../open-sse/services/combo.js";
import { openaiResponsesToOpenAIRequest } from "../../open-sse/translator/request/openai-responses.js";
import { ollamaBodyToOpenAI } from "../../open-sse/translator/response/ollama-to-openai.js";
import { createSSEStream } from "../../open-sse/utils/stream.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

describe("Upstream open issue fixes (Oct 2026)", () => {
  it("Issue #5139: DeepSeek executor converts response_format json_schema to json_object + system schema instruction", () => {
    const exec = new DefaultExecutor("deepseek");
    const out = exec.transformRequest("deepseek-chat", {
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Is the sky blue?" }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ans",
          schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
        },
      },
    }, false, {});
    expect(out.response_format).toEqual({ type: "json_object" });
    expect(out.messages[0].role).toBe("system");
    expect(out.messages[0].content).toContain('"answer"');
  });

  it("Issue #5125: openaiToClaudeRequest converts image_url inside role:tool messages to Claude image blocks", () => {
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const out = openaiToClaudeRequest("claude-sonnet-5-5", {
      messages: [
        { role: "user", content: "take screenshot" },
        {
          role: "assistant",
          tool_calls: [{ id: "call_1", type: "function", function: { name: "screenshot", arguments: "{}" } }],
        },
        {
          role: "tool",
          tool_call_id: "call_1",
          content: [
            { type: "text", text: "Captured:" },
            { type: "image_url", image_url: { url: `data:image/png;base64,${pngBase64}` } },
          ],
        },
      ],
    }, false);
    const toolResultMsg = out.messages.find((m) => Array.isArray(m.content) && m.content[0]?.type === "tool_result");
    expect(toolResultMsg).toBeTruthy();
    const inner = toolResultMsg.content[0].content;
    expect(Array.isArray(inner)).toBe(true);
    expect(inner[0]).toEqual({ type: "text", text: "Captured:" });
    expect(inner[1]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: pngBase64 },
    });
  });

  it("Issue #5108: applyThinking preserves explicit budget_tokens on deepseek thinkingFormat", () => {
    const body = applyThinking("openai", "deepseek-v4.1-flash", {
      model: "deepseek-v4.1-flash",
      thinking: { type: "enabled", budget_tokens: 16384 },
    }, "openai-compatible-chat-test");
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 16384 });
  });

  it("Issue #5126: detectRequiredCapabilities and openaiResponsesToOpenAIRequest handle images inside function_call_output", () => {
    const responsesBody = {
      input: [
        { type: "message", role: "user", content: [{ type: "input_text", text: "inspect" }] },
        { type: "function_call", call_id: "fc_1", name: "view_img", arguments: "{}" },
        {
          type: "function_call_output",
          call_id: "fc_1",
          output: [
            { type: "input_text", text: "image loaded" },
            { type: "input_image", image_url: "data:image/png;base64,AAAA" },
          ],
        },
      ],
    };
    const caps = detectRequiredCapabilities(responsesBody);
    expect(caps.has("vision")).toBe(true);

    const chatBody = openaiResponsesToOpenAIRequest("gpt-5", responsesBody, false, {});
    const toolMsg = chatBody.messages.find((m) => m.role === "tool");
    expect(Array.isArray(toolMsg.content)).toBe(true);
    expect(toolMsg.content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAAA", detail: "auto" },
    });
  });

  it("Issue #5137: ollamaBodyToOpenAI passes through OpenAI-formatted choices without blanking content", () => {
    const openaiShaped = {
      id: "chatcmpl-123",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content: "PONG" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 34, completion_tokens: 1, total_tokens: 35 },
    };
    expect(ollamaBodyToOpenAI(openaiShaped)).toBe(openaiShaped);
  });

  it("Issue #5030: createSSEStream preserves prompt_tokens_details.cached_tokens on Claude -> OpenAI streaming", async () => {
    const sse = createSSEStream({
      mode: "translate",
      targetFormat: FORMATS.CLAUDE,
      sourceFormat: FORMATS.OPENAI,
      provider: "claude",
      model: "claude-sonnet-5-5",
      body: { messages: [{ role: "user", content: "hi" }] },
    });

    const events = [
      'data: {"type":"message_start","message":{"id":"msg_1","model":"claude-sonnet-5-5","usage":{"input_tokens":50,"output_tokens":0,"cache_read_input_tokens":1200,"cache_creation_input_tokens":300}}}\n\n',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
      'data: {"type":"content_block_stop","index":0}\n\n',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":12}}\n\n',
      'data: {"type":"message_stop"}\n\n',
    ];

    const writer = sse.writable.getWriter();
    const reader = sse.readable.getReader();
    const chunks = [];
    const readAll = (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(new TextDecoder().decode(value));
      }
    })();

    for (const ev of events) {
      await writer.write(new TextEncoder().encode(ev));
    }
    await writer.close();
    await readAll;

    const full = chunks.join("");
    const dataLines = full
      .split("\n")
      .filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"))
      .map((l) => JSON.parse(l.slice(6)));
    const finalChunk = dataLines.find((c) => c.choices?.[0]?.finish_reason === "stop");
    expect(finalChunk).toBeTruthy();
    expect(finalChunk.usage.prompt_tokens_details).toEqual({
      cached_tokens: 1200,
      cache_creation_tokens: 300,
    });
  });
});
