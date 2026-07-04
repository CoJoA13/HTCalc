import type {
  HeatTreatBillableHours,
  HeatTreatQuoteBreakdown,
  HeatTreatQuoteConfidence,
  HeatTreatQuoteInput,
  HeatTreatQuoteRecommendation,
  HeatTreatTimeAssumption,
} from "./types.js";

const quoteSourceModes = ["adi", "steel-austempering", "martempering", "manual"] as const;
const quoteConfidences = ["green", "yellow", "red"] as const;
const timeAssumptionSources = ["imported", "manual", "calculated"] as const;

function invalidQuoteInput(fieldPath: string, requirement: string): RangeError {
  return new RangeError(`Invalid heat-treat quote input: ${fieldPath} must ${requirement}`);
}

function assertEnumValue(value: unknown, fieldPath: string, allowedValues: readonly string[]): void {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw invalidQuoteInput(fieldPath, `be one of ${allowedValues.join(", ")}.`);
  }
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

function assertIntegerNonNegative(value: number, fieldPath: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw invalidQuoteInput(fieldPath, "be an integer greater than or equal to 0.");
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

  assertEnumValue(value.source, `${fieldPath}.source`, timeAssumptionSources);
  assertFiniteNonNegative(value.nominalMin, `${fieldPath}.nominalMin`);
  assertOptionalNonNegative(value.minMin, `${fieldPath}.minMin`);
  assertOptionalNonNegative(value.maxMin, `${fieldPath}.maxMin`);
}

function validateInput(input: HeatTreatQuoteInput): void {
  assertEnumValue(input.sourceMode, "sourceMode", quoteSourceModes);
  assertEnumValue(input.importedProcess.sourceMode, "importedProcess.sourceMode", quoteSourceModes);
  assertEnumValue(input.importedProcess.processConfidence, "importedProcess.processConfidence", quoteConfidences);

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
  assertIntegerNonNegative(input.importedProcess.temperCount, "importedProcess.temperCount");
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

function hasImportedTimeAssumptionWithoutManualOverride(input: HeatTreatQuoteInput): boolean {
  return (
    (input.importedProcess.austenitizeMinutes !== undefined &&
      input.manualOverrides.billableFurnaceHours === undefined) ||
    (input.importedProcess.bathMinutes !== undefined &&
      input.manualOverrides.billableBathQuenchHours === undefined) ||
    (input.importedProcess.temperMinutes !== undefined &&
      input.manualOverrides.billableTemperHours === undefined)
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
  const temperCount = input.importedProcess.temperCount;

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

  if (input.adjustments.manualAdderDiscount !== 0) {
    warnings.push("Manual adder/discount applied; review pricing before sending the quote.");
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

function dedupeLines(lines: readonly string[]): string[] {
  return lines.filter((line, index, all) => all.indexOf(line) === index);
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

function validationChecks(input: HeatTreatQuoteInput): string[] {
  return dedupeLines([
    "Confirm shop rates, burden, and margin are current.",
    "Confirm quantity, piece weight, and load capacity against the RFQ package.",
    "Confirm imported process assumptions before sending customer pricing.",
    "Confirm inspection, certification, packaging, and expedite scope.",
    ...input.importedProcess.validationBurdenHints,
  ]);
}

export function recommendHeatTreatQuote(input: HeatTreatQuoteInput): HeatTreatQuoteRecommendation {
  validateInput(input);
  const weightKg = totalWeightKg(input);
  const cycles = cycleCount(input, weightKg);

  if (cycles === null && !hasManualBillableHours(input)) {
    throw new RangeError("Invalid heat-treat quote input: lot must provide weight/load capacity or manual billable hours.");
  }

  if (cycles === null && hasImportedTimeAssumptionWithoutManualOverride(input)) {
    throw new RangeError("Invalid heat-treat quote input: lot must provide cycle basis or manual billable overrides for all imported process time assumptions.");
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
    validationChecks: validationChecks(input),
  };
}
