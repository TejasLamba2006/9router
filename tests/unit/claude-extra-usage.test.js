import { describe, expect, it, vi } from "vitest";
import {
  CLAUDE_EXTRA_USAGE_ERROR_MESSAGE,
  CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
  buildClaudeExtraUsageConnectionUpdate,
  isClaudeExtraUsageAllowed,
  isClaudeExtraUsageBlockEnabled,
} from "@/lib/providers/claudeExtraUsage.js";
import { parseQuotaData } from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

function futureIso(ms = 60_000) {
  return new Date(Date.now() + ms).toISOString();
}

describe("Claude extra-usage policy", () => {
  it("blocks Claude paid overage by default and requires explicit opt-in", () => {
    expect(isClaudeExtraUsageBlockEnabled("claude", {})).toBe(true);
    expect(isClaudeExtraUsageBlockEnabled("claude", { blockExtraUsage: false })).toBe(false);
    expect(isClaudeExtraUsageBlockEnabled("openai", {})).toBe(false);
    expect(isClaudeExtraUsageAllowed("claude", { blockExtraUsage: false })).toBe(true);
    expect(isClaudeExtraUsageAllowed("claude", {})).toBe(false);
  });

  it("builds an account cooldown when Anthropic reports queued extra usage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00.000Z"));
    const sessionReset = futureIso(180_000);

    try {
      const update = buildClaudeExtraUsageConnectionUpdate(
        {
          provider: "claude",
          providerSpecificData: {},
          backoffLevel: 0,
        },
        {
          extraUsage: { queued: true },
          quotas: {
            "session (5h)": { remainingPercentage: 0, resetAt: sessionReset },
            "weekly (7d)": { remainingPercentage: 60, resetAt: futureIso(360_000) },
          },
        },
      );

      expect(update).toMatchObject({
        testStatus: "unavailable",
        lastError: CLAUDE_EXTRA_USAGE_ERROR_MESSAGE,
        lastErrorType: "quota_exhausted",
        lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
        errorCode: 429,
        rateLimitedUntil: sessionReset,
        backoffLevel: 1,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears only an extra-usage lock after a trusted snapshot says billing stopped", () => {
    const locked = {
      provider: "claude",
      providerSpecificData: {},
      testStatus: "unavailable",
      lastError: CLAUDE_EXTRA_USAGE_ERROR_MESSAGE,
      lastErrorType: "quota_exhausted",
      lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
      rateLimitedUntil: futureIso(),
      backoffLevel: 2,
    };

    expect(buildClaudeExtraUsageConnectionUpdate(locked, {
      extraUsage: null,
      quotas: { "session (5h)": { remainingPercentage: 30 } },
    })).toEqual({
      testStatus: "active",
      lastError: null,
      lastErrorAt: null,
      lastErrorType: null,
      lastErrorSource: null,
      errorCode: null,
      rateLimitedUntil: null,
      backoffLevel: 0,
    });
    expect(buildClaudeExtraUsageConnectionUpdate(locked, {
      message: "Claude connected. Unable to fetch usage: timeout",
    })).toBeNull();
    expect(buildClaudeExtraUsageConnectionUpdate({
      ...locked,
      lastErrorSource: "provider",
    }, {
      extraUsage: null,
      quotas: {},
    })).toBeNull();
  });
});

describe("Claude extra-usage credits", () => {
  it("adds enabled credit usage to the quota dashboard", () => {
    const quotas = parseQuotaData("claude", {
      quotas: {},
      extraUsage: {
        is_enabled: true,
        monthly_limit: 25,
        used_credits: 7.5,
        utilization: 30,
        currency: "USD",
      },
    });

    expect(quotas).toEqual([
      {
        name: "extra usage",
        used: 7.5,
        total: 25,
        creditBalance: 17.5,
        remainingPercentage: 70,
        resetAt: null,
        isCreditBalance: true,
        currency: "USD",
      },
    ]);
  });
});
