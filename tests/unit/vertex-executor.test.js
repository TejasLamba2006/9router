import { describe, expect, it } from "vitest";
import { VertexExecutor } from "open-sse/executors/vertex.js";

const serviceAccount = JSON.stringify({
  type: "service_account",
  project_id: "project-1",
  client_email: "vertex@example.iam.gserviceaccount.com",
  private_key: "private-secret",
});

describe("Vertex Gemini endpoint location", () => {
  const executor = new VertexExecutor();

  it("uses the global location for service accounts by default", () => {
    expect(executor.buildUrl("gemini-3.8-flash", true, 0, { apiKey: serviceAccount })).toBe(
      "https://aiplatform.googleapis.com/v1/projects/project-1/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent?alt=sse",
    );
  });

  it("keeps an explicitly configured regional location", () => {
    expect(executor.buildUrl("gemini-2.5-flash", false, 0, {
      apiKey: serviceAccount,
      providerSpecificData: { location: "europe-west1" },
    })).toBe(
      "https://aiplatform.googleapis.com/v1/projects/project-1/locations/europe-west1/publishers/google/models/gemini-2.5-flash:generateContent",
    );
  });
});
