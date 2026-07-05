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

  it("renders incomplete RFQ pricing basis through the correction state", () => {
    expect(mainSource).toContain("function quoteInputHasPricingBasis");
    expect(mainSource).toContain("function quoteValidationStateForPricingBasis");
    expect(mainSource).toContain("function renderQuoteCorrectionState");
    expect(mainSource).toContain("Current RFQ inputs need correction before a new quote can be calculated.");
    expect(mainSource).toContain("Enter lot weight and load capacity, or provide manual billable hours.");

    const renderQuoteBody = mainSource.match(/function renderQuoteRecommendation[\s\S]*?\n}\n\nfunction quoteInputForCurrentState/)?.[0] ?? "";
    expect(renderQuoteBody).toContain("const pricingBasisValidation = quoteValidationStateForPricingBasis(quoteInput);");
    expect(renderQuoteBody).toContain("if (pricingBasisValidation)");
    expect(renderQuoteBody).toContain("renderQuoteCorrectionState(recommendationPanel, quoteValidationViewState);");

    const correctionStateBody = mainSource.match(/function renderQuoteCorrectionState[\s\S]*?\n}\n\nfunction quoteStaleNotice/)?.[0] ?? "";
    expect(correctionStateBody).toContain("quote-correction-state");
    expect(correctionStateBody).not.toContain("RFQ needs pricing inputs");
  });

  it("keeps manual RFQ summary and imported source label synchronized", () => {
    expect(mainSource).toContain("function syncManualQuoteSource");

    const quoteInputBody = mainSource.match(/function quoteInputForCurrentState[\s\S]*?\n}\n\nfunction quoteInputHasPricingBasis/)?.[0] ?? "";
    expect(quoteInputBody).toContain("return syncManualQuoteSource();");

    const bindQuoteBody = mainSource.match(/function bindQuoteInputs[\s\S]*?\n}\n\nfunction captureManualQuoteSource/)?.[0] ?? "";
    expect(bindQuoteBody).toContain('path === "processSummary" && heatTreatQuoteState.sourceMode === "manual"');
    expect(bindQuoteBody).toContain("syncManualQuoteSource();");

    const syncManualBody = mainSource.match(/function syncManualQuoteSource[\s\S]*?\n}\n\nfunction captureManualQuoteSource/)?.[0] ?? "";
    expect(syncManualBody).toContain("processLabel: processSummary");
    expect(syncManualBody).toContain('sourceMode: "manual"');
  });

  it("resets manual RFQ source cache when restoring any project", () => {
    expect(mainSource).toContain("function resetManualQuoteSourceCache");

    const restoreProjectBody = mainSource.match(/function restoreProject[\s\S]*?\n}\n\nfunction replaceAdiInput/)?.[0] ?? "";
    expect(restoreProjectBody).toContain("resetManualQuoteSourceCache(project.heatTreatQuote.input);");
    expect(restoreProjectBody).not.toContain('if (heatTreatQuoteState.sourceMode === "manual")');

    const resetCacheBody = mainSource.match(/function resetManualQuoteSourceCache[\s\S]*?\n}\n\nfunction refreshQuoteSourceSummary/)?.[0] ?? "";
    expect(resetCacheBody).toContain("defaultHeatTreatQuoteInput()");
    expect(resetCacheBody).toContain("manualQuoteProcessSummary =");
    expect(resetCacheBody).toContain("manualQuoteImportedProcess =");
  });
});
