import { describe, expect, it } from "vitest";
import {
  PLAYGROUND_MODES,
  getDefaultSettings,
  parseAdvancedJson,
  mergeAdvanced,
  buildPlaygroundRequest,
  buildVideoPollRequest,
  toFormData,
  createStreamState,
  splitSseEvents,
  reduceStreamEvent,
  finalizeAssistantMessage,
  buildToolResultMessage,
  normalizeResponse,
} from "../../src/shared/utils/playgroundRequest.js";

describe("modes and defaults", () => {
  it("lists all six modes", () => {
    expect(PLAYGROUND_MODES).toEqual(["chat", "image", "tts", "stt", "embedding", "video"]);
  });

  it("returns a fresh defaults object per mode", () => {
    for (const mode of PLAYGROUND_MODES) {
      const a = getDefaultSettings(mode);
      expect(a).toBeTypeOf("object");
      a.mutated = true;
      expect(getDefaultSettings(mode).mutated).toBeUndefined();
    }
    expect(getDefaultSettings("chat").stream).toBe(true);
    expect(getDefaultSettings("tts").response_format).toBe("mp3");
  });

  it("rejects unknown modes", () => {
    expect(() => getDefaultSettings("nope")).toThrow(/mode/);
  });
});

describe("parseAdvancedJson", () => {
  it("treats blank input as an empty object", () => {
    expect(parseAdvancedJson("")).toEqual({ ok: true, value: {} });
    expect(parseAdvancedJson("   \n")).toEqual({ ok: true, value: {} });
    expect(parseAdvancedJson(undefined)).toEqual({ ok: true, value: {} });
  });

  it("parses a JSON object", () => {
    expect(parseAdvancedJson('{"seed": 3}')).toEqual({ ok: true, value: { seed: 3 } });
  });

  it("reports syntax errors", () => {
    const r = parseAdvancedJson("{bad");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/JSON/);
  });

  it("rejects non-object JSON", () => {
    for (const text of ["[1]", "1", '"x"', "null", "true"]) {
      const r = parseAdvancedJson(text);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/object/);
    }
  });
});

describe("mergeAdvanced", () => {
  it("adds and overrides ordinary fields", () => {
    const r = mergeAdvanced({ model: "m", temperature: 1 }, { temperature: 0.2, seed: 7 });
    expect(r.body).toEqual({ model: "m", temperature: 0.2, seed: 7 });
    expect(r.ignored).toEqual([]);
  });

  it("cannot override protected fields", () => {
    const base = { model: "m", messages: [{ role: "user", content: "hi" }], stream: true };
    const adv = {
      model: "evil", messages: [], input: "x", prompt: "x", file: "x", files: [], stream: false,
      url: "http://x", endpoint: "/x", base_url: "http://x", baseUrl: "http://x", api_base: "x",
      headers: { authorization: "x" }, authorization: "x", api_key: "k", apiKey: "k",
      "x-connection-id": "c", connection_id: "c", connectionId: "c", provider: "p",
      request_id: "r", id: "r", job_id: "j", jobId: "j", top_k: 5,
    };
    const r = mergeAdvanced(base, adv);
    expect(r.body).toEqual({ ...base, top_k: 5 });
    expect(r.ignored.sort()).toEqual(Object.keys(adv).filter((k) => k !== "top_k").sort());
  });

  it("matches protected keys case-insensitively", () => {
    const r = mergeAdvanced({ model: "m" }, { Model: "x", AUTHORIZATION: "y", Stream: false });
    expect(r.body).toEqual({ model: "m" });
    expect(r.ignored).toHaveLength(3);
  });

  it("blocks prototype pollution keys", () => {
    const adv = JSON.parse('{"__proto__": {"polluted": 1}, "constructor": 1, "prototype": 2}');
    const r = mergeAdvanced({ model: "m" }, adv);
    expect(r.body.polluted).toBeUndefined();
    expect(Object.getPrototypeOf(r.body)).toBe(Object.prototype);
    expect(({}).polluted).toBeUndefined();
    expect(r.ignored.sort()).toEqual(["__proto__", "constructor", "prototype"]);
  });

  it("does not mutate inputs", () => {
    const base = { model: "m" };
    const adv = { seed: 1 };
    mergeAdvanced(base, adv);
    expect(base).toEqual({ model: "m" });
    expect(adv).toEqual({ seed: 1 });
  });

  it("tolerates missing advanced", () => {
    expect(mergeAdvanced({ model: "m" }).body).toEqual({ model: "m" });
  });
});

describe("buildPlaygroundRequest", () => {
  it("requires a model", () => {
    expect(() => buildPlaygroundRequest({ mode: "chat", model: " ", input: { messages: [] } })).toThrow(/model/);
  });

  it("builds a streaming chat request with system prompt and omitted nulls", () => {
    const req = buildPlaygroundRequest({
      mode: "chat",
      model: "openai/gpt",
      settings: { ...getDefaultSettings("chat"), system: "be brief", max_tokens: null },
      input: { messages: [{ role: "user", content: "hi" }] },
      advanced: '{"top_p": 0.5, "stream": false, "model": "x"}',
    });
    expect(req).toMatchObject({ method: "POST", path: "/api/v1/chat/completions", bodyType: "json", responseType: "sse" });
    expect(req.body.model).toBe("openai/gpt");
    expect(req.body.stream).toBe(true);
    expect(req.body.stream_options).toEqual({ include_usage: true });
    expect(req.body.top_p).toBe(0.5);
    expect(req.body.messages).toEqual([
      { role: "system", content: "be brief" },
      { role: "user", content: "hi" },
    ]);
    expect("max_tokens" in req.body).toBe(false);
    expect("system" in req.body).toBe(false);
    expect(req.ignored.sort()).toEqual(["model", "stream"]);
  });

  it("builds a non-streaming chat request", () => {
    const req = buildPlaygroundRequest({
      mode: "chat", model: "m", settings: { stream: false }, input: { messages: [{ role: "user", content: "x" }] },
    });
    expect(req.responseType).toBe("json");
    expect(req.body.stream).toBe(false);
    expect(req.body.stream_options).toBeUndefined();
  });

  it("rejects chat without messages", () => {
    expect(() => buildPlaygroundRequest({ mode: "chat", model: "m", input: { messages: [] } })).toThrow(/message/);
  });

  it("throws on invalid advanced JSON", () => {
    expect(() => buildPlaygroundRequest({
      mode: "image", model: "m", input: { prompt: "cat" }, advanced: "{",
    })).toThrow(/Advanced JSON/);
  });

  it("accepts an advanced object as well as text", () => {
    const req = buildPlaygroundRequest({ mode: "image", model: "m", input: { prompt: "cat" }, advanced: { style: "vivid" } });
    expect(req.body.style).toBe("vivid");
  });

  it("builds an image request", () => {
    const req = buildPlaygroundRequest({ mode: "image", model: "m", input: { prompt: "a cat" } });
    expect(req).toMatchObject({ path: "/api/v1/images/generations", bodyType: "json", responseType: "json" });
    expect(req.body).toMatchObject({ model: "m", prompt: "a cat", n: 1, size: "1024x1024" });
    expect(() => buildPlaygroundRequest({ mode: "image", model: "m", input: { prompt: "" } })).toThrow(/prompt/);
  });

  it("builds a tts request expecting a blob", () => {
    const req = buildPlaygroundRequest({ mode: "tts", model: "openai/tts-1", input: { text: "hello" } });
    expect(req).toMatchObject({ path: "/api/v1/audio/speech", bodyType: "json", responseType: "blob" });
    expect(req.body).toMatchObject({ model: "openai/tts-1", input: "hello", response_format: "mp3" });
    expect(() => buildPlaygroundRequest({ mode: "tts", model: "m", input: { text: "" } })).toThrow(/text/);
  });

  it("builds an stt multipart spec with the file last-protected", () => {
    const file = new Blob(["abc"], { type: "audio/wav" });
    const req = buildPlaygroundRequest({
      mode: "stt", model: "openai/whisper-1", input: { file, fileName: "a.wav" },
      settings: { language: "en", response_format: "json" }, advanced: '{"temperature": 0, "file": "x"}',
    });
    expect(req).toMatchObject({ path: "/api/v1/audio/transcriptions", bodyType: "form", responseType: "json" });
    expect(req.body).toBeUndefined();
    const names = req.formFields.map((f) => f.name);
    expect(names.slice(0, -1).sort()).toEqual(["language", "model", "response_format", "temperature"]);
    expect(names.at(-1)).toBe("file");
    expect(req.formFields.at(-1)).toEqual({ name: "file", value: file, fileName: "a.wav" });
    expect(req.formFields.find((f) => f.name === "temperature").value).toBe("0");
    expect(req.ignored).toEqual(["file"]);
    expect(() => buildPlaygroundRequest({ mode: "stt", model: "m", input: {} })).toThrow(/file/);
  });

  it("serialises object form values as JSON in stt", () => {
    const req = buildPlaygroundRequest({
      mode: "stt", model: "m", input: { file: new Blob(["a"]) }, advanced: { timestamp_granularities: ["word"] },
    });
    expect(req.formFields.find((f) => f.name === "timestamp_granularities").value).toBe('["word"]');
    expect(req.formFields.at(-1).fileName).toBe("audio");
  });

  it("builds an embedding request from a string or list", () => {
    const one = buildPlaygroundRequest({ mode: "embedding", model: "m", input: { text: "hi" } });
    expect(one).toMatchObject({ path: "/api/v1/embeddings", responseType: "json" });
    expect(one.body).toMatchObject({ model: "m", input: "hi", encoding_format: "float" });
    const many = buildPlaygroundRequest({ mode: "embedding", model: "m", input: { text: ["a", "b"] } });
    expect(many.body.input).toEqual(["a", "b"]);
    expect(() => buildPlaygroundRequest({ mode: "embedding", model: "m", input: { text: [] } })).toThrow(/text/);
    expect(() => buildPlaygroundRequest({ mode: "embedding", model: "m", input: { text: "" } })).toThrow(/text/);
  });

  it("builds a video create request", () => {
    const req = buildPlaygroundRequest({
      mode: "video", model: "xai/grok-imagine-video", input: { prompt: "waves" }, advanced: { request_id: "x", seed: 2 },
    });
    expect(req).toMatchObject({ path: "/api/v1/videos/generations", responseType: "json" });
    expect(req.body).toMatchObject({ model: "xai/grok-imagine-video", prompt: "waves", duration: 5, seed: 2 });
    expect(req.body.request_id).toBeUndefined();
    expect(req.ignored).toEqual(["request_id"]);
  });

  it("never returns headers settable by the caller", () => {
    const req = buildPlaygroundRequest({ mode: "image", model: "m", input: { prompt: "p" }, advanced: { headers: { a: 1 } } });
    expect(req.headers).toEqual({ "Content-Type": "application/json" });
  });

  it("drops every auth/routing header attempt in every mode", () => {
    const advanced = {
      headers: { Authorization: "Bearer sk-x" }, Authorization: "Bearer sk-x", "x-api-key": "k",
      cookie: "s=1", "x-connection-id": "c", "x-9router-connection-id": "c", "proxy-authorization": "p",
    };
    const inputs = {
      chat: { messages: [{ role: "user", content: "x" }] }, image: { prompt: "p" }, tts: { text: "t" },
      stt: { file: new Blob(["a"]) }, embedding: { text: "e" }, video: { prompt: "v" },
    };
    for (const mode of PLAYGROUND_MODES) {
      const req = buildPlaygroundRequest({ mode, model: "m", input: inputs[mode], advanced, settings: { headers: { Authorization: "x" } } });
      const serialized = JSON.stringify([req.headers, req.body, req.formFields?.map((f) => f.name)]);
      expect(serialized).not.toMatch(/authorization|sk-x|x-api-key|cookie|connection/i);
      expect(req.ignored.sort()).toEqual(Object.keys(advanced).sort());
    }
  });

  it("leaves Content-Type unset for multipart so the browser adds the boundary", () => {
    const req = buildPlaygroundRequest({ mode: "stt", model: "m", input: { file: new Blob(["a"]) } });
    expect(req.headers).toEqual({});
  });
});

describe("buildVideoPollRequest", () => {
  it("encodes the job id and pins the connection", () => {
    expect(buildVideoPollRequest("a/b?c", "conn-1")).toEqual({
      method: "GET",
      path: "/api/v1/videos/a%2Fb%3Fc",
      headers: { "x-connection-id": "conn-1" },
      bodyType: "none",
      responseType: "json",
    });
    expect(buildVideoPollRequest("id").headers).toEqual({});
  });

  it("requires a job id", () => {
    expect(() => buildVideoPollRequest("")).toThrow(/job id/);
  });
});

describe("toFormData", () => {
  it("appends fields in order with file names", () => {
    const file = new Blob(["a"]);
    const fd = toFormData([{ name: "model", value: "m" }, { name: "file", value: file, fileName: "x.wav" }]);
    expect(fd.get("model")).toBe("m");
    expect(fd.get("file").name).toBe("x.wav");
  });

  it("uses an injected FormData constructor", () => {
    const calls = [];
    class Fake { append(...args) { calls.push(args); } }
    toFormData([{ name: "a", value: "1" }, { name: "f", value: "blob", fileName: "n" }], Fake);
    expect(calls).toEqual([["a", "1"], ["f", "blob", "n"]]);
  });
});

describe("SSE parsing", () => {
  it("splits complete events and keeps the remainder", () => {
    const r = splitSseEvents('data: {"a":1}\n\ndata: {"b"');
    expect(r.events).toEqual(['{"a":1}']);
    expect(r.rest).toBe('data: {"b"');
  });

  it("handles CRLF, comments, event lines, and multi-line data", () => {
    const r = splitSseEvents(": ping\r\n\r\nevent: x\r\ndata: one\r\ndata: two\r\n\r\ndata:[DONE]\n\n");
    expect(r.events).toEqual(["one\ntwo", "[DONE]"]);
    expect(r.rest).toBe("");
  });
});

function feed(events) {
  return events.reduce((s, e) => reduceStreamEvent(s, typeof e === "string" ? e : JSON.stringify(e)), createStreamState());
}

describe("reduceStreamEvent", () => {
  it("accumulates content and reasoning", () => {
    const s = feed([
      { choices: [{ delta: { role: "assistant", reasoning_content: "think " } }] },
      { choices: [{ delta: { reasoning: "more" } }] },
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } },
      "[DONE]",
    ]);
    expect(s.content).toBe("Hello");
    expect(s.reasoningContent).toBe("think more");
    expect(s.finishReason).toBe("stop");
    expect(s.usage).toEqual({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
    expect(s.done).toBe(true);
  });

  it("is pure", () => {
    const s0 = createStreamState();
    const s1 = reduceStreamEvent(s0, JSON.stringify({ choices: [{ delta: { content: "a" } }] }));
    expect(s0.content).toBe("");
    expect(s1.content).toBe("a");
    const s2 = reduceStreamEvent(s1, JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "{" } }] } }] }));
    reduceStreamEvent(s2, JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: "}" } }] } }] }));
    expect(s2.toolCalls[0].function.arguments).toBe("{");
  });

  it("merges parallel tool-call deltas by index", () => {
    const s = feed([
      { choices: [{ delta: { tool_calls: [
        { index: 0, id: "call_a", type: "function", function: { name: "get_weather", arguments: "" } },
        { index: 1, id: "call_b", function: { name: "time" } },
      ] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"city":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 1, function: { arguments: "{}" } }, { index: 0, function: { arguments: '"Paris"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
    ]);
    expect(s.toolCalls).toEqual([
      { id: "call_a", type: "function", function: { name: "get_weather", arguments: '{"city":"Paris"}' } },
      { id: "call_b", type: "function", function: { name: "time", arguments: "{}" } },
    ]);
    expect(s.finishReason).toBe("tool_calls");
  });

  it("defaults a missing tool-call index to the position", () => {
    const s = feed([{ choices: [{ delta: { tool_calls: [{ id: "x", function: { name: "f", arguments: "{}" } }] } }] }]);
    expect(s.toolCalls[0].id).toBe("x");
  });

  it("captures stream errors", () => {
    const s = feed([{ error: { message: "rate limited", code: 429 } }]);
    expect(s.error).toBe("rate limited");
    expect(feed([{ error: "boom" }]).error).toBe("boom");
  });

  it("records unparseable chunks without throwing", () => {
    const s = feed(["not json", { choices: [{ delta: { content: "ok" } }] }]);
    expect(s.content).toBe("ok");
    expect(s.malformed).toBe(1);
  });

  it("ignores empty and non-object payloads", () => {
    const s = feed(["", "null", "42"]);
    expect(s.content).toBe("");
    expect(s.error).toBeNull();
  });
});

describe("finalizeAssistantMessage", () => {
  it("builds a plain assistant message", () => {
    const s = feed([{ choices: [{ delta: { content: "hi" } }] }]);
    expect(finalizeAssistantMessage(s)).toEqual({ role: "assistant", content: "hi" });
  });

  it("includes reasoning and tool calls, null content when empty", () => {
    const s = feed([
      { choices: [{ delta: { reasoning_content: "r", tool_calls: [{ index: 0, id: "c", function: { name: "f", arguments: "{}" } }] } }] },
    ]);
    expect(finalizeAssistantMessage(s)).toEqual({
      role: "assistant",
      content: null,
      reasoning_content: "r",
      tool_calls: [{ id: "c", type: "function", function: { name: "f", arguments: "{}" } }],
    });
  });
});

describe("buildToolResultMessage", () => {
  it("builds a tool message from a string", () => {
    expect(buildToolResultMessage("call_1", "sunny")).toEqual({ role: "tool", tool_call_id: "call_1", content: "sunny" });
  });

  it("stringifies non-string results", () => {
    expect(buildToolResultMessage("c", { t: 20 }).content).toBe('{"t":20}');
    expect(buildToolResultMessage("c", undefined).content).toBe("");
  });

  it("requires a tool call id", () => {
    expect(() => buildToolResultMessage("", "x")).toThrow(/tool_call_id/);
  });
});

describe("normalizeResponse", () => {
  it("normalises error payloads for every mode", () => {
    for (const mode of PLAYGROUND_MODES) {
      expect(normalizeResponse(mode, { error: { message: "bad" } })).toEqual({ kind: "error", message: "bad" });
    }
    expect(normalizeResponse("chat", { error: "flat" })).toEqual({ kind: "error", message: "flat" });
  });

  it("normalises a non-stream chat completion", () => {
    const r = normalizeResponse("chat", {
      choices: [{ message: { role: "assistant", content: "hi", reasoning_content: "r" }, finish_reason: "stop" }],
      usage: { total_tokens: 3 },
    });
    expect(r).toEqual({
      kind: "chat",
      message: { role: "assistant", content: "hi", reasoning_content: "r" },
      finishReason: "stop",
      usage: { total_tokens: 3 },
    });
  });

  it("normalises a finished stream state", () => {
    const s = feed([{ choices: [{ delta: { content: "x" }, finish_reason: "stop" }] }]);
    expect(normalizeResponse("chat", s)).toMatchObject({ kind: "chat", message: { content: "x" }, finishReason: "stop" });
    expect(normalizeResponse("chat", feed([{ error: { message: "e" } }]))).toEqual({ kind: "error", message: "e" });
  });

  it("normalises image urls and base64", () => {
    const r = normalizeResponse("image", { data: [
      { url: "https://x/a.png", revised_prompt: "rp" },
      { b64_json: "AAAA" },
      { nothing: true },
    ] });
    expect(r).toEqual({ kind: "image", images: [
      { src: "https://x/a.png", revisedPrompt: "rp" },
      { src: "data:image/png;base64,AAAA", revisedPrompt: null },
    ] });
  });

  it("normalises tts blobs", () => {
    const blob = new Blob(["x"], { type: "audio/mpeg" });
    expect(normalizeResponse("tts", blob)).toEqual({ kind: "audio", blob, mimeType: "audio/mpeg" });
    expect(normalizeResponse("tts", new Blob(["x"])).mimeType).toBe("application/octet-stream");
  });

  it("normalises stt json and plain text", () => {
    expect(normalizeResponse("stt", { text: "hello", language: "en" })).toEqual({ kind: "text", text: "hello", raw: { text: "hello", language: "en" } });
    expect(normalizeResponse("stt", "plain")).toEqual({ kind: "text", text: "plain", raw: "plain" });
  });

  it("normalises embeddings with preview", () => {
    const vec = Array.from({ length: 12 }, (_, i) => i / 10);
    const r = normalizeResponse("embedding", { data: [{ index: 0, embedding: vec }], usage: { prompt_tokens: 2 } });
    expect(r.kind).toBe("embedding");
    expect(r.vectors[0]).toEqual({ index: 0, dimensions: 12, preview: vec.slice(0, 8), values: vec });
    expect(r.usage).toEqual({ prompt_tokens: 2 });
  });

  it("marks base64 embeddings without decoding", () => {
    const r = normalizeResponse("embedding", { data: [{ index: 0, embedding: "AAAA" }] });
    expect(r.vectors[0]).toEqual({ index: 0, dimensions: null, preview: [], values: "AAAA" });
  });

  it("normalises video job states", () => {
    expect(normalizeResponse("video", { request_id: "r1" })).toEqual({
      kind: "video", id: "r1", status: "pending", done: false, videos: [], error: null,
    });
    expect(normalizeResponse("video", { id: "r1", status: "completed", videos: [{ url: "u1" }, { url: null }], video: { url: "u1" } }))
      .toMatchObject({ status: "completed", done: true, videos: ["u1"] });
    expect(normalizeResponse("video", { status: "done", video: { url: "u2" } })).toMatchObject({ status: "completed", videos: ["u2"] });
    expect(normalizeResponse("video", { id: "r", status: "failed", error: { message: "nsfw" } }))
      .toEqual({ kind: "error", message: "nsfw" });
    expect(normalizeResponse("video", { id: "r", status: "expired" })).toMatchObject({ status: "failed", done: true });
    expect(normalizeResponse("video", { id: "r", status: "in_progress" })).toMatchObject({ status: "pending", done: false });
  });

  it("returns raw json for unexpected shapes", () => {
    expect(normalizeResponse("image", { foo: 1 })).toEqual({ kind: "image", images: [] });
    expect(normalizeResponse("chat", "weird")).toEqual({ kind: "json", data: "weird" });
  });
});
