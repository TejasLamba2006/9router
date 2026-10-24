"use client";

import PropTypes from "prop-types";

const OPTIONS = [
  { mode: "all", label: "All", icon: "view_module", title: "Show every provider in grouped sections." },
  { mode: "configured", label: "Configured", icon: "check_circle", title: "Show providers with saved connections or no-auth." },
  { mode: "compact", label: "Compact", icon: "view_agenda", title: "Show all matching providers in one dense grid." },
];

export default function ProviderDisplayModeControl({ mode, onChange }) {
  return (
    <div
      className="flex items-center rounded-lg border border-border p-0.5"
      role="radiogroup"
      aria-label="Provider display mode"
    >
      {OPTIONS.map((o) => {
        const active = mode === o.mode;
        return (
          <label
            key={o.mode}
            title={o.title}
            className={`inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
              active ? "bg-primary/10 text-primary" : "text-text-muted hover:text-text-main"
            }`}
          >
            <input
              type="radio"
              name="provider-display-mode"
              value={o.mode}
              checked={active}
              onChange={() => onChange(o.mode)}
              className="sr-only"
              aria-label={o.title}
            />
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              {o.icon}
            </span>
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

ProviderDisplayModeControl.propTypes = {
  mode: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};
