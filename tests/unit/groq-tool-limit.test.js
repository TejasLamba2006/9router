import { describe, expect, it } from "vitest";
import { getExecutor } from "../../open-sse/executors/index.js";

const model = "openai/gpt-oss-120b";
const makeTools = (count) => Array.from({ length: count }, (_, i) => ({
  type: "function",
  function: { name: `tool_${i}`, parameters: { type: "object", properties: {} } },
}));

describe("Groq tool limit", () => {
  it("caps 224 tools before dispatch to Groq", () => {
    const out = getExecutor("groq").transformRequest(model, { messages: [], tools: makeTools(224) }, false, {});
    expect(out.tools).toHaveLength(128);
    expect(out.tools[0].function.name).toBe("tool_0");
    expect(out.tools[127].function.name).toBe("tool_127");
  });

  it("preserves forced and previously called tools beyond the first 128", () => {
    const body = {
      tools: makeTools(224),
      tool_choice: { type: "function", function: { name: "tool_223" } },
      messages: [{ role: "assistant", tool_calls: [
        { id: "call_previous", type: "function", function: { name: "tool_200", arguments: "{}" } },
      ] }],
    };
    const out = getExecutor("groq").transformRequest(model, body, false, {});
    expect(out.tools).toHaveLength(128);
    expect(out.tools.map((tool) => tool.function.name)).toContain("tool_223");
    expect(out.tools.map((tool) => tool.function.name)).toContain("tool_200");
    expect(out.tool_choice).toEqual({ type: "function", function: { name: "tool_223" } });
  });

  it.each([0, 1, 128])("leaves %i tools unchanged", (count) => {
    const tools = makeTools(count);
    const out = getExecutor("groq").transformRequest(model, { messages: [], tools }, false, {});
    expect(out.tools).toBe(tools);
  });

  it("does not impose Groq's limit on unrelated providers", () => {
    const tools = makeTools(224);
    const out = getExecutor("openrouter").transformRequest(model, { messages: [], tools }, false, {});
    expect(out.tools).toBe(tools);
    expect(out.tools).toHaveLength(224);
  });
});
