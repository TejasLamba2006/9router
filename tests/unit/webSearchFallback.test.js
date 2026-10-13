// Layers 1+2 of the native web_search redirect: tool conversion (webSearchFallback.js)
// and whole-request routing (webSearchRouting.js). Pure functions, no mocks needed.
import { describe, expect, it } from "vitest";
import {
  NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME,
  prepareWebSearchFallbackBody,
  supportsNativeWebSearchFallbackBypass,
} from "open-sse/services/webSearchFallback.js";
import {
  hasNativeWebSearchTool,
  resolveWebSearchRouteOverride,
} from "open-sse/services/webSearchRouting.js";

const CLAUDE = "claude";
const OPENAI = "openai";
const RESPONSES = "openai-responses";

const nativeTool = { type: "web_search_20250305", name: "web_search", max_uses: 5 };
const functionTool = { type: "function", function: { name: "web_search", parameters: {} } };

function claudeBody(extra = {}) {
  return {
    model: "minimax/minimax-m2",
    messages: [{ role: "user", content: "hi" }],
    tools: [functionTool, { ...nativeTool }],
    ...extra,
  };
}

describe("prepareWebSearchFallbackBody (layer 1)", () => {
  it("converts the built-in web_search tool into the fallback function tool for a Claude client", () => {
    const body = claudeBody();
    const { body: next, fallback } = prepareWebSearchFallbackBody(body, {
      provider: "minimax", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: false,
    });
    expect(fallback.enabled).toBe(true);
    expect(fallback.toolName).toBe(NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME);
    expect(fallback.convertedToolCount).toBe(1);
    expect(next.tools).toHaveLength(2);
    const injected = next.tools[0];
    expect(injected.name).toBe(NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME);
    expect(injected.input_schema.properties.query.type).toBe("string");
    // untouched: the custom function tool named web_search stays
    expect(next.tools[1]).toBe(functionTool);
  });

  it("maps search_context_size to a default max_results", () => {
    const body = { ...claudeBody(), tools: [{ type: "web_search", search_context_size: "high" }] };
    const { body: next } = prepareWebSearchFallbackBody(body, {
      provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false,
    });
    expect(next.tools[0].input_schema.properties.max_results.default).toBe(10);
  });

  it("replaces a built-in web_search tool_choice", () => {
    const body = claudeBody({ tool_choice: { type: "web_search_20250305" } });
    const { body: next, fallback } = prepareWebSearchFallbackBody(body, {
      provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false,
    });
    expect(fallback.enabled).toBe(true);
    expect(next.tool_choice).toEqual({ type: "tool", name: NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME });
  });

  it("leaves the body untouched when the target runs web search natively", () => {
    const body = claudeBody();
    for (const opts of [
      { provider: "anthropic", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: true },
      { provider: "anthropic", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: false },
    ]) {
      const { body: next, fallback } = prepareWebSearchFallbackBody(body, opts);
      expect(fallback.enabled).toBe(false);
      expect(next).toBe(body);
    }
  });

  it("emits the injected tool in the client format (Responses flat, Chat nested)", () => {
    const responsesBody = { tools: [{ type: "web_search_preview" }] };
    const flat = prepareWebSearchFallbackBody(responsesBody, {
      provider: "gemini", sourceFormat: RESPONSES, targetFormat: RESPONSES, nativePassthrough: false,
    }).body.tools[0];
    expect(flat.type).toBe("function");
    expect(flat.name).toBe(NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME);
    expect(flat.parameters).toBeDefined();

    const chatBody = { tools: [{ type: "function", function: { name: "x" } }] };
    // no native tool -> disabled
    expect(prepareWebSearchFallbackBody(chatBody, {
      provider: "kimi", sourceFormat: OPENAI, targetFormat: OPENAI, nativePassthrough: false,
    }).fallback.enabled).toBe(false);
  });

  it("does not treat a custom function tool named web_search as the built-in", () => {
    const body = { tools: [functionTool] };
    const { fallback } = prepareWebSearchFallbackBody(body, {
      provider: "kimi", sourceFormat: OPENAI, targetFormat: OPENAI, nativePassthrough: false,
    });
    expect(fallback.enabled).toBe(false);
  });

  it("skips conversion when the tool is scoped with external_web_access:false", () => {
    // Routing a non-public search through external providers would break the scope,
    // so the whole request is left for the upstream to handle.
    const body = { tools: [{ ...nativeTool, external_web_access: false }] };
    const { body: next, fallback } = prepareWebSearchFallbackBody(body, {
      provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false,
    });
    expect(fallback.enabled).toBe(false);
    expect(next).toBe(body);
  });

  it("skips conversion when the client already owns the reserved fallback tool name", () => {
    // Converting anyway would make the interceptor run the client's own tool as a search.
    const ownedByClient = { type: "function", function: { name: NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME, parameters: {} } };
    const body = { tools: [{ ...nativeTool }, ownedByClient] };
    const { body: next, fallback } = prepareWebSearchFallbackBody(body, {
      provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false,
    });
    expect(fallback.enabled).toBe(false);
    expect(next).toBe(body);
  });
});

describe("supportsNativeWebSearchFallbackBypass", () => {
  it("never bypasses Gemini targets (9router translator does not map web_search)", () => {
    expect(supportsNativeWebSearchFallbackBypass({
      provider: "gemini", sourceFormat: OPENAI, targetFormat: OPENAI, nativePassthrough: false,
    })).toBe(false);
  });
});

describe("resolveWebSearchRouteOverride (layer 2)", () => {
  it("detects only native server tools", () => {
    expect(hasNativeWebSearchTool({ tools: [{ type: "web_search_20250305" }] })).toBe(true);
    expect(hasNativeWebSearchTool({ tools: [functionTool] })).toBe(false);
    expect(hasNativeWebSearchTool({})).toBe(false);
  });

  it("routes the whole request when webSearchRouteModel is set and different", () => {
    const body = { tools: [{ type: "web_search" }] };
    const route = resolveWebSearchRouteOverride("minimax/m2", body, { webSearchRouteModel: "anthropic/claude-opus-4-6" });
    expect(route).toEqual({ wasRouted: true, model: "anthropic/claude-opus-4-6" });
  });

  it("falls through without the tool, without config, or when already routed", () => {
    const body = { tools: [{ type: "web_search" }] };
    expect(resolveWebSearchRouteOverride("m", body, {}).wasRouted).toBe(false);
    expect(resolveWebSearchRouteOverride("m", {}, { webSearchRouteModel: "x" }).wasRouted).toBe(false);
    expect(resolveWebSearchRouteOverride("x", body, { webSearchRouteModel: "x" }).wasRouted).toBe(false);
  });
});

// ---- Native web_fetch redirect (layer 1) ----
import {
  NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME,
  prepareWebFetchFallbackBody,
  supportsNativeWebFetchFallbackBypass,
} from "open-sse/services/webSearchFallback.js";

const nativeFetch = { type: "web_fetch_20250910", name: "web_fetch", max_uses: 3, allowed_domains: ["example.com"], max_content_tokens: 5000, citations: { enabled: true } };
const fetchOpts = { provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false, provider_: "x" };

describe("prepareWebFetchFallbackBody", () => {
  it("converts the native web_fetch tool into a url function tool and keeps policy", () => {
    const body = { messages: [{ role: "user", content: "read https://example.com/a please" }], tools: [functionTool, { ...nativeFetch }] };
    const { body: next, fallback } = prepareWebFetchFallbackBody(body, fetchOpts);
    expect(fallback.enabled).toBe(true);
    expect(fallback.toolName).toBe(NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME);
    expect(fallback.convertedToolCount).toBe(1);
    expect(next.tools[0].name).toBe(NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME);
    expect(next.tools[0].input_schema.required).toEqual(["url"]);
    expect(next.tools[1]).toBe(functionTool);
    expect(fallback.policy).toEqual({
      maxUses: 3, allowedDomains: ["example.com"], blockedDomains: null, maxContentTokens: 5000, citations: true,
    });
    expect(fallback.priorUrls).toContain("https://example.com/a");
  });

  it("only converts Claude-format requests", () => {
    for (const sourceFormat of [OPENAI, RESPONSES]) {
      const body = { tools: [{ type: "web_fetch" }] };
      expect(prepareWebFetchFallbackBody(body, { ...fetchOpts, sourceFormat }).fallback.enabled).toBe(false);
    }
  });

  it("never matches a client function tool named web_fetch", () => {
    const body = { tools: [{ name: "web_fetch", description: "d", input_schema: { type: "object" } }, { type: "function", function: { name: "web_fetch" } }] };
    expect(prepareWebFetchFallbackBody(body, fetchOpts).fallback.enabled).toBe(false);
  });

  it("bypasses native passthrough, anthropic, anthropic-compatible and quirk providers", () => {
    const body = { tools: [{ ...nativeFetch }] };
    for (const opts of [
      { provider: "anthropic", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: false },
      { provider: "anthropic-compatible-x", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: false },
      { provider: "minimax", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: true },
    ]) {
      expect(supportsNativeWebFetchFallbackBypass(opts)).toBe(true);
      const { body: next, fallback } = prepareWebFetchFallbackBody(body, opts);
      expect(fallback.enabled).toBe(false);
      expect(next).toBe(body);
    }
    expect(supportsNativeWebFetchFallbackBypass({ provider: "minimax", sourceFormat: CLAUDE, targetFormat: CLAUDE, nativePassthrough: false })).toBe(false);
  });

  it("skips conversion when the client already owns the reserved tool name", () => {
    const body = { tools: [{ ...nativeFetch }, { name: NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME, input_schema: { type: "object" } }] };
    const { body: next, fallback } = prepareWebFetchFallbackBody(body, fetchOpts);
    expect(fallback.enabled).toBe(false);
    expect(next).toBe(body);
  });

  it("rewrites a forced tool_choice for the native tool", () => {
    for (const tool_choice of [{ type: "tool", name: "web_fetch" }, { type: "web_fetch_20250910" }]) {
      const { body: next } = prepareWebFetchFallbackBody({ tools: [{ ...nativeFetch }], tool_choice }, fetchOpts);
      expect(next.tool_choice).toEqual({ type: "tool", name: NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME });
    }
  });

  it("composes with the search conversion so both replacements survive", () => {
    const body = { messages: [{ role: "user", content: "hi" }], tools: [{ ...nativeTool }, { ...nativeFetch }] };
    const o = { provider: "minimax", sourceFormat: CLAUDE, targetFormat: OPENAI, nativePassthrough: false };
    const s = prepareWebSearchFallbackBody(body, o);
    const f = prepareWebFetchFallbackBody(s.body, o);
    expect(f.body.tools.map((t) => t.name).sort()).toEqual([NINEROUTER_WEB_FETCH_FALLBACK_TOOL_NAME, NINEROUTER_WEB_SEARCH_FALLBACK_TOOL_NAME].sort());
  });

  it("builds prior context only from user text, client tool_result and server result blocks", () => {
    const body = {
      system: "see https://system.example/only",
      tools: [{ ...nativeFetch }],
      messages: [
        { role: "user", content: [{ type: "text", text: "go to https://user.example/p." }] },
        { role: "assistant", content: [
          { type: "text", text: "I invented https://invented.example/x" },
          { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://search.example/r", title: "t" }] },
          { type: "web_fetch_tool_result", tool_use_id: "srvtoolu_2", content: { type: "web_fetch_result", url: "https://fetched.example/d" } },
        ] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: [{ type: "text", text: "link https://tool.example/y#frag" }] }] },
      ],
    };
    const urls = prepareWebFetchFallbackBody(body, fetchOpts).fallback.priorUrls;
    expect(urls).toEqual(expect.arrayContaining([
      "https://user.example/p", "https://search.example/r", "https://fetched.example/d", "https://tool.example/y",
    ]));
    expect(urls).not.toContain("https://invented.example/x");
    expect(urls).not.toContain("https://system.example/only");
  });
});
