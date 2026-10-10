export function filterAndSortModelRows(rows, { freeFilter = "all", sortFreeFirst = false } = {}) {
  const filtered = rows.filter((row) => {
    if (freeFilter === "free") return row.isFree === true;
    if (freeFilter === "paid") return row.isFree === false;
    return true;
  });
  if (!sortFreeFirst) return filtered;
  return filtered
    .map((row, index) => ({ row, index }))
    .sort((a, b) => Number(b.row.isFree === true) - Number(a.row.isFree === true) || a.index - b.index)
    .map(({ row }) => row);
}
