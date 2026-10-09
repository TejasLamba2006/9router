import { describe, expect, it } from "vitest";
import { getExecutor } from "../../open-sse/executors/index.js";

const provider = "openai-compatible-chat-679efd16-1ced-4571-91d2-8943d42c6e15";
const model = "gpt-5.6-sol";
const tools = () => Array.from({ length: 183 }, (_, i) => ({
  type: "function",
  function: { name: `tool_${i}`, parameters: { type: "object", properties: {} } },
}));

describe("OpenAI-compatible tool limit", () => {
  it("caps the personal Azure provider's 183 tools at 128", () => {
    const out = getExecutor(provider).transformRequest(model, { messages: [], tools: tools() }, false, {});
    expect(out.tools).toHaveLength(128);
    expect(out.tools[0].function.name).toBe("tool_0");
    expect(out.tools[127].function.name).toBe("tool_127");
  });

  it("retains forced and previously called tools outside the first 128", () => {
    const out = getExecutor(provider).transformRequest(model, {
      tools: tools(),
      tool_choice: { type: "function", function: { name: "tool_182" } },
      messages: [{ role: "assistant", tool_calls: [
        { id: "call_previous", type: "function", function: { name: "tool_180", arguments: "{}" } },
      ] }],
    }, false, {});
    expect(out.tools).toHaveLength(128);
    expect(out.tools.map((tool) => tool.function.name)).toContain("tool_182");
    expect(out.tools.map((tool) => tool.function.name)).toContain("tool_180");
    expect(out.tool_choice.function.name).toBe("tool_182");
  });

  it("also caps flat Responses tools on a compatible Responses provider", () => {
    const out = getExecutor("openai-compatible-responses-test").transformRequest(model, {
      input: [],
      tools: tools().map(({ function: fn }) => ({ type: "function", ...fn })),
      tool_choice: { type: "function", name: "tool_182" },
    }, false, { runtimeTransport: { format: "openai-responses" } });
    expect(out.tools).toHaveLength(128);
    expect(out.tools.map((tool) => tool.name)).toContain("tool_182");
  });

  it("retains tools already called in Responses input history without a new forced choice", () => {
    const out = getExecutor("openai-compatible-responses-test").transformRequest(model, {
      input: [
        { type: "function_call", call_id: "call_old", name: "tool_182", arguments: "{}" },
        { type: "function_call_output", call_id: "call_old", output: "done" },
      ],
      tools: tools().map(({ function: fn }) => ({ type: "function", ...fn })),
    }, false, { runtimeTransport: { format: "openai-responses" } });
    expect(out.tools).toHaveLength(128);
    expect(out.tools.map((tool) => tool.name)).toContain("tool_182");
  });
});
