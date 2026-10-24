import { describe, it, expect, vi, afterEach } from "vitest";
import { compressMessages } from "../../open-sse/rtk/index.js";
import { compressWithHeadroom } from "../../open-sse/rtk/headroom.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";
import { BaseExecutor } from "../../open-sse/executors/base.js";

afterEach(() => vi.restoreAllMocks());

const BIG = Array.from({ length: 400 }, () => "same noisy repeated line of output").join("\n");

function openaiBody(tool, extra = {}) {
  return {
    messages: [
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: tool, arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: BIG, ...extra },
    ],
  };
}
function claudeBody(tool, block = {}) {
  return {
    messages: [
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: tool, input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: BIG, ...block }] },
    ],
  };
}
function responsesBody(tool) {
  return {
    input: [
      { type: "function_call", call_id: "r1", name: tool, arguments: "{}" },
      { type: "function_call_output", call_id: "r1", output: BIG },
    ],
  };
}

describe("RTK protected tools", () => {
  for (const tool of ["Read", "Edit", "Write", "Grep", "apply_patch", "mcp__fs__read_file"]) {
    it(`skips ${tool} across shapes`, () => {
      const o = openaiBody(tool); compressMessages(o, true);
      expect(o.messages[1].content).toBe(BIG);
      const c = claudeBody(tool); compressMessages(c, true);
      expect(c.messages[1].content[0].content).toBe(BIG);
      const r = responsesBody(tool); compressMessages(r, true);
      expect(r.input[1].output).toBe(BIG);
    });
  }

  it("still compresses Bash output", () => {
    const o = openaiBody("Bash"); compressMessages(o, true);
    const c = claudeBody("Bash"); compressMessages(c, true);
    const r = responsesBody("exec"); compressMessages(r, true);
    const shrunk = [o.messages[1].content, c.messages[1].content[0].content, r.input[1].output]
      .filter((t) => t.length < BIG.length);
    expect(shrunk.length).toBe(3);
  });

  it("skips error results", () => {
    const o = openaiBody("Bash", { is_error: true }); compressMessages(o, true);
    expect(o.messages[1].content).toBe(BIG);
    const c = claudeBody("Bash", { isError: true }); compressMessages(c, true);
    expect(c.messages[1].content[0].content).toBe(BIG);
    const j = openaiBody("Bash"); j.messages[1].content = `{"error": "x"}\n${BIG}`;
    const before = j.messages[1].content; compressMessages(j, true);
    expect(j.messages[1].content).toBe(before);
    const e = openaiBody("Bash"); e.messages[1].content = `Exit code 2\n${BIG}`;
    const eb = e.messages[1].content; compressMessages(e, true);
    expect(e.messages[1].content).toBe(eb);
  });
});

describe("Headroom restores protected results", () => {
  it("keeps Read and error results verbatim", async () => {
    global.fetch = vi.fn(async (_u, init) => {
      const msgs = JSON.parse(init.body).messages.map((m) => (m.role === "tool" ? { ...m, content: "SUMMARY" } : m));
      return new Response(JSON.stringify({ messages: msgs, tokens_saved: 1 }), { status: 200 });
    });
    const body = {
      messages: [
        { role: "assistant", content: null, tool_calls: [
          { id: "a", type: "function", function: { name: "Read", arguments: "{}" } },
          { id: "b", type: "function", function: { name: "Bash", arguments: "{}" } },
          { id: "c", type: "function", function: { name: "Bash", arguments: "{}" } },
        ] },
        { role: "tool", tool_call_id: "a", content: "1\tline one" },
        { role: "tool", tool_call_id: "b", content: "boom", is_error: true },
        { role: "tool", tool_call_id: "c", content: "ok output" },
      ],
    };
    await compressWithHeadroom(body, { enabled: true, url: "http://h:1", model: "gpt-4o", format: "openai" });
    expect(body.messages[1].content).toBe("1\tline one");
    expect(body.messages[2].content).toBe("boom");
    expect(body.messages[3].content).toBe("SUMMARY");
  });
});

describe("OpenCode classification and replay", () => {
  it("cooldowns", () => {
    expect(checkFallbackError(429, "abusive traffic from this IP address")).toMatchObject({ shouldFallback: true, cooldownMs: 30000 });
    expect(checkFallbackError(429, "FreeUsageLimitError: rate limit")).toMatchObject({ shouldFallback: true, cooldownMs: 60000 });
    expect(checkFallbackError(403, "FreeTierError")).toMatchObject({ shouldFallback: true, cooldownMs: 15000 });
  });

  const resp = (status, text) => ({ response: new Response(text, { status }) });

  it("replays direct on 403 FreeTierError via proxy", async () => {
    const spy = vi.spyOn(BaseExecutor.prototype, "execute")
      .mockResolvedValueOnce(resp(403, '{"type":"FreeTierError"}'))
      .mockResolvedValueOnce(resp(200, "ok"));
    const ex = new OpenCodeExecutor("opencode");
    const out = await ex.execute({ model: "x", body: { messages: [] }, credentials: {}, proxyOptions: { connectionProxyEnabled: true, connectionProxyUrl: "http://p" } });
    expect(out.response.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].proxyOptions.connectionProxyEnabled).toBe(false);
  });

  it("uses next proxy candidate on abusive traffic 429", async () => {
    const spy = vi.spyOn(BaseExecutor.prototype, "execute")
      .mockResolvedValueOnce(resp(429, "abusive traffic from this IP address"))
      .mockResolvedValueOnce(resp(200, "ok"));
    const ex = new OpenCodeExecutor("opencode");
    await ex.execute({ model: "x", body: { messages: [] }, credentials: {}, proxyOptions: { proxyCandidates: [{ proxyPoolId: "p2" }] } });
    expect(spy.mock.calls[1][0].proxyOptions.proxyPoolId).toBe("p2");
  });

  it("does not replay without proxy or on other errors", async () => {
    const spy = vi.spyOn(BaseExecutor.prototype, "execute").mockResolvedValue(resp(403, "FreeTierError"));
    const ex = new OpenCodeExecutor("opencode");
    await ex.execute({ model: "x", body: { messages: [] }, credentials: {} });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
