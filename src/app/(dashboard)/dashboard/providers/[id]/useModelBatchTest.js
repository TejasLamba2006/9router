"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consumeModelBatchStream } from "@/shared/utils/modelBatchClient.js";

export default function useModelBatchTest({ providerId, connections, onVisibilityChanged }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [connectionId, setConnectionId] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState("5");
  const [autoHide, setAutoHide] = useState(true);
  const [verifyCapabilities, setVerifyCapabilities] = useState(false);
  const [state, setState] = useState(null);
  const [results, setResults] = useState({});
  const [capabilityEvidence, setCapabilityEvidence] = useState({});
  const abortRef = useRef(null);
  const evidenceRequestRef = useRef(0);
  const activeConnections = connections.filter((connection) => connection.isActive !== false);
  const defaultConnectionId = activeConnections[0]?.id || "";

  const refreshCapabilityEvidence = useCallback(async (selectedConnectionId) => {
    const requestId = ++evidenceRequestRef.current;
    if (!selectedConnectionId) { setCapabilityEvidence({}); return; }
    try {
      const response = await fetch(`/api/models/capabilities?provider=${encodeURIComponent(providerId)}&connectionId=${encodeURIComponent(selectedConnectionId)}`, { cache: "no-store" });
      const data = await response.json();
      if (requestId === evidenceRequestRef.current && response.ok) setCapabilityEvidence(data.models || {});
    } catch {}
  }, [providerId]);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const selectedConnectionId = connectionId || defaultConnectionId;
    if (!selectedConnectionId) return;
    Promise.resolve().then(() => refreshCapabilityEvidence(selectedConnectionId));
  }, [connectionId, defaultConnectionId, refreshCapabilityEvidence]);

  async function run(modelIds) {
    const selectedConnectionId = connectionId || defaultConnectionId;
    const cooldown = Number(cooldownSeconds);
    if (!selectedConnectionId || modelIds.length === 0 || state?.running
      || !Number.isFinite(cooldown) || cooldown < 0 || cooldown > 60) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setResults((previous) => modelIds.length === 1 ? previous : {});
    setState({ running: true, done: 0, total: modelIds.length, current: modelIds[0] || "", stopReason: null });
    try {
      const response = await fetch("/api/models/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          connectionId: selectedConnectionId,
          modelIds,
          cooldownMs: Math.round(cooldown * 1000),
          autoHideHardFailures: autoHide,
          verifyCapabilities,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || "Batch test failed");
      await consumeModelBatchStream(response.body, (event) => {
        if (event.type === "result") {
          setResults((previous) => ({ ...previous, [event.result.modelId]: event.result }));
          setState((previous) => ({ ...previous, done: event.done, current: event.result.modelId }));
        } else if (event.type === "wait") {
          setState((previous) => ({ ...previous, done: event.done, current: modelIds[event.done] || "" }));
        } else if (event.type === "done" || event.type === "cancelled") {
          setState((previous) => ({ ...previous, running: false, done: event.done, stopReason: event.stopReason }));
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      });
      await Promise.all([onVisibilityChanged?.(), refreshCapabilityEvidence(selectedConnectionId)]);
    } catch (error) {
      if (error?.name !== "AbortError") setState((previous) => ({ ...previous, running: false, error: error.message }));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setState((previous) => previous ? { ...previous, running: false } : previous);
    }
  }

  const toggleSelected = (modelId) => setSelectedIds((previous) => (
    previous.includes(modelId) ? previous.filter((id) => id !== modelId) : [...previous, modelId]
  ));

  return {
    activeConnections,
    selectedIds,
    setSelectedIds,
    toggleSelected,
    connectionId,
    setConnectionId,
    cooldownSeconds,
    setCooldownSeconds,
    autoHide,
    setAutoHide,
    verifyCapabilities,
    setVerifyCapabilities,
    state,
    results,
    capabilityEvidence,
    refreshCapabilityEvidence,
    run,
    cancel: () => abortRef.current?.abort(),
  };
}
