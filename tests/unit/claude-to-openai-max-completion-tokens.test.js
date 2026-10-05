import { describe, expect, it } from "vitest";
import { claudeToOpenAIRequest } from "../../open-sse/translator/request/claude-to-openai.js";
import { usesMaxCompletionTokens } from "../../open-sse/translator/formats/maxTokens.js";
import { DefaultExecutor } from "../../open-sse/executors/default.js";

const body = { max_tokens: 1000, messages: [{ role: "user", content: "hi" }] };

const NEW_MODELS = ["gpt-5", "gpt-5.2-mini", "gpt-6.1-sol", "openai/gpt-6.1-sol", "gpt-10", "o1", "o3", "o4-mini", "o5", "openai/o3"];
const OLD_MODELS = ["gpt-4o", "gpt-4.1", "gpt-4-turbo", "gpt-oss-120b", "claude-sonnet-4", "pro3", "foo4", "deepseek-chat", "gemini-3-pro"];

describe("usesMaxCompletionTokens (#1745)", () => {
  it.each(NEW_MODELS)("%s needs max_completion_tokens", (m) => expect(usesMaxCompletionTokens(m)).toBe(true));
  it.each(OLD_MODELS)("%s keeps max_tokens", (m) => expect(usesMaxCompletionTokens(m)).toBe(false));
});

describe("claudeToOpenAIRequest max token field", () => {
  it.each(NEW_MODELS)("%s emits max_completion_tokens", (model) => {
    const out = claudeToOpenAIRequest(model, body, false);
    expect(out.max_completion_tokens).toBeGreaterThan(0);
    expect(out.max_tokens).toBeUndefined();
  });
  it.each(OLD_MODELS)("%s emits max_tokens", (model) => {
    const out = claudeToOpenAIRequest(model, body, false);
    expect(out.max_tokens).toBeGreaterThan(0);
    expect(out.max_completion_tokens).toBeUndefined();
  });
});

describe("DefaultExecutor for OpenAI-format clients", () => {
  it("renames max_tokens for gpt-6.1-sol on the openai provider", () => {
    const ex = new DefaultExecutor("openai");
    const out = ex.transformRequest("gpt-6.1-sol", { ...body }, false, {});
    expect(out.max_completion_tokens).toBe(1000);
    expect(out.max_tokens).toBeUndefined();
  });
  it("keeps an explicit max_completion_tokens from the client", () => {
    const ex = new DefaultExecutor("openai");
    const out = ex.transformRequest("gpt-6.1-sol", { ...body, max_completion_tokens: 50 }, false, {});
    expect(out.max_completion_tokens).toBe(50);
    expect(out.max_tokens).toBeUndefined();
  });
  it("leaves older models alone", () => {
    const ex = new DefaultExecutor("openai");
    const out = ex.transformRequest("gpt-4o", { ...body }, false, {});
    expect(out.max_tokens).toBe(1000);
  });
});

describe("DefaultExecutor openai tool cap", () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ type: "function", function: { name: `t${i}`, parameters: { type: "object", properties: {} } } }));
  it("caps 224 tools to 128 and keeps order", () => {
    const out = new DefaultExecutor("openai").transformRequest("gpt-4o", { messages: [], tools: mk(224) }, false, {});
    expect(out.tools).toHaveLength(128);
    expect(out.tools[0].function.name).toBe("t0");
  });
  it("keeps a forced tool_choice tool and tools already called", () => {
    const body = {
      messages: [{ role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: "t200", arguments: "{}" } }] }],
      tool_choice: { type: "function", function: { name: "t210" } },
      tools: mk(224),
    };
    const names = new DefaultExecutor("openai").transformRequest("gpt-4o", body, false, {}).tools.map((t) => t.function.name);
    expect(names).toHaveLength(128);
    expect(names).toContain("t200");
    expect(names).toContain("t210");
  });
  it("leaves 128 or fewer untouched", () => {
    const out = new DefaultExecutor("openai").transformRequest("gpt-4o", { messages: [], tools: mk(128) }, false, {});
    expect(out.tools).toHaveLength(128);
  });
});

describe("needsResponsesForTools (litellm#33221, frigate#24555)", async () => {
  const { needsResponsesForTools } = await import("../../open-sse/translator/formats/maxTokens.js");
  const withTools = { tools: [{ type: "function", function: { name: "f" } }] };
  it.each(["gpt-5.4", "gpt-5.6-sol", "gpt-6.1-sol", "openai/gpt-6-luna", "gpt-10"])("%s + tools needs /responses", (m) =>
    expect(needsResponsesForTools(m, withTools)).toBe(true));
  it.each(["gpt-5", "gpt-5.1", "gpt-5.2-mini", "gpt-4o", "o3", "claude-sonnet-4"])("%s keeps chat", (m) =>
    expect(needsResponsesForTools(m, withTools)).toBe(false));
  it("no tools means no reroute", () => expect(needsResponsesForTools("gpt-6.1-sol", {})).toBe(false));
});
