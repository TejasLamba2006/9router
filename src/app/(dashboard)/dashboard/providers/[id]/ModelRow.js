"use client";

import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { CapacityBadges } from "@/shared/components";
import ModelCapabilityBadges from "@/shared/components/ModelCapabilityBadges";
import { getModelPricingPresentation, getModelSourceBadge, getModelTestPresentation, parsePricingInput } from "@/shared/utils/modelRowPresentation.js";

export default function ModelRow({
  model,
  fullModel,
  alias,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  isCustom,
  onTest,
  testDisabledReason,
  isTesting,
  onDisable,
  onEnable,
  hidden,
  caps,
  thinkingSuffix,
  selected,
  onToggleSelected,
  batchResult,
  capabilityEvidence,
  pricing,
  onSavePricing,
  onResetPricing,
}) {
  const displayModel = thinkingSuffix ? `${fullModel}(${thinkingSuffix})` : fullModel;
  const sourceBadge = getModelSourceBadge(model.source);
  const test = getModelTestPresentation({ testing: isTesting, result: batchResult });
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasValue, setAliasValue] = useState(alias || "");
  const aliasInputRef = useRef(null);
  const price = getModelPricingPresentation(pricing);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceDraft, setPriceDraft] = useState({ input: "", output: "" });
  const [savingPrice, setSavingPrice] = useState(false);
  const priceRates = parsePricingInput(priceDraft);

  const savePrice = async () => {
    if (!priceRates) return;
    setSavingPrice(true);
    try {
      await onSavePricing(priceRates);
      setEditingPrice(false);
    } catch (error) {
      alert(error.message || "Failed to save price");
    } finally {
      setSavingPrice(false);
    }
  };

  useEffect(() => {
    if (editingAlias) aliasInputRef.current?.focus();
  }, [editingAlias]);

  const saveAlias = () => {
    const value = aliasValue.trim();
    if (value && value !== alias) onSetAlias?.(value);
    else if (!value && alias) onDeleteAlias?.();
    setEditingAlias(false);
  };

  const testTone = test.tone === "success"
    ? "text-green-500"
    : test.tone === "warning"
      ? "text-amber-500"
      : test.tone === "error"
        ? "text-red-500"
        : "text-text-muted hover:text-primary";
  const borderColor = test.tone === "success"
    ? "border-green-500/40"
    : test.tone === "error"
      ? "border-red-500/40"
      : "border-border";

  return (
    <div className={`flex min-w-[220px] max-w-md items-center gap-2 rounded-lg border px-3 py-2 transition-opacity hover:bg-sidebar/50 ${borderColor} ${hidden ? "opacity-50" : ""}`}>
      {!hidden && onToggleSelected && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label={`Select ${model.id}`}
          className="h-4 w-4 shrink-0 rounded border-border text-primary"
        />
      )}
      <span className="material-symbols-outlined shrink-0 text-base text-text-muted">smart_toy</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <code className="max-w-full break-all rounded bg-sidebar px-1.5 py-0.5 font-mono text-xs text-text-muted">{displayModel}</code>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sourceBadge.className}`}>
          {sourceBadge.label}
        </span>
        {onSetAlias && editingAlias ? (
          <input
            ref={aliasInputRef}
            value={aliasValue}
            onChange={(event) => setAliasValue(event.target.value)}
            onBlur={saveAlias}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveAlias();
              if (event.key === "Escape") { setAliasValue(alias || ""); setEditingAlias(false); }
            }}
            className="w-24 rounded border border-primary/50 bg-surface px-1 py-0.5 text-[10px] text-text-main outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => { if (onSetAlias) { setAliasValue(alias || ""); setEditingAlias(true); } }}
            className={`truncate text-[10px] italic ${onSetAlias ? "cursor-pointer hover:text-primary" : "cursor-default"} ${alias ? "text-primary/80" : "text-text-muted/70"}`}
            title={onSetAlias ? "Click to edit alias" : undefined}
          >
            {alias || model.name || model.id}
          </button>
        )}
        <CapacityBadges caps={caps} colorOverride="text-text-muted/70" size={12} />
        <ModelCapabilityBadges capabilities={capabilityEvidence} />
        {batchResult && (
          <span className={`rounded px-1.5 py-0.5 text-[9px] ${batchResult.ok ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
            {batchResult.classification}
          </span>
        )}
        <button
          onClick={() => onCopy(displayModel, `model-${model.id}`)}
          className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary"
          title={copied === `model-${model.id}` ? "Copied" : "Copy model"}
        >
          <span className="material-symbols-outlined text-sm">{copied === `model-${model.id}` ? "check" : "content_copy"}</span>
        </button>
        {onSavePricing && (editingPrice ? (
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <label className="flex items-center gap-0.5">
              In $
              <input
                type="number" min="0" step="any" inputMode="decimal"
                aria-label={`Input price for ${model.id} in dollars per 1M tokens`}
                value={priceDraft.input}
                onChange={(event) => setPriceDraft((d) => ({ ...d, input: event.target.value }))}
                className="w-16 rounded border border-border bg-surface px-1 py-0.5 text-text-main"
              />
            </label>
            <label className="flex items-center gap-0.5">
              Out $
              <input
                type="number" min="0" step="any" inputMode="decimal"
                aria-label={`Output price for ${model.id} in dollars per 1M tokens`}
                value={priceDraft.output}
                onChange={(event) => setPriceDraft((d) => ({ ...d, output: event.target.value }))}
                onKeyDown={(event) => { if (event.key === "Enter") savePrice(); if (event.key === "Escape") setEditingPrice(false); }}
                className="w-16 rounded border border-border bg-surface px-1 py-0.5 text-text-main"
              />
            </label>
            <span>$ / 1M tokens</span>
            <button type="button" onClick={savePrice} disabled={!priceRates || savingPrice} title="Save price" className="rounded p-0.5 hover:text-primary disabled:opacity-40">
              <span className="material-symbols-outlined text-sm">check</span>
            </button>
            <button type="button" onClick={() => setEditingPrice(false)} title="Cancel" className="rounded p-0.5 hover:text-primary">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-text-muted">
            <button
              type="button"
              onClick={() => { setPriceDraft({ input: price.input, output: price.output }); setEditingPrice(true); }}
              title="Edit price ($ / 1M tokens)"
              className="rounded px-1 hover:text-primary"
            >
              {price.label}
            </button>
            {price.canReset && onResetPricing && (
              <button type="button" onClick={onResetPricing} title="Reset to default price" className="rounded p-0.5 hover:text-primary">
                <span className="material-symbols-outlined text-sm">restart_alt</span>
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onTest}
          disabled={!onTest || isTesting}
          title={testDisabledReason || (isTesting ? "Testing model" : "Test model")}
          className={`rounded p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${testTone}`}
        >
          <span className={`material-symbols-outlined text-sm ${isTesting ? "animate-spin" : ""}`}>{test.icon}</span>
        </button>
        {(onDisable || onEnable) && (
          <button
            onClick={hidden ? onEnable : onDisable}
            className="rounded p-0.5 text-text-muted hover:bg-sidebar hover:text-primary disabled:opacity-40"
            title={hidden ? "Unhide model" : "Hide model"}
          >
            <span className="material-symbols-outlined text-sm">{hidden ? "visibility" : "visibility_off"}</span>
          </button>
        )}
        {isCustom && (
          <button onClick={onDeleteAlias} className="rounded p-0.5 text-red-500 hover:bg-red-500/10" title="Remove custom model">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>
    </div>
  );
}

ModelRow.propTypes = {
  model: PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string, source: PropTypes.string }).isRequired,
  fullModel: PropTypes.string.isRequired,
  alias: PropTypes.string,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onSetAlias: PropTypes.func,
  onDeleteAlias: PropTypes.func,
  isCustom: PropTypes.bool,
  onTest: PropTypes.func,
  testDisabledReason: PropTypes.string,
  isTesting: PropTypes.bool,
  onDisable: PropTypes.func,
  onEnable: PropTypes.func,
  hidden: PropTypes.bool,
  caps: PropTypes.object,
  thinkingSuffix: PropTypes.string,
  selected: PropTypes.bool,
  onToggleSelected: PropTypes.func,
  batchResult: PropTypes.shape({ ok: PropTypes.bool, classification: PropTypes.string }),
  capabilityEvidence: PropTypes.object,
  pricing: PropTypes.shape({ rates: PropTypes.object, source: PropTypes.string }),
  onSavePricing: PropTypes.func,
  onResetPricing: PropTypes.func,
};
