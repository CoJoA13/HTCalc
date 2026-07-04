import type {
  HeatTreatQuoteInput,
  HeatTreatQuoteSourceMode,
} from "../quote/index.js";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type QuoteValue = string | number | boolean | undefined;

const validSourceModes: ReadonlySet<HeatTreatQuoteSourceMode> = new Set([
  "adi",
  "steel-austempering",
  "martempering",
  "manual",
]);

const heatTreatQuoteDefault: HeatTreatQuoteInput = {
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

export function defaultHeatTreatQuoteInput(): HeatTreatQuoteInput {
  return structuredClone(heatTreatQuoteDefault);
}

export function setHeatTreatQuoteInputValue(
  input: HeatTreatQuoteInput,
  path: string,
  value: QuoteValue,
): void {
  switch (path) {
    case "sourceMode":
      assignSourceMode(input, value);
      return;
    case "processSummary":
      (input as Mutable<HeatTreatQuoteInput>).processSummary = String(value ?? "");
      return;
    case "lot.quantity":
      (input.lot as Mutable<HeatTreatQuoteInput["lot"]>).quantity = numericValue(value);
      return;
    case "lot.pieceWeightKg":
      assignOptionalNumber(input.lot as Mutable<HeatTreatQuoteInput["lot"]>, "pieceWeightKg", value);
      return;
    case "lot.totalWeightKg":
      assignOptionalNumber(input.lot as Mutable<HeatTreatQuoteInput["lot"]>, "totalWeightKg", value);
      return;
    case "lot.loadCapacityKg":
      assignOptionalNumber(input.lot as Mutable<HeatTreatQuoteInput["lot"]>, "loadCapacityKg", value);
      return;
    case "lot.laborHoursPerLoad":
      assignOptionalNumber(input.lot as Mutable<HeatTreatQuoteInput["lot"]>, "laborHoursPerLoad", value);
      return;
    case "lot.cycleCountOverride":
      assignOptionalNumber(input.lot as Mutable<HeatTreatQuoteInput["lot"]>, "cycleCountOverride", value);
      return;
    case "shopRates.minimumLotCharge":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).minimumLotCharge = numericValue(value);
      return;
    case "shopRates.setupAdminCharge":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).setupAdminCharge = numericValue(value);
      return;
    case "shopRates.laborRatePerHour":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).laborRatePerHour = numericValue(value);
      return;
    case "shopRates.furnaceRatePerHour":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).furnaceRatePerHour = numericValue(value);
      return;
    case "shopRates.bathQuenchRatePerHour":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).bathQuenchRatePerHour = numericValue(value);
      return;
    case "shopRates.temperFurnaceRatePerHour":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).temperFurnaceRatePerHour = numericValue(value);
      return;
    case "shopRates.inspectionBaseCharge":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).inspectionBaseCharge = numericValue(value);
      return;
    case "shopRates.consumablesPerKg":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).consumablesPerKg = numericValue(value);
      return;
    case "shopRates.handlingPackagingCharge":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).handlingPackagingCharge = numericValue(value);
      return;
    case "shopRates.overheadPercent":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).overheadPercent = numericValue(value);
      return;
    case "shopRates.targetMarginPercent":
      (input.shopRates as Mutable<HeatTreatQuoteInput["shopRates"]>).targetMarginPercent = numericValue(value);
      return;
    case "manualOverrides.billableFurnaceHours":
      assignOptionalNumber(
        input.manualOverrides as Mutable<HeatTreatQuoteInput["manualOverrides"]>,
        "billableFurnaceHours",
        value,
      );
      return;
    case "manualOverrides.billableBathQuenchHours":
      assignOptionalNumber(
        input.manualOverrides as Mutable<HeatTreatQuoteInput["manualOverrides"]>,
        "billableBathQuenchHours",
        value,
      );
      return;
    case "manualOverrides.billableTemperHours":
      assignOptionalNumber(
        input.manualOverrides as Mutable<HeatTreatQuoteInput["manualOverrides"]>,
        "billableTemperHours",
        value,
      );
      return;
    case "manualOverrides.billableLaborHours":
      assignOptionalNumber(
        input.manualOverrides as Mutable<HeatTreatQuoteInput["manualOverrides"]>,
        "billableLaborHours",
        value,
      );
      return;
    case "manualOverrides.billableCycleCount":
      assignOptionalNumber(
        input.manualOverrides as Mutable<HeatTreatQuoteInput["manualOverrides"]>,
        "billableCycleCount",
        value,
      );
      return;
    case "adjustments.complexityFactor":
      (input.adjustments as Mutable<HeatTreatQuoteInput["adjustments"]>).complexityFactor = numericValue(value);
      return;
    case "adjustments.scrapReworkReservePercent":
      (input.adjustments as Mutable<HeatTreatQuoteInput["adjustments"]>).scrapReworkReservePercent = numericValue(value);
      return;
    case "adjustments.expediteMultiplier":
      (input.adjustments as Mutable<HeatTreatQuoteInput["adjustments"]>).expediteMultiplier = numericValue(value);
      return;
    case "adjustments.manualAdderDiscount":
      (input.adjustments as Mutable<HeatTreatQuoteInput["adjustments"]>).manualAdderDiscount = numericValue(value);
      return;
    default:
      throw new RangeError(`Unknown heat-treat quote input path: ${path}`);
  }
}

function assignSourceMode(input: HeatTreatQuoteInput, value: QuoteValue): void {
  if (!isHeatTreatQuoteSourceMode(value)) {
    throw new RangeError(`Unknown heat-treat quote source mode: ${String(value)}`);
  }

  (input as Mutable<HeatTreatQuoteInput>).sourceMode = value;
}

function isHeatTreatQuoteSourceMode(value: QuoteValue): value is HeatTreatQuoteSourceMode {
  return typeof value === "string" && validSourceModes.has(value as HeatTreatQuoteSourceMode);
}

function assignOptionalNumber<T extends object, K extends keyof T>(
  target: Mutable<T>,
  key: K,
  value: QuoteValue,
): void {
  if (value === undefined || value === "") {
    delete target[key];
    return;
  }

  Object.assign(target, { [key]: numericValue(value) });
}

function numericValue(value: QuoteValue): number {
  if (value === undefined) {
    return Number.NaN;
  }

  return typeof value === "number" ? value : Number(value);
}
