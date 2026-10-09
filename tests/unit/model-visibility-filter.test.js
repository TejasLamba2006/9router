import { describe, expect, it } from "vitest";
import { filterModelRows } from "../../src/shared/utils/modelVisibility.js";

const rows = [
  { id: "gpt-5", name: "GPT Five", fullModel: "openai/gpt-5" },
  { id: "claude-sonnet", name: "Claude Sonnet", fullModel: "anthropic/claude-sonnet" },
  { id: "gemini-pro", name: "Gemini Pro", fullModel: "gemini/gemini-pro", alias: "fast" },
];

describe("model visibility filtering", () => {
  it("searches id, name, full model and alias case-insensitively", () => {
    expect(filterModelRows(rows, { query: "FIVE" }).map((m) => m.id)).toEqual(["gpt-5"]);
    expect(filterModelRows(rows, { query: "anthropic/" }).map((m) => m.id)).toEqual(["claude-sonnet"]);
    expect(filterModelRows(rows, { query: "FAST" }).map((m) => m.id)).toEqual(["gemini-pro"]);
  });

  it("combines visibility and search filters", () => {
    expect(filterModelRows(rows, { visibility: "visible", disabledIds: ["gpt-5"] }).map((m) => m.id))
      .toEqual(["claude-sonnet", "gemini-pro"]);
    expect(filterModelRows(rows, { visibility: "hidden", query: "gpt", disabledIds: ["gpt-5"] }).map((m) => m.id))
      .toEqual(["gpt-5"]);
  });
});
