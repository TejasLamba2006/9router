import { describe, expect, it } from "vitest";
import { resolveCapabilityProvenance } from "../../src/lib/modelCapabilityResolver.js";

describe("model capability provenance", () => {
  it("keeps verified, reported, built-in, and user sources separate", () => {
    const result = resolveCapabilityProvenance({
      evidence: [{ capability: "vision", outcome: "unsupported", checkedAt: "2026-10-10", connectionId: "c", probeVersion: 1 }],
      reported: { capabilities: { attachment: true, tools: true } },
      builtin: { vision: true, tools: false },
      user: { vision: false },
      currentProbeVersion: 1,
    });
    expect(result.vision).toEqual({
      verified: { outcome: "unsupported", checkedAt: "2026-10-10", connectionId: "c", probeVersion: 1, stale: false },
      reported: true,
      builtin: true,
      user: false,
    });
    expect(result.tools.reported).toBe(true);
    expect(result.tools.builtin).toBe(false);
    expect(result.tools.verified).toBeNull();
  });

  it("marks older evidence stale", () => {
    const result = resolveCapabilityProvenance({
      evidence: [{ capability: "text", outcome: "verified", checkedAt: "x", connectionId: "c", probeVersion: 1 }],
      currentProbeVersion: 2,
    });
    expect(result.text.verified.stale).toBe(true);
  });
});
