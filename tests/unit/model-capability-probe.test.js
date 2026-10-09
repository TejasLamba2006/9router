import { describe, expect, it } from "vitest";
import {
  MODEL_CAPABILITY_PROBE_VERSION,
  buildCapabilityProbe,
  classifyCapabilityOutcome,
  runModelCapabilityProbeGroup,
  verifyCapabilityEvidence,
} from "../../src/lib/modelCapabilityProbe.js";

describe("model capability probes", () => {
  it("builds only safe chat probes", () => {
    for (const capability of ["text", "vision", "tools", "structuredOutput", "reasoning"]) {
      const probe = buildCapabilityProbe(capability, "nonce");
      expect(probe.body.stream).toBe(false);
      expect(probe.body.model).toBeUndefined();
      expect(JSON.stringify(probe)).not.toMatch(/images\/generations|audio\/speech|videos\/generations/);
    }
  });

  it("requires exact semantic evidence", () => {
    expect(verifyCapabilityEvidence("text", { text: "CAP_OK" }, "n")).toBe(true);
    expect(verifyCapabilityEvidence("text", { text: "CAP_OK extra" }, "n")).toBe(false);
    expect(verifyCapabilityEvidence("vision", { text: "RED" }, "n")).toBe(true);
    expect(verifyCapabilityEvidence("structuredOutput", { text: '{"answer":"CAP_OK"}' }, "n")).toBe(true);
  });

  it("verifies exact forced tool calls", () => {
    const evidence = { toolCalls: [{ function: { name: "cap_probe_nonce", arguments: '{"answer":"CAP_OK"}' } }] };
    expect(verifyCapabilityEvidence("tools", evidence, "nonce")).toBe(true);
    expect(verifyCapabilityEvidence("tools", evidence, "wrong")).toBe(false);
  });

  it("requires observable reasoning evidence", () => {
    expect(verifyCapabilityEvidence("reasoning", { reasoning: "thinking", usage: null }, "n")).toBe(true);
    expect(verifyCapabilityEvidence("reasoning", { reasoning: "", usage: { completion_tokens_details: { reasoning_tokens: 3 } } }, "n")).toBe(true);
    expect(verifyCapabilityEvidence("reasoning", { reasoning: "", usage: {} }, "n")).toBe(false);
  });

  it("stops sub-probes after an unreliable account result", async () => {
    const calls = [];
    const result = await runModelCapabilityProbeGroup({
      provider: "claude",
      model: "claude-x",
      connectionId: "conn-a",
      probe: async ({ capability, body }) => {
        calls.push({ capability, body });
        return capability === "text"
          ? { classification: "healthy", ok: true, status: 200, latencyMs: 1, evidence: { text: "CAP_OK" } }
          : { classification: "rate_limited", ok: false, status: 429, latencyMs: 2, evidence: null };
      },
    });
    expect(calls.map((call) => call.capability)).toEqual(["text", "vision"]);
    expect(calls.every((call) => call.body.model === undefined)).toBe(true);
    expect(result.text.outcome).toBe("verified");
    expect(result.vision.outcome).toBe("transient_failure");
    expect(result.tools.outcome).toBe("transient_failure");
  });

  it("returns no evidence when cancelled", async () => {
    const controller = new AbortController();
    const result = await runModelCapabilityProbeGroup({
      provider: "claude",
      model: "claude-x",
      connectionId: "conn-a",
      signal: controller.signal,
      probe: async () => {
        controller.abort();
        return { classification: "skipped", ok: false, status: null, latencyMs: 1, evidence: null };
      },
    });
    expect(result).toBeNull();
  });

  it("maps account failures to transient evidence and feature rejections to unsupported", () => {
    expect(classifyCapabilityOutcome({ classification: "rate_limited" }, false)).toBe("transient_failure");
    expect(classifyCapabilityOutcome({ classification: "auth_or_account" }, false)).toBe("transient_failure");
    expect(classifyCapabilityOutcome({ status: 400, message: "vision is not supported" }, false)).toBe("unsupported");
    expect(classifyCapabilityOutcome({ classification: "healthy" }, false)).toBe("inconclusive");
    expect(classifyCapabilityOutcome({ classification: "healthy" }, true)).toBe("verified");
    expect(MODEL_CAPABILITY_PROBE_VERSION).toBe(1);
  });
});
