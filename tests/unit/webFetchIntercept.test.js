// Layer 0 of the native web_fetch redirect. handleFetch and the SSRF guard are mocked;
// what is verified is URL policy, block shapes, usage counters and fail-open behaviour.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSettings: vi.fn(), handleFetch: vi.fn(), assertPublicUrlResolved: vi.fn() }));
vi.mock("@/lib/localDb", () => ({ getSettings: mocks.getSettings, getCombos: vi.fn() }));
vi.mock("@/sse/handlers/fetch.js", () => ({ handleFetch: mocks.handleFetch }));
vi.mock("@/shared/utils/ssrfGuard.js", () => ({ assertPublicUrlResolved: mocks.assertPublicUrlResolved }));
// webSearchIntercept (shared helpers) pulls these in at import time.
vi.mock("@/sse/services/auth.js", () => ({ getProviderCredentials: vi.fn(), markAccountUnavailable: vi.fn(), clearAccountError: vi.fn() }));
vi.mock("@/sse/services/tokenRefresh.js", () => ({ updateProviderCredentials: vi.fn(), checkAndRefreshToken: vi.fn() }));
vi.mock("open-sse/handlers/search/index.js", () => ({ handleSearchCore: vi.fn() }));

const { applyWebFetchFallback } = await import("open-sse/handlers/chatCore/webFetchIntercept.js");

const policy = (o = {}) => ({ maxUses: null, allowedDomains: null, blockedDomains: null, maxContentTokens: null, citations: false, ...o });
const plan = (o = {}) => ({ enabled: true, toolName: "9router_web_fetch", convertedToolCount: 1, policy: policy(o.policy), priorUrls: o.priorUrls || ["https://example.com/a"] });
const resp = (...urls) => ({
  type: "message",
  content: urls.map((u, i) => ({ type: "tool_use", id: `tu_${i}`, name: "9router_web_fetch", input: { url: u } })),
  stop_reason: "tool_use",
});
const ok = (text = "page body") => new Response(JSON.stringify({ title: "T", content: { text } }), { status: 200 });
const run = (response, p = plan()) => applyWebFetchFallback({ translatedResponse: response, sourceFormat: "claude", fallbackPlan: p, apiKey: "k", log: {} });
const errCode = (out, i = 1) => out.content[i].content.error_code;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSettings.mockResolvedValue({ webFetchFallbackProvider: "firecrawl" });
  mocks.assertPublicUrlResolved.mockResolvedValue(undefined);
  mocks.handleFetch.mockImplementation(async () => ok());
});

describe("applyWebFetchFallback", () => {
  it("rewrites a fetch call into server_tool_use + web_fetch_tool_result with usage", async () => {
    const out = await run(resp("https://example.com/a"));
    expect(out.content.map((b) => b.type)).toEqual(["server_tool_use", "web_fetch_tool_result", "text"]);
    expect(out.content[0].name).toBe("web_fetch");
    expect(out.content[0].id).toMatch(/^srvtoolu_[a-zA-Z0-9_]+$/);
    const result = out.content[1];
    expect(result.tool_use_id).toBe(out.content[0].id);
    expect(result.content.type).toBe("web_fetch_result");
    expect(result.content.url).toBe("https://example.com/a");
    expect(result.content.content.type).toBe("document");
    expect(result.content.content.source).toEqual({ type: "text", media_type: "text/plain", data: "page body" });
    expect(typeof result.content.retrieved_at).toBe("string");
    expect(out.usage.server_tool_use.web_fetch_requests).toBe(1);
    expect(out.stop_reason).toBe("end_turn");
    const body = await mocks.handleFetch.mock.calls[0][0].json();
    expect(body).toMatchObject({ provider: "firecrawl", url: "https://example.com/a", format: "markdown" });
    expect(mocks.handleFetch.mock.calls[0][0].headers.get("authorization")).toBe("Bearer k");
  });

  it("matches the tool name when Gemini prefixes a leading underscore", async () => {
    const r = resp("https://example.com/a");
    r.content[0].name = "_9router_web_fetch";
    const out = await run(r);
    expect(out.content.map((b) => b.type)).toEqual(["server_tool_use", "web_fetch_tool_result", "text"]);
  });

  it("keeps an existing web_search counter additive", async () => {
    const r = { ...resp("https://example.com/a"), usage: { server_tool_use: { web_search_requests: 2 } } };
    const out = await run(r);
    expect(out.usage.server_tool_use).toEqual({ web_search_requests: 2, web_fetch_requests: 1 });
  });

  it("rejects URLs not in prior context without touching the network", async () => {
    const out = await run(resp("https://evil.example/x"));
    expect(errCode(out)).toBe("url_not_in_prior_context");
    expect(mocks.handleFetch).not.toHaveBeenCalled();
    expect(out.usage.server_tool_use.web_fetch_requests).toBe(1);
  });

  it("matches prior context after fragment normalisation", async () => {
    const out = await run(resp("https://example.com/a#section"));
    expect(out.content[1].content.type).toBe("web_fetch_result");
  });

  it("enforces allowed_domains including subdomains", async () => {
    const p = plan({ policy: { allowedDomains: ["example.com"] }, priorUrls: ["https://docs.example.com/x", "https://other.org/y"] });
    expect((await run(resp("https://docs.example.com/x"), p)).content[1].content.type).toBe("web_fetch_result");
    expect(errCode(await run(resp("https://other.org/y"), p))).toBe("url_not_allowed");
  });

  it("enforces blocked_domains", async () => {
    const p = plan({ policy: { blockedDomains: ["example.com"] } });
    expect(errCode(await run(resp("https://example.com/a"), p))).toBe("url_not_allowed");
  });

  it("rejects allow plus block lists together", async () => {
    const p = plan({ policy: { allowedDomains: ["a.com"], blockedDomains: ["b.com"] } });
    expect(errCode(await run(resp("https://example.com/a"), p))).toBe("invalid_tool_input");
  });

  it("rejects over-long URLs and a missing url", async () => {
    const long = "https://example.com/" + "a".repeat(260);
    expect(errCode(await run(resp(long), plan({ priorUrls: [long] })))).toBe("url_too_long");
    const noUrl = { type: "message", content: [{ type: "tool_use", id: "t", name: "9router_web_fetch", input: {} }] };
    expect(errCode(await run(noUrl))).toBe("invalid_tool_input");
  });

  it("blocks private targets via the SSRF guard", async () => {
    mocks.assertPublicUrlResolved.mockRejectedValue(new Error("Blocked URL: internal host"));
    const out = await run(resp("https://example.com/a"));
    expect(errCode(out)).toBe("url_not_allowed");
    expect(mocks.handleFetch).not.toHaveBeenCalled();
  });

  it("caps calls at max_uses", async () => {
    const p = plan({ policy: { maxUses: 1 }, priorUrls: ["https://example.com/a", "https://example.com/b"] });
    const out = await run(resp("https://example.com/a", "https://example.com/b"), p);
    const results = out.content.filter((b) => b.type === "web_fetch_tool_result");
    expect(results[0].content.type).toBe("web_fetch_result");
    expect(results[1].content.error_code).toBe("max_uses_exceeded");
    expect(mocks.handleFetch).toHaveBeenCalledTimes(1);
  });

  it("maps max_content_tokens to a character limit and caps the default", async () => {
    await run(resp("https://example.com/a"), plan({ policy: { maxContentTokens: 1000 } }));
    expect((await mocks.handleFetch.mock.calls[0][0].json()).max_characters).toBe(4000);
    await run(resp("https://example.com/a"));
    const capped = (await mocks.handleFetch.mock.calls[1][0].json()).max_characters;
    expect(capped).toBeGreaterThan(0);
    expect(capped).toBeLessThanOrEqual(400000);
  });

  it("maps provider failures to documented error codes", async () => {
    for (const [status, code] of [[429, "too_many_requests"], [503, "unavailable"], [404, "url_not_accessible"]]) {
      mocks.handleFetch.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status }));
      expect(errCode(await run(resp("https://example.com/a")))).toBe(code);
    }
  });

  it("declines when no provider is configured", async () => {
    mocks.getSettings.mockResolvedValue({ webFetchFallbackProvider: "" });
    const out = await run(resp("https://example.com/a"));
    expect(errCode(out)).toBe("unavailable");
    expect(mocks.handleFetch).not.toHaveBeenCalled();
  });

  it("preserves a remaining client tool_use after the injected result", async () => {
    const r = resp("https://example.com/a");
    r.content.push({ type: "tool_use", id: "tu_x", name: "Read", input: {} });
    const out = await run(r);
    expect(out.content.map((b) => b.type)).toEqual(["server_tool_use", "web_fetch_tool_result", "text", "tool_use"]);
    expect(out.stop_reason).toBe("tool_use");
  });

  it("is a no-op for disabled plans, non-Claude clients and unrelated tool calls", async () => {
    const r = resp("https://example.com/a");
    expect(await run(r, { enabled: false })).toBe(r);
    expect(await applyWebFetchFallback({ translatedResponse: r, sourceFormat: "openai", fallbackPlan: plan(), log: {} })).toBe(r);
    const other = { type: "message", content: [{ type: "tool_use", id: "t", name: "Read", input: {} }] };
    expect(await run(other)).toBe(other);
  });

  it("turns a throwing fetch handler into an unavailable error result", async () => {
    mocks.handleFetch.mockRejectedValue(new Error("boom"));
    const out = await run(resp("https://example.com/a"));
    expect(errCode(out)).toBe("unavailable");
  });
});
