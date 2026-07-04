import { describe, expect, it } from "vitest";
import { recommendHeatTreatQuote, type HeatTreatQuoteInput } from "../src/quote/index.js";
import {
  createQuoteReportViewModel,
  quoteReportMarkdownFilename,
  serializeQuoteReportMarkdown,
} from "../src/ui/quote-report.js";

const input: HeatTreatQuoteInput = {
  sourceMode: "adi",
  processSummary: "ADI 150-110-07",
  lot: {
    quantity: 40,
    pieceWeightKg: 5,
    totalWeightKg: 200,
    loadCapacityKg: 100,
    laborHoursPerLoad: 0.5,
  },
  importedProcess: {
    sourceMode: "adi",
    processLabel: "ADI 150-110-07",
    processConfidence: "green",
    processWarnings: [],
    validationBurdenHints: ["Review ADI validation checklist and required metallography before quoting."],
    austenitizeMinutes: { label: "Austenitize", minMin: 90, nominalMin: 120, maxMin: 150, source: "imported" },
    bathMinutes: { label: "Austemper", minMin: 60, nominalMin: 90, maxMin: 120, source: "imported" },
    temperCount: 0,
  },
  shopRates: {
    minimumLotCharge: 500,
    setupAdminCharge: 100,
    laborRatePerHour: 80,
    furnaceRatePerHour: 120,
    bathQuenchRatePerHour: 90,
    temperFurnaceRatePerHour: 75,
    inspectionBaseCharge: 50,
    consumablesPerKg: 0.5,
    handlingPackagingCharge: 25,
    overheadPercent: 10,
    targetMarginPercent: 20,
  },
  manualOverrides: {},
  adjustments: {
    complexityFactor: 1,
    scrapReworkReservePercent: 5,
    expediteMultiplier: 1,
    manualAdderDiscount: 0,
  },
};

describe("quote report markdown", () => {
  it("serializes customer quote summary and internal breakdown", () => {
    const recommendation = recommendHeatTreatQuote(input);
    const report = createQuoteReportViewModel({
      exportedAt: "2026-07-04T00:00:00.000Z",
      metadata: {
        customerName: "ACME Castings",
        partName: "Pump bracket",
        notes: "RFQ for heat treatment only.",
      },
      input,
      recommendation,
    });

    const markdown = serializeQuoteReportMarkdown(report);

    expect(markdown).toContain("# HTCalc Heat-Treat RFQ Report");
    expect(markdown).toContain("Customer: ACME Castings");
    expect(markdown).toContain("Part: Pump bracket");
    expect(markdown).toContain("Process source: ADI 150-110-07");
    expect(markdown).toContain(`Lot price: $${recommendation.lotPrice.toFixed(2)}`);
    expect(markdown).toContain("## Internal Cost Breakdown");
    expect(markdown).toContain("- Furnace:");
    expect(markdown).toContain("- Minimum charge adjustment:");
  });

  it("builds RFQ markdown filenames from metadata", () => {
    expect(quoteReportMarkdownFilename(
      { customerName: "ACME Castings", partName: "Pump Bracket", notes: "" },
      "2026-07-04T10:00:00.000Z",
    )).toBe("acme-castings-pump-bracket-htcalc-heat-treat-rfq-2026-07-04.md");
  });
});
