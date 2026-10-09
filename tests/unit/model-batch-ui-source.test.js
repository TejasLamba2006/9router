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
    expect(nativePage).toContain('const supportsStrictModelTests = !isFreeNoAuth && providerId !== "cursor" && providerId !== "zed"');
    expect(compatible).toContain("batch.run([id])");
    expect(hook).toContain('fetch("/api/models/test-batch"');
    expect(hook).toContain("connectionId: selectedConnectionId");
  });
});
