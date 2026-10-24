/**
 * FreePi usage: GET https://api.freepi.ai/me
 * Fields: remaining_usd_today, cap_usd_today, credit_usd, tier, lane, refill_at
 */
import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { toFiniteNumber } from "./shared.js";

export async function getFreepiUsage(token, proxyOptions = null) {
  if (!token) return { message: "FreePi token not available." };
  try {
    const res = await proxyAwareFetch(
      "https://api.freepi.ai/me",
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      proxyOptions,
    );
    if (res.status === 401 || res.status === 403) {
      return { plan: "FreePi", message: "FreePi token invalid or expired. Sign in again." };
    }
    if (!res.ok) return { plan: "FreePi", message: `FreePi /me error (${res.status})` };
    const d = await res.json().catch(() => null);
    if (!d || typeof d !== "object") return { message: "FreePi /me response was not JSON." };

    const cap = toFiniteNumber(d.cap_usd_today, 0);
    const remaining = Math.max(0, toFiniteNumber(d.remaining_usd_today, 0));
    const quotas = {};
    if (cap > 0) {
      quotas["Daily allowance (USD)"] = {
        used: Math.max(0, cap - remaining),
        total: cap,
        remainingPercentage: Math.min(100, (remaining / cap) * 100),
        resetAt: d.refill_at || null,
        unlimited: false,
      };
    }
    const credit = toFiniteNumber(d.credit_usd, 0);
    if (credit > 0) {
      quotas["Credit (USD)"] = {
        used: 0,
        total: credit,
        remainingPercentage: 100,
        resetAt: null,
        unlimited: false,
        isCreditBalance: true,
        currency: "USD",
      };
    }
    const plan = ["FreePi", d.tier, d.lane].filter(Boolean).join(" ");
    return Object.keys(quotas).length ? { plan, quotas } : { plan, message: "FreePi connected. No allowance data returned." };
  } catch (error) {
    return { message: `FreePi error: ${error.message}` };
  }
}
