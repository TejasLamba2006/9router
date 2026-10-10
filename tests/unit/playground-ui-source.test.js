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

  it("wires model modes, settings, tools, files, and the protected dashboard gateway", () => {
    const page = source("src/app/(dashboard)/dashboard/basic-chat/BasicChatPageClient.js");

    expect(page).toContain("ModelSelectModal");
    expect(page).toContain("PlaygroundModeTabs");
    expect(page).toContain("PlaygroundSettingsDrawer");
    expect(page).toContain("ConversationRail");
    expect(page).toContain("ToolCallCard");
    expect(page).toContain("preparePlaygroundAttachments");
    expect(page).toContain("/api/dashboard/playground/");
    expect(page).toContain("buildPlaygroundRequest");
    expect(page).toContain("reduceStreamEvent");
    expect(page).toContain("ConfirmModal");
  });

  it("renders the unified playground through the shared request utility and dashboard proxy", () => {
    const dir = "src/app/(dashboard)/dashboard/basic-chat";
    const page = source(`${dir}/BasicChatPageClient.js`);
    const all = [
      page,
      ...fs.readdirSync(path.join(root, dir, "components")).map((f) => source(`${dir}/components/${f}`)),
    ].join("\n");

    expect(page).toContain("@/shared/utils/playgroundRequest");
    expect(page).toContain("toDashboardPath");
    expect(page).not.toContain("/api/dashboard/chat/completions");
    expect(page).not.toMatch(/fetch\(\s*["'`]\/api\/v1/);
    expect(all).toContain("ModelSelectModal");
    expect(all).toContain("kindFilter");
    expect(all).toContain("Drawer");
    expect(all).toContain('role="tablist"');
    // No HTML injection: model output renders as plain pre-wrap text.
    expect(all).not.toContain("dangerouslySetInnerHTML");
    expect(all).toContain("whitespace-pre-wrap");
  });
});
