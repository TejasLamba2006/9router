import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderCredentials: vi.fn(),
}));

vi.mock("@/sse/services/auth.js", () => ({
  getProviderCredentials: mocks.getProviderCredentials,
  markAccountUnavailable: vi.fn(async () => ({ shouldFallback: false })),
  clearAccountError: vi.fn(async () => {}),
  extractApiKey: vi.fn(() => null),
  isValidApiKey: vi.fn(async () => true),
}));
vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(async () => ({ requireApiKey: false })),
  getModelAliases: vi.fn(async () => ({})),
  getComboByName: vi.fn(async () => null),
  getProviderNodes: vi.fn(async () => [{
    id: "openai-compatible-chat-node",
    type: "openai-compatible",
    prefix: "media-node",
    baseUrl: "https://media.example/v1",
    serviceKinds: ["tts", "stt"],
  }]),
  getCustomModels: vi.fn(async () => []),
}));
vi.mock("@/lib/disabledModelsDb", () => ({ getDisabledModels: vi.fn(async () => ({})) }));
vi.mock("@/lib/db/repos/combosRepo.js", () => ({ getCombos: vi.fn(async () => []) }));
vi.mock("@/lib/db/repos/apiKeysRepo.js", () => ({ getApiKeyByKey: vi.fn(async () => null) }));
vi.mock("@/sse/utils/logger.js", () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), request: vi.fn() }));

const { handleTts } = await import("@/sse/handlers/tts.js");
const { handleStt } = await import("@/sse/handlers/stt.js");

const credentials = {
  connectionId: "conn-media",
  connectionName: "Media",
  apiKey: "secret",
  providerSpecificData: {
    baseUrl: "https://media.example/v1",
    serviceKinds: ["tts", "stt"],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderCredentials.mockResolvedValue(credentials);
  global.fetch = vi.fn();
});

describe("custom compatible media handlers", () => {
  it("loads credentials before routing TTS", async () => {
    global.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200 }));
    const response = await handleTts(new Request("http://localhost/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "media-node/tts-1/alloy", input: "hello" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.getProviderCredentials).toHaveBeenCalledWith(
      "openai-compatible-chat-node", expect.any(Set), "tts-1/alloy"
    );
    expect(global.fetch.mock.calls[0][0]).toBe("https://media.example/v1/audio/speech");
  });

  it("loads credentials before routing STT", async () => {
    global.fetch.mockResolvedValue(new Response(JSON.stringify({ text: "hello" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const form = new FormData();
    form.set("model", "media-node/whisper-1");
    form.set("file", new Blob([new Uint8Array([1, 2])], { type: "audio/wav" }), "sample.wav");
    const response = await handleStt(new Request("http://localhost/v1/audio/transcriptions", {
      method: "POST",
      body: form,
    }));

    expect(response.status).toBe(200);
    expect(mocks.getProviderCredentials).toHaveBeenCalledWith(
      "openai-compatible-chat-node", expect.any(Set), "whisper-1"
    );
    expect(global.fetch.mock.calls[0][0]).toBe("https://media.example/v1/audio/transcriptions");
  });
});
