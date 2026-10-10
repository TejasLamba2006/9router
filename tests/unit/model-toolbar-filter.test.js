import { describe, expect, it } from "vitest";
import { filterAndSortModelRows } from "../../src/shared/utils/modelToolbar.js";

describe("model toolbar free filters", () => {
  const rows = [
    { id: "paid", name: "Paid", isFree: false },
    { id: "free", name: "Free", isFree: true },
    { id: "unknown", name: "Unknown" },
  ];

  it("filters explicit free and paid models without treating unknown as free", () => {
    expect(filterAndSortModelRows(rows, { freeFilter: "free" }).map((row) => row.id)).toEqual(["free"]);
    expect(filterAndSortModelRows(rows, { freeFilter: "paid" }).map((row) => row.id)).toEqual(["paid"]);
  });

  it("sorts explicit free models first and keeps stable order otherwise", () => {
    expect(filterAndSortModelRows(rows, { sortFreeFirst: true }).map((row) => row.id)).toEqual(["free", "paid", "unknown"]);
  });
});
