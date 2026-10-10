"use client";

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import { AUTO_HIDE_CLASSIFICATIONS, DEFAULT_AUTO_HIDE_CLASSIFICATIONS } from "@/lib/modelTestBatch.js";

const CLASSIFICATION_LABELS = {
  hard_model_failure: "Hard model failure",
  rate_limited: "Rate limited",
  timeout: "Timeout",
  quota: "Quota or credits",
  auth_or_account: "Authentication or account",
  transient_provider: "Transient provider error",
  content_filtered: "Content filtered",
  skipped: "Skipped",
  inconclusive: "Inconclusive",
};

export default function ModelBatchToolbar({ batch, shownIds }) {
  const [hideMenuOpen, setHideMenuOpen] = useState(false);
  const hideMenuRef = useRef(null);
  const hasRiskySelection = batch.autoHideClassifications.some((value) => !DEFAULT_AUTO_HIDE_CLASSIFICATIONS.includes(value));

  useEffect(() => {
    if (batch.state?.running) {
      Promise.resolve().then(() => setHideMenuOpen(false));
      return;
    }
    if (!hideMenuOpen) return;
    const close = (event) => {
      if (!hideMenuRef.current?.contains(event.target)) setHideMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [hideMenuOpen, batch.state?.running]);

  const toggleClassification = (classification) => {
    batch.setAutoHideClassifications((previous) => previous.includes(classification)
      ? previous.filter((value) => value !== classification)
      : [...previous, classification]);
  };

  if (batch.activeConnections.length === 0) return null;
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs">
      <select
        value={batch.connectionId || batch.activeConnections[0]?.id || ""}
        onChange={(event) => batch.setConnectionId(event.target.value)}
        aria-label="Probe connection"
        className="rounded border border-border bg-background px-2 py-1.5"
      >
        {batch.activeConnections.map((connection) => (
          <option key={connection.id} value={connection.id}>{connection.name || connection.email || connection.id}</option>
        ))}
      </select>
      <label className="flex items-center gap-1">
        Delay
        <input
          type="number"
          min="0"
          max="60"
          step="1"
          value={batch.cooldownSeconds}
          onChange={(event) => batch.setCooldownSeconds(event.target.value)}
          className="w-16 rounded border border-border bg-background px-2 py-1"
        />
        sec
      </label>
      <div className="relative" ref={hideMenuRef}>
        <button
          type="button"
          onClick={() => setHideMenuOpen((open) => !open)}
          disabled={batch.state?.running}
          aria-expanded={hideMenuOpen}
          className="rounded border border-border bg-background px-2 py-1.5 disabled:opacity-50"
        >
          Auto-hide: {batch.autoHideClassifications.length}
        </button>
        {hideMenuOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[250px] rounded-lg border border-border bg-bg p-2 shadow-lg">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <button type="button" disabled={batch.state?.running} onClick={() => batch.setAutoHideClassifications([])} className="text-text-muted hover:text-primary disabled:opacity-50">None</button>
              <button type="button" disabled={batch.state?.running} onClick={() => batch.setAutoHideClassifications([...DEFAULT_AUTO_HIDE_CLASSIFICATIONS])} className="text-primary hover:underline disabled:opacity-50">Reset safe default</button>
            </div>
            <div className="mt-2 flex flex-col gap-1.5">
              {AUTO_HIDE_CLASSIFICATIONS.map((classification) => (
                <label key={classification} className="flex items-center gap-2 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={batch.autoHideClassifications.includes(classification)}
                    onChange={() => toggleClassification(classification)}
                    disabled={batch.state?.running}
                  />
                  {CLASSIFICATION_LABELS[classification]}
                </label>
              ))}
            </div>
            {hasRiskySelection && (
              <p className="mt-2 border-t border-border pt-2 text-[10px] text-amber-600">
                Hides models permanently until unhidden. Temporary account or provider errors can hide working models.
              </p>
            )}
          </div>
        )}
      </div>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={batch.verifyCapabilities} onChange={(event) => batch.setVerifyCapabilities(event.target.checked)} />
        Verify capabilities
      </label>
      <Button size="sm" variant="secondary" icon="science" onClick={() => batch.run(batch.selectedIds)} disabled={batch.selectedIds.length === 0 || batch.state?.running}>
        Test selected ({batch.selectedIds.length})
      </Button>
      <Button size="sm" variant="secondary" icon="playlist_play" onClick={() => batch.run(shownIds)} disabled={shownIds.length === 0 || batch.state?.running}>
        Test shown ({shownIds.length})
      </Button>
      {batch.state?.running && (
        <Button size="sm" variant="ghost" icon="stop" onClick={batch.cancel}>Cancel</Button>
      )}
      {batch.state && (
        <span className="text-text-muted">
          {batch.state.done}/{batch.state.total}{batch.state.current ? ` · ${batch.state.current}` : ""}{batch.state.stopReason ? ` · ${batch.state.stopReason}` : ""}{batch.state.error ? ` · ${batch.state.error}` : ""}
        </span>
      )}
    </div>
  );
}

ModelBatchToolbar.propTypes = {
  batch: PropTypes.shape({
    activeConnections: PropTypes.array.isRequired,
    selectedIds: PropTypes.array.isRequired,
    connectionId: PropTypes.string.isRequired,
    setConnectionId: PropTypes.func.isRequired,
    cooldownSeconds: PropTypes.string.isRequired,
    setCooldownSeconds: PropTypes.func.isRequired,
    autoHideClassifications: PropTypes.arrayOf(PropTypes.string).isRequired,
    setAutoHideClassifications: PropTypes.func.isRequired,
    verifyCapabilities: PropTypes.bool.isRequired,
    setVerifyCapabilities: PropTypes.func.isRequired,
    state: PropTypes.object,
    run: PropTypes.func.isRequired,
    cancel: PropTypes.func.isRequired,
  }).isRequired,
  shownIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};
