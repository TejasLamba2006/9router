import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("custom model output capability wiring", () => {
  it("whitelists output caps and carries them through API and browser fallback", () => {
    const constants = source("src/shared/constants/models.js");
    const route = source("src/app/api/models/route.js");
    const hook = source("src/shared/hooks/useModelCaps.js");
    const customRoute = source("src/app/api/models/custom/route.js");

    for (const key of ["imageOutput", "audioOutput", "videoOutput"]) {
      expect(constants).toContain(`${key}:`);
      expect(route).toContain(`${key}: c.${key}`);
      expect(hook).toContain(`${key}: c.${key}`);
    }
    expect(customRoute).toContain("Object.keys(CAPACITY_META)");
  });
});
