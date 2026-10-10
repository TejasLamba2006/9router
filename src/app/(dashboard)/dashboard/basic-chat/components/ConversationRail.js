"use client";

function RailBody({ sessions, activeId, onSelect, onNew, onDelete, disabled }) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-main hover:bg-surface-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          New conversation
        </button>
      </div>
      <nav aria-label="Conversations" className="flex-1 overflow-y-auto px-2 pb-3 custom-scrollbar">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-sm text-text-muted">No conversations yet.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  disabled={disabled}
                  aria-current={s.id === activeId ? "true" : undefined}
                  className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-60 ${
                    s.id === activeId ? "bg-surface-2 text-text-main" : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  }`}
                >
                  <span className="block truncate">{s.title}</span>
                  <span className="block truncate text-xs text-text-subtle">{s.model || "No model"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  disabled={disabled}
                  aria-label={`Delete ${s.title}`}
                  className="rounded-md p-1.5 text-text-subtle opacity-100 hover:bg-surface-2 hover:text-danger focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 disabled:opacity-30"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  );
}

export default function ConversationRail({ mobileOpen, onMobileClose, ...props }) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-border-subtle bg-bg-alt lg:block">
        <RailBody {...props} />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-surface shadow-[var(--shadow-elev)]">
            <RailBody
              {...props}
              onSelect={(id) => { props.onSelect(id); onMobileClose(); }}
              onNew={() => { props.onNew(); onMobileClose(); }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
