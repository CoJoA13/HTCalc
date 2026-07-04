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

  it("preserves RFQ quote state through project save and restore shell wiring", () => {
    expect(mainSource).toContain("let heatTreatQuoteState: HeatTreatQuoteInput = defaultHeatTreatQuoteInput();");

    const saveProjectBody = mainSource.match(/function saveProject[\s\S]*?\n}\n\nfunction restoreProject/)?.[0] ?? "";
    expect(saveProjectBody).toContain("heatTreatQuoteInput: heatTreatQuoteState");

    const restoreProjectBody = mainSource.match(/function restoreProject[\s\S]*?\n}\n\nfunction replaceAdiInput/)?.[0] ?? "";
    expect(restoreProjectBody).toContain("heatTreatQuoteState = structuredClone(project.heatTreatQuote.input);");
  });

  it("wires the heat-treat RFQ mode to the active workspace and report renderer", () => {
    expect(mainSource).toContain("function quoteWorkspace");
    expect(mainSource).toContain("function bindQuoteInputs");
    expect(mainSource).toContain("function renderQuoteRecommendation");
    expect(mainSource).toContain('case "heat-treat-rfq":');
    expect(mainSource).toContain("quoteInputForCurrentState()");
    expect(mainSource).toContain("quoteAssumptionsForSource");
  });

  it("renders incomplete RFQ pricing basis without using the generic error state", () => {
    expect(mainSource).toContain("function quoteInputHasPricingBasis");
    expect(mainSource).toContain("function renderIncompleteQuoteState");
    expect(mainSource).toContain("Enter lot weight/load capacity or manual billable hours to calculate a quote.");

    const renderQuoteBody = mainSource.match(/function renderQuoteRecommendation[\s\S]*?\n}\n\nfunction quoteInputForCurrentState/)?.[0] ?? "";
    expect(renderQuoteBody).toContain("if (!quoteInputHasPricingBasis(quoteInput))");
    expect(renderQuoteBody).toContain("renderIncompleteQuoteState(recommendationPanel);");

    const incompleteStateBody = mainSource.match(/function renderIncompleteQuoteState[\s\S]*?\n}\n\nfunction quoteInputForCurrentState/)?.[0] ?? "";
    expect(incompleteStateBody).not.toContain("error-state");
  });
});
