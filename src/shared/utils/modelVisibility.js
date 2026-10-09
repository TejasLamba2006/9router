export function filterModelRows(rows, { query = "", visibility = "all", disabledIds = [] } = {}) {
  const needle = query.trim().toLowerCase();
  const disabled = new Set(disabledIds);
  return rows.filter((row) => {
    const hidden = disabled.has(row.id);
    if (visibility === "visible" && hidden) return false;
    if (visibility === "hidden" && !hidden) return false;
    if (!needle) return true;
    return [row.id, row.name, row.fullModel, row.alias]
      .some((value) => String(value || "").toLowerCase().includes(needle));
  });
}
