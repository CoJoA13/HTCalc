import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("report print mode", () => {
  it("gates print-only workspace hiding behind an open report state", () => {
    const styles = readFileSync("src/ui/styles.css", "utf8");
    const main = readFileSync("src/ui/main.ts", "utf8");

    expect(styles).toContain("body.is-report-open .workspace");
    expect(styles).toContain("body:not(.is-report-open) .report-backdrop");
    expect(main).toContain('document.body.classList.add("is-report-open")');
    expect(main).toContain('document.body.classList.remove("is-report-open")');
  });
});
