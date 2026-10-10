import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getInternalHeaders: vi.fn(),
  createPlaygroundVideoToken: vi.fn(),
  verifyPlaygroundVideoToken: vi.fn(),
  buildModelsList: vi.fn(),
  initTranslators: vi.fn(),
  chat: vi.fn(),
  image: vi.fn(),
  tts: vi.fn(),
  stt: vi.fn(),
  embedding: vi.fn(),
  videoCreate: vi.fn(),
  videoGet: vi.fn(),
}));

vi.mock("@/lib/internalApiAuth.js", () => ({ getInternalHeaders: mocks.getInternalHeaders }));
vi.mock("@/lib/auth/playgroundVideoToken.js", () => ({
  createPlaygroundVideoToken: mocks.createPlaygroundVideoToken,
  verifyPlaygroundVideoToken: mocks.verifyPlaygroundVideoToken,
}));
vi.mock("@/app/api/v1/models/route.js", () => ({ buildModelsList: mocks.buildModelsList }));
vi.mock("open-sse/translator/index.js", () => ({ initTranslators: mocks.initTranslators }));
vi.mock("@/sse/handlers/chat.js", () => ({ handleChat: mocks.chat }));
vi.mock("@/sse/handlers/imageGeneration.js", () => ({ handleImageGeneration: mocks.image }));
vi.mock("@/sse/handlers/tts.js", () => ({ handleTts: mocks.tts }));
vi.mock("@/sse/handlers/stt.js", () => ({ handleStt: mocks.stt }));
vi.mock("@/sse/handlers/embeddings.js", () => ({ handleEmbeddings: mocks.embedding }));
vi.mock("@/sse/handlers/videoGeneration.js", () => ({
  handleVideoCreate: mocks.videoCreate,
  handleVideoGet: mocks.videoGet,
}));

const { dispatchPlaygroundRequest, MAX_PLAYGROUND_BODY_BYTES } = await import("../../src/lib/playgroundGateway.js");

const jsonRequest = (path, body, headers = {}, method = "POST") => new Request(`http://localhost:20128${path}`, {
  method,
  headers: { origin: "http://localhost:20128", host: "localhost:20128", "content-type": "application/json", ...headers },
  body: method === "GET" ? undefined : JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInternalHeaders.mockResolvedValue({ Authorization: "Bearer internal", "x-9r-cli-token": "machine" });
  mocks.buildModelsList.mockImplementation(async (kinds) => [{ id: `${kinds[0]}/model` }]);
  for (const handler of [mocks.chat, mocks.image, mocks.tts, mocks.stt, mocks.embedding]) {
    handler.mockResolvedValue(Response.json({ ok: true }));
  }
  mocks.videoCreate.mockResolvedValue(new Response(JSON.stringify({ request_id: "job-1" }), {
    headers: { "content-type": "application/json", "x-9router-connection-id": "conn-secret" },
  }));
  mocks.videoGet.mockResolvedValue(new Response(JSON.stringify({ status: "pending" }), {
    headers: { "content-type": "application/json", "x-9router-connection-id": "conn-secret" },
  }));
  mocks.createPlaygroundVideoToken.mockResolvedValue("opaque-token");
  mocks.verifyPlaygroundVideoToken.mockResolvedValue({ connectionId: "conn-secret", jobId: "job-1" });
});

describe("Playground dashboard gateway", () => {
  it("rejects cross-origin POSTs before dispatch", async () => {
    const request = jsonRequest("/api/dashboard/playground/chat", { model: "llm/model", messages: [] }, { origin: "https://evil.example" });
    const response = await dispatchPlaygroundRequest(request, ["chat"]);
    expect(response.status).toBe(403);
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it("rebuilds chat requests with trusted auth while preserving safe protocol headers", async () => {
    const controller = new AbortController();
    mocks.chat.mockImplementation(async (request) => {
      const body = await request.json();
      controller.abort();
      return Response.json({
        body,
        headers: Object.fromEntries(request.headers.entries()),
        pathname: new URL(request.url).pathname,
        signalAborted: request.signal.aborted,
      });
    });
    const originalBase = jsonRequest("/api/dashboard/playground/chat", {
      model: "llm/model",
      messages: [{ role: "user", content: "hi" }],
    }, {
      authorization: "Bearer attacker",
      "x-api-key": "attacker",
      "x-connection-id": "conn-attacker",
      "x-9router-connection-id": "conn-attacker-2",
      "x-9r-cli-token": "attacker-cli",
      "anthropic-beta": "context-1m-2025-08-07",
      accept: "text/event-stream",
      "idempotency-key": "idem-1",
    });
    const original = new Request(originalBase, { signal: controller.signal });

    const response = await dispatchPlaygroundRequest(original, ["chat"]);
    const data = await response.json();
    expect(data.pathname).toBe("/api/v1/chat/completions");
    expect(data.body.model).toBe("llm/model");
    expect(data.headers.authorization).toBe("Bearer internal");
    expect(data.headers["x-api-key"]).toBeUndefined();
    expect(data.headers["x-connection-id"]).toBeUndefined();
    expect(data.headers["x-9router-connection-id"]).toBeUndefined();
    expect(data.headers["x-9r-cli-token"]).toBe("machine");
    expect(data.headers["anthropic-beta"]).toBe("context-1m-2025-08-07");
    expect(data.headers.accept).toBe("text/event-stream");
    expect(data.headers["idempotency-key"]).toBe("idem-1");
    expect(data.signalAborted).toBe(true);
    expect(mocks.initTranslators).toHaveBeenCalledOnce();
  });

  it("requires an unrestricted internal key for every Playground request", async () => {
    mocks.getInternalHeaders.mockResolvedValue({ "x-9r-cli-token": "machine" });
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/chat", { model: "llm/model", messages: [] }),
      ["chat"],
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No active unrestricted API key is available for Playground" });
  });

  it("rejects declared requests above the 50 MB body ceiling before reading", async () => {
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/chat", { model: "llm/model" }, { "content-length": String(MAX_PLAYGROUND_BODY_BYTES + 1) }),
      ["chat"],
    );
    expect(response.status).toBe(413);
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it("rejects a model absent from the selected operation inventory", async () => {
    mocks.buildModelsList.mockResolvedValue([{ id: "image/other" }]);
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/image", { model: "llm/model", prompt: "draw" }),
      ["image"],
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Model is not available for image" });
    expect(mocks.image).not.toHaveBeenCalled();
  });

  it("accepts a voice suffix on an inventoried TTS model", async () => {
    mocks.buildModelsList.mockResolvedValue([{ id: "tts/model" }]);
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/tts", { model: "tts/model/alloy", input: "hello" }),
      ["tts"],
    );
    expect(response.status).toBe(200);
    expect(mocks.tts).toHaveBeenCalledOnce();
  });

  it("preserves TTS response_format through the internal query", async () => {
    mocks.buildModelsList.mockResolvedValue([{ id: "tts/model" }]);
    mocks.tts.mockImplementation(async (request) => Response.json({ search: new URL(request.url).search }));
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/tts", { model: "tts/model", input: "hello", response_format: "json" }),
      ["tts"],
    );
    expect(await response.json()).toEqual({ search: "?response_format=json" });

    const queryResponse = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/tts?response_format=wav", { model: "tts/model", input: "hello" }),
      ["tts"],
    );
    expect(await queryResponse.json()).toEqual({ search: "?response_format=wav" });
  });

  it("preserves multipart fields and enforces file-count limits", async () => {
    mocks.buildModelsList.mockResolvedValue([{ id: "stt/model" }]);
    const form = new FormData();
    form.append("model", "stt/model");
    form.append("file", new File(["audio"], "voice.mp3", { type: "audio/mpeg" }));
    mocks.stt.mockImplementation(async (request) => {
      const forwarded = await request.formData();
      return Response.json({ model: forwarded.get("model"), file: forwarded.get("file").name });
    });
    const request = new Request("http://localhost:20128/api/dashboard/playground/stt", {
      method: "POST",
      headers: { origin: "http://localhost:20128", host: "localhost:20128" },
      body: form,
    });
    const response = await dispatchPlaygroundRequest(request, ["stt"]);
    expect(await response.json()).toEqual({ model: "stt/model", file: "voice.mp3" });

    const tooMany = new FormData();
    tooMany.append("model", "stt/model");
    for (let i = 0; i < 11; i += 1) tooMany.append("file", new File(["x"], `${i}.mp3`, { type: "audio/mpeg" }));
    const rejected = await dispatchPlaygroundRequest(new Request("http://localhost:20128/api/dashboard/playground/stt", {
      method: "POST",
      headers: { origin: "http://localhost:20128", host: "localhost:20128" },
      body: tooMany,
    }), ["stt"]);
    expect(rejected.status).toBe(413);
  });

  it("replaces raw video connection ids with an opaque job-bound token", async () => {
    mocks.buildModelsList.mockResolvedValue([{ id: "video/model" }]);
    const response = await dispatchPlaygroundRequest(
      jsonRequest("/api/dashboard/playground/video", { model: "video/model", prompt: "move" }),
      ["video"],
    );
    expect(mocks.createPlaygroundVideoToken).toHaveBeenCalledWith({ connectionId: "conn-secret", jobId: "job-1" });
    expect(response.headers.get("x-9router-connection-id")).toBeNull();
    expect(response.headers.get("x-playground-video-token")).toBe("opaque-token");
  });

  it("accepts only a valid job-bound opaque token for video polling", async () => {
    mocks.videoGet.mockImplementation(async (request, jobId) => Response.json({
      jobId,
      connectionId: request.headers.get("x-connection-id"),
      authorization: request.headers.get("authorization"),
    }, { headers: { "x-9router-connection-id": "conn-secret" } }));
    const makePollRequest = () => new Request("http://localhost:20128/api/dashboard/playground/video/job-1", {
      headers: {
        host: "localhost:20128",
        authorization: "Bearer attacker",
        "x-connection-id": "conn-attacker",
        "x-playground-video-token": "opaque-token",
      },
    });
    const response = await dispatchPlaygroundRequest(makePollRequest(), ["video", "job-1"]);
    expect(await response.json()).toEqual({ jobId: "job-1", connectionId: "conn-secret", authorization: "Bearer internal" });
    expect(response.headers.get("x-9router-connection-id")).toBeNull();
    expect(response.headers.get("x-playground-video-token")).toBe("opaque-token");

    mocks.verifyPlaygroundVideoToken.mockResolvedValueOnce(null);
    const invalid = await dispatchPlaygroundRequest(makePollRequest(), ["video", "job-1"]);
    expect(invalid.status).toBe(401);

    mocks.verifyPlaygroundVideoToken.mockResolvedValueOnce({ connectionId: "conn-secret", jobId: "other" });
    const mismatch = await dispatchPlaygroundRequest(makePollRequest(), ["video", "job-1"]);
    expect(mismatch.status).toBe(401);
  });

  it("rejects unknown operations and wrong methods", async () => {
    expect((await dispatchPlaygroundRequest(jsonRequest("/x", {}, {}, "POST"), ["delete"])).status).toBe(404);
    expect((await dispatchPlaygroundRequest(new Request("http://localhost/x"), ["chat"])).status).toBe(405);
  });
});
