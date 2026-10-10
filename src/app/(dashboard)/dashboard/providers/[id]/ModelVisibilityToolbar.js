"use client";

import PropTypes from "prop-types";
import { Button } from "@/shared/components";

export default function ModelVisibilityToolbar({
  query,
  onQueryChange,
  visibility,
  onVisibilityChange,
  freeFilter,
  onFreeFilterChange,
  sortFreeFirst,
  onSortFreeFirstChange,
  counts,
  shownIds,
  onHideShown,
  onUnhideShown,
  batchControls,
}) {
  const shownVisible = shownIds.filter((id) => !counts.disabledSet.has(id));
  const shownHidden = shownIds.filter((id) => counts.disabledSet.has(id));

  return (
    <div className="mb-3 flex w-full flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[15px] text-text-muted">search</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter models…"
          aria-label="Search models"
          className="w-full rounded-lg border border-border bg-sidebar/50 py-1.5 pl-7 pr-3 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-border bg-sidebar/50 p-0.5">
        {[
          ["all", `All (${counts.all})`],
          ["visible", `Visible (${counts.visible})`],
          ["hidden", `Hidden (${counts.hidden})`],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onVisibilityChange(value)}
            className={`rounded px-2 py-1 text-xs ${visibility === value ? "bg-primary text-white" : "text-text-muted hover:text-text-main"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {onFreeFilterChange && (
        <div className="flex items-center gap-1 rounded-lg border border-border bg-sidebar/50 p-0.5">
          {[["all", "All"], ["free", "Free only"], ["paid", "Paid only"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onFreeFilterChange(value)}
              className={`rounded px-2 py-1 text-xs ${freeFilter === value ? "bg-primary text-white" : "text-text-muted hover:text-text-main"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {onSortFreeFirstChange && (
        <button
          type="button"
          onClick={() => onSortFreeFirstChange(!sortFreeFirst)}
          aria-pressed={sortFreeFirst}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${sortFreeFirst ? "border-primary bg-primary/10 text-primary" : "border-border text-text-main"}`}
        >
          <span className="material-symbols-outlined text-[16px]">sort</span>
          Free first
        </button>
      )}
      {batchControls}
      {shownHidden.length > 0 && (
        <Button size="sm" variant="secondary" icon="visibility" onClick={() => onUnhideShown(shownHidden)}>Show all</Button>
      )}
      {shownVisible.length > 0 && (
        <Button size="sm" variant="secondary" icon="visibility_off" onClick={() => onHideShown(shownVisible)}>Hide all</Button>
      )}
      <span className="whitespace-nowrap text-xs text-text-muted">{counts.visible}/{counts.all} active</span>
    </div>
  );
}

ModelVisibilityToolbar.propTypes = {
  query: PropTypes.string.isRequired,
  onQueryChange: PropTypes.func.isRequired,
  visibility: PropTypes.oneOf(["all", "visible", "hidden"]).isRequired,
  onVisibilityChange: PropTypes.func.isRequired,
  freeFilter: PropTypes.oneOf(["all", "free", "paid"]),
  onFreeFilterChange: PropTypes.func,
  sortFreeFirst: PropTypes.bool,
  onSortFreeFirstChange: PropTypes.func,
  counts: PropTypes.shape({ all: PropTypes.number.isRequired, visible: PropTypes.number.isRequired, hidden: PropTypes.number.isRequired, disabledSet: PropTypes.instanceOf(Set).isRequired }).isRequired,
  shownIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onHideShown: PropTypes.func.isRequired,
  onUnhideShown: PropTypes.func.isRequired,
  batchControls: PropTypes.node,
};
