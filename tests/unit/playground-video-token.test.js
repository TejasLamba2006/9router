import { describe, expect, it } from "vitest";

const { createPlaygroundVideoToken, verifyPlaygroundVideoToken } = await import("../../src/lib/auth/playgroundVideoToken.js");

describe("Playground video token", () => {
  it("round-trips a signed job-bound connection id", async () => {
    const token = await createPlaygroundVideoToken({ connectionId: "conn-secret", jobId: "job-1" });
    expect(token).not.toContain("conn-secret");
    await expect(verifyPlaygroundVideoToken(token)).resolves.toEqual({ connectionId: "conn-secret", jobId: "job-1" });
  });

  it("rejects tampering and unrelated dashboard tokens", async () => {
    const token = await createPlaygroundVideoToken({ connectionId: "conn-secret", jobId: "job-1" });
    await expect(verifyPlaygroundVideoToken(`${token.slice(0, -1)}x`)).resolves.toBeNull();
    await expect(verifyPlaygroundVideoToken("")).resolves.toBeNull();
  });
});
