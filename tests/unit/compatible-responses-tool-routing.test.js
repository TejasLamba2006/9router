// Routing guard: a custom OpenAI-compatible GPT-5.6+ request carrying function
// tools must reach the provider's OWN /responses endpoint, not chat/completions.
// Upstream rejects tools+reasoning_effort on chat ("use /v1/responses"), and the
// credential must never be redirected to another origin.
//
// Drives the REAL handleChatCore transport guard and translation; only the
// executor's HTTP response is mocked. Asserts on credentials.runtimeTransport
// (the field DefaultExecutor.buildUrl reads) and on the URL actually dispatched.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock("../../open-sse/executors/index.js", () => ({
  getExecutor: () => ({ noAuth: true, execute: executeMock }),
}));

vi.mock("../../open-sse/utils/requestLogger.js", () => ({
  createRequestLogger: async () => ({
    logClientRawRequest: vi.fn(), logRawRequest: vi.fn(), logTargetRequest: vi.fn(),
    logProviderResponse: vi.fn(), logConvertedResponse: vi.fn(), logError: vi.fn(),
  }),
}));

vi.mock("../../open-sse/utils/stream.js", async (importOriginal) => ({
  ...(await importOriginal()),
  createPassthroughStreamWithLogger: vi.fn(() => new TransformStream()),
}));

vi.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(), appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}), saveRequestUsage: vi.fn(async () => {}),
}));

vi.mock("../../open-sse/translator/concerns/image.js", () => ({
  encodeDataUri: (mimeType, base64) => `data:${mimeType};base64,${base64}`,
  parseDataUri: (url) => {
    const m = /^data:([^;]+);base64,(.*)$/.exec(url);
    return m ? { mimeType: m[1], base64: m[2] } : null;
  },
  fetchImageAsBase64: async () => null,
}));

const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");
const { DefaultExecutor } = await import("../../open-sse/executors/default.js");

const PROVIDER = "openai-compatible-chat-679efd16-1ced-4571-91d2-8943d42c6e15";
const BASE = "https://callkarospinnyaicalling.cognitiveservices.azure.com/openai/v1";
const tools = (n) => Array.from({ length: n }, (_, i) => ({
  name: `tool_${i}`, description: "A test function.", input_schema: { type: "object", properties: {} },
}));

const RESPONSES_BODY = {
  id: "resp_1", object: "response", created_at: 0, status: "completed", model: "gpt-5.6-sol",
  output: [{
    type: "message", id: "msg_1", role: "assistant", status: "completed",
    content: [{ type: "output_text", text: "ok", annotations: [] }],
  }],
};

async function route({ model, tools: t, provider = PROVIDER, baseUrl = BASE, thinking = true, credentials } = {}) {
  executeMock.mockImplementationOnce(async ({ credentials: creds, model: m, stream }) => {
    // DefaultExecutor.buildUrl is the real URL decision: runtimeTransport wins when set,
    // otherwise the node's own baseUrl + /chat/completions.
    const url = new DefaultExecutor(provider).buildUrl(m, stream, 0, creds);
    return {
      response: new Response(JSON.stringify(RESPONSES_BODY), { status: 200, headers: { "content-type": "application/json" } }),
      url,
      headers: {},
      transformedBody: null,
      responseFormat: creds.runtimeTransport?.format,
    };
  });

  const creds = credentials ?? { apiKey: "test-key", providerSpecificData: { baseUrl } };
  const result = await handleChatCore({
    body: {
      model: `${provider === PROVIDER ? "personal" : "openai"}/${model}`,
      stream: false, max_tokens: 256,
      // Claude Code asks for high effort with the Claude-shaped thinking block,
      // not a top-level reasoning_effort.
      ...(thinking ? { thinking: { type: "enabled", budget_tokens: 16000 } } : {}),
      messages: [{ role: "user", content: "say ok" }],
      ...(t ? { tools: t, tool_choice: { type: "tool", name: `tool_${t.length - 1}` } } : {}),
    },
    modelInfo: { provider, model },
    credentials: creds,
    connectionId: "compatible-responses-test",
    sourceFormatOverride: "claude",
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
  });

  const call = executeMock.mock.calls.at(-1)[0];
  const dispatched = await executeMock.mock.results.at(-1).value;
  return { result, runtimeTransport: call.credentials.runtimeTransport ?? null, url: dispatched.url, body: call.body };
}

describe("custom OpenAI GPT tool requests route to the provider's own /responses", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends gpt-5.6-sol + tools to <baseUrl>/responses, not chat/completions", async () => {
    const { result, runtimeTransport, url } = await route({ model: "gpt-5.6-sol", tools: tools(183) });
    expect(url).toBe("https://callkarospinnyaicalling.cognitiveservices.azure.com/openai/v1/responses");
    expect(url).not.toContain("api.openai.com");
    expect(runtimeTransport?.format).toBe("openai-responses");
    expect(result.success).toBe(true);
  });

  it("keeps the origin the operator configured, even with a trailing slash", async () => {
    const { url } = await route({ model: "gpt-6.1-sol", tools: tools(3), baseUrl: `${BASE}/` });
    expect(url).toBe("https://callkarospinnyaicalling.cognitiveservices.azure.com/openai/v1/responses");
  });

  it("translates to the Responses body and carries the Claude thinking budget as reasoning effort", async () => {
    const { body } = await route({ model: "gpt-5.6-sol", tools: tools(200) });
    expect(body.input).toBeDefined();
    expect(body.messages).toBeUndefined();
    expect(body.thinking).toBeUndefined();
    expect(typeof body.reasoning_effort).toBe("string");
    expect(body.reasoning_effort).not.toBe("");
    // Tool cap is enforced inside executor.execute(), which this test mocks
    // (see compatible-tool-limit.test.js); assert only that translation keeps
    // the forced tool intact on the Responses wire.
    expect(body.tools.map((x) => x.name)).toContain("tool_199");
  });

  it.each([
    ["gpt-5.1", "before the cutover, chat is fine"],
    ["gpt-5.2-mini", "before the cutover, chat is fine"],
    ["claude-sonnet-4", "non-GPT model"],
    ["llama-3.3-70b-versatile", "non-GPT model"],
  ])("leaves %s + tools on chat/completions (%s)", async (model) => {
    const { url, runtimeTransport } = await route({ model, tools: tools(200) });
    expect(url).toBe(`${BASE}/chat/completions`);
    expect(runtimeTransport).toBeNull();
  });

  it("leaves a gpt-5.6-sol request without tools on chat/completions", async () => {
    const { url, runtimeTransport } = await route({ model: "gpt-5.6-sol" });
    expect(url).toBe(`${BASE}/chat/completions`);
    expect(runtimeTransport).toBeNull();
  });

  it("still reroutes native openai gpt-6 with tools to api.openai.com responses", async () => {
    const { url } = await route({
      model: "gpt-6.1-sol", tools: tools(3), provider: "openai", baseUrl: undefined,
      credentials: { apiKey: "test-key", providerSpecificData: {} },
    });
    expect(url).toBe("https://api.openai.com/v1/responses");
  });

  it("falls back to the shared default base when the connection has none", async () => {
    const { url } = await route({
      model: "gpt-5.6-sol", tools: tools(3),
      credentials: { apiKey: "test-key", providerSpecificData: {} },
    });
    expect(url).toBe("https://api.openai.com/v1/responses");
  });
});