"use client";

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";
import { filterModelRows } from "@/shared/utils/modelVisibility";
import ModelVisibilityToolbar from "./ModelVisibilityToolbar";
function CompatibleModelRow({ modelId, fullModel, copied, onCopy, onDeleteAlias, onTest, testStatus, isTesting, hidden, onHide, onUnhide, selected, onToggleSelected, batchResult }) {
  const borderColor = testStatus === "ok"
    ? "border-green-500/40"
    : testStatus === "error"
    ? "border-red-500/40"
    : "border-border";

  const iconColor = testStatus === "ok"
    ? "#22c55e"
    : testStatus === "error"
    ? "#ef4444"
    : undefined;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${borderColor} hover:bg-sidebar/50`}>
      {!hidden && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${modelId}`}
          className="h-4 w-4 rounded border-border text-primary"
        />
      )}
      <span
        className="material-symbols-outlined text-base text-text-muted"
        style={iconColor ? { color: iconColor } : undefined}
      >
        {testStatus === "ok" ? "check_circle" : testStatus === "error" ? "cancel" : "smart_toy"}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{modelId}</p>
          {batchResult && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${batchResult.ok ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
              {batchResult.classification}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <code className="text-xs text-text-muted font-mono bg-sidebar px-1.5 py-0.5 rounded">{fullModel}</code>
          <div className="relative group/btn">
            <button
              onClick={() => onCopy(fullModel, `model-${modelId}`)}
              className="p-0.5 hover:bg-sidebar rounded text-text-muted hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm">
                {copied === `model-${modelId}` ? "check" : "content_copy"}
              </span>
            </button>
            <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {copied === `model-${modelId}` ? "Copied!" : "Copy"}
            </span>
          </div>
          {onTest && (
            <div className="relative group/btn">
              <button
                onClick={onTest}
                disabled={isTesting}
                className="p-0.5 hover:bg-sidebar rounded text-text-muted hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-sm" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined}>
                  {isTesting ? "progress_activity" : "science"}
                </span>
              </button>
              <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                {isTesting ? "Testing..." : "Test"}
              </span>
            </div>
          )}
        </div>
      </div>
      <button
        onClick={hidden ? onUnhide : onHide}
        className="p-1 hover:bg-sidebar rounded text-text-muted hover:text-primary"
        title={hidden ? "Unhide model" : "Hide model"}
      >
        <span className="material-symbols-outlined text-sm">{hidden ? "visibility" : "visibility_off"}</span>
      </button>
      <button
        onClick={onDeleteAlias}
        className="p-1 hover:bg-red-50 rounded text-red-500"
        title="Remove model"
      >
        <span className="material-symbols-outlined text-sm">delete</span>
      </button>
    </div>
  );
}

CompatibleModelRow.propTypes = {
  modelId: PropTypes.string.isRequired,
  fullModel: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onTest: PropTypes.func,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  isTesting: PropTypes.bool,
  hidden: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onUnhide: PropTypes.func.isRequired,
  selected: PropTypes.bool,
  onToggleSelected: PropTypes.func,
  batchResult: PropTypes.shape({
    ok: PropTypes.bool,
    classification: PropTypes.string,
  }),
};

export default function CompatibleModelsSection({ providerStorageAlias, providerDisplayAlias, modelAliases, customModels, copied, onCopy, onDeleteAlias, onAddCustomModel, onDeleteCustomModel, connections, isAnthropic, onImportModels, importing, importMessage, disabledModelIds, onHideModels, onUnhideModels, onVisibilityChanged }) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [testingModelId, setTestingModelId] = useState(null);
  const [modelTestResults, setModelTestResults] = useState({});
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [selectedIds, setSelectedIds] = useState([]);
  const [probeConnectionId, setProbeConnectionId] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState("5");
  const [autoHide, setAutoHide] = useState(true);
  const [batchState, setBatchState] = useState(null);
  const [batchResults, setBatchResults] = useState({});
  const batchAbortRef = useRef(null);

  useEffect(() => () => batchAbortRef.current?.abort(), []);

  const handleTestModel = async (modelId) => {
    if (testingModelId) return;
    setTestingModelId(modelId);
    try {
      const res = await fetch("/api/models/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: `${providerStorageAlias}/${modelId}` }),
      });
      const data = await res.json();
      setModelTestResults((prev) => ({ ...prev, [modelId]: data.ok ? "ok" : "error" }));
    } catch {
      setModelTestResults((prev) => ({ ...prev, [modelId]: "error" }));
    } finally {
      setTestingModelId(null);
    }
  };

  const allModels = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias: providerStorageAlias,
    type: "llm",
  });

  const disabledSet = new Set(disabledModelIds);
  const shownModels = filterModelRows(allModels, { query, visibility, disabledIds: disabledModelIds });
  const counts = {
    all: allModels.length,
    visible: allModels.filter((model) => !disabledSet.has(model.id)).length,
    hidden: allModels.filter((model) => disabledSet.has(model.id)).length,
    disabledSet,
  };

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    if (allModels.some((model) => model.id === modelId)) {
      alert("Model already exists for this provider.");
      return;
    }

    setAdding(true);
    try {
      await onAddCustomModel(modelId);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  const canImport = connections.some((conn) => conn.isActive !== false);
  const activeConnections = connections.filter((conn) => conn.isActive !== false);
  const visibleShownIds = shownModels.filter((model) => !disabledSet.has(model.id)).map((model) => model.id);

  const runBatch = async (modelIds) => {
    const connectionId = probeConnectionId || activeConnections[0]?.id;
    if (!connectionId || modelIds.length === 0 || batchState?.running) return;
    const controller = new AbortController();
    batchAbortRef.current = controller;
    setBatchResults({});
    setBatchState({ running: true, done: 0, total: modelIds.length, current: "", stopReason: null });
    try {
      const response = await fetch("/api/models/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId: providerStorageAlias,
          connectionId,
          modelIds,
          cooldownMs: Math.round(Number(cooldownSeconds || 5) * 1000),
          autoHideHardFailures: autoHide,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error((await response.json().catch(() => null))?.error || "Batch test failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const raw of lines) {
          if (!raw.trim()) continue;
          const event = JSON.parse(raw);
          if (event.type === "result") {
            setBatchResults((prev) => ({ ...prev, [event.result.modelId]: event.result }));
            setBatchState((prev) => ({ ...prev, done: event.done, current: event.result.modelId }));
          } else if (event.type === "done" || event.type === "cancelled") {
            setBatchState((prev) => ({ ...prev, running: false, done: event.done, stopReason: event.stopReason }));
          } else if (event.type === "error") throw new Error(event.error);
        }
      }
      if (autoHide) await onVisibilityChanged?.();
    } catch (error) {
      if (error?.name !== "AbortError") setBatchState((prev) => ({ ...prev, running: false, error: error.message }));
    } finally {
      if (batchAbortRef.current === controller) batchAbortRef.current = null;
      setBatchState((prev) => prev ? { ...prev, running: false } : prev);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Add {isAnthropic ? "Anthropic" : "OpenAI"}-compatible models manually or import them from the /models endpoint.
      </p>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label htmlFor="new-compatible-model-input" className="text-xs text-text-muted mb-1 block">Model ID</label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={isAnthropic ? "claude-3-opus-20240229" : "gpt-4o"}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
        <Button size="sm" variant="secondary" icon="download" onClick={onImportModels} disabled={!canImport || importing}>
          {importing ? "Importing..." : (importMessage || "Import from /models")}
        </Button>
      </div>

      {!canImport && (
        <p className="text-xs text-text-muted">
          Add a connection to enable importing models.
        </p>
      )}

      {allModels.length > 0 && (
        <>
          <ModelVisibilityToolbar
            query={query}
            onQueryChange={setQuery}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            counts={counts}
            shownIds={shownModels.map((model) => model.id)}
            onHideShown={onHideModels}
            onUnhideShown={onUnhideModels}
          />
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs">
            <select
              value={probeConnectionId || activeConnections[0]?.id || ""}
              onChange={(event) => setProbeConnectionId(event.target.value)}
              aria-label="Probe connection"
              className="rounded border border-border bg-background px-2 py-1.5"
            >
              {activeConnections.map((connection) => (
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
                value={cooldownSeconds}
                onChange={(event) => setCooldownSeconds(event.target.value)}
                className="w-16 rounded border border-border bg-background px-2 py-1"
              />
              sec
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={autoHide} onChange={(event) => setAutoHide(event.target.checked)} />
              Auto-hide hard failures
            </label>
            <Button size="sm" variant="secondary" icon="science" onClick={() => runBatch(selectedIds)} disabled={selectedIds.length === 0 || batchState?.running}>
              Test selected ({selectedIds.length})
            </Button>
            <Button size="sm" variant="secondary" icon="playlist_play" onClick={() => runBatch(visibleShownIds)} disabled={visibleShownIds.length === 0 || batchState?.running}>
              Test shown ({visibleShownIds.length})
            </Button>
            {batchState?.running && (
              <Button size="sm" variant="ghost" icon="stop" onClick={() => batchAbortRef.current?.abort()}>
                Cancel
              </Button>
            )}
            {batchState && (
              <span className="text-text-muted">
                {batchState.done}/{batchState.total}{batchState.current ? ` · ${batchState.current}` : ""}{batchState.stopReason ? ` · ${batchState.stopReason}` : ""}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {shownModels.map(({ id, alias, source }) => {
              const hidden = disabledSet.has(id);
              return (
                <CompatibleModelRow
                  key={`${source}-${providerStorageAlias}/${id}`}
                  modelId={id}
                  fullModel={`${providerDisplayAlias}/${id}`}
                  copied={copied}
                  onCopy={onCopy}
                  onDeleteAlias={() => source === "custom" ? onDeleteCustomModel(id) : onDeleteAlias(alias)}
                  onTest={!hidden && connections.length > 0 ? () => handleTestModel(id) : undefined}
                  testStatus={modelTestResults[id]}
                  isTesting={testingModelId === id}
                  hidden={hidden}
                  onHide={() => onHideModels([id])}
                  onUnhide={() => onUnhideModels([id])}
                  selected={selectedIds.includes(id)}
                  onToggleSelected={() => setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])}
                  batchResult={batchResults[id]}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  customModels: PropTypes.arrayOf(PropTypes.object),
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onAddCustomModel: PropTypes.func.isRequired,
  onDeleteCustomModel: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    isActive: PropTypes.bool,
  })).isRequired,
  isAnthropic: PropTypes.bool,
  onImportModels: PropTypes.func.isRequired,
  importing: PropTypes.bool,
  importMessage: PropTypes.string,
  disabledModelIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onHideModels: PropTypes.func.isRequired,
  onUnhideModels: PropTypes.func.isRequired,
  onVisibilityChanged: PropTypes.func.isRequired,
};
