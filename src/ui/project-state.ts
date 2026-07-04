import {
  ASTM_A897_GRADES,
  type AdiModelCalibration,
  type AdiProcessInput,
  type AdiProcessRecommendation,
} from "../adi/index.js";
import {
  STEEL_COMPOSITION_KEYS,
  type MartemperingInput,
  type SteelAustemperingInput,
  type SteelBaseInput,
} from "../steel/index.js";
import type { HeatTreatQuoteInput } from "../quote/index.js";
import {
  PROCESS_MODES,
  type ProcessModeId,
  type ProjectProcessModeId,
} from "./process-modes.js";
import { defaultHeatTreatQuoteInput } from "./quote-state.js";
import {
  defaultMartemperingInput,
  defaultSteelAustemperingInput,
} from "./steel-state.js";
import type { UnitSystem } from "./units.js";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

export const HTCALC_PROJECT_VERSION = 4;
const LEGACY_PROJECT_VERSION = 1;
const REVIEW_PROJECT_VERSION = 2;
const STEEL_PROJECT_VERSION = 3;

const validProcessModeIds: ReadonlySet<ProjectProcessModeId> = new Set(
  PROCESS_MODES.map((mode) => mode.id),
);
const validUnitSystems: ReadonlySet<UnitSystem> = new Set(["imperial", "metric"]);
const validGrades: ReadonlySet<AdiProcessInput["target"]["grade"]> = new Set(
  ASTM_A897_GRADES.map((grade) => grade.grade),
);
const validPriorities: ReadonlySet<AdiProcessInput["target"]["priority"]> = new Set([
  "strength",
  "ductility",
  "impact",
  "wear",
  "fatigue",
  "machinability",
]);
const validStartingMatrices: ReadonlySet<AdiProcessInput["microstructure"]["startingMatrix"]> = new Set([
  "ferritic",
  "pearlitic",
  "ferritic-pearlitic",
]);
const validFurnaceTypes: ReadonlySet<AdiProcessInput["equipment"]["furnaceType"]> = new Set([
  "controlled-atmosphere",
  "air",
  "vacuum",
  "inert",
  "salt",
]);
const validAtmosphereTypes: ReadonlySet<AdiProcessInput["equipment"]["atmosphereType"]> = new Set([
  "endothermic-neutral",
  "nitrogen-methanol",
  "nitrogen-hydrocarbon",
  "vacuum",
  "inert",
  "air",
  "salt",
  "unknown",
]);
const validBathAgitations: ReadonlySet<AdiProcessInput["equipment"]["bathAgitation"]> = new Set([
  "poor",
  "fair",
  "good",
]);
const validBathTypes: ReadonlySet<AdiProcessInput["equipment"]["austemperBathType"]> = new Set([
  "salt",
  "fluidized-bed",
  "other",
]);
const validConfidenceLevels: ReadonlySet<AdiProcessRecommendation["confidence"]> = new Set([
  "green",
  "yellow",
  "red",
]);
const validProcessingStatuses: ReadonlySet<AdiProcessRecommendation["austemper"]["processingWindowStatus"]> = new Set([
  "robust",
  "narrow",
  "invalid",
]);
const validCarbonPotentialCategories: ReadonlySet<
  AdiProcessRecommendation["austenitize"]["carbonPotential"]["category"]
> = new Set([
  "low",
  "medium",
  "high",
  "equipment-calibrated",
]);
const validSteelStartingConditions: ReadonlySet<SteelBaseInput["startingCondition"]> = new Set([
  "normalized",
  "annealed",
  "spheroidized",
  "quenched-tempered",
  "hot-rolled",
  "unknown",
]);
const validSteelPriorities: ReadonlySet<SteelBaseInput["target"]["priority"]> = new Set([
  "hardness",
  "toughness",
  "distortion",
  "wear",
  "fatigue",
]);
const validSteelFurnaceTypes: ReadonlySet<SteelBaseInput["equipment"]["furnaceType"]> = new Set([
  "controlled-atmosphere",
  "air",
  "vacuum",
  "inert",
  "salt",
]);
const validSteelAtmosphereTypes: ReadonlySet<SteelBaseInput["equipment"]["atmosphereType"]> = new Set([
  "endothermic-neutral",
  "nitrogen-methanol",
  "vacuum",
  "inert",
  "air",
  "salt",
  "unknown",
]);
const validSteelQuenchMedia: ReadonlySet<SteelBaseInput["equipment"]["quenchMedium"]> = new Set([
  "water",
  "oil",
  "polymer",
  "salt",
  "hot-oil",
  "air",
  "furnace",
  "other",
]);
const validSteelAgitations: ReadonlySet<SteelBaseInput["equipment"]["agitation"]> = new Set([
  "poor",
  "fair",
  "good",
]);
const validBainiteTargets: ReadonlySet<SteelAustemperingInput["austemper"]["bainiteTarget"]> = new Set([
  "upper",
  "lower",
  "balanced",
]);
const validAustemperBathMedia: ReadonlySet<SteelAustemperingInput["austemper"]["bathMedium"]> = new Set([
  "salt",
  "hot-oil",
  "fluidized-bed",
  "furnace",
  "other",
]);
const validMartemperBathMedia: ReadonlySet<MartemperingInput["martemper"]["bathMedium"]> = new Set([
  "salt",
  "hot-oil",
  "polymer",
  "other",
]);
const validEqualizationStrategies: ReadonlySet<MartemperingInput["martemper"]["equalizationStrategy"]> = new Set([
  "section-equalized",
  "surface-equalized",
  "time-limited",
]);
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

const calibrationKeys = [
  "alloyAustemperabilityScale",
  "sectionPenaltyScale",
  "transferPenaltyScale",
  "agitationPenaltyScale",
  "carbideSegregationScale",
  "temperatureAdjustmentScale",
  "soakTimeScale",
  "holdTimeScale",
] as const satisfies readonly (keyof AdiModelCalibration)[];

const compositionKeys = [
  "C",
  "Si",
  "Mn",
  "Cu",
  "Ni",
  "Mo",
  "Cr",
  "Mg",
  "P",
  "S",
] as const satisfies readonly (keyof AdiProcessInput["composition"])[];

const defaultMetadata: ProjectMetadata = Object.freeze({
  customerName: "",
  partName: "",
  notes: "",
});

function emptyValidationChecklists(): Record<ProjectProcessModeId, ValidationChecklistState> {
  return {
    adi: { items: [] },
    "steel-austempering": { items: [] },
    martempering: { items: [] },
    "heat-treat-rfq": { items: [] },
  };
}

export interface ProjectMetadata {
  readonly customerName: string;
  readonly partName: string;
  readonly notes: string;
}

export interface ValidationChecklistItem {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly notes: string;
}

export interface ValidationChecklistState {
  readonly items: readonly ValidationChecklistItem[];
}

export type ModeValidationChecklists = Readonly<
  Record<ProcessModeId, ValidationChecklistState> &
  Partial<Record<"heat-treat-rfq", ValidationChecklistState>>
>;

export interface PinnedComparisonBaseline {
  readonly label: string;
  readonly pinnedAt: string;
  readonly input: AdiProcessInput;
  readonly calibration: AdiModelCalibration;
  readonly recommendation: AdiProcessRecommendation;
}

export interface HtcalcProjectState {
  readonly htcalcProjectVersion: typeof HTCALC_PROJECT_VERSION;
  readonly activeModeId: ProcessModeId;
  readonly unitSystem: UnitSystem;
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly adi: {
    readonly input: AdiProcessInput;
    readonly calibration: AdiModelCalibration;
  };
  readonly steelAustempering: {
    readonly input: SteelAustemperingInput;
  };
  readonly martempering: {
    readonly input: MartemperingInput;
  };
  readonly heatTreatQuote: {
    readonly input: HeatTreatQuoteInput;
  };
  readonly validationChecklists: ModeValidationChecklists;
  readonly pinnedComparisonBaseline: PinnedComparisonBaseline | null;
}

export interface CreateProjectStateInput {
  readonly activeModeId: ProjectProcessModeId;
  readonly unitSystem: UnitSystem;
  readonly adiInput: AdiProcessInput;
  readonly adiCalibration: AdiModelCalibration;
  readonly steelAustemperingInput?: SteelAustemperingInput;
  readonly martemperingInput?: MartemperingInput;
  readonly heatTreatQuoteInput?: HeatTreatQuoteInput;
  readonly metadata?: ProjectMetadata;
  readonly validationChecklist?: ValidationChecklistState;
  readonly validationChecklists?: Partial<ModeValidationChecklists>;
  readonly pinnedComparisonBaseline?: PinnedComparisonBaseline | null;
  readonly exportedAt?: string;
}

export function createProjectState(input: CreateProjectStateInput): HtcalcProjectState {
  return {
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    activeModeId: input.activeModeId as ProcessModeId,
    unitSystem: input.unitSystem,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    metadata: structuredClone(input.metadata ?? defaultMetadata),
    adi: {
      input: structuredClone(input.adiInput),
      calibration: structuredClone(input.adiCalibration),
    },
    steelAustempering: {
      input: structuredClone(input.steelAustemperingInput ?? defaultSteelAustemperingInput()),
    },
    martempering: {
      input: structuredClone(input.martemperingInput ?? defaultMartemperingInput()),
    },
    heatTreatQuote: {
      input: structuredClone(input.heatTreatQuoteInput ?? defaultHeatTreatQuoteInput()),
    },
    validationChecklists: structuredClone({
      ...emptyValidationChecklists(),
      ...input.validationChecklists,
      adi: input.validationChecklists?.adi ?? input.validationChecklist ?? { items: [] },
    }),
    pinnedComparisonBaseline: input.pinnedComparisonBaseline
      ? structuredClone(input.pinnedComparisonBaseline)
      : null,
  };
}

export function serializeProjectState(project: HtcalcProjectState): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProjectState(json: string): HtcalcProjectState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("HTCalc project file must contain valid JSON.");
  }

  assertRecord(parsed, "project");

  if (
    parsed.htcalcProjectVersion !== HTCALC_PROJECT_VERSION &&
    parsed.htcalcProjectVersion !== STEEL_PROJECT_VERSION &&
    parsed.htcalcProjectVersion !== REVIEW_PROJECT_VERSION &&
    parsed.htcalcProjectVersion !== LEGACY_PROJECT_VERSION
  ) {
    throw new Error(`Unsupported HTCalc project version: ${String(parsed.htcalcProjectVersion)}`);
  }

  const base = parseBaseProject(parsed);

  if (parsed.htcalcProjectVersion === LEGACY_PROJECT_VERSION) {
    return {
      ...base,
      htcalcProjectVersion: HTCALC_PROJECT_VERSION,
      metadata: structuredClone(defaultMetadata),
      steelAustempering: {
        input: defaultSteelAustemperingInput(),
      },
      martempering: {
        input: defaultMartemperingInput(),
      },
      heatTreatQuote: {
        input: defaultHeatTreatQuoteInput(),
      },
      validationChecklists: emptyValidationChecklists(),
      pinnedComparisonBaseline: null,
    };
  }

  if (parsed.htcalcProjectVersion === REVIEW_PROJECT_VERSION) {
    return {
      ...base,
      htcalcProjectVersion: HTCALC_PROJECT_VERSION,
      metadata: parseMetadata(parsed.metadata, "metadata"),
      steelAustempering: {
        input: defaultSteelAustemperingInput(),
      },
      martempering: {
        input: defaultMartemperingInput(),
      },
      heatTreatQuote: {
        input: defaultHeatTreatQuoteInput(),
      },
      validationChecklists: {
        ...emptyValidationChecklists(),
        adi: parseValidationChecklist(parsed.validationChecklist, "validationChecklist"),
      },
      pinnedComparisonBaseline: parsePinnedComparisonBaseline(parsed.pinnedComparisonBaseline),
    };
  }

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
      validationChecklists: parseLegacyValidationChecklists(parsed.validationChecklists),
      pinnedComparisonBaseline: parsePinnedComparisonBaseline(parsed.pinnedComparisonBaseline),
    };
  }

  return {
    ...base,
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    metadata: parseMetadata(parsed.metadata, "metadata"),
    steelAustempering: parseSteelAustemperingProject(parsed.steelAustempering),
    martempering: parseMartemperingProject(parsed.martempering),
    heatTreatQuote: parseHeatTreatQuoteProject(parsed.heatTreatQuote),
    validationChecklists: parseValidationChecklists(parsed.validationChecklists),
    pinnedComparisonBaseline: parsePinnedComparisonBaseline(parsed.pinnedComparisonBaseline),
  };
}

function parseBaseProject(project: Record<string, unknown>): Omit<
  HtcalcProjectState,
  | "htcalcProjectVersion"
  | "metadata"
  | "steelAustempering"
  | "martempering"
  | "heatTreatQuote"
  | "validationChecklists"
  | "pinnedComparisonBaseline"
> {
  assertString(project.activeModeId, "activeModeId");
  assertMember(project.activeModeId, validProcessModeIds, "activeModeId");
  assertString(project.unitSystem, "unitSystem");
  assertMember(project.unitSystem, validUnitSystems, "unitSystem");
  assertString(project.exportedAt, "exportedAt");
  assertRecord(project.adi, "adi");

  return {
    activeModeId: project.activeModeId as ProcessModeId,
    unitSystem: project.unitSystem,
    exportedAt: project.exportedAt,
    adi: {
      input: parseAdiInput(project.adi.input, "adi.input"),
      calibration: parseCalibration(project.adi.calibration, "adi.calibration"),
    },
  };
}

function parseMetadata(value: unknown, path: string): ProjectMetadata {
  assertRecord(value, path);
  assertString(value.customerName, `${path}.customerName`, true);
  assertString(value.partName, `${path}.partName`, true);
  assertString(value.notes, `${path}.notes`, true);

  return {
    customerName: value.customerName,
    partName: value.partName,
    notes: value.notes,
  };
}

function parseValidationChecklists(value: unknown): ModeValidationChecklists {
  assertRecord(value, "validationChecklists");

  return {
    adi: parseValidationChecklist(value.adi, "validationChecklists.adi"),
    "steel-austempering": parseValidationChecklist(
      value["steel-austempering"],
      "validationChecklists.steel-austempering",
    ),
    martempering: parseValidationChecklist(value.martempering, "validationChecklists.martempering"),
    "heat-treat-rfq": parseValidationChecklist(
      value["heat-treat-rfq"],
      "validationChecklists.heat-treat-rfq",
    ),
  };
}

function parseLegacyValidationChecklists(value: unknown): ModeValidationChecklists {
  assertRecord(value, "validationChecklists");

  return {
    adi: parseValidationChecklist(value.adi, "validationChecklists.adi"),
    "steel-austempering": parseValidationChecklist(
      value["steel-austempering"],
      "validationChecklists.steel-austempering",
    ),
    martempering: parseValidationChecklist(value.martempering, "validationChecklists.martempering"),
    "heat-treat-rfq": {
      items: [],
    },
  };
}

function parseValidationChecklist(value: unknown, path: string): ValidationChecklistState {
  assertRecord(value, path);
  assertArray(value.items, `${path}.items`);

  return {
    items: value.items.map((item, index) => parseChecklistItem(
      item,
      `${path}.items[${index}]`,
    )),
  };
}

function parseChecklistItem(value: unknown, path: string): ValidationChecklistItem {
  assertRecord(value, path);
  assertString(value.id, `${path}.id`);
  assertString(value.label, `${path}.label`);
  assertBoolean(value.checked, `${path}.checked`);
  assertString(value.notes, `${path}.notes`, true);

  return {
    id: value.id,
    label: value.label,
    checked: value.checked,
    notes: value.notes,
  };
}

function parsePinnedComparisonBaseline(value: unknown): PinnedComparisonBaseline | null {
  if (value === null) {
    return null;
  }

  assertRecord(value, "pinnedComparisonBaseline");
  assertString(value.label, "pinnedComparisonBaseline.label");
  assertString(value.pinnedAt, "pinnedComparisonBaseline.pinnedAt");

  return {
    label: value.label,
    pinnedAt: value.pinnedAt,
    input: parseAdiInput(value.input, "pinnedComparisonBaseline.input"),
    calibration: parseCalibration(value.calibration, "pinnedComparisonBaseline.calibration"),
    recommendation: parseRecommendation(
      value.recommendation,
      "pinnedComparisonBaseline.recommendation",
    ),
  };
}

function parseSteelAustemperingProject(value: unknown): HtcalcProjectState["steelAustempering"] {
  assertRecord(value, "steelAustempering");

  return {
    input: parseSteelAustemperingInput(value.input, "steelAustempering.input"),
  };
}

function parseMartemperingProject(value: unknown): HtcalcProjectState["martempering"] {
  assertRecord(value, "martempering");

  return {
    input: parseMartemperingInput(value.input, "martempering.input"),
  };
}

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

  return {
    sourceMode: enumValue(value.sourceMode, validQuoteSourceModes, `${path}.sourceMode`),
    processSummary: stringValue(value.processSummary, `${path}.processSummary`),
    lot: parseHeatTreatQuoteLot(value.lot, `${path}.lot`),
    importedProcess: parseImportedProcessAssumptions(
      value.importedProcess,
      `${path}.importedProcess`,
    ),
    shopRates: parseHeatTreatShopRates(value.shopRates, `${path}.shopRates`),
    manualOverrides: parseHeatTreatManualOverrides(
      value.manualOverrides,
      `${path}.manualOverrides`,
    ),
    adjustments: parseHeatTreatQuoteAdjustments(value.adjustments, `${path}.adjustments`),
  };
}

function parseHeatTreatQuoteLot(value: unknown, path: string): HeatTreatQuoteInput["lot"] {
  assertRecord(value, path);
  const lot: Mutable<HeatTreatQuoteInput["lot"]> = {
    quantity: finiteNumber(value.quantity, `${path}.quantity`, { minExclusive: 0 }),
  };

  assignOptionalFiniteNumber(lot, "pieceWeightKg", value.pieceWeightKg, `${path}.pieceWeightKg`, {
    minExclusive: 0,
  });
  assignOptionalFiniteNumber(lot, "totalWeightKg", value.totalWeightKg, `${path}.totalWeightKg`, {
    minExclusive: 0,
  });
  assignOptionalFiniteNumber(lot, "loadCapacityKg", value.loadCapacityKg, `${path}.loadCapacityKg`, {
    minExclusive: 0,
  });
  assignOptionalFiniteNumber(
    lot,
    "laborHoursPerLoad",
    value.laborHoursPerLoad,
    `${path}.laborHoursPerLoad`,
    { min: 0 },
  );
  assignOptionalFiniteNumber(
    lot,
    "cycleCountOverride",
    value.cycleCountOverride,
    `${path}.cycleCountOverride`,
    { minExclusive: 0 },
  );

  return lot;
}

function parseImportedProcessAssumptions(
  value: unknown,
  path: string,
): HeatTreatQuoteInput["importedProcess"] {
  assertRecord(value, path);
  assertStringArray(value.processWarnings, `${path}.processWarnings`);
  assertStringArray(value.validationBurdenHints, `${path}.validationBurdenHints`);
  const importedProcess: Mutable<HeatTreatQuoteInput["importedProcess"]> = {
    sourceMode: enumValue(value.sourceMode, validQuoteSourceModes, `${path}.sourceMode`),
    processLabel: stringValue(value.processLabel, `${path}.processLabel`),
    processConfidence: enumValue(
      value.processConfidence,
      validConfidenceLevels,
      `${path}.processConfidence`,
    ),
    processWarnings: value.processWarnings,
    validationBurdenHints: value.validationBurdenHints,
    temperCount: finiteNumber(value.temperCount, `${path}.temperCount`, { min: 0 }),
  };

  if (!Number.isInteger(importedProcess.temperCount)) {
    throw new Error(`HTCalc project file has invalid value at ${path}.temperCount.`);
  }

  if (value.austenitizeMinutes !== undefined) {
    importedProcess.austenitizeMinutes = parseHeatTreatTimeAssumption(
      value.austenitizeMinutes,
      `${path}.austenitizeMinutes`,
    );
  }

  if (value.bathMinutes !== undefined) {
    importedProcess.bathMinutes = parseHeatTreatTimeAssumption(
      value.bathMinutes,
      `${path}.bathMinutes`,
    );
  }

  if (value.temperMinutes !== undefined) {
    importedProcess.temperMinutes = parseHeatTreatTimeAssumption(
      value.temperMinutes,
      `${path}.temperMinutes`,
    );
  }

  return importedProcess;
}

function parseHeatTreatTimeAssumption(
  value: unknown,
  path: string,
): NonNullable<HeatTreatQuoteInput["importedProcess"]["austenitizeMinutes"]> {
  assertRecord(value, path);
  const assumption: Mutable<NonNullable<HeatTreatQuoteInput["importedProcess"]["austenitizeMinutes"]>> = {
    label: stringValue(value.label, `${path}.label`),
    nominalMin: finiteNumber(value.nominalMin, `${path}.nominalMin`, { min: 0 }),
    source: enumValue(value.source, validQuoteTimeSources, `${path}.source`),
  };

  assignOptionalFiniteNumber(assumption, "minMin", value.minMin, `${path}.minMin`, { min: 0 });
  assignOptionalFiniteNumber(assumption, "maxMin", value.maxMin, `${path}.maxMin`, { min: 0 });

  return assumption;
}

function parseHeatTreatShopRates(value: unknown, path: string): HeatTreatQuoteInput["shopRates"] {
  assertRecord(value, path);
  const targetMarginPercent = finiteNumber(
    value.targetMarginPercent,
    `${path}.targetMarginPercent`,
    { min: 0 },
  );

  if (targetMarginPercent >= 100) {
    throw new Error(`HTCalc project file has invalid value at ${path}.targetMarginPercent.`);
  }

  return {
    minimumLotCharge: finiteNumber(value.minimumLotCharge, `${path}.minimumLotCharge`, { min: 0 }),
    setupAdminCharge: finiteNumber(value.setupAdminCharge, `${path}.setupAdminCharge`, { min: 0 }),
    laborRatePerHour: finiteNumber(value.laborRatePerHour, `${path}.laborRatePerHour`, { min: 0 }),
    furnaceRatePerHour: finiteNumber(value.furnaceRatePerHour, `${path}.furnaceRatePerHour`, {
      min: 0,
    }),
    bathQuenchRatePerHour: finiteNumber(
      value.bathQuenchRatePerHour,
      `${path}.bathQuenchRatePerHour`,
      { min: 0 },
    ),
    temperFurnaceRatePerHour: finiteNumber(
      value.temperFurnaceRatePerHour,
      `${path}.temperFurnaceRatePerHour`,
      { min: 0 },
    ),
    inspectionBaseCharge: finiteNumber(value.inspectionBaseCharge, `${path}.inspectionBaseCharge`, {
      min: 0,
    }),
    consumablesPerKg: finiteNumber(value.consumablesPerKg, `${path}.consumablesPerKg`, {
      min: 0,
    }),
    handlingPackagingCharge: finiteNumber(
      value.handlingPackagingCharge,
      `${path}.handlingPackagingCharge`,
      { min: 0 },
    ),
    overheadPercent: finiteNumber(value.overheadPercent, `${path}.overheadPercent`, { min: 0 }),
    targetMarginPercent,
  };
}

function parseHeatTreatManualOverrides(
  value: unknown,
  path: string,
): HeatTreatQuoteInput["manualOverrides"] {
  assertRecord(value, path);
  const manualOverrides: Mutable<HeatTreatQuoteInput["manualOverrides"]> = {};

  assignOptionalFiniteNumber(
    manualOverrides,
    "billableFurnaceHours",
    value.billableFurnaceHours,
    `${path}.billableFurnaceHours`,
    { min: 0 },
  );
  assignOptionalFiniteNumber(
    manualOverrides,
    "billableBathQuenchHours",
    value.billableBathQuenchHours,
    `${path}.billableBathQuenchHours`,
    { min: 0 },
  );
  assignOptionalFiniteNumber(
    manualOverrides,
    "billableTemperHours",
    value.billableTemperHours,
    `${path}.billableTemperHours`,
    { min: 0 },
  );
  assignOptionalFiniteNumber(
    manualOverrides,
    "billableLaborHours",
    value.billableLaborHours,
    `${path}.billableLaborHours`,
    { min: 0 },
  );
  assignOptionalFiniteNumber(
    manualOverrides,
    "billableCycleCount",
    value.billableCycleCount,
    `${path}.billableCycleCount`,
    { minExclusive: 0 },
  );

  return manualOverrides;
}

function parseHeatTreatQuoteAdjustments(
  value: unknown,
  path: string,
): HeatTreatQuoteInput["adjustments"] {
  assertRecord(value, path);

  return {
    complexityFactor: finiteNumber(value.complexityFactor, `${path}.complexityFactor`, {
      minExclusive: 0,
    }),
    scrapReworkReservePercent: finiteNumber(
      value.scrapReworkReservePercent,
      `${path}.scrapReworkReservePercent`,
      { min: 0 },
    ),
    expediteMultiplier: finiteNumber(value.expediteMultiplier, `${path}.expediteMultiplier`, {
      minExclusive: 0,
    }),
    manualAdderDiscount: finiteNumber(value.manualAdderDiscount, `${path}.manualAdderDiscount`),
  };
}

function parseSteelAustemperingInput(value: unknown, path: string): SteelAustemperingInput {
  const base = parseSteelBaseInput(value, path);
  assertRecord(value, path);
  assertRecord(value.austemper, `${path}.austemper`);
  const austemperRecord = value.austemper;

  const austemper: SteelAustemperingInput["austemper"] = {
    bainiteTarget: enumValue(
      austemperRecord.bainiteTarget,
      validBainiteTargets,
      `${path}.austemper.bainiteTarget`,
    ),
    bathMedium: enumValue(
      austemperRecord.bathMedium,
      validAustemperBathMedia,
      `${path}.austemper.bathMedium`,
    ),
  };

  if (austemperRecord.bathTemperatureC !== undefined) {
    austemper.bathTemperatureC = finiteNumber(
      austemperRecord.bathTemperatureC,
      `${path}.austemper.bathTemperatureC`,
      { min: 0 },
    );
  }

  if (austemperRecord.maxHoldMin !== undefined) {
    austemper.maxHoldMin = finiteNumber(
      austemperRecord.maxHoldMin,
      `${path}.austemper.maxHoldMin`,
      { minExclusive: 0 },
    );
  }

  return {
    ...base,
    austemper,
  };
}

function parseMartemperingInput(value: unknown, path: string): MartemperingInput {
  const base = parseSteelBaseInput(value, path);
  assertRecord(value, path);
  assertRecord(value.martemper, `${path}.martemper`);
  const martemperRecord = value.martemper;

  const martemper: MartemperingInput["martemper"] = {
    bathMedium: enumValue(
      martemperRecord.bathMedium,
      validMartemperBathMedia,
      `${path}.martemper.bathMedium`,
    ),
    equalizationStrategy: enumValue(
      martemperRecord.equalizationStrategy,
      validEqualizationStrategies,
      `${path}.martemper.equalizationStrategy`,
    ),
    temperHoldMin: finiteNumber(
      martemperRecord.temperHoldMin,
      `${path}.martemper.temperHoldMin`,
      { minExclusive: 0 },
    ),
    temperCount: finiteNumber(
      martemperRecord.temperCount,
      `${path}.martemper.temperCount`,
      { minExclusive: 0, max: 3 },
    ),
  };

  if (!Number.isInteger(martemper.temperCount)) {
    throw new Error(`HTCalc project file has invalid value at ${path}.martemper.temperCount.`);
  }

  if (martemperRecord.bathTemperatureC !== undefined) {
    martemper.bathTemperatureC = finiteNumber(
      martemperRecord.bathTemperatureC,
      `${path}.martemper.bathTemperatureC`,
      { min: 0 },
    );
  }

  if (martemperRecord.maxEqualizationMin !== undefined) {
    martemper.maxEqualizationMin = finiteNumber(
      martemperRecord.maxEqualizationMin,
      `${path}.martemper.maxEqualizationMin`,
      { minExclusive: 0 },
    );
  }

  return {
    ...base,
    martemper,
  };
}

function parseSteelBaseInput(value: unknown, path: string): SteelBaseInput {
  assertRecord(value, path);
  assertRecord(value.composition, `${path}.composition`);
  assertRecord(value.geometry, `${path}.geometry`);
  assertRecord(value.target, `${path}.target`);
  assertRecord(value.equipment, `${path}.equipment`);
  const compositionRecord = value.composition;
  const geometryRecord = value.geometry;
  const targetRecord = value.target;
  const equipmentRecord = value.equipment;

  const composition = Object.fromEntries(
    STEEL_COMPOSITION_KEYS.map((key) => [
      key,
      finiteNumber(compositionRecord[key], `${path}.composition.${key}`, { min: 0 }),
    ]),
  ) as unknown as SteelBaseInput["composition"];

  const geometry: SteelBaseInput["geometry"] = {
    maxSectionMm: finiteNumber(geometryRecord.maxSectionMm, `${path}.geometry.maxSectionMm`, {
      minExclusive: 0,
    }),
    minSectionMm: finiteNumber(geometryRecord.minSectionMm, `${path}.geometry.minSectionMm`, {
      minExclusive: 0,
    }),
    criticalSectionMm: finiteNumber(
      geometryRecord.criticalSectionMm,
      `${path}.geometry.criticalSectionMm`,
      { minExclusive: 0 },
    ),
  };

  if (geometryRecord.estimatedMassKg !== undefined) {
    geometry.estimatedMassKg = finiteNumber(
      geometryRecord.estimatedMassKg,
      `${path}.geometry.estimatedMassKg`,
      { minExclusive: 0 },
    );
  }

  const target: SteelBaseInput["target"] = {
    priority: enumValue(targetRecord.priority, validSteelPriorities, `${path}.target.priority`),
  };

  if (targetRecord.targetHardnessHrc !== undefined) {
    target.targetHardnessHrc = finiteNumber(
      targetRecord.targetHardnessHrc,
      `${path}.target.targetHardnessHrc`,
      { min: 5, max: 70 },
    );
  }

  const furnaceType = enumValue(
    equipmentRecord.furnaceType,
    validSteelFurnaceTypes,
    `${path}.equipment.furnaceType`,
  );
  const atmosphereType = enumValue(
    equipmentRecord.atmosphereType,
    validSteelAtmosphereTypes,
    `${path}.equipment.atmosphereType`,
  );
  assertBoolean(equipmentRecord.carbonProtection, `${path}.equipment.carbonProtection`);
  const quenchMedium = enumValue(
    equipmentRecord.quenchMedium,
    validSteelQuenchMedia,
    `${path}.equipment.quenchMedium`,
  );
  const agitation = enumValue(
    equipmentRecord.agitation,
    validSteelAgitations,
    `${path}.equipment.agitation`,
  );

  return {
    composition,
    geometry,
    startingCondition: enumValue(
      value.startingCondition,
      validSteelStartingConditions,
      `${path}.startingCondition`,
    ),
    target,
    equipment: {
      furnaceType,
      atmosphereType,
      carbonProtection: equipmentRecord.carbonProtection,
      quenchMedium,
      agitation,
      transferTimeSec: finiteNumber(
        equipmentRecord.transferTimeSec,
        `${path}.equipment.transferTimeSec`,
        { min: 0 },
      ),
      bathUniformityC: finiteNumber(
        equipmentRecord.bathUniformityC,
        `${path}.equipment.bathUniformityC`,
        { min: 0 },
      ),
    },
  };
}

function parseAdiInput(value: unknown, path: string): AdiProcessInput {
  assertRecord(value, path);
  assertRecord(value.composition, `${path}.composition`);
  assertRecord(value.geometry, `${path}.geometry`);
  assertRecord(value.microstructure, `${path}.microstructure`);
  assertRecord(value.target, `${path}.target`);
  assertRecord(value.equipment, `${path}.equipment`);
  const compositionRecord = value.composition;
  const geometryRecord = value.geometry;
  const microstructureRecord = value.microstructure;
  const targetRecord = value.target;
  const equipmentRecord = value.equipment;

  const composition = Object.fromEntries(
    compositionKeys.map((key) => [
      key,
      finiteNumber(compositionRecord[key], `${path}.composition.${key}`, { min: 0 }),
    ]),
  ) as unknown as AdiProcessInput["composition"];

  const geometry: AdiProcessInput["geometry"] = {
    maxSectionMm: finiteNumber(geometryRecord.maxSectionMm, `${path}.geometry.maxSectionMm`, {
      minExclusive: 0,
    }),
    minSectionMm: finiteNumber(geometryRecord.minSectionMm, `${path}.geometry.minSectionMm`, {
      minExclusive: 0,
    }),
    criticalSectionMm: finiteNumber(
      geometryRecord.criticalSectionMm,
      `${path}.geometry.criticalSectionMm`,
      { minExclusive: 0 },
    ),
  };

  if (geometryRecord.estimatedMassKg !== undefined) {
    geometry.estimatedMassKg = finiteNumber(
      geometryRecord.estimatedMassKg,
      `${path}.geometry.estimatedMassKg`,
      { minExclusive: 0 },
    );
  }

  if (geometryRecord.surfaceAreaToVolumeRatio !== undefined) {
    geometry.surfaceAreaToVolumeRatio = finiteNumber(
      geometryRecord.surfaceAreaToVolumeRatio,
      `${path}.geometry.surfaceAreaToVolumeRatio`,
      { minExclusive: 0 },
    );
  }

  assertString(microstructureRecord.startingMatrix, `${path}.microstructure.startingMatrix`);
  const startingMatrix = enumValue(
    microstructureRecord.startingMatrix,
    validStartingMatrices,
    `${path}.microstructure.startingMatrix`,
  );
  assertBoolean(microstructureRecord.carbidesPresent, `${path}.microstructure.carbidesPresent`);

  const microstructure: AdiProcessInput["microstructure"] = {
    startingMatrix,
    carbidesPresent: microstructureRecord.carbidesPresent,
  };

  if (microstructureRecord.noduleCountPerMm2 !== undefined) {
    microstructure.noduleCountPerMm2 = finiteNumber(
      microstructureRecord.noduleCountPerMm2,
      `${path}.microstructure.noduleCountPerMm2`,
      { min: 0 },
    );
  }

  if (microstructureRecord.nodularityPercent !== undefined) {
    microstructure.nodularityPercent = finiteNumber(
      microstructureRecord.nodularityPercent,
      `${path}.microstructure.nodularityPercent`,
      { min: 0, max: 100 },
    );
  }

  if (microstructureRecord.segregationRiskKnown !== undefined) {
    assertBoolean(
      microstructureRecord.segregationRiskKnown,
      `${path}.microstructure.segregationRiskKnown`,
    );
    microstructure.segregationRiskKnown = microstructureRecord.segregationRiskKnown;
  }

  if (microstructureRecord.chillTendencyKnown !== undefined) {
    assertBoolean(
      microstructureRecord.chillTendencyKnown,
      `${path}.microstructure.chillTendencyKnown`,
    );
    microstructure.chillTendencyKnown = microstructureRecord.chillTendencyKnown;
  }

  const grade = enumValue(targetRecord.grade, validGrades, `${path}.target.grade`);
  const priority = enumValue(targetRecord.priority, validPriorities, `${path}.target.priority`);

  const target: AdiProcessInput["target"] = {
    grade,
    priority,
  };

  if (targetRecord.dimensionalGrowthSensitive !== undefined) {
    assertBoolean(
      targetRecord.dimensionalGrowthSensitive,
      `${path}.target.dimensionalGrowthSensitive`,
    );
    target.dimensionalGrowthSensitive = targetRecord.dimensionalGrowthSensitive;
  }

  const furnaceType = enumValue(
    equipmentRecord.furnaceType,
    validFurnaceTypes,
    `${path}.equipment.furnaceType`,
  );
  const atmosphereType = enumValue(
    equipmentRecord.atmosphereType,
    validAtmosphereTypes,
    `${path}.equipment.atmosphereType`,
  );
  assertBoolean(
    equipmentRecord.carbonPotentialControl,
    `${path}.equipment.carbonPotentialControl`,
  );
  const austemperBathType = enumValue(
    equipmentRecord.austemperBathType,
    validBathTypes,
    `${path}.equipment.austemperBathType`,
  );
  const bathAgitation = enumValue(
    equipmentRecord.bathAgitation,
    validBathAgitations,
    `${path}.equipment.bathAgitation`,
  );

  return {
    composition,
    geometry,
    microstructure,
    target,
    equipment: {
      furnaceType,
      atmosphereType,
      carbonPotentialControl: equipmentRecord.carbonPotentialControl,
      quenchTransferTimeSec: finiteNumber(
        equipmentRecord.quenchTransferTimeSec,
        `${path}.equipment.quenchTransferTimeSec`,
        { min: 0 },
      ),
      austemperBathType,
      bathAgitation,
      bathUniformityC: finiteNumber(
        equipmentRecord.bathUniformityC,
        `${path}.equipment.bathUniformityC`,
        { min: 0 },
      ),
    },
  };
}

function parseCalibration(value: unknown, path: string): AdiModelCalibration {
  assertRecord(value, path);

  return Object.fromEntries(
    calibrationKeys.map((key) => [
      key,
      finiteNumber(value[key], `${path}.${key}`, { minExclusive: 0 }),
    ]),
  ) as unknown as AdiModelCalibration;
}

function parseRecommendation(value: unknown, path: string): AdiProcessRecommendation {
  assertRecord(value, path);
  const expectedGrade = enumValue(value.expectedGrade, validGrades, `${path}.expectedGrade`);
  assertRecord(value.austenitize, `${path}.austenitize`);
  assertRecord(value.transfer, `${path}.transfer`);
  assertRecord(value.austemper, `${path}.austemper`);
  assertRecord(value.scores, `${path}.scores`);
  const austenitizeRecord = value.austenitize;
  const transferRecord = value.transfer;
  const austemperRecord = value.austemper;
  const scoresRecord = value.scores;
  const confidence = enumValue(value.confidence, validConfidenceLevels, `${path}.confidence`);
  assertStringArray(value.warnings, `${path}.warnings`);
  assertStringArray(value.validationChecks, `${path}.validationChecks`);

  return {
    expectedGrade,
    austenitize: {
      temperature: parseTemperatureWindow(
        austenitizeRecord.temperature,
        `${path}.austenitize.temperature`,
      ),
      soakAfterCoreAtTemp: parseTimeWindow(
        austenitizeRecord.soakAfterCoreAtTemp,
        `${path}.austenitize.soakAfterCoreAtTemp`,
      ),
      totalFurnaceTimeNote: stringValue(
        austenitizeRecord.totalFurnaceTimeNote,
        `${path}.austenitize.totalFurnaceTimeNote`,
      ),
      carbonPotential: parseCarbonPotential(
        austenitizeRecord.carbonPotential,
        `${path}.austenitize.carbonPotential`,
      ),
    },
    transfer: {
      maxRecommendedTransferTimeSec: finiteNumber(
        transferRecord.maxRecommendedTransferTimeSec,
        `${path}.transfer.maxRecommendedTransferTimeSec`,
        { min: 0 },
      ),
      actualTransferTimeSec: finiteNumber(
        transferRecord.actualTransferTimeSec,
        `${path}.transfer.actualTransferTimeSec`,
        { min: 0 },
      ),
    },
    austemper: {
      temperature: parseTemperatureWindow(austemperRecord.temperature, `${path}.austemper.temperature`),
      holdAfterCoreAtTemp: parseTimeWindow(
        austemperRecord.holdAfterCoreAtTemp,
        `${path}.austemper.holdAfterCoreAtTemp`,
      ),
      processingWindowStatus: enumValue(
        austemperRecord.processingWindowStatus,
        validProcessingStatuses,
        `${path}.austemper.processingWindowStatus`,
      ),
    },
    scores: {
      sectionFactor: finiteNumber(scoresRecord.sectionFactor, `${path}.scores.sectionFactor`),
      austemperabilityIndex: finiteNumber(
        scoresRecord.austemperabilityIndex,
        `${path}.scores.austemperabilityIndex`,
      ),
      requiredAustemperabilityIndex: finiteNumber(
        scoresRecord.requiredAustemperabilityIndex,
        `${path}.scores.requiredAustemperabilityIndex`,
      ),
      carbideSegregationRisk: finiteNumber(
        scoresRecord.carbideSegregationRisk,
        `${path}.scores.carbideSegregationRisk`,
        { min: 0 },
      ),
      atmosphereRisk: parseAtmosphereRisk(scoresRecord.atmosphereRisk, `${path}.scores.atmosphereRisk`),
    },
    confidence,
    warnings: value.warnings,
    validationChecks: value.validationChecks,
  };
}

function parseTemperatureWindow(value: unknown, path: string): AdiProcessRecommendation["austenitize"]["temperature"] {
  assertRecord(value, path);

  return {
    minC: finiteNumber(value.minC, `${path}.minC`),
    nominalC: finiteNumber(value.nominalC, `${path}.nominalC`),
    maxC: finiteNumber(value.maxC, `${path}.maxC`),
    minF: finiteNumber(value.minF, `${path}.minF`),
    nominalF: finiteNumber(value.nominalF, `${path}.nominalF`),
    maxF: finiteNumber(value.maxF, `${path}.maxF`),
  };
}

function parseTimeWindow(value: unknown, path: string): AdiProcessRecommendation["austenitize"]["soakAfterCoreAtTemp"] {
  assertRecord(value, path);

  return {
    minMin: finiteNumber(value.minMin, `${path}.minMin`, { min: 0 }),
    nominalMin: finiteNumber(value.nominalMin, `${path}.nominalMin`, { min: 0 }),
    maxMin: finiteNumber(value.maxMin, `${path}.maxMin`, { min: 0 }),
  };
}

function parseCarbonPotential(
  value: unknown,
  path: string,
): AdiProcessRecommendation["austenitize"]["carbonPotential"] {
  assertRecord(value, path);
  const category = enumValue(value.category, validCarbonPotentialCategories, `${path}.category`);
  const guidance = stringValue(value.guidance, `${path}.guidance`);

  if (value.rangeCarbonEquivalentPercent === undefined) {
    return { category, guidance };
  }

  assertTuple(value.rangeCarbonEquivalentPercent, `${path}.rangeCarbonEquivalentPercent`);

  return {
    category,
    rangeCarbonEquivalentPercent: [
      finiteNumber(value.rangeCarbonEquivalentPercent[0], `${path}.rangeCarbonEquivalentPercent[0]`, {
        min: 0,
      }),
      finiteNumber(value.rangeCarbonEquivalentPercent[1], `${path}.rangeCarbonEquivalentPercent[1]`, {
        min: 0,
      }),
    ],
    guidance,
  };
}

function parseAtmosphereRisk(value: unknown, path: string): 0 | 1 | 2 | 3 {
  if (value === 0 || value === 1 || value === 2 || value === 3) {
    return value;
  }

  throw new Error(`HTCalc project file has invalid value at ${path}.`);
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`HTCalc project file is missing required object: ${path}`);
  }
}

function assertArray(value: unknown, path: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`HTCalc project file is missing required array: ${path}`);
  }
}

function assertTuple(value: unknown, path: string): asserts value is [unknown, unknown] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`HTCalc project file is missing required numeric range: ${path}`);
  }
}

function assertString(
  value: unknown,
  path: string,
  allowEmpty = false,
): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) {
    throw new Error(`HTCalc project file is missing required string: ${path}`);
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`HTCalc project file is missing required boolean: ${path}`);
  }
}

function assertMember<T extends string>(
  value: string,
  validValues: ReadonlySet<T>,
  path: string,
): asserts value is T {
  if (!validValues.has(value as T)) {
    throw new Error(`HTCalc project file has invalid value at ${path}.`);
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  assertArray(value, path);
  value.forEach((item, index) => {
    assertString(item, `${path}[${index}]`);
  });
}

function stringValue(value: unknown, path: string): string {
  assertString(value, path, true);
  return value;
}

function enumValue<T extends string>(value: unknown, validValues: ReadonlySet<T>, path: string): T {
  assertString(value, path);
  assertMember(value, validValues, path);
  return value;
}

interface NumberOptions {
  readonly min?: number;
  readonly max?: number;
  readonly minExclusive?: number;
}

function finiteNumber(value: unknown, path: string, options: NumberOptions = {}): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`HTCalc project file is missing required finite number: ${path}`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new Error(`HTCalc project file has invalid numeric range at ${path}.`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new Error(`HTCalc project file has invalid numeric range at ${path}.`);
  }

  if (options.minExclusive !== undefined && value <= options.minExclusive) {
    throw new Error(`HTCalc project file has invalid numeric range at ${path}.`);
  }

  return value;
}

function assignOptionalFiniteNumber<T extends object, K extends keyof T>(
  target: Mutable<T>,
  key: K,
  value: unknown,
  path: string,
  options: NumberOptions = {},
): void {
  if (value === undefined) {
    return;
  }

  Object.assign(target, { [key]: finiteNumber(value, path, options) });
}
