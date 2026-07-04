# Heat-Treat RFQ Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Heat-Treat RFQ mode that calculates auditable heat-treatment service quotes from shop-specific rates and can import assumptions from current ADI, steel austempering, and martempering recipes.

**Architecture:** Add a pure `src/quote` package for quote types, pricing math, and recipe adapters. Extend process modes, project-state versioning, reports, and the browser UI so quote data is saved, restored, rendered, and exported without changing existing metallurgy model behavior.

**Tech Stack:** TypeScript, Vite, Vitest, strict project-state JSON parsing, existing HTCalc UI helpers.

---

## File Structure

- Create `src/quote/types.ts`: RFQ input, imported assumptions, shop rates, manual overrides, breakdown, confidence, and recommendation types.
- Create `src/quote/model.ts`: deterministic cost-plus quote calculator with validation, cycle/time resolution, cost buckets, warnings, and confidence.
- Create `src/quote/adapters.ts`: conversion helpers from ADI, steel austempering, and martempering recommendations into imported RFQ assumptions.
- Create `src/quote/index.ts`: quote package exports.
- Create `src/ui/quote-state.ts`: default RFQ UI state plus path-based setters.
- Create `src/ui/quote-report.ts`: RFQ report view model, Markdown serializer, and filename helper.
- Modify `tsconfig.build.json`: include `src/quote/**/*.ts` in library builds.
- Modify `src/ui/process-modes.ts`: add `heat-treat-rfq`.
- Modify `src/ui/project-state.ts`: bump project version to 4, persist quote state, and migrate versions 1-3.
- Modify `src/ui/units.ts`: make quote lot weight fields unit-sensitive.
- Modify `src/ui/view-model.ts`: parse optional quote numeric inputs.
- Modify `src/ui/main.ts`: add RFQ state, workspace, input binding, import-source handling, recommendation rendering, report actions, save/load wiring, and active-rendering routing.
- Modify `README.md`, `docs/index.md`, and create `docs/quote-pricing-model.md`: document RFQ model scope and limitations.
- Add tests in `test/quote-model.test.ts`, `test/quote-adapters.test.ts`, `test/quote-state.test.ts`, `test/quote-report.test.ts`, and update existing project-state/UI/unit tests.

---

### Task 1: Quote Core Model

**Files:**
- Create: `src/quote/types.ts`
- Create: `src/quote/model.ts`
- Create: `src/quote/index.ts`
- Modify: `tsconfig.build.json`
- Test: `test/quote-model.test.ts`

- [ ] **Step 1: Write failing quote model tests**

Create `test/quote-model.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the failing model test**

Run:

```bash
npm test -- test/quote-model.test.ts
```

Expected: FAIL because `../src/quote/index.js` does not exist.

- [ ] **Step 3: Add quote types**

Create `src/quote/types.ts`:

```ts
export type HeatTreatQuoteSourceMode =
  | "adi"
  | "steel-austempering"
  | "martempering"
  | "manual";

export type HeatTreatQuoteConfidence = "green" | "yellow" | "red";
export type HeatTreatTimeAssumptionSource = "imported" | "manual" | "calculated";

export interface HeatTreatTimeAssumption {
  readonly label: string;
  readonly minMin?: number;
  readonly nominalMin: number;
  readonly maxMin?: number;
  readonly source: HeatTreatTimeAssumptionSource;
}

export interface ImportedProcessAssumptions {
  readonly sourceMode: HeatTreatQuoteSourceMode;
  readonly processLabel: string;
  readonly processConfidence: HeatTreatQuoteConfidence;
  readonly processWarnings: readonly string[];
  readonly validationBurdenHints: readonly string[];
  readonly austenitizeMinutes?: HeatTreatTimeAssumption;
  readonly bathMinutes?: HeatTreatTimeAssumption;
  readonly temperMinutes?: HeatTreatTimeAssumption;
  readonly temperCount: number;
}

export interface HeatTreatQuoteLot {
  readonly quantity: number;
  readonly pieceWeightKg?: number;
  readonly totalWeightKg?: number;
  readonly loadCapacityKg?: number;
  readonly laborHoursPerLoad?: number;
  readonly cycleCountOverride?: number;
}

export interface HeatTreatShopRates {
  readonly minimumLotCharge: number;
  readonly setupAdminCharge: number;
  readonly laborRatePerHour: number;
  readonly furnaceRatePerHour: number;
  readonly bathQuenchRatePerHour: number;
  readonly temperFurnaceRatePerHour: number;
  readonly inspectionBaseCharge: number;
  readonly consumablesPerKg: number;
  readonly handlingPackagingCharge: number;
  readonly overheadPercent: number;
  readonly targetMarginPercent: number;
}

export interface HeatTreatManualOverrides {
  readonly billableFurnaceHours?: number;
  readonly billableBathQuenchHours?: number;
  readonly billableTemperHours?: number;
  readonly billableLaborHours?: number;
  readonly billableCycleCount?: number;
}

export interface HeatTreatQuoteAdjustments {
  readonly complexityFactor: number;
  readonly scrapReworkReservePercent: number;
  readonly expediteMultiplier: number;
  readonly manualAdderDiscount: number;
}

export interface HeatTreatQuoteInput {
  readonly sourceMode: HeatTreatQuoteSourceMode;
  readonly processSummary: string;
  readonly lot: HeatTreatQuoteLot;
  readonly importedProcess: ImportedProcessAssumptions;
  readonly shopRates: HeatTreatShopRates;
  readonly manualOverrides: HeatTreatManualOverrides;
  readonly adjustments: HeatTreatQuoteAdjustments;
}

export interface HeatTreatBillableHours {
  readonly furnace: number;
  readonly bathQuench: number;
  readonly temper: number;
  readonly labor: number;
}

export interface HeatTreatQuoteBreakdown {
  readonly setupAdmin: number;
  readonly furnace: number;
  readonly bathQuench: number;
  readonly temper: number;
  readonly labor: number;
  readonly inspection: number;
  readonly consumables: number;
  readonly handlingPackaging: number;
  readonly scrapReworkReserve: number;
  readonly overhead: number;
  readonly margin: number;
  readonly expedite: number;
  readonly manualAdderDiscount: number;
  readonly minimumChargeAdjustment: number;
  readonly total: number;
}

export interface HeatTreatQuoteRecommendation {
  readonly sourceMode: HeatTreatQuoteSourceMode;
  readonly processSummary: string;
  readonly lotPrice: number;
  readonly unitPrice: number;
  readonly pricePerKg: number | null;
  readonly totalWeightKg: number | null;
  readonly cycleCount: number | null;
  readonly billableHours: HeatTreatBillableHours;
  readonly breakdown: HeatTreatQuoteBreakdown;
  readonly importedAssumptions: readonly string[];
  readonly warnings: readonly string[];
  readonly confidence: HeatTreatQuoteConfidence;
  readonly customerSummaryLines: readonly string[];
  readonly internalNotes: readonly string[];
  readonly validationChecks: readonly string[];
}
```

- [ ] **Step 4: Add the pricing model**

Create `src/quote/model.ts`:

```ts
import type {
  HeatTreatBillableHours,
  HeatTreatQuoteBreakdown,
  HeatTreatQuoteConfidence,
  HeatTreatQuoteInput,
  HeatTreatQuoteRecommendation,
  HeatTreatTimeAssumption,
} from "./types.js";

function invalidQuoteInput(fieldPath: string, requirement: string): RangeError {
  return new RangeError(`Invalid heat-treat quote input: ${fieldPath} must ${requirement}`);
}

function assertFiniteNonNegative(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw invalidQuoteInput(fieldPath, "be a finite non-negative number.");
  }
}

function assertFinitePositive(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw invalidQuoteInput(fieldPath, "be a finite positive number.");
  }
}

function assertPercent(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value < 0 || value >= 100) {
    throw invalidQuoteInput(fieldPath, "be at least 0 and less than 100.");
  }
}

function assertOptionalPositive(value: number | undefined, fieldPath: string): void {
  if (value !== undefined) {
    assertFinitePositive(value, fieldPath);
  }
}

function assertOptionalNonNegative(value: number | undefined, fieldPath: string): void {
  if (value !== undefined) {
    assertFiniteNonNegative(value, fieldPath);
  }
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function validateTimeAssumption(value: HeatTreatTimeAssumption | undefined, fieldPath: string): void {
  if (!value) {
    return;
  }

  assertFiniteNonNegative(value.nominalMin, `${fieldPath}.nominalMin`);
  assertOptionalNonNegative(value.minMin, `${fieldPath}.minMin`);
  assertOptionalNonNegative(value.maxMin, `${fieldPath}.maxMin`);
}

function validateInput(input: HeatTreatQuoteInput): void {
  assertFinitePositive(input.lot.quantity, "lot.quantity");
  assertOptionalPositive(input.lot.pieceWeightKg, "lot.pieceWeightKg");
  assertOptionalPositive(input.lot.totalWeightKg, "lot.totalWeightKg");
  assertOptionalPositive(input.lot.loadCapacityKg, "lot.loadCapacityKg");
  assertOptionalNonNegative(input.lot.laborHoursPerLoad, "lot.laborHoursPerLoad");
  assertOptionalPositive(input.lot.cycleCountOverride, "lot.cycleCountOverride");

  assertFiniteNonNegative(input.shopRates.minimumLotCharge, "shopRates.minimumLotCharge");
  assertFiniteNonNegative(input.shopRates.setupAdminCharge, "shopRates.setupAdminCharge");
  assertFiniteNonNegative(input.shopRates.laborRatePerHour, "shopRates.laborRatePerHour");
  assertFiniteNonNegative(input.shopRates.furnaceRatePerHour, "shopRates.furnaceRatePerHour");
  assertFiniteNonNegative(input.shopRates.bathQuenchRatePerHour, "shopRates.bathQuenchRatePerHour");
  assertFiniteNonNegative(input.shopRates.temperFurnaceRatePerHour, "shopRates.temperFurnaceRatePerHour");
  assertFiniteNonNegative(input.shopRates.inspectionBaseCharge, "shopRates.inspectionBaseCharge");
  assertFiniteNonNegative(input.shopRates.consumablesPerKg, "shopRates.consumablesPerKg");
  assertFiniteNonNegative(input.shopRates.handlingPackagingCharge, "shopRates.handlingPackagingCharge");
  assertFiniteNonNegative(input.shopRates.overheadPercent, "shopRates.overheadPercent");
  if (input.shopRates.targetMarginPercent >= 100) {
    throw invalidQuoteInput("shopRates.targetMarginPercent", "be less than 100.");
  }
  assertPercent(input.shopRates.targetMarginPercent, "shopRates.targetMarginPercent");

  assertOptionalNonNegative(input.manualOverrides.billableFurnaceHours, "manualOverrides.billableFurnaceHours");
  assertOptionalNonNegative(input.manualOverrides.billableBathQuenchHours, "manualOverrides.billableBathQuenchHours");
  assertOptionalNonNegative(input.manualOverrides.billableTemperHours, "manualOverrides.billableTemperHours");
  assertOptionalNonNegative(input.manualOverrides.billableLaborHours, "manualOverrides.billableLaborHours");
  assertOptionalPositive(input.manualOverrides.billableCycleCount, "manualOverrides.billableCycleCount");

  assertFinitePositive(input.adjustments.complexityFactor, "adjustments.complexityFactor");
  assertFiniteNonNegative(input.adjustments.scrapReworkReservePercent, "adjustments.scrapReworkReservePercent");
  assertFinitePositive(input.adjustments.expediteMultiplier, "adjustments.expediteMultiplier");
  if (!Number.isFinite(input.adjustments.manualAdderDiscount)) {
    throw invalidQuoteInput("adjustments.manualAdderDiscount", "be a finite number.");
  }

  validateTimeAssumption(input.importedProcess.austenitizeMinutes, "importedProcess.austenitizeMinutes");
  validateTimeAssumption(input.importedProcess.bathMinutes, "importedProcess.bathMinutes");
  validateTimeAssumption(input.importedProcess.temperMinutes, "importedProcess.temperMinutes");
  assertFiniteNonNegative(input.importedProcess.temperCount, "importedProcess.temperCount");
}

function totalWeightKg(input: HeatTreatQuoteInput): number | null {
  if (input.lot.totalWeightKg !== undefined) {
    return input.lot.totalWeightKg;
  }

  if (input.lot.pieceWeightKg !== undefined) {
    return input.lot.pieceWeightKg * input.lot.quantity;
  }

  return null;
}

function hasManualBillableHours(input: HeatTreatQuoteInput): boolean {
  return (
    input.manualOverrides.billableFurnaceHours !== undefined ||
    input.manualOverrides.billableBathQuenchHours !== undefined ||
    input.manualOverrides.billableTemperHours !== undefined ||
    input.manualOverrides.billableLaborHours !== undefined
  );
}

function cycleCount(input: HeatTreatQuoteInput, weightKg: number | null): number | null {
  if (input.manualOverrides.billableCycleCount !== undefined) {
    return Math.ceil(input.manualOverrides.billableCycleCount);
  }

  if (input.lot.cycleCountOverride !== undefined) {
    return Math.ceil(input.lot.cycleCountOverride);
  }

  if (weightKg !== null && input.lot.loadCapacityKg !== undefined) {
    return Math.max(1, Math.ceil(weightKg / input.lot.loadCapacityKg));
  }

  return null;
}

function hoursFromMinutes(
  assumption: HeatTreatTimeAssumption | undefined,
  cycles: number | null,
  multiplier = 1,
): number {
  if (!assumption || cycles === null) {
    return 0;
  }

  return (assumption.nominalMin / 60) * cycles * multiplier;
}

function billableHours(input: HeatTreatQuoteInput, cycles: number | null): HeatTreatBillableHours {
  const temperCount = Math.max(1, input.importedProcess.temperCount || 1);

  return {
    furnace: input.manualOverrides.billableFurnaceHours
      ?? hoursFromMinutes(input.importedProcess.austenitizeMinutes, cycles),
    bathQuench: input.manualOverrides.billableBathQuenchHours
      ?? hoursFromMinutes(input.importedProcess.bathMinutes, cycles),
    temper: input.manualOverrides.billableTemperHours
      ?? hoursFromMinutes(input.importedProcess.temperMinutes, cycles, temperCount),
    labor: input.manualOverrides.billableLaborHours
      ?? (cycles !== null && input.lot.laborHoursPerLoad !== undefined
        ? input.lot.laborHoursPerLoad * cycles
        : 0),
  };
}

function buildImportedAssumptions(input: HeatTreatQuoteInput, hours: HeatTreatBillableHours): string[] {
  const assumptions = [`Source: ${input.importedProcess.processLabel}`];

  if (input.importedProcess.austenitizeMinutes) {
    assumptions.push(`Austenitize pricing time: ${input.importedProcess.austenitizeMinutes.nominalMin} min nominal.`);
  }

  if (input.importedProcess.bathMinutes) {
    assumptions.push(`Bath/quench pricing time: ${input.importedProcess.bathMinutes.nominalMin} min nominal.`);
  }

  if (input.importedProcess.temperMinutes) {
    assumptions.push(`Temper pricing time: ${input.importedProcess.temperMinutes.nominalMin} min x ${input.importedProcess.temperCount}.`);
  }

  if (input.manualOverrides.billableFurnaceHours !== undefined) {
    assumptions.push(`Furnace hours use manual override: ${hours.furnace} h.`);
  }

  if (input.manualOverrides.billableBathQuenchHours !== undefined) {
    assumptions.push(`Bath/quench hours use manual override: ${hours.bathQuench} h.`);
  }

  if (input.manualOverrides.billableTemperHours !== undefined) {
    assumptions.push(`Temper hours use manual override: ${hours.temper} h.`);
  }

  if (input.manualOverrides.billableLaborHours !== undefined) {
    assumptions.push(`Labor hours use manual override: ${hours.labor} h.`);
  }

  return assumptions;
}

function buildWarnings(
  input: HeatTreatQuoteInput,
  weightKg: number | null,
  cycles: number | null,
  hours: HeatTreatBillableHours,
  minimumApplied: boolean,
): string[] {
  const warnings = [...input.importedProcess.processWarnings];

  if (input.sourceMode === "manual") {
    warnings.push("Manual quote source selected; imported process assumptions are not linked to a recipe.");
  }

  if (input.importedProcess.processConfidence === "red") {
    warnings.push("Imported process confidence is red; review the recipe before sending the quote.");
  }

  if (weightKg === null) {
    warnings.push("Total lot weight is unavailable; price per weight is not calculated.");
  }

  if (cycles === null) {
    warnings.push("Cycle count is not calculated from load capacity; billable hours are manual.");
  }

  if (hours.labor === 0) {
    warnings.push("Billable labor hours are zero; confirm loading, paperwork, inspection, and handling labor before quoting.");
  }

  if (input.shopRates.inspectionBaseCharge === 0) {
    warnings.push("Inspection charge is zero; confirm certification and testing scope.");
  }

  if (minimumApplied) {
    warnings.push("Minimum lot charge exceeded calculated sell price.");
  }

  return warnings.filter((warning, index, all) => all.indexOf(warning) === index);
}

function quoteConfidence(
  input: HeatTreatQuoteInput,
  weightKg: number | null,
  cycles: number | null,
  warnings: readonly string[],
): HeatTreatQuoteConfidence {
  if (input.importedProcess.processConfidence === "red") {
    return "red";
  }

  if (
    input.sourceMode === "manual" ||
    input.importedProcess.processConfidence === "yellow" ||
    weightKg === null ||
    cycles === null ||
    warnings.length > 0
  ) {
    return "yellow";
  }

  return "green";
}

function validationChecks(): string[] {
  return [
    "Confirm shop rates, burden, and margin are current.",
    "Confirm quantity, piece weight, and load capacity against the RFQ package.",
    "Confirm imported process assumptions before sending customer pricing.",
    "Confirm inspection, certification, packaging, and expedite scope.",
  ];
}

export function recommendHeatTreatQuote(input: HeatTreatQuoteInput): HeatTreatQuoteRecommendation {
  validateInput(input);
  const weightKg = totalWeightKg(input);
  const cycles = cycleCount(input, weightKg);

  if (cycles === null && !hasManualBillableHours(input)) {
    throw new RangeError("Invalid heat-treat quote input: lot must provide weight/load capacity or manual billable hours.");
  }

  const hours = billableHours(input, cycles);
  const complexity = input.adjustments.complexityFactor;
  const setupAdmin = round(input.shopRates.setupAdminCharge);
  const furnace = round(hours.furnace * input.shopRates.furnaceRatePerHour * complexity);
  const bathQuench = round(hours.bathQuench * input.shopRates.bathQuenchRatePerHour * complexity);
  const temper = round(hours.temper * input.shopRates.temperFurnaceRatePerHour * complexity);
  const labor = round(hours.labor * input.shopRates.laborRatePerHour * complexity);
  const inspection = round(input.shopRates.inspectionBaseCharge);
  const consumables = round((weightKg ?? 0) * input.shopRates.consumablesPerKg);
  const handlingPackaging = round(input.shopRates.handlingPackagingCharge);
  const subtotalBeforeReserve = setupAdmin + furnace + bathQuench + temper + labor + inspection + consumables + handlingPackaging;
  const scrapReworkReserve = round(subtotalBeforeReserve * (input.adjustments.scrapReworkReservePercent / 100));
  const processCost = subtotalBeforeReserve + scrapReworkReserve;
  const overhead = round(processCost * (input.shopRates.overheadPercent / 100));
  const burdenedCost = processCost + overhead;
  const sellBeforeAdjustments = burdenedCost / (1 - input.shopRates.targetMarginPercent / 100);
  const margin = round(sellBeforeAdjustments - burdenedCost);
  const expedite = round(sellBeforeAdjustments * input.adjustments.expediteMultiplier - sellBeforeAdjustments);
  const adjustedSell = round(sellBeforeAdjustments * input.adjustments.expediteMultiplier + input.adjustments.manualAdderDiscount);
  const minimumChargeAdjustment = round(Math.max(0, input.shopRates.minimumLotCharge - adjustedSell));
  const lotPrice = round(adjustedSell + minimumChargeAdjustment);

  const breakdown: HeatTreatQuoteBreakdown = {
    setupAdmin,
    furnace,
    bathQuench,
    temper,
    labor,
    inspection,
    consumables,
    handlingPackaging,
    scrapReworkReserve,
    overhead,
    margin,
    expedite,
    manualAdderDiscount: round(input.adjustments.manualAdderDiscount),
    minimumChargeAdjustment,
    total: lotPrice,
  };
  const warnings = buildWarnings(input, weightKg, cycles, hours, minimumChargeAdjustment > 0);

  return {
    sourceMode: input.sourceMode,
    processSummary: input.processSummary,
    lotPrice,
    unitPrice: round(lotPrice / input.lot.quantity),
    pricePerKg: weightKg === null ? null : round(lotPrice / weightKg),
    totalWeightKg: weightKg === null ? null : round(weightKg, 3),
    cycleCount: cycles,
    billableHours: {
      furnace: round(hours.furnace, 3),
      bathQuench: round(hours.bathQuench, 3),
      temper: round(hours.temper, 3),
      labor: round(hours.labor, 3),
    },
    breakdown,
    importedAssumptions: buildImportedAssumptions(input, hours),
    warnings,
    confidence: quoteConfidence(input, weightKg, cycles, warnings),
    customerSummaryLines: [
      `Lot price: $${lotPrice.toFixed(2)}`,
      `Unit price: $${round(lotPrice / input.lot.quantity).toFixed(2)}`,
      weightKg === null ? "Price per weight: unavailable" : `Price per kg: $${round(lotPrice / weightKg).toFixed(2)}`,
    ],
    internalNotes: [
      `Cycle count: ${cycles ?? "manual"}`,
      `Billable furnace/bath/temper/labor hours: ${round(hours.furnace, 3)} / ${round(hours.bathQuench, 3)} / ${round(hours.temper, 3)} / ${round(hours.labor, 3)}`,
    ],
    validationChecks: validationChecks(),
  };
}
```

- [ ] **Step 5: Add quote exports**

Create `src/quote/index.ts`:

```ts
export * from "./types.js";
export * from "./model.js";
```

- [ ] **Step 6: Include quote in library build**

Modify `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/adi/**/*.ts", "src/steel/**/*.ts", "src/quote/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 7: Run quote model tests**

Run:

```bash
npm test -- test/quote-model.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit quote core model**

```bash
git add tsconfig.build.json src/quote/types.ts src/quote/model.ts src/quote/index.ts test/quote-model.test.ts
git commit -m "feat: add heat-treat quote model"
```

---

### Task 2: Recipe Import Adapters

**Files:**
- Create: `src/quote/adapters.ts`
- Modify: `src/quote/index.ts`
- Test: `test/quote-adapters.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `test/quote-adapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
  type AdiProcessInput,
} from "../src/adi/index.js";
import {
  recommendMartemperingProcess,
  recommendSteelAustemperingProcess,
  type MartemperingInput,
  type SteelAustemperingInput,
} from "../src/steel/index.js";
import {
  quoteAssumptionsFromAdi,
  quoteAssumptionsFromMartempering,
  quoteAssumptionsFromSteelAustempering,
} from "../src/quote/index.js";

const adiInput: AdiProcessInput = {
  composition: { C: 3.6, Si: 2.5, Mn: 0.25, Cu: 0.7, Ni: 0.6, Mo: 0.15, Cr: 0.03, Mg: 0.04, P: 0.02, S: 0.01 },
  geometry: { maxSectionMm: 30, minSectionMm: 8, criticalSectionMm: 25 },
  microstructure: { startingMatrix: "ferritic-pearlitic", carbidesPresent: false, noduleCountPerMm2: 120, nodularityPercent: 90 },
  target: { grade: "150-110-07", priority: "strength" },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonPotentialControl: true, quenchTransferTimeSec: 8, austemperBathType: "salt", bathAgitation: "good", bathUniformityC: 5 },
};

const steelAustemperingInput: SteelAustemperingInput = {
  composition: { C: 0.42, Mn: 0.85, Si: 1.5, Ni: 0.2, Cr: 0.8, Mo: 0.25, V: 0.02, Cu: 0.15, B: 0.0007 },
  geometry: { maxSectionMm: 45, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 22 },
  startingCondition: "normalized",
  target: { priority: "toughness", targetHardnessHrc: 42 },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonProtection: true, quenchMedium: "salt", agitation: "good", transferTimeSec: 7, bathUniformityC: 5 },
  austemper: { bainiteTarget: "lower", bathMedium: "salt" },
};

const martemperingInput: MartemperingInput = {
  composition: { C: 0.45, Mn: 0.8, Si: 0.25, Ni: 0.2, Cr: 0.9, Mo: 0.2, V: 0.02, Cu: 0.15, B: 0.0005 },
  geometry: { maxSectionMm: 38, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 18 },
  startingCondition: "normalized",
  target: { priority: "distortion", targetHardnessHrc: 44 },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonProtection: true, quenchMedium: "salt", agitation: "good", transferTimeSec: 6, bathUniformityC: 5 },
  martemper: { bathMedium: "salt", equalizationStrategy: "section-equalized", temperHoldMin: 120, temperCount: 2 },
};

describe("quote recipe adapters", () => {
  it("imports ADI process time and risk context", () => {
    const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);
    const assumptions = quoteAssumptionsFromAdi(recommendation);

    expect(assumptions.sourceMode).toBe("adi");
    expect(assumptions.processLabel).toBe(`ADI ${recommendation.expectedGrade}`);
    expect(assumptions.austenitizeMinutes?.nominalMin).toBe(recommendation.austenitize.soakAfterCoreAtTemp.nominalMin);
    expect(assumptions.bathMinutes?.nominalMin).toBe(recommendation.austemper.holdAfterCoreAtTemp.nominalMin);
    expect(assumptions.temperCount).toBe(0);
    expect(assumptions.validationBurdenHints).toContain("Review ADI validation checklist and required metallography before quoting.");
  });

  it("imports steel austempering process time and confidence", () => {
    const recommendation = recommendSteelAustemperingProcess(steelAustemperingInput);
    const assumptions = quoteAssumptionsFromSteelAustempering(recommendation);

    expect(assumptions.sourceMode).toBe("steel-austempering");
    expect(assumptions.processLabel).toContain("Steel Austempering");
    expect(assumptions.austenitizeMinutes?.nominalMin).toBe(recommendation.austenitize.soakAfterCoreAtTemp.nominalMin);
    expect(assumptions.bathMinutes?.nominalMin).toBe(recommendation.austemper.holdAfterCoreAtTemp.nominalMin);
    expect(assumptions.processConfidence).toBe(recommendation.confidence);
  });

  it("imports martempering equalization and temper cycle assumptions", () => {
    const recommendation = recommendMartemperingProcess(martemperingInput);
    const assumptions = quoteAssumptionsFromMartempering(recommendation);

    expect(assumptions.sourceMode).toBe("martempering");
    expect(assumptions.bathMinutes?.nominalMin).toBe(recommendation.equalize.nominalMin);
    expect(assumptions.temperMinutes?.nominalMin).toBe(recommendation.temper.hold.nominalMin);
    expect(assumptions.temperCount).toBe(recommendation.temper.temperCount);
    expect(assumptions.validationBurdenHints).toContain("Include tempering validation and final hardness verification in quote scope.");
  });
});
```

- [ ] **Step 2: Run failing adapter tests**

Run:

```bash
npm test -- test/quote-adapters.test.ts
```

Expected: FAIL because adapter exports are missing.

- [ ] **Step 3: Implement adapter helpers**

Create `src/quote/adapters.ts`:

```ts
import type {
  AdiProcessRecommendation,
  TimeWindow as AdiTimeWindow,
} from "../adi/index.js";
import type {
  MartemperingRecommendation,
  SteelAustemperingRecommendation,
  TimeWindow as SteelTimeWindow,
} from "../steel/index.js";
import type {
  HeatTreatQuoteConfidence,
  HeatTreatTimeAssumption,
  ImportedProcessAssumptions,
} from "./types.js";

type TimeWindow = AdiTimeWindow | SteelTimeWindow;

function timeAssumption(label: string, window: TimeWindow): HeatTreatTimeAssumption {
  return {
    label,
    minMin: window.minMin,
    nominalMin: window.nominalMin,
    maxMin: window.maxMin,
    source: "imported",
  };
}

function confidence(value: "green" | "yellow" | "red"): HeatTreatQuoteConfidence {
  return value;
}

export function quoteAssumptionsFromAdi(
  recommendation: AdiProcessRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "adi",
    processLabel: `ADI ${recommendation.expectedGrade}`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Review ADI validation checklist and required metallography before quoting.",
      "Include hardness traverse or tensile testing when required by the customer specification.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Austemper hold after core reaches bath temperature",
      recommendation.austemper.holdAfterCoreAtTemp,
    ),
    temperCount: 0,
  };
}

export function quoteAssumptionsFromSteelAustempering(
  recommendation: SteelAustemperingRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "steel-austempering",
    processLabel: `Steel Austempering - ${recommendation.expectedStructure}`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Include hardenability review, final hardness traverse, and microstructure validation in quote scope.",
      "Confirm final cooling and handling requirements before sending pricing.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Austemper hold after core reaches bath temperature",
      recommendation.austemper.holdAfterCoreAtTemp,
    ),
    temperCount: 0,
  };
}

export function quoteAssumptionsFromMartempering(
  recommendation: MartemperingRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "martempering",
    processLabel: `Martempering - temper to ${recommendation.temper.targetHardnessHrc} HRC`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Include tempering validation and final hardness verification in quote scope.",
      "Confirm retained-austenite, distortion, and prompt-temper risks before sending pricing.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Martemper equalization time",
      recommendation.equalize,
    ),
    temperMinutes: timeAssumption(
      "Temper hold time",
      recommendation.temper.hold,
    ),
    temperCount: recommendation.temper.temperCount,
  };
}
```

- [ ] **Step 4: Export adapters**

Modify `src/quote/index.ts`:

```ts
export * from "./types.js";
export * from "./model.js";
export * from "./adapters.js";
```

- [ ] **Step 5: Run adapter and model tests**

Run:

```bash
npm test -- test/quote-model.test.ts test/quote-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit recipe adapters**

```bash
git add src/quote/adapters.ts src/quote/index.ts test/quote-adapters.test.ts
git commit -m "feat: import recipe assumptions for quote pricing"
```

---

### Task 3: RFQ State, Process Mode, And Project Persistence

**Files:**
- Create: `src/ui/quote-state.ts`
- Modify: `src/ui/process-modes.ts`
- Modify: `src/ui/project-state.ts`
- Test: `test/quote-state.test.ts`
- Test: `test/process-modes.test.ts`
- Test: `test/project-state.test.ts`

- [ ] **Step 1: Write failing quote-state tests**

Create `test/quote-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultHeatTreatQuoteInput,
  setHeatTreatQuoteInputValue,
} from "../src/ui/quote-state.js";

describe("quote UI state", () => {
  it("creates editable shop-specific default quote input", () => {
    const input = defaultHeatTreatQuoteInput();

    expect(input.sourceMode).toBe("manual");
    expect(input.processSummary).toBe("Manual heat-treatment quote");
    expect(input.shopRates.targetMarginPercent).toBe(20);
    expect(input.adjustments.complexityFactor).toBe(1);
    expect(input.adjustments.expediteMultiplier).toBe(1);
  });

  it("updates nested quote fields from UI paths", () => {
    const input = defaultHeatTreatQuoteInput();

    setHeatTreatQuoteInputValue(input, "sourceMode", "adi");
    setHeatTreatQuoteInputValue(input, "lot.quantity", 250);
    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", 1200);
    setHeatTreatQuoteInputValue(input, "shopRates.furnaceRatePerHour", 145);
    setHeatTreatQuoteInputValue(input, "manualOverrides.billableFurnaceHours", 6.5);
    setHeatTreatQuoteInputValue(input, "adjustments.manualAdderDiscount", -75);

    expect(input.sourceMode).toBe("adi");
    expect(input.lot.quantity).toBe(250);
    expect(input.lot.totalWeightKg).toBe(1200);
    expect(input.shopRates.furnaceRatePerHour).toBe(145);
    expect(input.manualOverrides.billableFurnaceHours).toBe(6.5);
    expect(input.adjustments.manualAdderDiscount).toBe(-75);
  });

  it("clears optional numeric fields when the UI sends undefined", () => {
    const input = defaultHeatTreatQuoteInput();
    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", 1200);

    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", undefined);

    expect(input.lot.totalWeightKg).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run failing quote-state tests**

Run:

```bash
npm test -- test/quote-state.test.ts
```

Expected: FAIL because `src/ui/quote-state.ts` does not exist.

- [ ] **Step 3: Implement quote-state helpers**

Create `src/ui/quote-state.ts`:

```ts
import type {
  HeatTreatQuoteAdjustments,
  HeatTreatQuoteInput,
  HeatTreatQuoteLot,
  HeatTreatManualOverrides,
  HeatTreatShopRates,
} from "../quote/index.js";

type QuoteFieldGroup =
  | HeatTreatQuoteLot
  | HeatTreatShopRates
  | HeatTreatManualOverrides
  | HeatTreatQuoteAdjustments;

export function defaultHeatTreatQuoteInput(): HeatTreatQuoteInput {
  return {
    sourceMode: "manual",
    processSummary: "Manual heat-treatment quote",
    lot: {
      quantity: 1,
    },
    importedProcess: {
      sourceMode: "manual",
      processLabel: "Manual heat-treatment quote",
      processConfidence: "yellow",
      processWarnings: [],
      validationBurdenHints: [],
      temperCount: 0,
    },
    shopRates: {
      minimumLotCharge: 0,
      setupAdminCharge: 0,
      laborRatePerHour: 0,
      furnaceRatePerHour: 0,
      bathQuenchRatePerHour: 0,
      temperFurnaceRatePerHour: 0,
      inspectionBaseCharge: 0,
      consumablesPerKg: 0,
      handlingPackagingCharge: 0,
      overheadPercent: 0,
      targetMarginPercent: 20,
    },
    manualOverrides: {},
    adjustments: {
      complexityFactor: 1,
      scrapReworkReservePercent: 0,
      expediteMultiplier: 1,
      manualAdderDiscount: 0,
    },
  };
}

export function setHeatTreatQuoteInputValue(
  input: HeatTreatQuoteInput,
  path: string,
  value: string | number | undefined,
): void {
  if (path === "sourceMode") {
    inputAsMutable(input).sourceMode = value as HeatTreatQuoteInput["sourceMode"];
    return;
  }

  if (path === "processSummary") {
    inputAsMutable(input).processSummary = String(value ?? "");
    return;
  }

  const [group, key] = path.split(".") as [keyof HeatTreatQuoteInput, string];
  if (
    group === "lot" ||
    group === "shopRates" ||
    group === "manualOverrides" ||
    group === "adjustments"
  ) {
    assignNumeric(input[group] as QuoteFieldGroup, key, value);
  }
}

function assignNumeric(
  target: QuoteFieldGroup,
  key: string,
  value: string | number | undefined,
): void {
  const record = target as Record<string, number | undefined>;
  if (value === undefined || value === "") {
    delete record[key];
    return;
  }

  record[key] = typeof value === "number" ? value : Number(value);
}

function inputAsMutable(input: HeatTreatQuoteInput): {
  sourceMode: HeatTreatQuoteInput["sourceMode"];
  processSummary: string;
} {
  return input as {
    sourceMode: HeatTreatQuoteInput["sourceMode"];
    processSummary: string;
  };
}
```

- [ ] **Step 4: Update process-mode tests**

Modify `test/process-modes.test.ts` to expect the RFQ mode:

```ts
import { describe, expect, it } from "vitest";
import {
  getProcessMode,
  implementedProcessModes,
  plannedProcessModes,
  PROCESS_MODES,
} from "../src/ui/process-modes.js";

describe("process mode metadata", () => {
  it("defines implemented ADI, steel, martempering, and RFQ modes", () => {
    expect(PROCESS_MODES.map((mode) => mode.id)).toEqual([
      "adi",
      "steel-austempering",
      "martempering",
      "heat-treat-rfq",
    ]);
    expect(implementedProcessModes().map((mode) => mode.id)).toEqual([
      "adi",
      "steel-austempering",
      "martempering",
      "heat-treat-rfq",
    ]);
    expect(plannedProcessModes()).toEqual([]);
  });

  it("returns RFQ metadata", () => {
    expect(getProcessMode("heat-treat-rfq")).toMatchObject({
      label: "Heat-Treat RFQ",
      status: "implemented",
      description: "Heat-treatment service quote estimate.",
    });
  });
});
```

- [ ] **Step 5: Add the RFQ process mode**

Modify `src/ui/process-modes.ts`:

```ts
export type ProcessModeId = "adi" | "steel-austempering" | "martempering" | "heat-treat-rfq";
export type ProcessModeStatus = "implemented" | "planned";

export interface ProcessMode {
  readonly id: ProcessModeId;
  readonly label: string;
  readonly icon: string;
  readonly status: ProcessModeStatus;
  readonly description: string;
  readonly plannedInputs: readonly string[];
}

export const PROCESS_MODES: readonly ProcessMode[] = Object.freeze([
  {
    id: "adi",
    label: "ADI",
    icon: "ph-target",
    status: "implemented",
    description: "Austempered ductile iron process recommendation.",
    plannedInputs: [],
  },
  {
    id: "steel-austempering",
    label: "Steel Austempering",
    icon: "ph-thermometer-hot",
    status: "implemented",
    description: "Bainitic steel austempering process recommendation.",
    plannedInputs: [
      "Steel composition and hardenability",
      "Austenitizing temperature and soak",
      "Quench severity and transfer timing",
      "Austemper bath temperature and hold",
    ],
  },
  {
    id: "martempering",
    label: "Martempering",
    icon: "ph-lock-simple",
    status: "implemented",
    description: "Interrupted quench, equalization, and tempering process recommendation.",
    plannedInputs: [
      "Steel grade and martensite-start estimate",
      "Austenitizing temperature and soak",
      "Interrupted quench bath temperature",
      "Equalization, final cooling, and tempering plan",
    ],
  },
  {
    id: "heat-treat-rfq",
    label: "Heat-Treat RFQ",
    icon: "ph-currency-dollar",
    status: "implemented",
    description: "Heat-treatment service quote estimate.",
    plannedInputs: [],
  },
]);

export function getProcessMode(id: ProcessModeId): ProcessMode {
  const mode = PROCESS_MODES.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new RangeError(`Unknown process mode: ${id}`);
  }

  return mode;
}

export function implementedProcessModes(): readonly ProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "implemented");
}

export function plannedProcessModes(): readonly ProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "planned");
}
```

- [ ] **Step 6: Add project-state tests for version 4 quote persistence**

Modify `test/project-state.test.ts`:

```ts
import type { HeatTreatQuoteInput } from "../src/quote/index.js";
import { defaultHeatTreatQuoteInput } from "../src/ui/quote-state.js";
```

Update `validationChecklists` fixtures to include:

```ts
"heat-treat-rfq": {
  items: [],
},
```

Update `version3Project` helper to keep `htcalcProjectVersion: 3`; add this helper:

```ts
function version4Project(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...version3Project(),
    htcalcProjectVersion: 4,
    heatTreatQuote: {
      input: defaultHeatTreatQuoteInput(),
    },
    validationChecklists: {
      ...validationChecklists,
      "heat-treat-rfq": { items: [] },
    },
    ...overrides,
  };
}
```

Add tests:

```ts
it("creates a version 4 project state snapshot with RFQ state", () => {
  const heatTreatQuoteInput: HeatTreatQuoteInput = {
    ...defaultHeatTreatQuoteInput(),
    sourceMode: "adi",
    lot: {
      ...defaultHeatTreatQuoteInput().lot,
      quantity: 50,
    },
    shopRates: {
      ...defaultHeatTreatQuoteInput().shopRates,
      minimumLotCharge: 600,
    },
  };

  const project = createProjectState({
    activeModeId: "heat-treat-rfq",
    unitSystem: "imperial",
    adiInput,
    adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
    steelAustemperingInput,
    martemperingInput,
    heatTreatQuoteInput,
    metadata,
    validationChecklists: {
      ...validationChecklists,
      "heat-treat-rfq": { items: [] },
    },
    exportedAt: "2026-07-04T00:00:00.000Z",
  });

  expect(project).toMatchObject({
    htcalcProjectVersion: 4,
    activeModeId: "heat-treat-rfq",
    heatTreatQuote: {
      input: {
        sourceMode: "adi",
        lot: {
          quantity: 50,
        },
        shopRates: {
          minimumLotCharge: 600,
        },
      },
    },
  });
});

it("round-trips version 4 quote state through JSON", () => {
  const parsed = parseProjectState(JSON.stringify(version4Project({
    activeModeId: "heat-treat-rfq",
  })));

  expect(parsed.htcalcProjectVersion).toBe(4);
  expect(parsed.activeModeId).toBe("heat-treat-rfq");
  expect(parsed.heatTreatQuote.input.sourceMode).toBe("manual");
});

it("migrates version 3 project files to version 4 with default RFQ state", () => {
  const parsed = parseProjectState(JSON.stringify(version3Project()));

  expect(parsed.htcalcProjectVersion).toBe(4);
  expect(parsed.heatTreatQuote.input).toMatchObject(defaultHeatTreatQuoteInput());
  expect(parsed.validationChecklists["heat-treat-rfq"]).toEqual({ items: [] });
});

it("rejects invalid quote margin in version 4 project files", () => {
  const invalidProject = version4Project({
    heatTreatQuote: {
      input: {
        ...defaultHeatTreatQuoteInput(),
        shopRates: {
          ...defaultHeatTreatQuoteInput().shopRates,
          targetMarginPercent: 100,
        },
      },
    },
  });

  expect(() => parseProjectState(JSON.stringify(invalidProject))).toThrow(
    "HTCalc project file has invalid value at heatTreatQuote.input.shopRates.targetMarginPercent.",
  );
});
```

- [ ] **Step 7: Implement project-state version 4 support**

Modify `src/ui/project-state.ts`:

```ts
import type { HeatTreatQuoteInput } from "../quote/index.js";
import { defaultHeatTreatQuoteInput } from "./quote-state.js";
```

Change constants:

```ts
export const HTCALC_PROJECT_VERSION = 4;
const LEGACY_PROJECT_VERSION = 1;
const REVIEW_PROJECT_VERSION = 2;
const STEEL_PROJECT_VERSION = 3;
```

Update `emptyValidationChecklists()`:

```ts
function emptyValidationChecklists(): Record<ProcessModeId, ValidationChecklistState> {
  return {
    adi: { items: [] },
    "steel-austempering": { items: [] },
    martempering: { items: [] },
    "heat-treat-rfq": { items: [] },
  };
}
```

Add to `HtcalcProjectState`:

```ts
readonly heatTreatQuote: {
  readonly input: HeatTreatQuoteInput;
};
```

Add to `CreateProjectStateInput`:

```ts
readonly heatTreatQuoteInput?: HeatTreatQuoteInput;
```

Add quote-specific parser sets near the existing valid-value sets:

```ts
const validQuoteSourceModes: ReadonlySet<HeatTreatQuoteInput["sourceMode"]> = new Set([
  "adi",
  "steel-austempering",
  "martempering",
  "manual",
]);
const validQuoteTimeSources: ReadonlySet<"imported" | "manual" | "calculated"> = new Set([
  "imported",
  "manual",
  "calculated",
]);
```

Add to `createProjectState`:

```ts
heatTreatQuote: {
  input: structuredClone(input.heatTreatQuoteInput ?? defaultHeatTreatQuoteInput()),
},
```

Update accepted versions in `parseProjectState`:

```ts
if (
  parsed.htcalcProjectVersion !== HTCALC_PROJECT_VERSION &&
  parsed.htcalcProjectVersion !== STEEL_PROJECT_VERSION &&
  parsed.htcalcProjectVersion !== REVIEW_PROJECT_VERSION &&
  parsed.htcalcProjectVersion !== LEGACY_PROJECT_VERSION
) {
  throw new Error(`Unsupported HTCalc project version: ${String(parsed.htcalcProjectVersion)}`);
}
```

For legacy and review migrations, add:

```ts
heatTreatQuote: {
  input: defaultHeatTreatQuoteInput(),
},
```

For version 3 migration, return parsed steel state plus RFQ defaults:

```ts
if (parsed.htcalcProjectVersion === STEEL_PROJECT_VERSION) {
  return {
    ...base,
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    metadata: parseMetadata(parsed.metadata, "metadata"),
    steelAustempering: parseSteelAustemperingProject(parsed.steelAustempering),
    martempering: parseMartemperingProject(parsed.martempering),
    heatTreatQuote: {
      input: defaultHeatTreatQuoteInput(),
    },
    validationChecklists: {
      ...parseValidationChecklists(parsed.validationChecklists),
      "heat-treat-rfq": { items: [] },
    },
    pinnedComparisonBaseline: parsePinnedComparisonBaseline(parsed.pinnedComparisonBaseline),
  };
}
```

For version 4 return:

```ts
heatTreatQuote: parseHeatTreatQuoteProject(parsed.heatTreatQuote),
```

Add parsers:

```ts
function parseHeatTreatQuoteProject(value: unknown): HtcalcProjectState["heatTreatQuote"] {
  assertRecord(value, "heatTreatQuote");

  return {
    input: parseHeatTreatQuoteInput(value.input, "heatTreatQuote.input"),
  };
}

function parseHeatTreatQuoteInput(value: unknown, path: string): HeatTreatQuoteInput {
  assertRecord(value, path);
  assertRecord(value.lot, `${path}.lot`);
  assertRecord(value.importedProcess, `${path}.importedProcess`);
  assertRecord(value.shopRates, `${path}.shopRates`);
  assertRecord(value.manualOverrides, `${path}.manualOverrides`);
  assertRecord(value.adjustments, `${path}.adjustments`);

  const sourceMode = enumValue(value.sourceMode, validQuoteSourceModes, `${path}.sourceMode`);
  assertString(value.processSummary, `${path}.processSummary`);

  const importedRecord = value.importedProcess;
  const importedSourceMode = enumValue(
    importedRecord.sourceMode,
    validQuoteSourceModes,
    `${path}.importedProcess.sourceMode`,
  );

  return {
    sourceMode,
    processSummary: value.processSummary,
    lot: parseQuoteLot(value.lot, `${path}.lot`),
    importedProcess: {
      sourceMode: importedSourceMode,
      processLabel: stringValue(importedRecord.processLabel, `${path}.importedProcess.processLabel`),
      processConfidence: enumValue(importedRecord.processConfidence, validConfidenceLevels, `${path}.importedProcess.processConfidence`),
      processWarnings: stringArrayValue(importedRecord.processWarnings, `${path}.importedProcess.processWarnings`),
      validationBurdenHints: stringArrayValue(importedRecord.validationBurdenHints, `${path}.importedProcess.validationBurdenHints`),
      ...(importedRecord.austenitizeMinutes === undefined ? {} : { austenitizeMinutes: parseQuoteTimeAssumption(importedRecord.austenitizeMinutes, `${path}.importedProcess.austenitizeMinutes`) }),
      ...(importedRecord.bathMinutes === undefined ? {} : { bathMinutes: parseQuoteTimeAssumption(importedRecord.bathMinutes, `${path}.importedProcess.bathMinutes`) }),
      ...(importedRecord.temperMinutes === undefined ? {} : { temperMinutes: parseQuoteTimeAssumption(importedRecord.temperMinutes, `${path}.importedProcess.temperMinutes`) }),
      temperCount: finiteNumber(importedRecord.temperCount, `${path}.importedProcess.temperCount`, { min: 0 }),
    },
    shopRates: parseQuoteShopRates(value.shopRates, `${path}.shopRates`),
    manualOverrides: parseQuoteManualOverrides(value.manualOverrides, `${path}.manualOverrides`),
    adjustments: parseQuoteAdjustments(value.adjustments, `${path}.adjustments`),
  };
}
```

Add focused helper functions used by the parser:

```ts
function optionalPositiveRecordNumber(record: Record<string, unknown>, key: string, path: string): number | undefined {
  return record[key] === undefined ? undefined : finiteNumber(record[key], `${path}.${key}`, { minExclusive: 0 });
}

function optionalNonNegativeRecordNumber(record: Record<string, unknown>, key: string, path: string): number | undefined {
  return record[key] === undefined ? undefined : finiteNumber(record[key], `${path}.${key}`, { min: 0 });
}

function parseQuoteLot(value: unknown, path: string): HeatTreatQuoteInput["lot"] {
  assertRecord(value, path);
  return {
    quantity: finiteNumber(value.quantity, `${path}.quantity`, { minExclusive: 0 }),
    ...(value.pieceWeightKg === undefined ? {} : { pieceWeightKg: finiteNumber(value.pieceWeightKg, `${path}.pieceWeightKg`, { minExclusive: 0 }) }),
    ...(value.totalWeightKg === undefined ? {} : { totalWeightKg: finiteNumber(value.totalWeightKg, `${path}.totalWeightKg`, { minExclusive: 0 }) }),
    ...(value.loadCapacityKg === undefined ? {} : { loadCapacityKg: finiteNumber(value.loadCapacityKg, `${path}.loadCapacityKg`, { minExclusive: 0 }) }),
    ...(value.laborHoursPerLoad === undefined ? {} : { laborHoursPerLoad: finiteNumber(value.laborHoursPerLoad, `${path}.laborHoursPerLoad`, { min: 0 }) }),
    ...(value.cycleCountOverride === undefined ? {} : { cycleCountOverride: finiteNumber(value.cycleCountOverride, `${path}.cycleCountOverride`, { minExclusive: 0 }) }),
  };
}

function parseQuoteShopRates(value: unknown, path: string): HeatTreatQuoteInput["shopRates"] {
  assertRecord(value, path);
  const targetMarginPercent = finiteNumber(value.targetMarginPercent, `${path}.targetMarginPercent`, { min: 0, max: 100 });
  if (targetMarginPercent >= 100) {
    throw new Error(`HTCalc project file has invalid value at ${path}.targetMarginPercent.`);
  }
  return {
    minimumLotCharge: finiteNumber(value.minimumLotCharge, `${path}.minimumLotCharge`, { min: 0 }),
    setupAdminCharge: finiteNumber(value.setupAdminCharge, `${path}.setupAdminCharge`, { min: 0 }),
    laborRatePerHour: finiteNumber(value.laborRatePerHour, `${path}.laborRatePerHour`, { min: 0 }),
    furnaceRatePerHour: finiteNumber(value.furnaceRatePerHour, `${path}.furnaceRatePerHour`, { min: 0 }),
    bathQuenchRatePerHour: finiteNumber(value.bathQuenchRatePerHour, `${path}.bathQuenchRatePerHour`, { min: 0 }),
    temperFurnaceRatePerHour: finiteNumber(value.temperFurnaceRatePerHour, `${path}.temperFurnaceRatePerHour`, { min: 0 }),
    inspectionBaseCharge: finiteNumber(value.inspectionBaseCharge, `${path}.inspectionBaseCharge`, { min: 0 }),
    consumablesPerKg: finiteNumber(value.consumablesPerKg, `${path}.consumablesPerKg`, { min: 0 }),
    handlingPackagingCharge: finiteNumber(value.handlingPackagingCharge, `${path}.handlingPackagingCharge`, { min: 0 }),
    overheadPercent: finiteNumber(value.overheadPercent, `${path}.overheadPercent`, { min: 0 }),
    targetMarginPercent,
  };
}

function parseQuoteManualOverrides(value: unknown, path: string): HeatTreatQuoteInput["manualOverrides"] {
  assertRecord(value, path);
  return {
    ...(value.billableFurnaceHours === undefined ? {} : { billableFurnaceHours: optionalNonNegativeRecordNumber(value, "billableFurnaceHours", path) }),
    ...(value.billableBathQuenchHours === undefined ? {} : { billableBathQuenchHours: optionalNonNegativeRecordNumber(value, "billableBathQuenchHours", path) }),
    ...(value.billableTemperHours === undefined ? {} : { billableTemperHours: optionalNonNegativeRecordNumber(value, "billableTemperHours", path) }),
    ...(value.billableLaborHours === undefined ? {} : { billableLaborHours: optionalNonNegativeRecordNumber(value, "billableLaborHours", path) }),
    ...(value.billableCycleCount === undefined ? {} : { billableCycleCount: optionalPositiveRecordNumber(value, "billableCycleCount", path) }),
  };
}

function parseQuoteAdjustments(value: unknown, path: string): HeatTreatQuoteInput["adjustments"] {
  assertRecord(value, path);
  return {
    complexityFactor: finiteNumber(value.complexityFactor, `${path}.complexityFactor`, { minExclusive: 0 }),
    scrapReworkReservePercent: finiteNumber(value.scrapReworkReservePercent, `${path}.scrapReworkReservePercent`, { min: 0 }),
    expediteMultiplier: finiteNumber(value.expediteMultiplier, `${path}.expediteMultiplier`, { minExclusive: 0 }),
    manualAdderDiscount: finiteNumber(value.manualAdderDiscount, `${path}.manualAdderDiscount`),
  };
}

function parseQuoteTimeAssumption(value: unknown, path: string): HeatTreatQuoteInput["importedProcess"]["austenitizeMinutes"] {
  assertRecord(value, path);
  return {
    label: stringValue(value.label, `${path}.label`),
    ...(value.minMin === undefined ? {} : { minMin: finiteNumber(value.minMin, `${path}.minMin`, { min: 0 }) }),
    nominalMin: finiteNumber(value.nominalMin, `${path}.nominalMin`, { min: 0 }),
    ...(value.maxMin === undefined ? {} : { maxMin: finiteNumber(value.maxMin, `${path}.maxMin`, { min: 0 }) }),
    source: enumValue(value.source, validQuoteTimeSources, `${path}.source`),
  };
}

function stringArrayValue(value: unknown, path: string): string[] {
  assertStringArray(value, path);
  return value;
}
```

- [ ] **Step 8: Run state and project tests**

Run:

```bash
npm test -- test/quote-state.test.ts test/process-modes.test.ts test/project-state.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit state and persistence**

```bash
git add src/ui/quote-state.ts src/ui/process-modes.ts src/ui/project-state.ts test/quote-state.test.ts test/process-modes.test.ts test/project-state.test.ts
git commit -m "feat: persist heat-treat rfq state"
```

---

### Task 4: RFQ Report Serialization

**Files:**
- Create: `src/ui/quote-report.ts`
- Test: `test/quote-report.test.ts`

- [ ] **Step 1: Write failing quote report tests**

Create `test/quote-report.test.ts`:

```ts
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
```

- [ ] **Step 2: Run failing quote report tests**

Run:

```bash
npm test -- test/quote-report.test.ts
```

Expected: FAIL because `src/ui/quote-report.ts` does not exist.

- [ ] **Step 3: Implement quote report serializer**

Create `src/ui/quote-report.ts`:

```ts
import type {
  HeatTreatQuoteInput,
  HeatTreatQuoteRecommendation,
} from "../quote/index.js";
import type { ProjectMetadata } from "./project-state.js";

export interface CreateQuoteReportViewModelInput {
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly input: HeatTreatQuoteInput;
  readonly recommendation: HeatTreatQuoteRecommendation;
}

export interface QuoteReportViewModel extends CreateQuoteReportViewModelInput {
  readonly title: string;
}

export function createQuoteReportViewModel(
  input: CreateQuoteReportViewModelInput,
): QuoteReportViewModel {
  return {
    ...structuredClone(input),
    title: "HTCalc Heat-Treat RFQ Report",
  };
}

export function serializeQuoteReportMarkdown(report: QuoteReportViewModel): string {
  const notes = report.metadata.notes.trim() || "No project notes entered.";
  const warningLines = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings.map((warning) => `- ${warning}`)
    : ["- No active quote warnings for the current input set."];
  const assumptionLines = report.recommendation.importedAssumptions.length > 0
    ? report.recommendation.importedAssumptions.map((assumption) => `- ${assumption}`)
    : ["- No imported assumptions."];

  return [
    `# ${report.title}`,
    "",
    `Generated: ${report.exportedAt}`,
    "",
    "## Project",
    `Customer: ${report.metadata.customerName || "Unspecified"}`,
    `Part: ${report.metadata.partName || "Unspecified"}`,
    "",
    "### Notes",
    notes,
    "",
    "## Quote Summary",
    `Process source: ${report.recommendation.processSummary}`,
    `Quantity: ${formatNumber(report.input.lot.quantity)}`,
    `Total weight: ${report.recommendation.totalWeightKg === null ? "Unavailable" : `${formatNumber(report.recommendation.totalWeightKg)} kg`}`,
    `Cycle count: ${report.recommendation.cycleCount ?? "Manual"}`,
    `Lot price: $${report.recommendation.lotPrice.toFixed(2)}`,
    `Unit price: $${report.recommendation.unitPrice.toFixed(2)}`,
    `Price per kg: ${report.recommendation.pricePerKg === null ? "Unavailable" : `$${report.recommendation.pricePerKg.toFixed(2)}`}`,
    `Confidence: ${report.recommendation.confidence}`,
    "",
    "## Quote Assumptions",
    ...assumptionLines,
    "",
    "## Pricing Warnings",
    ...warningLines,
    "",
    "## Internal Cost Breakdown",
    `- Setup/admin: $${report.recommendation.breakdown.setupAdmin.toFixed(2)}`,
    `- Furnace: $${report.recommendation.breakdown.furnace.toFixed(2)}`,
    `- Bath/quench: $${report.recommendation.breakdown.bathQuench.toFixed(2)}`,
    `- Temper: $${report.recommendation.breakdown.temper.toFixed(2)}`,
    `- Labor: $${report.recommendation.breakdown.labor.toFixed(2)}`,
    `- Inspection: $${report.recommendation.breakdown.inspection.toFixed(2)}`,
    `- Consumables: $${report.recommendation.breakdown.consumables.toFixed(2)}`,
    `- Handling/packaging: $${report.recommendation.breakdown.handlingPackaging.toFixed(2)}`,
    `- Scrap/rework reserve: $${report.recommendation.breakdown.scrapReworkReserve.toFixed(2)}`,
    `- Overhead: $${report.recommendation.breakdown.overhead.toFixed(2)}`,
    `- Margin: $${report.recommendation.breakdown.margin.toFixed(2)}`,
    `- Expedite: $${report.recommendation.breakdown.expedite.toFixed(2)}`,
    `- Manual adder/discount: $${report.recommendation.breakdown.manualAdderDiscount.toFixed(2)}`,
    `- Minimum charge adjustment: $${report.recommendation.breakdown.minimumChargeAdjustment.toFixed(2)}`,
    `- Total: $${report.recommendation.breakdown.total.toFixed(2)}`,
    "",
    "## Model Notes",
    "Heat-treatment service pricing only. This quote excludes material, machining, outside services, freight, tax, and contractual terms unless entered separately as manual adjustments.",
    "",
  ].join("\n");
}

export function quoteReportMarkdownFilename(
  metadata: ProjectMetadata,
  exportedAt = new Date().toISOString(),
): string {
  const date = exportedAt.slice(0, 10);
  const slugParts = [metadata.customerName, metadata.partName]
    .map(slugify)
    .filter(Boolean);
  const prefix = slugParts.length > 0 ? `${slugParts.join("-")}-` : "";

  return `${prefix}htcalc-heat-treat-rfq-${date}.md`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}
```

- [ ] **Step 4: Run report tests**

Run:

```bash
npm test -- test/quote-report.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit report serializer**

```bash
git add src/ui/quote-report.ts test/quote-report.test.ts
git commit -m "feat: add heat-treat rfq reports"
```

---

### Task 5: RFQ UI Integration

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/units.ts`
- Modify: `src/ui/view-model.ts`
- Test: `test/ui-active-rendering.test.ts`
- Test: `test/ui-units.test.ts`

- [ ] **Step 1: Write failing UI routing assertions**

Modify `test/ui-active-rendering.test.ts`:

```ts
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

  it("routes Heat-Treat RFQ through dedicated workspace, binding, and renderer", () => {
    expect(mainSource).toContain("function quoteWorkspace");
    expect(mainSource).toContain("function bindQuoteInputs");
    expect(mainSource).toContain("function renderQuoteRecommendation");
    expect(mainSource).toContain('case "heat-treat-rfq":');
    expect(mainSource).toContain("quoteInputForCurrentState()");
    expect(mainSource).toContain("quoteAssumptionsForSource");
  });
});
```

- [ ] **Step 2: Write failing quote unit tests**

Modify `test/ui-units.test.ts` with quote lot paths:

```ts
it("converts quote lot weights with the active unit system", () => {
  expect(isUnitSensitivePath("lot.pieceWeightKg")).toBe(true);
  expect(isUnitSensitivePath("lot.totalWeightKg")).toBe(true);
  expect(isUnitSensitivePath("lot.loadCapacityKg")).toBe(true);
  expect(toDisplayValue("lot.totalWeightKg", 45.359237, "imperial")).toBeCloseTo(100);
  expect(toMetricValue("lot.totalWeightKg", 100, "imperial")).toBeCloseTo(45.359237);
  expect(unitLabelForPath("lot.totalWeightKg", "imperial", "kg")).toBe("lb");
  expect(unitLabelForPath("lot.totalWeightKg", "metric", "kg")).toBe("kg");
});
```

- [ ] **Step 3: Run failing UI tests**

Run:

```bash
npm test -- test/ui-active-rendering.test.ts test/ui-units.test.ts
```

Expected: FAIL because quote UI functions and quote unit paths are missing.

- [ ] **Step 4: Add quote unit paths**

Modify `src/ui/units.ts`:

```ts
const WEIGHT_PATHS = new Set([
  "geometry.estimatedMassKg",
  "lot.pieceWeightKg",
  "lot.totalWeightKg",
  "lot.loadCapacityKg",
]);
```

Update `isUnitSensitivePath`:

```ts
export function isUnitSensitivePath(path: string): boolean {
  return (
    SECTION_PATHS.has(path) ||
    WEIGHT_PATHS.has(path) ||
    path === "equipment.bathUniformityC"
  );
}
```

Update `toDisplayValue`, `toMetricValue`, and `unitLabelForPath` by replacing the exact `path === "geometry.estimatedMassKg"` checks with `WEIGHT_PATHS.has(path)`.

- [ ] **Step 5: Add quote optional numeric parsing**

Modify `src/ui/view-model.ts`:

```ts
const OPTIONAL_NUMERIC_PATHS = new Set([
  "geometry.estimatedMassKg",
  "microstructure.noduleCountPerMm2",
  "microstructure.nodularityPercent",
  "lot.pieceWeightKg",
  "lot.totalWeightKg",
  "lot.loadCapacityKg",
  "lot.laborHoursPerLoad",
  "lot.cycleCountOverride",
  "manualOverrides.billableFurnaceHours",
  "manualOverrides.billableBathQuenchHours",
  "manualOverrides.billableTemperHours",
  "manualOverrides.billableLaborHours",
  "manualOverrides.billableCycleCount",
]);
```

- [ ] **Step 6: Add imports and RFQ state to `main.ts`**

Modify imports in `src/ui/main.ts`:

```ts
import {
  quoteAssumptionsFromAdi,
  quoteAssumptionsFromMartempering,
  quoteAssumptionsFromSteelAustempering,
  recommendHeatTreatQuote,
  type HeatTreatQuoteInput,
  type HeatTreatQuoteRecommendation,
  type HeatTreatQuoteSourceMode,
  type ImportedProcessAssumptions,
} from "../quote/index.js";
import {
  createQuoteReportViewModel,
  quoteReportMarkdownFilename,
  serializeQuoteReportMarkdown,
  type QuoteReportViewModel,
} from "./quote-report.js";
import {
  defaultHeatTreatQuoteInput,
  setHeatTreatQuoteInputValue,
} from "./quote-state.js";
```

Add state:

```ts
let heatTreatQuoteState: HeatTreatQuoteInput = defaultHeatTreatQuoteInput();
```

Add checklist default:

```ts
"heat-treat-rfq": { items: [] },
```

- [ ] **Step 7: Add RFQ workspace rendering helpers**

Add these functions in `src/ui/main.ts` near other workspace helpers:

```ts
function quoteWorkspace(): string {
  return `
    <section class="input-pane" aria-label="Heat-treat RFQ inputs">
      ${projectDetailsSection()}
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-git-branch"></i><span>1. Quote Source</span></div>
        <div class="field-grid target-grid">
          ${quoteSelectField("sourceMode", "Source", [
            ["adi", "Use current ADI recipe"],
            ["steel-austempering", "Use current Steel Austempering recipe"],
            ["martempering", "Use current Martempering recipe"],
            ["manual", "Manual quote"],
          ], heatTreatQuoteState.sourceMode)}
          ${quoteTextField("processSummary", "Quote Summary", heatTreatQuoteState.processSummary)}
        </div>
      </div>
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-stack"></i><span>2. Lot</span></div>
        <div class="field-grid geometry-grid">
          ${quoteNumberField("lot.quantity", "Quantity", heatTreatQuoteState.lot.quantity, "1", "")}
          ${quoteNumberField("lot.pieceWeightKg", "Piece Weight", heatTreatQuoteState.lot.pieceWeightKg, "0.01", "kg")}
          ${quoteNumberField("lot.totalWeightKg", "Total Weight", heatTreatQuoteState.lot.totalWeightKg, "0.01", "kg")}
          ${quoteNumberField("lot.loadCapacityKg", "Load Capacity", heatTreatQuoteState.lot.loadCapacityKg, "0.01", "kg")}
          ${quoteNumberField("lot.laborHoursPerLoad", "Labor / Load", heatTreatQuoteState.lot.laborHoursPerLoad, "0.01", "h")}
          ${quoteNumberField("lot.cycleCountOverride", "Cycle Override", heatTreatQuoteState.lot.cycleCountOverride, "1", "")}
        </div>
      </div>
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-currency-dollar"></i><span>3. Shop Rates</span></div>
        <div class="field-grid equipment-grid">
          ${quoteNumberField("shopRates.minimumLotCharge", "Minimum Charge", heatTreatQuoteState.shopRates.minimumLotCharge, "0.01", "$")}
          ${quoteNumberField("shopRates.setupAdminCharge", "Setup/Admin", heatTreatQuoteState.shopRates.setupAdminCharge, "0.01", "$")}
          ${quoteNumberField("shopRates.laborRatePerHour", "Labor Rate", heatTreatQuoteState.shopRates.laborRatePerHour, "0.01", "$/h")}
          ${quoteNumberField("shopRates.furnaceRatePerHour", "Furnace Rate", heatTreatQuoteState.shopRates.furnaceRatePerHour, "0.01", "$/h")}
          ${quoteNumberField("shopRates.bathQuenchRatePerHour", "Bath/Quench Rate", heatTreatQuoteState.shopRates.bathQuenchRatePerHour, "0.01", "$/h")}
          ${quoteNumberField("shopRates.temperFurnaceRatePerHour", "Temper Rate", heatTreatQuoteState.shopRates.temperFurnaceRatePerHour, "0.01", "$/h")}
          ${quoteNumberField("shopRates.inspectionBaseCharge", "Inspection", heatTreatQuoteState.shopRates.inspectionBaseCharge, "0.01", "$")}
          ${quoteNumberField("shopRates.consumablesPerKg", "Consumables", heatTreatQuoteState.shopRates.consumablesPerKg, "0.01", "$/kg")}
          ${quoteNumberField("shopRates.handlingPackagingCharge", "Handling", heatTreatQuoteState.shopRates.handlingPackagingCharge, "0.01", "$")}
          ${quoteNumberField("shopRates.overheadPercent", "Overhead", heatTreatQuoteState.shopRates.overheadPercent, "0.1", "%")}
          ${quoteNumberField("shopRates.targetMarginPercent", "Margin", heatTreatQuoteState.shopRates.targetMarginPercent, "0.1", "%")}
        </div>
      </div>
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-sliders-horizontal"></i><span>4. Overrides & Adjustments</span></div>
        <div class="field-grid equipment-grid">
          ${quoteNumberField("manualOverrides.billableFurnaceHours", "Furnace Hours", heatTreatQuoteState.manualOverrides.billableFurnaceHours, "0.01", "h")}
          ${quoteNumberField("manualOverrides.billableBathQuenchHours", "Bath Hours", heatTreatQuoteState.manualOverrides.billableBathQuenchHours, "0.01", "h")}
          ${quoteNumberField("manualOverrides.billableTemperHours", "Temper Hours", heatTreatQuoteState.manualOverrides.billableTemperHours, "0.01", "h")}
          ${quoteNumberField("manualOverrides.billableLaborHours", "Labor Hours", heatTreatQuoteState.manualOverrides.billableLaborHours, "0.01", "h")}
          ${quoteNumberField("manualOverrides.billableCycleCount", "Billable Cycles", heatTreatQuoteState.manualOverrides.billableCycleCount, "1", "")}
          ${quoteNumberField("adjustments.complexityFactor", "Complexity", heatTreatQuoteState.adjustments.complexityFactor, "0.01", "x")}
          ${quoteNumberField("adjustments.scrapReworkReservePercent", "Scrap Reserve", heatTreatQuoteState.adjustments.scrapReworkReservePercent, "0.1", "%")}
          ${quoteNumberField("adjustments.expediteMultiplier", "Expedite", heatTreatQuoteState.adjustments.expediteMultiplier, "0.01", "x")}
          ${quoteNumberField("adjustments.manualAdderDiscount", "Adder / Discount", heatTreatQuoteState.adjustments.manualAdderDiscount, "0.01", "$")}
        </div>
      </div>
    </section>
    <aside class="result-pane" aria-label="Heat-treat RFQ recommendation">
      <div id="recommendation"></div>
    </aside>
  `;
}

function quoteNumberField(
  path: string,
  label: string,
  value: number | undefined,
  step: string,
  unit: string,
): string {
  const displayValue = value === undefined ? "" : formatNumber(toDisplayValue(path, value, unitSystem));
  return `
    <label class="field">
      ${fieldLabel(label)}
      <div class="input-wrap">
        <input data-quote-path="${path}" type="number" step="${step}" value="${displayValue}" />
        ${unit ? `<span data-unit-for="${path}">${unitLabelForPath(path, unitSystem, unit)}</span>` : ""}
      </div>
    </label>
  `;
}

function quoteTextField(path: string, label: string, value: string): string {
  return `
    <label class="field">
      ${fieldLabel(label)}
      <input data-quote-path="${path}" type="text" value="${escapeAttribute(value)}" />
    </label>
  `;
}

function quoteSelectField(
  path: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
): string {
  return `
    <label class="field">
      ${fieldLabel(label)}
      <select data-quote-path="${path}">
        ${options.map(([optionValue, optionLabel]) => `
          <option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>
        `).join("")}
      </select>
    </label>
  `;
}
```

- [ ] **Step 8: Add RFQ binding and source import**

Add to `src/ui/main.ts`:

```ts
function bindQuoteInputs(): void {
  bindMetadataInputs();

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-quote-path]").forEach((control) => {
    control.addEventListener("input", () => {
      const path = control.dataset.quotePath ?? "";
      const value = control instanceof HTMLInputElement && control.type === "number"
        ? parseNumericInputValue(path, control.value, unitSystem)
        : control.value;
      setHeatTreatQuoteInputValue(heatTreatQuoteState, path, value);
      if (path === "sourceMode") {
        refreshQuoteSourceSummary();
      }
      renderQuoteRecommendation();
    });
  });
}

function refreshQuoteSourceSummary(): void {
  const assumptions = quoteAssumptionsForSource(heatTreatQuoteState.sourceMode);
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    processSummary: assumptions.processLabel,
    importedProcess: assumptions,
  };
}

function quoteInputForCurrentState(): HeatTreatQuoteInput {
  const importedProcess = quoteAssumptionsForSource(heatTreatQuoteState.sourceMode);
  return {
    ...structuredClone(heatTreatQuoteState),
    processSummary: heatTreatQuoteState.sourceMode === "manual"
      ? heatTreatQuoteState.processSummary
      : importedProcess.processLabel,
    importedProcess,
  };
}

function quoteAssumptionsForSource(sourceMode: HeatTreatQuoteSourceMode): ImportedProcessAssumptions {
  switch (sourceMode) {
    case "adi":
      return quoteAssumptionsFromAdi(recommendAdiProcess(state, calibration));
    case "steel-austempering":
      return quoteAssumptionsFromSteelAustempering(recommendSteelAustemperingProcess(steelAustemperingState));
    case "martempering":
      return quoteAssumptionsFromMartempering(recommendMartemperingProcess(martemperingState));
    case "manual":
      return heatTreatQuoteState.importedProcess.sourceMode === "manual"
        ? heatTreatQuoteState.importedProcess
        : defaultHeatTreatQuoteInput().importedProcess;
  }
}
```

- [ ] **Step 9: Add RFQ recommendation rendering**

Add to `src/ui/main.ts`:

```ts
function renderQuoteRecommendation(): void {
  const recommendationPanel = document.querySelector<HTMLDivElement>("#recommendation");
  if (!recommendationPanel) {
    return;
  }

  try {
    const quoteInput = quoteInputForCurrentState();
    const result = recommendHeatTreatQuote(quoteInput);
    heatTreatQuoteState = quoteInput;
    setValidationChecklist(
      "heat-treat-rfq",
      reconcileValidationChecklist(validationChecklists["heat-treat-rfq"], result.validationChecks),
    );
    const warnings = result.warnings.length > 0
      ? result.warnings
      : ["No active quote warnings for the current input set."];

    recommendationPanel.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="eyebrow">Recommended Heat-Treat Quote</div>
          <h2>$${result.lotPrice.toFixed(2)} lot</h2>
        </div>
        <div class="summary-side">
          <span class="confidence confidence-${result.confidence}">${result.confidence}</span>
          <div class="recommendation-actions">
            <button class="icon-button" data-quote-report-action="open" type="button" title="Open printable report"><i class="ph ph-file-text"></i></button>
            <button class="icon-button" data-quote-report-action="print" type="button" title="Print report"><i class="ph ph-printer"></i></button>
            <button class="icon-button" data-quote-report-action="markdown" type="button" title="Download Markdown report"><i class="ph ph-download-simple"></i></button>
          </div>
        </div>
      </div>
      <div class="metric-strip">
        ${metric("Unit", `$${result.unitPrice.toFixed(2)}`, "per piece")}
        ${metric("Weight", result.pricePerKg === null ? "N/A" : `$${result.pricePerKg.toFixed(2)}`, "per kg")}
        ${metric("Cycles", String(result.cycleCount ?? "Manual"), "billable")}
        ${metric("Window", result.confidence, "quote")}
      </div>
      <div class="result-section">
        <div class="result-title"><i class="ph ph-list-checks"></i> Imported Assumptions</div>
        <ul class="check-list">${result.importedAssumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <div class="result-title"><i class="ph ph-calculator"></i> Cost Breakdown</div>
        <dl class="report-scores">
          <div><dt>Setup/Admin</dt><dd>$${result.breakdown.setupAdmin.toFixed(2)}</dd></div>
          <div><dt>Furnace</dt><dd>$${result.breakdown.furnace.toFixed(2)}</dd></div>
          <div><dt>Bath/Quench</dt><dd>$${result.breakdown.bathQuench.toFixed(2)}</dd></div>
          <div><dt>Temper</dt><dd>$${result.breakdown.temper.toFixed(2)}</dd></div>
          <div><dt>Labor</dt><dd>$${result.breakdown.labor.toFixed(2)}</dd></div>
          <div><dt>Overhead</dt><dd>$${result.breakdown.overhead.toFixed(2)}</dd></div>
          <div><dt>Margin</dt><dd>$${result.breakdown.margin.toFixed(2)}</dd></div>
          <div><dt>Total</dt><dd>$${result.breakdown.total.toFixed(2)}</dd></div>
        </dl>
      </div>
      <div class="result-section">
        <div class="result-title"><i class="ph ph-warning"></i> Warnings</div>
        <ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      </div>
      <div class="result-section">
        <div class="result-title"><i class="ph ph-check-square"></i> Validation Checks</div>
        ${validationChecklistRows(validationChecklists["heat-treat-rfq"])}
      </div>
    `;
    bindQuoteRecommendationActions(result);
    bindChecklistControls();
  } catch (error) {
    recommendationPanel.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-octagon"></i>
        <h2>Quote input needs correction</h2>
        <p>${error instanceof Error ? escapeHtml(error.message) : "Unable to calculate quote."}</p>
      </div>
    `;
  }
}
```

- [ ] **Step 10: Wire RFQ into active routing, save, restore, and reports**

Modify `workspaceForMode`:

```ts
case "heat-treat-rfq":
  return quoteWorkspace();
```

Modify `renderWorkspace`:

```ts
if (mode.id === "adi") {
  bindAdiInputs();
  bindHelpButtons();
  syncUnitControls();
  renderRecommendation();
} else if (mode.id === "heat-treat-rfq") {
  bindQuoteInputs();
  bindHelpButtons();
  syncUnitControls();
  renderQuoteRecommendation();
} else {
  bindSteelInputs(mode.id);
  bindHelpButtons();
  syncUnitControls();
  renderSteelRecommendation(mode.id);
}
```

Modify `renderActiveRecommendation`:

```ts
function renderActiveRecommendation(): void {
  if (activeModeId === "adi") {
    renderRecommendation();
  } else if (activeModeId === "heat-treat-rfq") {
    renderQuoteRecommendation();
  } else {
    renderSteelRecommendation(activeModeId);
  }
}
```

Modify `saveProject`:

```ts
heatTreatQuoteInput: heatTreatQuoteState,
```

Modify `restoreProject`:

```ts
heatTreatQuoteState = structuredClone(project.heatTreatQuote.input);
```

Modify report download routing:

```ts
if (activeModeId === "adi") {
  downloadCurrentMarkdownReport();
} else if (activeModeId === "heat-treat-rfq") {
  downloadCurrentQuoteMarkdownReport();
} else {
  downloadCurrentSteelMarkdownReport(activeModeId);
}
```

Add quote report functions:

```ts
function currentQuoteReportViewModel(result?: HeatTreatQuoteRecommendation): QuoteReportViewModel {
  const input = quoteInputForCurrentState();
  const recommendation = result ?? recommendHeatTreatQuote(input);
  setValidationChecklist(
    "heat-treat-rfq",
    reconcileValidationChecklist(validationChecklists["heat-treat-rfq"], recommendation.validationChecks),
  );

  return createQuoteReportViewModel({
    exportedAt: new Date().toISOString(),
    metadata: projectMetadata,
    input,
    recommendation,
  });
}

function bindQuoteRecommendationActions(result: HeatTreatQuoteRecommendation): void {
  document.querySelector<HTMLButtonElement>('[data-quote-report-action="open"]')?.addEventListener("click", () => {
    openQuoteReportDialog(result);
  });
  document.querySelector<HTMLButtonElement>('[data-quote-report-action="print"]')?.addEventListener("click", () => {
    openQuoteReportDialog(result);
    requestAnimationFrame(() => window.print());
  });
  document.querySelector<HTMLButtonElement>('[data-quote-report-action="markdown"]')?.addEventListener("click", () => {
    downloadCurrentQuoteMarkdownReport(result);
  });
}

function openQuoteReportDialog(result?: HeatTreatQuoteRecommendation): void {
  try {
    const report = currentQuoteReportViewModel(result);
    const documentEl = document.querySelector<HTMLElement>("#report-document");
    const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");
    if (!documentEl || !backdrop) {
      return;
    }
    documentEl.innerHTML = quoteReportHtml(report);
    backdrop.hidden = false;
    document.body.classList.add("is-report-open");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not create quote report.", true);
  }
}

function downloadCurrentQuoteMarkdownReport(result?: HeatTreatQuoteRecommendation): void {
  try {
    const report = currentQuoteReportViewModel(result);
    const blob = new Blob([serializeQuoteReportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = quoteReportMarkdownFilename(projectMetadata, report.exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showProjectStatus("Markdown report downloaded.");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not download quote report.", true);
  }
}

function quoteReportHtml(report: QuoteReportViewModel): string {
  const warnings = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings
    : ["No active quote warnings for the current input set."];

  return `
    <header class="report-document-header">
      <h1>${escapeHtml(report.title)}</h1>
      <dl>
        <div><dt>Generated</dt><dd>${escapeHtml(report.exportedAt)}</dd></div>
        <div><dt>Customer</dt><dd>${escapeHtml(report.metadata.customerName || "Unspecified")}</dd></div>
        <div><dt>Part</dt><dd>${escapeHtml(report.metadata.partName || "Unspecified")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(report.recommendation.processSummary)}</dd></div>
      </dl>
    </header>
    <section>
      <h2>Quote Summary</h2>
      <dl class="report-scores">
        <div><dt>Lot Price</dt><dd>$${report.recommendation.lotPrice.toFixed(2)}</dd></div>
        <div><dt>Unit Price</dt><dd>$${report.recommendation.unitPrice.toFixed(2)}</dd></div>
        <div><dt>Price per kg</dt><dd>${report.recommendation.pricePerKg === null ? "Unavailable" : `$${report.recommendation.pricePerKg.toFixed(2)}`}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(report.recommendation.confidence)}</dd></div>
      </dl>
    </section>
    <section>
      <h2>Warnings</h2>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Internal Cost Breakdown</h2>
      <dl class="report-scores">
        <div><dt>Furnace</dt><dd>$${report.recommendation.breakdown.furnace.toFixed(2)}</dd></div>
        <div><dt>Bath/Quench</dt><dd>$${report.recommendation.breakdown.bathQuench.toFixed(2)}</dd></div>
        <div><dt>Temper</dt><dd>$${report.recommendation.breakdown.temper.toFixed(2)}</dd></div>
        <div><dt>Labor</dt><dd>$${report.recommendation.breakdown.labor.toFixed(2)}</dd></div>
        <div><dt>Total</dt><dd>$${report.recommendation.breakdown.total.toFixed(2)}</dd></div>
      </dl>
    </section>
  `;
}
```

- [ ] **Step 11: Run UI-focused tests**

Run:

```bash
npm test -- test/ui-active-rendering.test.ts test/ui-units.test.ts
```

Expected: PASS.

- [ ] **Step 12: Commit UI integration**

```bash
git add src/ui/main.ts src/ui/units.ts src/ui/view-model.ts test/ui-active-rendering.test.ts test/ui-units.test.ts
git commit -m "feat: add heat-treat rfq workspace"
```

---

### Task 6: Documentation And Final Verification

**Files:**
- Create: `docs/quote-pricing-model.md`
- Modify: `docs/index.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add pricing model documentation**

Create `docs/quote-pricing-model.md`:

```md
# Heat-Treat RFQ Pricing Model

HTCalc's Heat-Treat RFQ model estimates heat-treatment service pricing from shop-specific rates entered by the user. It is a deterministic estimating aid, not an accounting system or binding commercial quote.

## Scope

The RFQ model covers heat-treatment service pricing only. It excludes raw material, machining, tooling, outside services, coating, freight, tax, and contract terms unless the estimator enters them as manual adjustments.

## Recipe Imports

The RFQ mode can import process assumptions from:

- ADI
- Steel austempering
- Martempering

Imported recipes contribute process label, nominal time windows, confidence, warnings, and validation burden hints. The RFQ mode owns price, margin, overhead, manual overrides, and customer-facing quote values.

## Pricing Method

The model calculates shop cost first:

- setup/admin
- furnace hours
- bath or quench hours
- temper hours
- labor hours
- inspection
- consumables
- handling and packaging
- scrap or rework reserve

It then applies overhead, target margin, expedite multiplier, manual adder or discount, and minimum lot charge.

## Limitations

Quote quality depends on current shop rates, accurate lot weight, realistic load capacity, inspection scope, and process validation. Imported recipe confidence affects quote confidence but does not block commercial pricing.
```

- [ ] **Step 2: Update docs index**

Modify `docs/index.md` to include:

```md
- [Heat-Treat RFQ pricing model](quote-pricing-model.md)
```

- [ ] **Step 3: Update README capabilities**

Modify `README.md` current capabilities list to include:

```md
- Heat-treatment service RFQ pricing with recipe imports, shop-specific rates, cost breakdowns, and quote reports.
```

Update the opening description to:

```md
HTCalc is a heat-treatment process recommendation and RFQ pricing workbench for engineering and estimating review.
```

- [ ] **Step 4: Update changelog**

Modify `CHANGELOG.md` under `## Unreleased`:

```md
- Added Heat-Treat RFQ pricing design and implementation for recipe-imported heat-treatment service estimates.
```

- [ ] **Step 5: Run full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected:

- `npm test`: all Vitest suites pass.
- `npm run typecheck`: exits 0.
- `npm run build`: library and UI build complete.

- [ ] **Step 6: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 7: Smoke check RFQ in browser**

Open the Vite URL and verify:

- Heat-Treat RFQ tab appears.
- Source selector can import current ADI, steel austempering, and martempering recipes.
- Quantity, weight, rates, and adjustments update quote results.
- Cost breakdown and imported assumptions are visible.
- Markdown report download works.
- Existing ADI, steel austempering, and martempering tabs still render recommendations.

- [ ] **Step 8: Stop local dev server**

Stop the dev server with `Ctrl-C`.

- [ ] **Step 9: Final git status**

Run:

```bash
git status --short
```

Expected: only intentionally untracked local reference files remain, such as `Austempered ductile iron.txt`.

- [ ] **Step 10: Commit docs and final verification updates**

```bash
git add README.md CHANGELOG.md docs/index.md docs/quote-pricing-model.md
git commit -m "docs: document heat-treat rfq pricing"
```

---

## Self-Review Notes

- Spec coverage: model math, recipe imports, visible and overridable assumptions, shop rates, project save/load, reports, warnings, confidence, tests, docs, and final verification are covered.
- Type consistency: source mode uses `manual` inside quote inputs and `heat-treat-rfq` only as the app process mode. Project-state parsing uses a quote-specific source-mode set instead of process-mode IDs.
- Scope: the plan stays within heat-treatment service pricing and avoids manufacturing, accounting, CRM, and market-pricing features.
