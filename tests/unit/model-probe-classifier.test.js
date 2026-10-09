import { describe, expect, it } from "vitest";
import { classifyProbeResult, parseRetryAfterMs, sanitizeProbeMessage } from "../../src/lib/modelProbe.js";

describe("model probe classification", () => {
  it.each([
    [{ status: 404, message: "The model deployment 'gone' was not found" }, "hard_model_failure"],
    [{ status: 400, message: "unknown model: gone" }, "hard_model_failure"],
    [{ status: 429, message: "rate limit exceeded" }, "rate_limited"],
    [{ status: 402, message: "insufficient credits" }, "quota"],
    [{ status: 401, message: "invalid token" }, "auth_or_account"],
    [{ status: 403, message: "account disabled" }, "auth_or_account"],
    [{ status: 500, message: "upstream unavailable" }, "transient_provider"],
    [{ status: 400, message: "content filtered by safety policy" }, "content_filtered"],
    [{ status: 404, message: "not found" }, "inconclusive"],
    [{ status: 400, message: "bad request" }, "inconclusive"],
    [{ status: 200, message: "", ok: true }, "healthy"],
  ])("classifies conservatively %#", (input, expected) => {
    expect(classifyProbeResult(input)).toBe(expected);
  });

  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfterMs("5", 1000)).toBe(5000);
    expect(parseRetryAfterMs(new Date(7000).toUTCString(), 1000)).toBe(6000);
  });

  it("redacts bearer tokens and known secrets", () => {
    const message = sanitizeProbeMessage("Bearer abc.secret token abc.secret", ["abc.secret"]);
    expect(message).not.toContain("abc.secret");
    expect(message).toContain("[REDACTED]");
  });
});
