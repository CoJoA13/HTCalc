import {
  ASTM_A897_GRADES,
  type AdiModelCalibration,
  type AdiProcessInput,
  type AdiProcessRecommendation,
} from "../adi/index.js";
import { PROCESS_MODES, type ProcessModeId } from "./process-modes.js";
import type { UnitSystem } from "./units.js";

export const HTCALC_PROJECT_VERSION = 2;
const LEGACY_PROJECT_VERSION = 1;

const validProcessModeIds: ReadonlySet<ProcessModeId> = new Set(PROCESS_MODES.map((mode) => mode.id));
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
  readonly validationChecklist: ValidationChecklistState;
  readonly pinnedComparisonBaseline: PinnedComparisonBaseline | null;
}

export interface CreateProjectStateInput {
  readonly activeModeId: ProcessModeId;
  readonly unitSystem: UnitSystem;
  readonly adiInput: AdiProcessInput;
  readonly adiCalibration: AdiModelCalibration;
  readonly metadata?: ProjectMetadata;
  readonly validationChecklist?: ValidationChecklistState;
  readonly pinnedComparisonBaseline?: PinnedComparisonBaseline | null;
  readonly exportedAt?: string;
}

export function createProjectState(input: CreateProjectStateInput): HtcalcProjectState {
  return {
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    activeModeId: input.activeModeId,
    unitSystem: input.unitSystem,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    metadata: structuredClone(input.metadata ?? defaultMetadata),
    adi: {
      input: structuredClone(input.adiInput),
      calibration: structuredClone(input.adiCalibration),
    },
    validationChecklist: structuredClone(input.validationChecklist ?? { items: [] }),
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
      validationChecklist: { items: [] },
      pinnedComparisonBaseline: null,
    };
  }

  return {
    ...base,
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    metadata: parseMetadata(parsed.metadata, "metadata"),
    validationChecklist: parseValidationChecklist(parsed.validationChecklist),
    pinnedComparisonBaseline: parsePinnedComparisonBaseline(parsed.pinnedComparisonBaseline),
  };
}

function parseBaseProject(project: Record<string, unknown>): Omit<
  HtcalcProjectState,
  "htcalcProjectVersion" | "metadata" | "validationChecklist" | "pinnedComparisonBaseline"
> {
  assertString(project.activeModeId, "activeModeId");
  assertMember(project.activeModeId, validProcessModeIds, "activeModeId");
  assertString(project.unitSystem, "unitSystem");
  assertMember(project.unitSystem, validUnitSystems, "unitSystem");
  assertString(project.exportedAt, "exportedAt");
  assertRecord(project.adi, "adi");

  return {
    activeModeId: project.activeModeId,
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

function parseValidationChecklist(value: unknown): ValidationChecklistState {
  assertRecord(value, "validationChecklist");
  assertArray(value.items, "validationChecklist.items");

  return {
    items: value.items.map((item, index) => parseChecklistItem(
      item,
      `validationChecklist.items[${index}]`,
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
