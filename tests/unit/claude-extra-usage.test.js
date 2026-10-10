import { describe, expect, it, vi } from "vitest";
import {
  CLAUDE_EXTRA_USAGE_ERROR_MESSAGE,
  CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
  buildClaudeExtraUsageConnectionUpdate,
  isClaudeExtraUsageAllowed,
  isClaudeExtraUsageBlockEnabled,
} from "@/lib/providers/claudeExtraUsage.js";
import { parseQuotaData } from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";
import { syncClaudeExtraUsageStateAfterRequest } from "@/sse/services/claudeExtraUsage.js";

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

  it("keeps extra-usage provenance in persisted connection records", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const originalDataDir = process.env.DATA_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "9router-claude-extra-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();

    try {
      const { createProviderConnection, getProviderConnectionById, updateProviderConnection } = await import("@/models/index.js");
      const connection = await createProviderConnection({
        provider: "claude",
        authType: "oauth",
        name: "Claude",
        email: "claude@example.com",
      });
      await updateProviderConnection(connection.id, {
        testStatus: "unavailable",
        lastErrorType: "quota_exhausted",
        lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
      });

      expect(await getProviderConnectionById(connection.id)).toMatchObject({
        lastErrorType: "quota_exhausted",
        lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
      });
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      if (originalDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = originalDataDir;
      vi.resetModules();
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

  it("syncs queued extra usage after a successful request using fresh credentials and the usage cache", async () => {
    const connection = {
      id: "claude-1",
      provider: "claude",
      providerSpecificData: {},
      accessToken: "stale-token",
      backoffLevel: 0,
    };
    const freshConnection = { ...connection, accessToken: "fresh-token" };
    const updateProviderConnection = vi.fn();
    const usage = {
      extraUsage: { queued: true },
      quotas: { "session (5h)": { resetAt: futureIso() } },
    };

    const getUsageForProvider = vi.fn().mockResolvedValue(usage);
    await syncClaudeExtraUsageStateAfterRequest(connection, {
      getProviderConnectionById: vi.fn().mockResolvedValue(freshConnection),
      getUsageForProvider,
      resolveConnectionProxyConfig: vi.fn().mockResolvedValue({
        connectionProxyEnabled: false,
      }),
      updateProviderConnection,
    });

    expect(getUsageForProvider).toHaveBeenCalledWith(
      freshConnection,
      expect.objectContaining({ strictProxy: false }),
    );
    expect(updateProviderConnection).toHaveBeenCalledWith(
      connection.id,
      expect.objectContaining({
        lastErrorSource: CLAUDE_EXTRA_USAGE_ERROR_SOURCE,
        testStatus: "unavailable",
      }),
    );
  });

  it("skips request-time usage fetch when paid credits are explicitly allowed", async () => {
    const getUsageForProvider = vi.fn();

    await syncClaudeExtraUsageStateAfterRequest({
      id: "claude-1",
      provider: "claude",
      providerSpecificData: { blockExtraUsage: false },
    }, { getUsageForProvider });

    expect(getUsageForProvider).not.toHaveBeenCalled();
  });

  it("fails open when request-time usage sync errors", async () => {
    await expect(syncClaudeExtraUsageStateAfterRequest({
      id: "claude-1",
      provider: "claude",
      providerSpecificData: {},
    }, {
      resolveConnectionProxyConfig: vi.fn().mockRejectedValue(new Error("proxy down")),
    })).resolves.toBeUndefined();
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

  it("shows a zero balance when Claude reports that prior credits ran out", () => {
    const quotas = parseQuotaData("claude", {
      quotas: {},
      extraUsage: {
        is_enabled: false,
        monthly_limit: null,
        used_credits: null,
        utilization: null,
        currency: "USD",
        disabled_reason: "out_of_credits",
        credits_ever_enabled: true,
      },
    });

    expect(quotas).toEqual([
      {
        name: "extra usage",
        used: 0,
        total: 0,
        creditBalance: 0,
        remainingPercentage: 0,
        resetAt: null,
        isCreditBalance: true,
        currency: "USD",
      },
    ]);
  });
});
