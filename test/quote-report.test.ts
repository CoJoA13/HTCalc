import { describe, expect, it } from "vitest";
import { recommendHeatTreatQuote, type HeatTreatQuoteInput } from "../src/quote/index.js";
import {
  createQuoteReportViewModel,
  quoteReportMarkdownFilename,
  serializeQuoteReportMarkdown,
} from "../src/ui/quote-report.js";

const shopRates: HeatTreatQuoteInput["shopRates"] = {
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
};

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
    processWarnings: ["Customer supplied partial RFQ package; confirm certification scope before release."],
    validationBurdenHints: ["Review ADI validation checklist and required metallography before quoting."],
    austenitizeMinutes: { label: "Austenitize", minMin: 90, nominalMin: 120, maxMin: 150, source: "imported" },
    bathMinutes: { label: "Austemper", minMin: 60, nominalMin: 90, maxMin: 120, source: "imported" },
    temperCount: 0,
  },
  shopRates,
  manualOverrides: {},
  adjustments: {
    complexityFactor: 1,
    scrapReworkReservePercent: 5,
    expediteMultiplier: 1,
    manualAdderDiscount: -50,
  },
};

const manualQuoteInput: HeatTreatQuoteInput = {
  sourceMode: "manual",
  processSummary: "Manual heat-treat estimate",
  lot: {
    quantity: 12,
  },
  importedProcess: {
    sourceMode: "manual",
    processLabel: "Manual heat-treat estimate",
    processConfidence: "yellow",
    processWarnings: [],
    validationBurdenHints: [],
    temperCount: 0,
  },
  shopRates,
  manualOverrides: {
    billableFurnaceHours: 2,
    billableBathQuenchHours: 0.5,
    billableTemperHours: 0,
    billableLaborHours: 1.25,
  },
  adjustments: {
    complexityFactor: 1,
    scrapReworkReservePercent: 0,
    expediteMultiplier: 1,
    manualAdderDiscount: 0,
  },
};

describe("quote report markdown", () => {
  it("serializes all customer, internal, validation, and pricing details", () => {
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

    expect(recommendation.importedAssumptions.length).toBeGreaterThan(0);
    expect(recommendation.warnings.length).toBeGreaterThan(0);

    for (const expectedLine of [
      "# HTCalc Heat-Treat RFQ Report",
      "Generated: 2026-07-04T00:00:00.000Z",
      "## Project",
      "Customer: ACME Castings",
      "Part: Pump bracket",
      "### Notes",
      "RFQ for heat treatment only.",
      "## Quote Summary",
      "Process source: ADI 150-110-07",
      "Source mode: adi",
      "Quantity: 40",
      "Total weight: 200 kg",
      "Cycle count: 2",
      `Lot price: $${recommendation.lotPrice.toFixed(2)}`,
      `Unit price: $${recommendation.unitPrice.toFixed(2)}`,
      `Price per kg: $${recommendation.pricePerKg?.toFixed(2)}`,
      `Confidence: ${recommendation.confidence}`,
      "## Customer Quote Summary",
      "## Quote Assumptions",
      "## Pricing Warnings",
      "## Billable Hours",
      `- Furnace: ${formatExpectedNumber(recommendation.billableHours.furnace)} h`,
      `- Bath/quench: ${formatExpectedNumber(recommendation.billableHours.bathQuench)} h`,
      `- Temper: ${formatExpectedNumber(recommendation.billableHours.temper)} h`,
      `- Labor: ${formatExpectedNumber(recommendation.billableHours.labor)} h`,
      "## Internal Cost Breakdown",
      "## Internal Notes",
      "## Validation Checks",
      "## Model Notes",
      "Heat-treatment service pricing only.",
    ]) {
      expect(markdown).toContain(expectedLine);
    }

    for (const summaryLine of recommendation.customerSummaryLines) {
      expect(markdown).toContain(`- ${summaryLine}`);
    }

    for (const assumption of recommendation.importedAssumptions) {
      expect(markdown).toContain(`- ${assumption}`);
    }

    for (const warning of recommendation.warnings) {
      expect(markdown).toContain(`- ${warning}`);
    }

    for (const note of recommendation.internalNotes) {
      expect(markdown).toContain(`- ${note}`);
    }

    for (const check of recommendation.validationChecks) {
      expect(markdown).toContain(`- ${check}`);
    }

    for (const bucketLabel of [
      "- Setup/admin:",
      "- Furnace:",
      "- Bath/quench:",
      "- Temper:",
      "- Labor:",
      "- Inspection:",
      "- Consumables:",
      "- Handling/packaging:",
      "- Scrap/rework reserve:",
      "- Overhead:",
      "- Margin:",
      "- Expedite:",
      "- Manual adder/discount:",
      "- Minimum charge adjustment:",
      "- Total:",
    ]) {
      expect(markdown).toContain(bucketLabel);
    }

    expect(markdown).toContain("- Manual adder/discount: -$50.00");
    expect(markdown).not.toContain("$-50.00");
  });

  it("serializes unavailable weight and manual cycle fields for manual quote paths", () => {
    const recommendation = recommendHeatTreatQuote(manualQuoteInput);
    const report = createQuoteReportViewModel({
      exportedAt: "2026-07-04T00:00:00.000Z",
      metadata: {
        customerName: "",
        partName: "",
        notes: "",
      },
      input: manualQuoteInput,
      recommendation,
    });

    const markdown = serializeQuoteReportMarkdown(report);

    expect(markdown).toContain("Customer: Unspecified");
    expect(markdown).toContain("Part: Unspecified");
    expect(markdown).toContain("No project notes entered.");
    expect(markdown).toContain("Process source: Manual heat-treat estimate");
    expect(markdown).toContain("Source mode: manual");
    expect(markdown).toContain("Total weight: Unavailable");
    expect(markdown).toContain("Price per kg: Unavailable");
    expect(markdown).toContain("Cycle count: Manual");
    expect(markdown).toContain(`Lot price: $${recommendation.lotPrice.toFixed(2)}`);
    expect(markdown).toContain("- Manual quote source selected; imported process assumptions are not linked to a recipe.");
  });

  it("builds RFQ markdown filenames from metadata", () => {
    expect(quoteReportMarkdownFilename(
      { customerName: "ACME Castings", partName: "Pump Bracket", notes: "" },
      "2026-07-04T10:00:00.000Z",
    )).toBe("acme-castings-pump-bracket-htcalc-heat-treat-rfq-2026-07-04.md");
  });
});

function formatExpectedNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}
