import { describe, it, expect } from "vitest";
import {
  applyFingerprintTools,
  concealFingerprintToolNames,
  appendMissingFingerprintTools,
  fingerprintToolKey,
  restoreToolNames,
  takeRenamedToolNames,
  OPENCODE_FINGERPRINT_TOOLS,
} from "../../open-sse/utils/opencodeFingerprint.js";

const CC_TOOLS = ["Task", "Shell", "Glob", "Grep", "Read", "Edit", "Write", "WebFetch"];
const flat = (names) => names.map((name) => ({ type: "function", name }));
const chat = (names) => names.map((name) => ({ type: "function", function: { name } }));

describe("opencodeFingerprint — request side", () => {
  // Zen answers 200 only for the exact canonical read+shell declarations (verified live):
  // client-style tools with the same names get 403, so client tools are never rewritten
  // into them and the canonical pair is appended beside the client's own tools.
  it("keeps client tools verbatim and appends the canonical read and shell", () => {
    const body = { tools: flat(CC_TOOLS) };
    const map = applyFingerprintTools(body, true);
    const names = body.tools.map((tool) => tool.name);

    expect(names.slice(0, CC_TOOLS.length)).toEqual(CC_TOOLS);
    expect(names.slice(CC_TOOLS.length)).toEqual(["read", "shell"]);
    expect(map.size).toBe(0);
  });

  it("appends the canonical definitions with their real descriptions and schemas", () => {
    const body = { tools: flat(["Edit"]) };
    applyFingerprintTools(body, true);
    const shell = body.tools.find((tool) => tool.name === "shell");
    expect(shell.description).toMatch(/^Execute a shell command and return its output/);
    expect(shell.parameters.required).toEqual(["command"]);
  });

  it("renames a client tool that is already exactly read or shell, and maps it back", () => {
    const body = { tools: flat(["read", "shell", "Edit"]), tool_choice: { type: "function", name: "shell" } };
    const map = applyFingerprintTools(body, true);
    const names = body.tools.map((tool) => tool.name);

    expect(names).toEqual(["read_client", "shell_client", "Edit", "read", "shell"]);
    expect(map.get("read_client")).toBe("read");
    expect(map.get("shell_client")).toBe("shell");
    expect(body.tool_choice.name).toBe("shell_client");
  });

  it("handles the nested chat shape", () => {
    const body = { tools: chat(["read", "Edit"]), tool_choice: { type: "function", function: { name: "read" } } };
    applyFingerprintTools(body, false);

    expect(body.tools.map((tool) => tool.function.name)).toEqual(["read_client", "Edit", "read", "shell"]);
    expect(body.tool_choice.function.name).toBe("read_client");
  });

  it("injects the canonical pair when the body carries no tools", () => {
    const body = { tools: [] };
    applyFingerprintTools(body, true);

    expect(body.tools.map((tool) => tool.name).sort()).toEqual([...OPENCODE_FINGERPRINT_TOOLS].sort());
    expect(body.tool_choice).toBe("auto");
  });

  it("omits tool_choice for chat completions when caller supplies no tools to avoid 403", () => {
    const body = {};
    applyFingerprintTools(body, false);

    expect(body.tools.map((tool) => tool.function.name)).toEqual(OPENCODE_FINGERPRINT_TOOLS);
    expect(body.tool_choice).toBeUndefined();
  });

  it("does not invent a chat tool_choice when the caller already supplied tools", () => {
    const body = { tools: chat(["Edit"]) };
    applyFingerprintTools(body, false);
    expect(body.tool_choice).toBeUndefined();
  });

  it("records the rename map against the body for the response side", () => {
    const body = { tools: flat(["read"]) };
    const map = applyFingerprintTools(body, true);
    expect(takeRenamedToolNames(body)).toBe(map);
  });

  it("never throws on malformed tools", () => {
    for (const tools of [null, undefined, "nope", [null, 42, []], [{}, { name: "" }]]) {
      expect(() => concealFingerprintToolNames(tools)).not.toThrow();
      expect(() => appendMissingFingerprintTools(tools, true)).not.toThrow();
    }
  });
});

describe("opencodeFingerprint — response side", () => {
  const map = new Map([["bash", "Bash"], ["grep", "Grep"], ["read", "Read"]]);

  it("restores names in Claude content_block_start chunks", () => {
    const chunk = {
      type: "content_block_start",
      content_block: { type: "tool_use", name: "bash", id: "t1" },
    };
    const out = restoreToolNames(chunk, map);

    expect(out.content_block.name).toBe("Bash");
    expect(chunk.content_block.name).toBe("bash");
  });

  it("recursively restores streaming chunks inside arrays", () => {
    const chunks = [{
      choices: [{ delta: { tool_calls: [{ function: { name: "grep", arguments: "{}" } }] } }],
    }];
    const out = restoreToolNames(chunks, map);
    expect(out[0].choices[0].delta.tool_calls[0].function.name).toBe("Grep");
  });

  it("restores names in Claude non-streaming bodies", () => {
    const body = { type: "message", content: [{ type: "tool_use", name: "bash", input: {} }] };
    expect(restoreToolNames(body, map).content[0].name).toBe("Bash");
  });

  it("restores names in Chat Completions message and delta shapes", () => {
    const body = {
      choices: [
        { message: { tool_calls: [{ function: { name: "grep", arguments: "{}" } }] } },
        { delta: { tool_calls: [{ function: { name: "read", arguments: "{}" } }] } },
      ],
    };
    const out = restoreToolNames(body, map);

    expect(out.choices[0].message.tool_calls[0].function.name).toBe("Grep");
    expect(out.choices[1].delta.tool_calls[0].function.name).toBe("Read");
  });

  it("restores names in Responses final output items", () => {
    const body = { output: [{ type: "function_call", name: "bash", call_id: "c1" }] };
    expect(restoreToolNames(body, map).output[0].name).toBe("Bash");
  });

  it("restores names in Responses streaming output_item events", () => {
    const event = {
      type: "response.output_item.added",
      item: { type: "function_call", name: "read", call_id: "c1" },
    };
    expect(restoreToolNames(event, map).item.name).toBe("Read");
  });

  it("is a no-op without a map or with an empty map", () => {
    const body = { choices: [{ message: { tool_calls: [{ function: { name: "bash" } }] } }] };
    expect(restoreToolNames(body, null)).toBe(body);
    expect(restoreToolNames(body, new Map())).toBe(body);
  });

  it("leaves unknown tool names untouched", () => {
    const body = { output: [{ type: "function_call", name: "Edit" }] };
    expect(restoreToolNames(body, map).output[0].name).toBe("Edit");
  });
});

describe("fingerprintToolKey", () => {
  it("maps fingerprint case/whitespace variants and rejects other tools", () => {
    expect(fingerprintToolKey("Shell")).toBe("shell");
    expect(fingerprintToolKey(" shell ")).toBe("shell");
    expect(fingerprintToolKey("Read")).toBe("read");
    expect(fingerprintToolKey("Edit")).toBe("");
    expect(fingerprintToolKey("terminal")).toBe("");
    expect(fingerprintToolKey(null)).toBe("");
  });
});
