import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("provider model batch UI wiring", () => {
  it("routes native and compatible single-row tests through the strict batch endpoint", () => {
    const nativePage = source("src/app/(dashboard)/dashboard/providers/[id]/page.js");
    const compatible = source("src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js");
    const addModal = source("src/app/(dashboard)/dashboard/providers/[id]/AddCustomModelModal.js");
    const hook = source("src/app/(dashboard)/dashboard/providers/[id]/useModelBatchTest.js");

    expect(nativePage).not.toContain('fetch("/api/models/test"');
    expect(compatible).not.toContain('fetch("/api/models/test"');
    expect(addModal).not.toContain('fetch("/api/models/test"');
    expect(nativePage).toContain("modelBatch.run([model.id])");
    expect(nativePage).toContain('const supportsStrictModelTests = providerId !== "cursor" && providerId !== "zed"');
    expect(nativePage).toContain("noAuth: isFreeNoAuth");
    expect(compatible).toContain("batch.run([model.id])");
    expect(hook).toContain('{ id: "noauth", name: "Public", isActive: true }');
    expect(hook).toContain('fetch("/api/models/test-batch"');
    expect(hook).toContain("connectionId: selectedConnectionId");
    expect(hook).toContain('if (!selectedConnectionId || selectedConnectionId === "noauth") { setCapabilityEvidence({}); return; }');
  });

  it("separates row hide from confirmed bulk hide and syncs auto-hide immediately", () => {
    const nativePage = source("src/app/(dashboard)/dashboard/providers/[id]/page.js");
    const compatible = source("src/app/(dashboard)/dashboard/providers/[id]/CompatibleModelsSection.js");
    const hook = source("src/app/(dashboard)/dashboard/providers/[id]/useModelBatchTest.js");
    const toolbar = source("src/app/(dashboard)/dashboard/providers/[id]/ModelBatchToolbar.js");
    const visibilityToolbar = source("src/app/(dashboard)/dashboard/providers/[id]/ModelVisibilityToolbar.js");

    expect(nativePage).toContain("onHideModel={handleDisableModel}");
    expect(nativePage).toContain("onHideModels={handleDisableAll}");
    expect(compatible).toContain("if (await onHideModel(model.id)) batch.removeSelected(model.id)");
    expect(nativePage).toContain("modelBatch.removeSelected(modelId)");
    expect(compatible).toContain("onHideShown={onHideModels}");
    expect(hook).toContain("autoHideClassifications");
    expect(hook).toContain("if (event.hidden)");
    expect(hook).toContain("finally");
    expect(toolbar).toContain("AUTO_HIDE_CLASSIFICATIONS");
    expect(toolbar).toContain("Test all");
    expect(toolbar).toContain("Active connection required");
    expect(toolbar).toContain("grid-cols-2");
    expect(toolbar).toContain("backdrop-blur-xl");
    expect(toolbar).toContain("bg-surface/80");
    expect(toolbar).toContain("Reset safe default");
    expect(toolbar).toContain("Hides models permanently until unhidden");
    expect(visibilityToolbar).toContain("Free only");
    expect(visibilityToolbar).toContain("Paid only");
    expect(visibilityToolbar).toContain("Free first");
    expect(visibilityToolbar).toContain("Show all");
    expect(visibilityToolbar).toContain("Hide all");
    expect(visibilityToolbar).toContain("active");
  });
});
