"use client";

import { useCallback, useEffect, useState } from "react";

export default function useModelPricing(resolvedProviderId, modelIds) {
  const [pricing, setPricing] = useState({});
  const idsKey = modelIds.join("\n");

  const load = useCallback(async () => {
    if (!resolvedProviderId || !idsKey) return setPricing({});
    const qs = idsKey.split("\n").map((id) => `models=${encodeURIComponent(id)}`).join("&");
    const res = await fetch(`/api/pricing?provider=${encodeURIComponent(resolvedProviderId)}&${qs}`, { cache: "no-store" });
    if (res.ok) setPricing(await res.json());
  }, [resolvedProviderId, idsKey]);

  useEffect(() => { Promise.resolve().then(load).catch(() => {}); }, [load]);

  const save = async (modelId, rates) => {
    const res = await fetch("/api/pricing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [resolvedProviderId]: { [modelId]: rates } }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save price");
    await load();
  };

  const reset = async (modelId) => {
    const res = await fetch(`/api/pricing?provider=${encodeURIComponent(resolvedProviderId)}&model=${encodeURIComponent(modelId)}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to reset price");
    await load();
  };

  return { pricing, save, reset };
}
