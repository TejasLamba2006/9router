"use client";

import { MODE_TABS } from "../playgroundUi";

export default function PlaygroundModeTabs({ mode, onChange, disabled }) {
  const onKeyDown = (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const i = MODE_TABS.findIndex((t) => t.mode === mode);
    const next = MODE_TABS[(i + step + MODE_TABS.length) % MODE_TABS.length];
    onChange(next.mode);
    event.currentTarget.parentElement?.querySelector(`[data-mode="${next.mode}"]`)?.focus();
  };

  return (
    <div role="tablist" aria-label="Playground mode" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 custom-scrollbar">
      {MODE_TABS.map((tab) => {
        const selected = tab.mode === mode;
        return (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            data-mode={tab.mode}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(tab.mode)}
            onKeyDown={onKeyDown}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 ${
              selected ? "bg-surface text-text-main shadow-sm" : "text-text-muted hover:text-text-main"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
