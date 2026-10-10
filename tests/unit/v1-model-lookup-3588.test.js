import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildModelsList: vi.fn(),
}));

vi.mock("../../src/app/api/v1/models/route.js", () => ({
  buildModelsList: mocks.buildModelsList,
}));

const { GET } = await import("../../src/app/api/v1/models/[...model]/route.js");

const chatModel = {
  id: "cc/claude-sonnet-5",
  object: "model",
  owned_by: "cc",
  context_length: 1_000_000,
};

function params(model) {
  return { params: Promise.resolve({ model }) };
}

describe("GET /v1/models/{id}", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves a provider-prefixed model ID split across URL path segments", async () => {
    mocks.buildModelsList.mockResolvedValue([chatModel]);

    const response = await GET(new Request("https://router.test/v1/models/cc/claude-sonnet-5"), params(["cc", "claude-sonnet-5"]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(chatModel);
    expect(mocks.buildModelsList).toHaveBeenCalledWith(["llm"]);
  });

  it("also handles a decoded slash in a single catch-all segment", async () => {
    mocks.buildModelsList.mockResolvedValue([chatModel]);

    const response = await GET(new Request("https://router.test/v1/models/cc%2Fclaude-sonnet-5"), params(["cc/claude-sonnet-5"]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(chatModel);
  });

  it.each([
    ["image", "image"],
    ["video", "video"],
  ])("keeps the %s capability-list route", async (slug, kind) => {
    const mediaModel = { id: `${kind}/model-1`, object: "model", owned_by: kind };
    mocks.buildModelsList.mockResolvedValue([mediaModel]);

    const response = await GET(new Request(`https://router.test/v1/models/${slug}`), params([slug]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ object: "list", data: [mediaModel] });
    expect(mocks.buildModelsList).toHaveBeenCalledWith([kind]);
  });

  it("returns an OpenAI-style model_not_found response for an unknown model", async () => {
    mocks.buildModelsList.mockResolvedValue([chatModel]);

    const response = await GET(new Request("https://router.test/v1/models/cc/missing-model"), params(["cc", "missing-model"]));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      type: "invalid_request_error",
      code: "model_not_found",
    });
  });
});
