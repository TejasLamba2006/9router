import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_NODE_SERVICE_KINDS,
  getNodeServiceKinds,
  isValidNodeServiceKinds,
} from "@/shared/constants/providers.js";

const originalDataDir = process.env.DATA_DIR;
let tempDir;

function request(body) {
  return new Request("http://localhost/api/provider-nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-node-services-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  vi.doMock("next/server", () => ({
    NextResponse: {
      json(body, init = {}) {
        return new Response(JSON.stringify(body), {
          status: init.status || 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  }));
});

afterEach(() => {
  vi.doUnmock("next/server");
  vi.resetModules();
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

describe("custom provider node service kinds", () => {
  it("normalizes supported OpenAI-compatible services and legacy embeddings", () => {
    expect(CUSTOM_NODE_SERVICE_KINDS).toEqual(["image", "tts", "stt", "video"]);
    expect(isValidNodeServiceKinds(["image", "video", "image"])).toBe(true);
    expect(isValidNodeServiceKinds(["image", "music"])).toBe(false);
    expect(getNodeServiceKinds({ type: "openai-compatible", serviceKinds: ["image", "image", "tts"] }))
      .toEqual(["image", "tts"]);
    expect(getNodeServiceKinds({ type: "custom-embedding" })).toEqual(["embedding"]);
    expect(getNodeServiceKinds({ type: "anthropic-compatible", serviceKinds: ["image"] })).toEqual([]);
  });

  it("persists valid services on OpenAI-compatible nodes", async () => {
    const { POST } = await import("@/app/api/provider-nodes/route.js");
    const response = await POST(request({
      name: "Media Node",
      prefix: "media",
      apiType: "chat",
      baseUrl: "https://media.example/v1",
      type: "openai-compatible",
      serviceKinds: ["image", "tts", "image"],
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.node.serviceKinds).toEqual(["image", "tts"]);
  });

  it("updates services and mirrors them into existing connections", async () => {
    const { POST } = await import("@/app/api/provider-nodes/route.js");
    const createdResponse = await POST(request({
      name: "Editable Media Node",
      prefix: "editable-media",
      apiType: "chat",
      baseUrl: "https://media.example/v1",
      type: "openai-compatible",
      serviceKinds: ["image"],
    }));
    const { node } = await createdResponse.json();
    const { createProviderConnection, getProviderConnections } = await import("@/models/index.js");
    await createProviderConnection({
      provider: node.id,
      authType: "apikey",
      name: "Connection",
      apiKey: "secret",
      providerSpecificData: { prefix: node.prefix, baseUrl: node.baseUrl, serviceKinds: node.serviceKinds },
    });
    const { PUT } = await import("@/app/api/provider-nodes/[id]/route.js");
    const response = await PUT(request({
      name: node.name,
      prefix: node.prefix,
      apiType: "chat",
      baseUrl: node.baseUrl,
      serviceKinds: ["video", "tts", "video"],
    }), { params: Promise.resolve({ id: node.id }) });
    const body = await response.json();
    const [connection] = await getProviderConnections({ provider: node.id });

    expect(response.status).toBe(200);
    expect(body.node.serviceKinds).toEqual(["video", "tts"]);
    expect(connection.providerSpecificData.serviceKinds).toEqual(["video", "tts"]);
  });

  it("rejects unknown services and media services on Anthropic nodes", async () => {
    const { POST } = await import("@/app/api/provider-nodes/route.js");
    const unknown = await POST(request({
      name: "Unknown",
      prefix: "unknown",
      apiType: "chat",
      baseUrl: "https://media.example/v1",
      type: "openai-compatible",
      serviceKinds: ["music"],
    }));
    const anthropic = await POST(request({
      name: "Anthropic",
      prefix: "anthropic-media",
      baseUrl: "https://anthropic.example/v1",
      type: "anthropic-compatible",
      serviceKinds: ["image"],
    }));

    expect(unknown.status).toBe(400);
    expect(anthropic.status).toBe(400);
  });
});
