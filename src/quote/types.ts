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
