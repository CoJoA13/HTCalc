import type {
  HeatTreatQuoteAdjustments,
  HeatTreatQuoteInput,
  HeatTreatQuoteLot,
  HeatTreatManualOverrides,
  HeatTreatQuoteSourceMode,
  HeatTreatShopRates,
} from "../quote/index.js";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type QuoteValue = string | number | boolean | undefined;

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
  const mutableInput = input as Mutable<HeatTreatQuoteInput>;

  if (path === "sourceMode") {
    mutableInput.sourceMode = value as HeatTreatQuoteSourceMode;
    return;
  }

  if (path === "processSummary") {
    mutableInput.processSummary = String(value ?? "");
    return;
  }

  const [group, key] = path.split(".") as [string, string];

  if (group === "lot") {
    const lot = input.lot as Mutable<HeatTreatQuoteLot>;
    if (key === "quantity") {
      lot.quantity = numericValue(value);
    } else {
      assignOptionalNumber(lot, key as keyof HeatTreatQuoteLot, value);
    }
    return;
  }

  if (group === "shopRates") {
    Object.assign(input.shopRates, {
      [key as keyof HeatTreatShopRates]: numericValue(value),
    });
    return;
  }

  if (group === "manualOverrides") {
    assignOptionalNumber(
      input.manualOverrides as Mutable<HeatTreatManualOverrides>,
      key as keyof HeatTreatManualOverrides,
      value,
    );
    return;
  }

  if (group === "adjustments") {
    Object.assign(input.adjustments, {
      [key as keyof HeatTreatQuoteAdjustments]: numericValue(value),
    });
  }
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
