import { describe, expect, it } from "vitest";
import {
  MODE_TABS,
  needsConfirmation,
  toDashboardPath,
  createSession,
  sessionTitle,
  toApiMessages,
  trimTrailingAssistant,
  pendingToolCalls,
  parseToolsJson,
  pendingVideoJobs,
} from "../../src/app/(dashboard)/dashboard/basic-chat/playgroundUi.js";
import { buildPlaygroundRequest, buildVideoPollRequest, PLAYGROUND_MODES } from "../../src/shared/utils/playgroundRequest.js";

describe("mode tabs", () => {
  it("covers every playground mode once, with the approved labels", () => {
    expect(MODE_TABS.map((t) => t.mode)).toEqual(PLAYGROUND_MODES);
    expect(MODE_TABS.map((t) => t.label)).toEqual(["Chat", "Image", "Speech", "Transcribe", "Embeddings", "Video"]);
  });

  it("filters the model picker by kind, chat uses the LLM picker", () => {
    expect(MODE_TABS.find((t) => t.mode === "chat").kindFilter).toBeNull();
    expect(MODE_TABS.find((t) => t.mode === "tts").kindFilter).toBe("tts");
    expect(MODE_TABS.find((t) => t.mode === "video").kindFilter).toBe("video");
  });
});

describe("first-use confirmation", () => {
  it("asks once per conversation for paid media modes only", () => {
    expect(needsConfirmation({ mode: "image" })).toBe(true);
    expect(needsConfirmation({ mode: "tts", confirmed: false })).toBe(true);
    expect(needsConfirmation({ mode: "video", confirmed: true })).toBe(false);
    expect(needsConfirmation({ mode: "chat" })).toBe(false);
    expect(needsConfirmation({ mode: "stt" })).toBe(false);
    expect(needsConfirmation({ mode: "embedding" })).toBe(false);
  });
});

describe("dashboard proxy paths", () => {
  it("maps every request-utility path to a dashboard playground operation", () => {
    const paths = {
      chat: buildPlaygroundRequest({ mode: "chat", model: "m", input: { messages: [{ role: "user", content: "hi" }] } }).path,
      image: buildPlaygroundRequest({ mode: "image", model: "m", input: { prompt: "p" } }).path,
      tts: buildPlaygroundRequest({ mode: "tts", model: "m", input: { text: "t" } }).path,
      stt: buildPlaygroundRequest({ mode: "stt", model: "m", input: { file: { name: "a.mp3" } } }).path,
      embedding: buildPlaygroundRequest({ mode: "embedding", model: "m", input: { text: "t" } }).path,
      video: buildPlaygroundRequest({ mode: "video", model: "m", input: { prompt: "p" } }).path,
    };
    for (const [mode, path] of Object.entries(paths)) {
      expect(toDashboardPath(path)).toBe(`/api/dashboard/playground/${mode}`);
    }
  });

  it("maps video polling and keeps the job id encoded", () => {
    expect(toDashboardPath(buildVideoPollRequest("job/1 x").path)).toBe("/api/dashboard/playground/video/job%2F1%20x");
  });

  it("refuses unknown paths instead of calling /api/v1 directly", () => {
    expect(() => toDashboardPath("/api/v1/models")).toThrow(/operation/);
    expect(() => toDashboardPath("/api/v1/videos/a/b")).toThrow(/operation/);
  });
});

describe("sessions", () => {
  it("creates a mode-scoped session with default settings and no confirmation", () => {
    const s = createSession({ mode: "image", model: "openai/dall-e-3" });
    expect(s).toMatchObject({ mode: "image", model: "openai/dall-e-3", title: "New image", confirmed: false, messages: [], advanced: "", tools: "" });
    expect(s.settings).toMatchObject({ n: 1, size: "1024x1024" });
    expect(typeof s.id).toBe("string");
  });

  it("derives a short single-line title", () => {
    expect(sessionTitle("  hello\n  world ")).toBe("hello world");
    expect(sessionTitle("x".repeat(80))).toHaveLength(49);
    expect(sessionTitle("")).toBe("Untitled");
  });
});

describe("toApiMessages", () => {
  const messages = [
    { id: "1", role: "user", content: "look", attachments: [
      { id: "a1", kind: "image", name: "p.png" },
      { id: "a2", kind: "text", name: "notes.md", text: "# hi" },
    ] },
    { id: "2", role: "assistant", content: null, reasoning_content: "thinking", status: "done",
      tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }], usage: { total_tokens: 3 } },
    { id: "3", role: "tool", tool_call_id: "c1", content: "42" },
    { id: "4", role: "assistant", content: "", status: "error", error: "boom" },
    { id: "5", role: "assistant", content: "", status: "streaming" },
  ];

  it("strips UI fields, builds content parts and drops failed or empty turns", () => {
    expect(toApiMessages(messages, { a1: "data:image/png;base64,AA" })).toEqual([
      { role: "user", content: [
        { type: "text", text: "look" },
        { type: "image_url", image_url: { url: "data:image/png;base64,AA" } },
        { type: "text", text: "--- notes.md ---\n# hi" },
      ] },
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "f", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: "42" },
    ]);
  });

  it("keeps plain string content when there are no usable attachments", () => {
    expect(toApiMessages([{ role: "user", content: "hi", attachments: [{ id: "x", kind: "image" }] }], {})).toEqual([{ role: "user", content: "hi" }]);
  });
});

describe("regenerate / tool flow", () => {
  it("drops trailing assistant replies only", () => {
    const msgs = [{ role: "user" }, { role: "assistant" }, { role: "user" }, { role: "assistant" }, { role: "assistant" }];
    expect(trimTrailingAssistant(msgs)).toEqual(msgs.slice(0, 3));
    expect(trimTrailingAssistant([{ role: "user" }])).toHaveLength(1);
  });

  it("lists tool calls of the last assistant turn still awaiting a result", () => {
    const call = (id) => ({ id, type: "function", function: { name: "f", arguments: "{}" } });
    const msgs = [{ role: "user" }, { role: "assistant", tool_calls: [call("a"), call("b")] }, { role: "tool", tool_call_id: "a", content: "" }];
    expect(pendingToolCalls(msgs).map((c) => c.id)).toEqual(["b"]);
    expect(pendingToolCalls([...msgs, { role: "tool", tool_call_id: "b", content: "" }])).toEqual([]);
    expect(pendingToolCalls([{ role: "user" }])).toEqual([]);
  });
});

describe("parseToolsJson", () => {
  it("accepts blank and a valid function tool array", () => {
    expect(parseToolsJson("  ")).toEqual({ ok: true, value: null });
    const tools = [{ type: "function", function: { name: "get_time", parameters: { type: "object" } } }];
    expect(parseToolsJson(JSON.stringify(tools))).toEqual({ ok: true, value: tools });
  });

  it("rejects invalid JSON, non arrays and tools without a function name", () => {
    expect(parseToolsJson("{").ok).toBe(false);
    expect(parseToolsJson("{}").error).toMatch(/array/);
    expect(parseToolsJson('[{"type":"function","function":{}}]').error).toMatch(/name/);
  });
});

describe("pendingVideoJobs", () => {
  it("finds unfinished video jobs so polling can resume after reload", () => {
    const sessions = [
      { id: "s1", messages: [
        { id: "m1", role: "assistant", result: { kind: "video", id: "j1", done: false }, job: { id: "j1", connectionId: "c" } },
        { id: "m2", role: "assistant", result: { kind: "video", id: "j2", done: true }, job: { id: "j2" } },
      ] },
      { id: "s2", messages: [{ id: "m3", role: "assistant", result: { kind: "image" } }] },
    ];
    expect(pendingVideoJobs(sessions)).toEqual([{ sessionId: "s1", messageId: "m1", jobId: "j1", connectionId: "c" }]);
  });
});
