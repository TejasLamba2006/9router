const SOURCE_BADGES = {
  custom: { label: "custom", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  manual: { label: "custom", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  upstream: { label: "imported", className: "border-sky-500/30 bg-sky-500/10 text-sky-500" },
  imported: { label: "imported", className: "border-sky-500/30 bg-sky-500/10 text-sky-500" },
  legacyAlias: { label: "alias", className: "border-violet-500/30 bg-violet-500/10 text-violet-500" },
  alias: { label: "alias", className: "border-violet-500/30 bg-violet-500/10 text-violet-500" },
  fallback: { label: "fallback", className: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
};

export function getModelSourceBadge(source) {
  return SOURCE_BADGES[source] || { label: "system", className: "border-border bg-sidebar/70 text-text-muted" };
}

export function getModelTestPresentation({ testing = false, result = null } = {}) {
  if (testing) return { icon: "progress_activity", tone: "muted" };
  if (!result) return { icon: "play_circle", tone: "muted" };
  if (result.ok || result.classification === "healthy") return { icon: "check_circle", tone: "success" };
  if (["quota", "rate_limited"].includes(result.classification)) return { icon: "warning", tone: "warning" };
  return { icon: "error", tone: "error" };
}
