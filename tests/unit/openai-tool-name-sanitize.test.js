import { describe, expect, it } from "vitest";
import { DefaultExecutor } from "../../open-sse/executors/default.js";
import { takeRenamedToolNames, restoreToolNames } from "../../open-sse/utils/opencodeFingerprint.js";

const VALID = /^[a-zA-Z0-9_-]{1,64}$/;
const MCP = "mcp__plugin_context7_context7__query.docs:v2";
const creds = { runtimeTransport: { format: "openai-responses", baseUrl: "https://api.openai.com/v1/responses" } };

describe("OpenAI tool name sanitizing", () => {
  it("rewrites tool declarations, tool_choice and history on the Responses wire", () => {
    const body = {
      tools: [{ type: "function", name: MCP, parameters: { type: "object", properties: {} } }, { type: "function", name: "Bash", parameters: {} }],
      tool_choice: { type: "function", name: MCP },
      input: [
        { type: "function_call", call_id: "c1", name: MCP, arguments: "{}" },
        { type: "function_call_output", call_id: "c1", output: "ok" },
      ],
    };
    const out = new DefaultExecutor("openai").transformRequest("gpt-6-astra", body, false, creds);
    const sent = out.tools[0].name;
    expect(sent).toMatch(VALID);
    expect(out.tools[1].name).toBe("Bash");
    expect(out.tool_choice.name).toBe(sent);
    expect(out.input[0].name).toBe(sent);
    expect(takeRenamedToolNames(out).get(sent)).toBe(MCP);
  });

  it("rewrites chat tools, tool_choice and assistant tool_calls", () => {
    const body = {
      messages: [{ role: "assistant", tool_calls: [{ id: "c1", type: "function", function: { name: MCP, arguments: "{}" } }] }],
      tools: [{ type: "function", function: { name: MCP, parameters: { type: "object", properties: {} } } }],
      tool_choice: { type: "function", function: { name: MCP } },
    };
    const out = new DefaultExecutor("openai").transformRequest("gpt-4o", body, false, {});
    const sent = out.tools[0].function.name;
    expect(sent).toMatch(VALID);
    expect(out.tool_choice.function.name).toBe(sent);
    expect(out.messages[0].tool_calls[0].function.name).toBe(sent);
  });

  it("keeps two names that sanitize alike distinct", () => {
    const body = { tools: [{ type: "function", name: "a.b", parameters: {} }, { type: "function", name: "a:b", parameters: {} }] };
    const out = new DefaultExecutor("openai").transformRequest("gpt-6-astra", body, false, creds);
    expect(out.tools[0].name).not.toBe(out.tools[1].name);
    expect(out.tools.every((t) => VALID.test(t.name))).toBe(true);
  });

  it("clamps names over 64 characters", () => {
    const long = "x".repeat(100);
    const out = new DefaultExecutor("openai").transformRequest("gpt-6-astra", { tools: [{ type: "function", name: long, parameters: {} }] }, false, creds);
    expect(out.tools[0].name).toMatch(VALID);
  });

  it("leaves valid names and the body identity untouched", () => {
    const body = { tools: [{ type: "function", name: "read_file", parameters: {} }] };
    const out = new DefaultExecutor("openai").transformRequest("gpt-6-astra", body, false, creds);
    expect(out.tools[0].name).toBe("read_file");
    expect(takeRenamedToolNames(out)).toBeNull();
  });

  it("restores the client's name on the response", () => {
    const body = { tools: [{ type: "function", name: MCP, parameters: {} }] };
    const out = new DefaultExecutor("openai").transformRequest("gpt-6-astra", body, false, creds);
    const sent = out.tools[0].name;
    const restored = restoreToolNames({ output: [{ type: "function_call", name: sent }] }, takeRenamedToolNames(out));
    expect(restored.output[0].name).toBe(MCP);
  });

  it("applies to openai-compatible nodes too, not to other providers", () => {
    const body = () => ({ tools: [{ type: "function", function: { name: MCP, parameters: {} } }] });
    const node = new DefaultExecutor("openai-compatible-x").transformRequest("m", body(), false, {});
    expect(node.tools[0].function.name).toMatch(VALID);
    const other = new DefaultExecutor("openrouter").transformRequest("m", body(), false, {});
    expect(other.tools[0].function.name).toBe(MCP);
  });

  it("records the map on the caller's body even when the executor clones it", () => {
    const body = {
      response_format: { type: "json_schema", json_schema: { schema: { type: "object" } } },
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: MCP, parameters: {} } }],
    };
    const out = new DefaultExecutor("openai-compatible-x").transformRequest("m", body, false, {});
    expect(out).not.toBe(body);
    const sent = out.tools[0].function.name;
    expect(takeRenamedToolNames(body).get(sent)).toBe(MCP);
  });
});
