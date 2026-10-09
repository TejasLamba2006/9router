"use client";

import PropTypes from "prop-types";
import { Button } from "@/shared/components";

export default function ModelBatchToolbar({ batch, shownIds }) {
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
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={batch.autoHide} onChange={(event) => batch.setAutoHide(event.target.checked)} />
        Auto-hide hard failures
      </label>
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
    autoHide: PropTypes.bool.isRequired,
    setAutoHide: PropTypes.func.isRequired,
    verifyCapabilities: PropTypes.bool.isRequired,
    setVerifyCapabilities: PropTypes.func.isRequired,
    state: PropTypes.object,
    run: PropTypes.func.isRequired,
    cancel: PropTypes.func.isRequired,
  }).isRequired,
  shownIds: PropTypes.arrayOf(PropTypes.string).isRequired,
};
