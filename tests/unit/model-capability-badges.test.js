import { describe, expect, it } from "vitest";
import { getCapabilityBadgeState, getCapabilityBadgeStates } from "../../src/shared/utils/modelCapabilityBadges.js";

describe("model capability badge precedence", () => {
  it("shows current verified evidence before metadata", () => {
    const value = { verified: { outcome: "unsupported", stale: false }, reported: true, builtin: true, user: true };
    expect(getCapabilityBadgeState(value)).toBe("unsupported");
    expect(getCapabilityBadgeStates(value)).toEqual(["unsupported", "user", "reported", "builtin"]);
  });

  it("uses provenance sources when evidence is stale or missing", () => {
    expect(getCapabilityBadgeState({ verified: { outcome: "verified", stale: true }, user: true, reported: true })).toBe("user");
    expect(getCapabilityBadgeState({ reported: true })).toBe("reported");
    expect(getCapabilityBadgeState({ builtin: true })).toBe("builtin");
    expect(getCapabilityBadgeState({ reported: false, builtin: false })).toBeNull();
  });
});
