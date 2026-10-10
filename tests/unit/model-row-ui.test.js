import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getModelSourceBadge, getModelTestPresentation } from "../../src/shared/utils/modelRowPresentation.js";

const root = path.resolve(import.meta.dirname, "../..");
const rowSource = fs.readFileSync(path.join(root, "src/app/(dashboard)/dashboard/providers/[id]/ModelRow.js"), "utf8");

describe("OmniRoute-style model rows", () => {
  it("maps test states to always-visible OmniRoute icons", () => {
    expect(getModelTestPresentation({})).toMatchObject({ icon: "play_circle" });
    expect(getModelTestPresentation({ testing: true })).toMatchObject({ icon: "progress_activity" });
    expect(getModelTestPresentation({ result: { classification: "healthy", ok: true } })).toMatchObject({ icon: "check_circle", tone: "success" });
    expect(getModelTestPresentation({ result: { classification: "quota", ok: false } })).toMatchObject({ icon: "warning", tone: "warning" });
    expect(getModelTestPresentation({ result: { classification: "hard_model_failure", ok: false } })).toMatchObject({ icon: "error", tone: "error" });
  });

  it("maps model origins to source badges", () => {
    expect(getModelSourceBadge("custom").label).toBe("custom");
    expect(getModelSourceBadge("upstream").label).toBe("imported");
    expect(getModelSourceBadge("legacyAlias").label).toBe("alias");
    expect(getModelSourceBadge()).toMatchObject({ label: "system" });
  });

  it("keeps the test button visible and exposes disabled reasons", () => {
    expect(rowSource).toContain("getModelTestPresentation");
    expect(rowSource).toContain("testDisabledReason");
    expect(rowSource).not.toContain('isTesting ? "opacity-100" : "opacity-100 sm:opacity-0');
  });
});
