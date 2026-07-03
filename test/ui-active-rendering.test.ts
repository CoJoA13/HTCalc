import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("../src/ui/main.ts", import.meta.url), "utf8");

describe("active process recommendation rendering", () => {
  it("routes restore, settings reset, and unit changes through the active process renderer", () => {
    expect(mainSource).toContain("function renderActiveRecommendation");

    const restoreProjectBody = mainSource.match(/function restoreProject[\s\S]*?\n}\n\nfunction replaceAdiInput/)?.[0] ?? "";
    expect(restoreProjectBody).toContain("renderActiveRecommendation();");
    expect(restoreProjectBody).not.toContain("renderRecommendation();");

    const settingsResetBody = mainSource.match(/#settings-reset[\s\S]*?}\);\n\n  document\.querySelectorAll/)?.[0] ?? "";
    expect(settingsResetBody).toContain("renderActiveRecommendation();");

    const unitSystemBody = mainSource.match(/input\[name="unit-system"\][\s\S]*?\n  }\);/)?.[0] ?? "";
    expect(unitSystemBody).toContain("renderActiveRecommendation();");
  });
});
