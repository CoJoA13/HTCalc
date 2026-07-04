import { describe, expect, it } from "vitest";
import {
  recommendHeatTreatQuote,
  type HeatTreatQuoteInput,
} from "../src/quote/index.js";

const baseInput: HeatTreatQuoteInput = {
  sourceMode: "steel-austempering",
  processSummary: "Steel austempering lower bainite",
  lot: {
    quantity: 100,
    pieceWeightKg: 2,
    totalWeightKg: 200,
    loadCapacityKg: 100,
    laborHoursPerLoad: 0.5,
  },
  importedProcess: {
    sourceMode: "steel-austempering",
    processLabel: "Steel Austempering - lower bainite",
    processConfidence: "green",
    processWarnings: [],
    validationBurdenHints: ["Confirm final hardness traverse."],
    austenitizeMinutes: {
      label: "Austenitize soak",
      minMin: 90,
      nominalMin: 120,
      maxMin: 150,
      source: "imported",
    },
    bathMinutes: {
      label: "Austemper hold",
      minMin: 45,
      nominalMin: 60,
      maxMin: 90,
      source: "imported",
    },
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

describe("heat-treat quote model", () => {
  it("calculates cost buckets, margin price, unit price, and price per kg", () => {
    const quote = recommendHeatTreatQuote(baseInput);

    expect(quote.cycleCount).toBe(2);
    expect(quote.billableHours).toMatchObject({
      furnace: 4,
      bathQuench: 2,
      temper: 0,
      labor: 1,
    });
    expect(quote.breakdown).toMatchObject({
      setupAdmin: 100,
      furnace: 480,
      bathQuench: 180,
      temper: 0,
      labor: 80,
      inspection: 50,
      consumables: 100,
      handlingPackaging: 25,
      scrapReworkReserve: 50.75,
      overhead: 106.58,
      minimumChargeAdjustment: 0,
      total: 1465.41,
    });
    expect(quote.lotPrice).toBe(1465.41);
    expect(quote.unitPrice).toBe(14.65);
    expect(quote.pricePerKg).toBe(7.33);
    expect(quote.confidence).toBe("green");
  });

  it("enforces the minimum lot charge after price adjustments", () => {
    const quote = recommendHeatTreatQuote({
      ...baseInput,
      shopRates: {
        ...baseInput.shopRates,
        minimumLotCharge: 2000,
      },
    });

    expect(quote.lotPrice).toBe(2000);
    expect(quote.breakdown.minimumChargeAdjustment).toBe(534.59);
    expect(quote.warnings).toContain("Minimum lot charge exceeded calculated sell price.");
  });

  it("applies complexity only to time-driven cost buckets", () => {
    const quote = recommendHeatTreatQuote({
      ...baseInput,
      adjustments: {
        ...baseInput.adjustments,
        complexityFactor: 1.25,
        scrapReworkReservePercent: 0,
      },
    });

    expect(quote.breakdown.furnace).toBe(600);
    expect(quote.breakdown.bathQuench).toBe(225);
    expect(quote.breakdown.labor).toBe(100);
    expect(quote.breakdown.setupAdmin).toBe(100);
    expect(quote.breakdown.inspection).toBe(50);
  });

  it("uses manual billable overrides before imported time assumptions", () => {
    const quote = recommendHeatTreatQuote({
      ...baseInput,
      manualOverrides: {
        billableFurnaceHours: 3,
        billableBathQuenchHours: 1.5,
        billableLaborHours: 2,
        billableCycleCount: 3,
      },
    });

    expect(quote.cycleCount).toBe(3);
    expect(quote.billableHours).toMatchObject({
      furnace: 3,
      bathQuench: 1.5,
      labor: 2,
    });
    expect(quote.importedAssumptions.some((line) => line.includes("manual override"))).toBe(true);
  });

  it("allows manual quote pricing when manual billable hours provide the pricing basis", () => {
    const quote = recommendHeatTreatQuote({
      ...baseInput,
      sourceMode: "manual",
      processSummary: "Manual salt bath quote",
      lot: {
        quantity: 10,
      },
      importedProcess: {
        sourceMode: "manual",
        processLabel: "Manual heat-treatment quote",
        processConfidence: "yellow",
        processWarnings: [],
        validationBurdenHints: [],
        temperCount: 0,
      },
      manualOverrides: {
        billableFurnaceHours: 2,
        billableBathQuenchHours: 1,
        billableLaborHours: 1,
      },
    });

    expect(quote.cycleCount).toBeNull();
    expect(quote.pricePerKg).toBeNull();
    expect(quote.confidence).toBe("yellow");
    expect(quote.warnings).toContain("Manual quote source selected; imported process assumptions are not linked to a recipe.");
  });

  it("marks red imported processes as red quote confidence without blocking commercial pricing", () => {
    const quote = recommendHeatTreatQuote({
      ...baseInput,
      importedProcess: {
        ...baseInput.importedProcess,
        processConfidence: "red",
        processWarnings: ["Austemper bath is below estimated Ms."],
      },
    });

    expect(quote.confidence).toBe("red");
    expect(quote.warnings).toContain("Imported process confidence is red; review the recipe before sending the quote.");
  });

  it("rejects invalid target margins", () => {
    expect(() =>
      recommendHeatTreatQuote({
        ...baseInput,
        shopRates: {
          ...baseInput.shopRates,
          targetMarginPercent: 100,
        },
      }),
    ).toThrow("Invalid heat-treat quote input: shopRates.targetMarginPercent must be less than 100.");
  });

  it("rejects missing cycle basis when no manual hours are supplied", () => {
    expect(() =>
      recommendHeatTreatQuote({
        ...baseInput,
        lot: {
          quantity: 12,
        },
        manualOverrides: {},
      }),
    ).toThrow("Invalid heat-treat quote input: lot must provide weight/load capacity or manual billable hours.");
  });
});
