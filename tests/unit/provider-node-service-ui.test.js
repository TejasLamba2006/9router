import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("custom provider media service UI", () => {
  it("offers media service checkboxes on OpenAI-compatible nodes", () => {
    const add = source("src/app/(dashboard)/dashboard/providers/components/AddCompatibleModal.js");
    const edit = source("src/app/(dashboard)/dashboard/providers/[id]/EditCompatibleNodeModal.js");

    for (const text of ["Image generation", "Text to speech", "Speech to text", "Video generation"]) {
      expect(add).toContain(text);
      expect(edit).toContain(text);
    }
    expect(add).toContain("serviceKinds: formData.serviceKinds");
    expect(edit).toContain("payload.serviceKinds = formData.serviceKinds");
  });

  it("lists declared custom nodes on matching media pages", () => {
    const listing = source("src/app/(dashboard)/dashboard/media-providers/[kind]/page.js");
    const detail = source("src/app/(dashboard)/dashboard/media-providers/[kind]/[id]/page.js");

    expect(listing).toContain("getNodeServiceKinds(n).includes(kind)");
    expect(detail).toContain("getNodeServiceKinds(customNode)");
    expect(detail).not.toContain('const kinds = isCustom ? ["embedding"]');
  });
});
