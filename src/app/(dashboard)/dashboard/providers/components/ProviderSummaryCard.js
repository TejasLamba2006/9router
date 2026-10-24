"use client";

import PropTypes from "prop-types";
import { Card, Button } from "@/shared/components";
import { STATUS_FILTER_OPTIONS } from "../utils";
import { CATEGORY_FILTERS, MEDIA_FILTERS } from "../providerFiltering";
import ProviderDisplayModeControl from "./ProviderDisplayModeControl";

function SearchInput({ value, onChange, placeholder, icon, label }) {
  return (
    <div className="relative min-w-[180px] flex-1">
      <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-text-muted">
        {icon}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-8 w-full rounded-lg border border-black/10 bg-black/[0.02] pl-7 pr-7 text-xs text-text-primary outline-none focus:border-primary/50 dark:border-white/10 dark:bg-white/[0.03]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
      )}
    </div>
  );
}

SearchInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  icon: PropTypes.string,
  label: PropTypes.string,
};

export default function ProviderSummaryCard({
  searchQuery,
  onSearchChange,
  modelQuery,
  onModelChange,
  mode,
  onModeChange,
  statusFilter,
  onStatusChange,
  category,
  onCategoryChange,
  media,
  onMediaChange,
  categoryCounts,
  onAddOpenAI,
  onAddAnthropic,
  onTestAll,
  testing,
}) {
  return (
    <Card padding="sm" className="flex flex-col gap-3">
      {/* Row 1: search + mode + status + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search providers by name, ID, or prefix..."
          icon="search"
          label="provider search"
        />
        <SearchInput
          value={modelQuery}
          onChange={onModelChange}
          placeholder="Search by model ID or name..."
          icon="psychology"
          label="model search"
        />
        <ProviderDisplayModeControl mode={mode} onChange={onModeChange} />
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-8 rounded-lg border border-black/10 bg-black/[0.02] px-2 text-xs text-text-primary outline-none dark:border-white/10 dark:bg-white/[0.03]"
          aria-label="Filter providers by connection status"
        >
          {STATUS_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" icon="add" onClick={onAddOpenAI}>
          OpenAI Compatible
        </Button>
        <Button size="sm" variant="secondary" icon="add" onClick={onAddAnthropic}>
          Anthropic Compatible
        </Button>
        <Button size="sm" icon="play_arrow" onClick={onTestAll} disabled={!!testing}>
          {testing ? "Testing..." : "Test All"}
        </Button>
      </div>

      {/* Row 2: category chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Provider category filter">
        {CATEGORY_FILTERS.map((c) => {
          const n = categoryCounts?.[c.id] || { configured: 0, total: 0 };
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onCategoryChange(c.id)}
              aria-pressed={active}
              className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:border-primary/40 hover:text-text-main"
              }`}
            >
              {c.dot && <span className={`size-2 rounded-full ${c.dot}`} />}
              {c.label}
              <span className="tabular-nums opacity-70">
                {n.configured}/{n.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Row 3: media chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Service kind filter">
        {MEDIA_FILTERS.map((m) => {
          const active = media === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onMediaChange(active ? "" : m.id)}
              aria-pressed={active}
              className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-text-muted hover:border-primary/40 hover:text-text-main"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{m.icon}</span>
              {m.label}
            </button>
          );
        })}
        {media && (
          <button
            type="button"
            onClick={() => onMediaChange("")}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        )}
      </div>
    </Card>
  );
}

ProviderSummaryCard.propTypes = {
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  modelQuery: PropTypes.string.isRequired,
  onModelChange: PropTypes.func.isRequired,
  mode: PropTypes.string.isRequired,
  onModeChange: PropTypes.func.isRequired,
  statusFilter: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func.isRequired,
  category: PropTypes.string.isRequired,
  onCategoryChange: PropTypes.func.isRequired,
  media: PropTypes.string.isRequired,
  onMediaChange: PropTypes.func.isRequired,
  categoryCounts: PropTypes.object,
  onAddOpenAI: PropTypes.func.isRequired,
  onAddAnthropic: PropTypes.func.isRequired,
  onTestAll: PropTypes.func.isRequired,
  testing: PropTypes.bool,
};
