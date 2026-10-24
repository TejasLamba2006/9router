import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { resolvePort, savePort, isValidPort } = require("../../cli/src/cli/utils/port.js");

describe("server port resolution", () => {
  let dir, env;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "port-")); env = { DATA_DIR: dir }; });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("defaults to 20128", () => expect(resolvePort({ env })).toBe(20128));
  it("uses port.json", () => {
    fs.writeFileSync(path.join(dir, "port.json"), JSON.stringify({ port: 30000 }));
    expect(resolvePort({ env })).toBe(30000);
  });
  it("PORT env beats port.json", () => {
    savePort(30000, env);
    expect(resolvePort({ env: { ...env, PORT: "31000" } })).toBe(31000);
  });
  it("flag beats env and port.json", () => {
    savePort(30000, env);
    expect(resolvePort({ flagPort: 32000, env: { ...env, PORT: "31000" } })).toBe(32000);
  });
  it("ignores corrupt or invalid saved port", () => {
    fs.writeFileSync(path.join(dir, "port.json"), "{bad");
    expect(resolvePort({ env })).toBe(20128);
    expect(() => savePort(70000, env)).toThrow();
  });
  it("validates range", () => {
    expect([0, 1, 65535, 65536, 1.5, NaN].map(isValidPort)).toEqual([false, true, true, false, false, false]);
  });
});
