import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  calls: [],
  token: { accessToken: "vertex-access-token" },
}));

vi.mock("open-sse/services/tokenRefresh.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    refreshVertexToken: vi.fn(async () => stubs.token),
  };
});

vi.mock("open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: async (url, options, proxyOptions) => {
    const stringUrl = String(url);
    stubs.calls.push({ url: stringUrl, options, proxyOptions });
    if (stringUrl.endsWith(":countTokens")) {
      return new Response(null, { status: stringUrl.includes("gemini-unavailable") ? 404 : 200 });
    }
    const pageToken = new URL(stringUrl).searchParams.get("pageToken");
    if (!pageToken) {
      return Response.json({
        publisherModels: [
          { name: "publishers/google/models/gemini-3.8-flash", launchStage: "GA" },
          { name: "publishers/google/models/gemini-unavailable", launchStage: "GA" },
          { name: "publishers/google/models/gemini-3.1-flash-image", launchStage: "GA" },
          { name: "publishers/google/models/gemini-2.5-pro-exp-03-25", launchStage: "EXPERIMENTAL" },
          { name: "publishers/meta/models/llama-4", launchStage: "GA" },
        ],
        nextPageToken: "page 2",
      });
    }
    return Response.json({
      publisherModels: [
        { name: "publishers/google/models/gemini-3.1-pro-preview", launchStage: "PUBLIC_PREVIEW" },
        { name: "publishers/google/models/gemini-embedding-2", launchStage: "GA" },
        { name: "publishers/google/models/gemini-3.8-flash", launchStage: "GA" },
      ],
    });
  },
}));

const originalDataDir = process.env.DATA_DIR;
let GET;
let createProviderConnection;
let refreshVertexToken;

beforeAll(async () => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "9router-vertex-models-"));
  vi.resetModules();
  ({ GET } = await import("@/app/api/providers/[id]/models/route.js"));
  ({ createProviderConnection } = await import("@/models/index.js"));
  ({ refreshVertexToken } = await import("open-sse/services/tokenRefresh.js"));
});

beforeEach(() => {
  stubs.calls.length = 0;
  stubs.token = { accessToken: "vertex-access-token" };
  refreshVertexToken.mockClear();
});

afterAll(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

async function seedVertex(providerSpecificData = { location: "europe-west1" }) {
  return createProviderConnection({
    provider: "vertex",
    authType: "apikey",
    apiKey: JSON.stringify({
      type: "service_account",
      project_id: "project-1",
      client_email: "vertex@example.iam.gserviceaccount.com",
      private_key: "private-secret",
    }),
    name: `vertex-${Date.now()}`,
    providerSpecificData,
    testStatus: "active",
  });
}

async function getModels(connectionId) {
  return GET(new Request(`http://localhost/api/providers/${connectionId}/models`), {
    params: Promise.resolve({ id: connectionId }),
  });
}

describe("Vertex live model listing", () => {
  it("returns paginated conversational Gemini models without exposing credentials", async () => {
    const connection = await seedVertex();
    const response = await getModels(connection.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.models.map((model) => model.id)).toEqual([
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
    ]);
    expect(body.authoritative).toBe(false);
    expect(body.warning).toMatch(/unavailable models were excluded/i);
    expect(stubs.calls).toHaveLength(5);
    expect(stubs.calls[0].url).toBe("https://europe-west1-aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=100&view=PUBLISHER_MODEL_VIEW_FULL");
    expect(new URL(stubs.calls[1].url).searchParams.get("pageToken")).toBe("page 2");
    expect(stubs.calls.slice(2).every((call) => call.url.endsWith(":countTokens"))).toBe(true);
    expect(stubs.calls[0].options.headers).toEqual({
      Accept: "application/json",
      Authorization: "Bearer vertex-access-token",
      "x-goog-user-project": "project-1",
    });
    expect(stubs.calls[0].options.signal).toBeInstanceOf(AbortSignal);
    expect(refreshVertexToken).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(body)).not.toContain("private-secret");
    expect(JSON.stringify(body)).not.toContain("vertex-access-token");
  });

  it("uses us-central1 for a global inference location", async () => {
    const connection = await seedVertex({ location: "global" });
    await getModels(connection.id);

    expect(new URL(stubs.calls[0].url).host).toBe("us-central1-aiplatform.googleapis.com");
  });

  it("rejects a Vertex credential that cannot mint an access token", async () => {
    stubs.token = null;
    const connection = await seedVertex();
    const response = await getModels(connection.id);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/access token/i);
    expect(stubs.calls).toHaveLength(0);
    expect(JSON.stringify(body)).not.toContain("private-secret");
  });
});
