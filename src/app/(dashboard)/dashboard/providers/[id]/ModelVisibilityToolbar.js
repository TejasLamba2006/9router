"use client";

import PropTypes from "prop-types";
import { Button } from "@/shared/components";

export default function ModelVisibilityToolbar({ query, onQueryChange, visibility, onVisibilityChange, counts, shownIds, onHideShown, onUnhideShown }) {
  const shownVisible = shownIds.filter((id) => !counts.disabledSet.has(id));
  const shownHidden = shownIds.filter((id) => counts.disabledSet.has(id));

  return (
    <div className="flex w-full flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center">
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search models"
        aria-label="Search models"
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <select
        value={visibility}
        onChange={(event) => onVisibilityChange(event.target.value)}
        aria-label="Model visibility"
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
      >
        <option value="all">All ({counts.all})</option>
        <option value="visible">Visible ({counts.visible})</option>
        <option value="hidden">Hidden ({counts.hidden})</option>
      </select>
      {shownVisible.length > 0 && (
        <Button size="sm" variant="secondary" icon="visibility_off" onClick={() => onHideShown(shownVisible)}>
          Hide shown
        </Button>
      )}
      {shownHidden.length > 0 && (
        <Button size="sm" variant="secondary" icon="visibility" onClick={() => onUnhideShown(shownHidden)}>
          Unhide shown
        </Button>
      )}
    </div>
  );
}

ModelVisibilityToolbar.propTypes = {
  query: PropTypes.string.isRequired,
  onQueryChange: PropTypes.func.isRequired,
  visibility: PropTypes.oneOf(["all", "visible", "hidden"]).isRequired,
  onVisibilityChange: PropTypes.func.isRequired,
  counts: PropTypes.shape({
    all: PropTypes.number.isRequired,
    visible: PropTypes.number.isRequired,
    hidden: PropTypes.number.isRequired,
    disabledSet: PropTypes.instanceOf(Set).isRequired,
  }).isRequired,
  shownIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  onHideShown: PropTypes.func.isRequired,
  onUnhideShown: PropTypes.func.isRequired,
};
