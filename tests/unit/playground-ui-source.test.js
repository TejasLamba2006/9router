import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

function source(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Playground dashboard wiring", () => {
  it("exposes Playground in navigation and header metadata", () => {
    const sidebar = source("src/shared/components/Sidebar.js");
    const header = source("src/shared/components/Header.js");

    expect(sidebar).toContain('{ href: "/dashboard/basic-chat", label: "Playground", icon: "chat" }');
    expect(header).toContain('pathname.includes("/basic-chat")');
    expect(header).toContain('title: "Playground"');
  });
});
