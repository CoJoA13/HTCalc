import { getGradeData, THRESHOLDS } from "./data.js";
import type {
  AdiModelCalibration,
  AdiProcessInput,
  AdiProcessRecommendation,
  AdiScores,
  AstmGradeData,
  CarbonPotentialRecommendation,
  TemperatureWindow,
  TimeWindow,
} from "./types.js";
import { buildWarningsAndConfidence } from "./validation.js";

const AUSTEMPER_BASE_TEMPERATURE_C = {
  1: 385,
  2: 370,
  3: 350,
  4: 325,
  5: 300,
  6: 275,
} as const satisfies Record<AstmGradeData["gradeIndex"], number>;

const COMPOSITION_FIELDS = ["C", "Si", "Mn", "Cu", "Ni", "Mo", "Cr", "Mg", "P", "S"] as const;

export const DEFAULT_ADI_MODEL_CALIBRATION: AdiModelCalibration = Object.freeze({
  alloyAustemperabilityScale: 1,
  sectionPenaltyScale: 1,
  transferPenaltyScale: 1,
  agitationPenaltyScale: 1,
  carbideSegregationScale: 1,
  temperatureAdjustmentScale: 1,
  soakTimeScale: 1,
  holdTimeScale: 1,
});

function invalidInput(fieldPath: string, requirement: string): RangeError {
  return new RangeError(`Invalid ADI input: ${fieldPath} must be ${requirement}`);
}

function assertFiniteNonNegative(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw invalidInput(fieldPath, "a finite non-negative number");
  }
}

function assertFinitePositive(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw invalidInput(fieldPath, "a finite positive number");
  }
}

function assertFinitePercent(value: number, fieldPath: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw invalidInput(fieldPath, "a finite number from 0 to 100 inclusive");
  }
}

function validateAdiProcessInput(input: AdiProcessInput): void {
  for (const field of COMPOSITION_FIELDS) {
    assertFiniteNonNegative(input.composition[field], `composition.${field}`);
  }

  assertFinitePositive(input.geometry.maxSectionMm, "geometry.maxSectionMm");
  assertFinitePositive(input.geometry.minSectionMm, "geometry.minSectionMm");
  assertFinitePositive(input.geometry.criticalSectionMm, "geometry.criticalSectionMm");

  if (input.geometry.estimatedMassKg !== undefined) {
    assertFinitePositive(input.geometry.estimatedMassKg, "geometry.estimatedMassKg");
  }

  if (input.geometry.surfaceAreaToVolumeRatio !== undefined) {
    assertFinitePositive(
      input.geometry.surfaceAreaToVolumeRatio,
      "geometry.surfaceAreaToVolumeRatio",
    );
  }

  assertFiniteNonNegative(
    input.equipment.quenchTransferTimeSec,
    "equipment.quenchTransferTimeSec",
  );
  assertFiniteNonNegative(input.equipment.bathUniformityC, "equipment.bathUniformityC");

  if (input.microstructure.noduleCountPerMm2 !== undefined) {
    assertFiniteNonNegative(
      input.microstructure.noduleCountPerMm2,
      "microstructure.noduleCountPerMm2",
    );
  }

  if (input.microstructure.nodularityPercent !== undefined) {
    assertFinitePercent(
      input.microstructure.nodularityPercent,
      "microstructure.nodularityPercent",
    );
  }
}

function resolveCalibration(calibration?: Partial<AdiModelCalibration>): AdiModelCalibration {
  const resolved = {
    ...DEFAULT_ADI_MODEL_CALIBRATION,
    ...calibration,
  };

  for (const [key, value] of Object.entries(resolved)) {
    assertFinitePositive(value, `calibration.${key}`);
  }

  return resolved;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function cToF(temperatureC: number): number {
  return round((temperatureC * 9) / 5 + 32);
}

function makeTemperatureWindow(
  nominalC: number,
  baselineRangeC: readonly [number, number],
  spreadC: number,
  lowerClampC: number,
  upperClampC: number,
): TemperatureWindow {
  const minC = clamp(Math.min(nominalC - spreadC, baselineRangeC[0]), lowerClampC, upperClampC);
  const maxC = clamp(Math.max(nominalC + spreadC, baselineRangeC[1]), lowerClampC, upperClampC);
  const clampedNominalC = clamp(nominalC, minC, maxC);

  return {
    minC: round(minC),
    nominalC: round(clampedNominalC),
    maxC: round(maxC),
    minF: cToF(minC),
    nominalF: cToF(clampedNominalC),
    maxF: cToF(maxC),
  };
}

function makeTimeWindow(
  nominalMin: number,
  baselineRangeMin: readonly [number, number],
  spreadMin: number,
  lowerClampMin: number,
  upperClampMin: number,
): TimeWindow {
  const minMin = clamp(
    Math.min(nominalMin - spreadMin, baselineRangeMin[0]),
    lowerClampMin,
    upperClampMin,
  );
  const maxMin = clamp(
    Math.max(nominalMin + spreadMin, baselineRangeMin[1]),
    lowerClampMin,
    upperClampMin,
  );
  const clampedNominalMin = clamp(nominalMin, minMin, maxMin);

  return {
    minMin: round(minMin),
    nominalMin: round(clampedNominalMin),
    maxMin: round(maxMin),
  };
}

function sectionFactor(input: AdiProcessInput): number {
  return Math.sqrt(input.geometry.criticalSectionMm / 25);
}

function calculateAustemperabilityIndex(
  input: AdiProcessInput,
  calibration: AdiModelCalibration,
): number {
  const { composition, equipment, geometry } = input;
  const agitationPenalty =
    equipment.bathAgitation === "poor" ? 0.4 : equipment.bathAgitation === "fair" ? 0.2 : 0;
  const alloyContribution =
    0.35 * composition.Ni +
    0.25 * composition.Cu +
    0.9 * composition.Mo +
    0.45 * composition.Mn +
    0.6 * composition.Cr;

  return (
    1.0 +
    alloyContribution * calibration.alloyAustemperabilityScale -
    0.04 * geometry.criticalSectionMm * calibration.sectionPenaltyScale -
    0.02 * equipment.quenchTransferTimeSec * calibration.transferPenaltyScale -
    agitationPenalty * calibration.agitationPenaltyScale
  );
}

function requiredAiForSection(sectionMm: number): number {
  return 0.25 + 0.015 * sectionMm;
}

function calculateCarbideSegregationRisk(
  input: AdiProcessInput,
  calibration: AdiModelCalibration,
): number {
  const { composition, geometry } = input;

  const risk =
    1.0 * composition.Mo +
    0.8 * composition.Mn +
    1.2 * composition.Cr +
    2.0 * composition.Mo * composition.Mn +
    2.0 * composition.Mo * composition.Cr +
    1.5 * composition.Mn * composition.Cr +
    0.01 * geometry.criticalSectionMm +
    2.0 * composition.P;

  return risk * calibration.carbideSegregationScale;
}

function calculateAtmosphereRisk(input: AdiProcessInput): 0 | 1 | 2 | 3 {
  const { atmosphereType, carbonPotentialControl, furnaceType } = input.equipment;
  const recognizedNeutralAtmosphere = [
    "endothermic-neutral",
    "nitrogen-methanol",
    "nitrogen-hydrocarbon",
    "salt",
    "vacuum",
  ].includes(atmosphereType);

  if (furnaceType === "air" || atmosphereType === "air") {
    return 3;
  }

  if (furnaceType === "controlled-atmosphere" && carbonPotentialControl && recognizedNeutralAtmosphere) {
    return 0;
  }

  if (carbonPotentialControl) {
    return 1;
  }

  return 2;
}

function calculateAustenitizeTemperatureC(
  input: AdiProcessInput,
  grade: AstmGradeData,
  calibration: AdiModelCalibration,
): number {
  const { composition, microstructure, target } = input;
  const baseTemperatureC = 925 - 12 * (grade.gradeIndex - 1);
  let adjustmentC = 0;

  adjustmentC += 10 * Math.max(0, composition.Si - 2.5);
  adjustmentC += 5 * Math.max(0, sectionFactor(input) - 1);

  if (microstructure.startingMatrix === "ferritic") {
    adjustmentC += 10;
  }

  if (microstructure.carbidesPresent) {
    adjustmentC += 15;
  }

  if (target.dimensionalGrowthSensitive) {
    adjustmentC -= 10;
  }

  return clamp(baseTemperatureC + adjustmentC * calibration.temperatureAdjustmentScale, 840, 950);
}

function calculateAustenitizeSoakMin(
  input: AdiProcessInput,
  calibration: AdiModelCalibration,
): number {
  const { composition, microstructure } = input;
  const alloyTotal =
    composition.Ni + composition.Cu + composition.Mo + composition.Mn;
  let adjustmentMin = 20 * Math.max(0, sectionFactor(input) - 1);

  if (microstructure.startingMatrix === "ferritic") {
    adjustmentMin += 20;
  }

  if (composition.Si > 3.0) {
    adjustmentMin += 15;
  }

  if (alloyTotal > 2.0) {
    adjustmentMin += 15;
  }

  if (microstructure.carbidesPresent) {
    adjustmentMin += 30;
  }

  return clamp(60 + adjustmentMin * calibration.soakTimeScale, 45, 180);
}

function calculateAustemperTemperatureC(
  input: AdiProcessInput,
  grade: AstmGradeData,
  carbideSegregationRisk: number,
): number {
  let temperatureC = AUSTEMPER_BASE_TEMPERATURE_C[grade.gradeIndex];

  if (input.target.priority === "ductility" || input.target.priority === "impact") {
    temperatureC += 10;
  }

  if (input.target.priority === "wear" || input.target.priority === "strength") {
    temperatureC -= 10;
  }

  if (carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk) {
    temperatureC += 10;
  }

  if (
    grade.gradeIndex >= 4 &&
    input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm
  ) {
    temperatureC += 5;
  }

  return clamp(temperatureC, 250, 400);
}

function calculateAustemperHoldMin(
  input: AdiProcessInput,
  austemperTemperatureC: number,
  calibration: AdiModelCalibration,
): number {
  const sectionMultiplier = Math.max(1, sectionFactor(input));
  const sectionReactionMultiplier = 1 + 0.25 * Math.max(0, sectionMultiplier - 1);
  const alloyMultiplier =
    1 +
    0.15 * input.composition.Mn +
    0.2 * input.composition.Mo +
    0.05 * input.composition.Ni +
    0.05 * input.composition.Cu;

  return (
    60 *
    Math.exp((385 - austemperTemperatureC) / 95) *
    sectionReactionMultiplier *
    alloyMultiplier *
    calibration.holdTimeScale
  );
}

function recommendCarbonPotential(austenitizeTemperatureC: number): CarbonPotentialRecommendation {
  if (austenitizeTemperatureC < 870) {
    return {
      category: "low",
      rangeCarbonEquivalentPercent: [0.8, 0.9],
      guidance:
        "Use a neutral furnace-control starting point and validate with ductile-iron coupons; this is not the ductile-iron matrix carbon level.",
    };
  }

  if (austenitizeTemperatureC <= 910) {
    return {
      category: "medium",
      rangeCarbonEquivalentPercent: [0.85, 0.95],
      guidance:
        "Use a neutral furnace-control starting point and verify no decarburized ferrite layer or carburized surface forms.",
    };
  }

  return {
    category: "high",
    rangeCarbonEquivalentPercent: [0.9, 1.05],
    guidance:
      "Use a neutral to slightly protective furnace-control starting point; calibrate with coupons and surface microhardness.",
  };
}

function roundScores(scores: AdiScores): AdiScores {
  return {
    sectionFactor: round(scores.sectionFactor, 2),
    austemperabilityIndex: round(scores.austemperabilityIndex, 2),
    requiredAustemperabilityIndex: round(scores.requiredAustemperabilityIndex, 2),
    carbideSegregationRisk: round(scores.carbideSegregationRisk, 2),
    atmosphereRisk: scores.atmosphereRisk,
  };
}

export function recommendAdiProcess(
  input: AdiProcessInput,
  calibrationInput?: Partial<AdiModelCalibration>,
): AdiProcessRecommendation {
  validateAdiProcessInput(input);
  const calibration = resolveCalibration(calibrationInput);

  const grade = getGradeData(input.target.grade);
  const carbideSegregationRisk = calculateCarbideSegregationRisk(input, calibration);
  const austenitizeTemperatureC = calculateAustenitizeTemperatureC(
    input,
    grade,
    calibration,
  );
  const austenitizeSoakMin = calculateAustenitizeSoakMin(input, calibration);
  const austemperTemperatureC = calculateAustemperTemperatureC(
    input,
    grade,
    carbideSegregationRisk,
  );
  const austemperHoldMin = calculateAustemperHoldMin(
    input,
    austemperTemperatureC,
    calibration,
  );
  const austemperHoldMax =
    austemperHoldMin *
    (carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk ? 1.3 : 1.8);
  const rawScores: AdiScores = {
    sectionFactor: sectionFactor(input),
    austemperabilityIndex: calculateAustemperabilityIndex(input, calibration),
    requiredAustemperabilityIndex: requiredAiForSection(input.geometry.criticalSectionMm),
    carbideSegregationRisk,
    atmosphereRisk: calculateAtmosphereRisk(input),
  };
  const scores = roundScores(rawScores);
  const assessment = buildWarningsAndConfidence(input, rawScores, {
    austemperHoldMin,
    austemperHoldMax,
  });

  return {
    expectedGrade: input.target.grade,
    austenitize: {
      temperature: makeTemperatureWindow(
        austenitizeTemperatureC,
        grade.austenitizeRangeC,
        15,
        840,
        950,
      ),
      soakAfterCoreAtTemp: makeTimeWindow(
        austenitizeSoakMin,
        grade.soakRangeMin,
        20,
        45,
        180,
      ),
      totalFurnaceTimeNote:
        "Total furnace time must add heat-up time until the critical section core reaches the selected austenitizing temperature.",
      carbonPotential: recommendCarbonPotential(austenitizeTemperatureC),
    },
    transfer: {
      maxRecommendedTransferTimeSec: THRESHOLDS.maxPreferredTransferTimeSec,
      actualTransferTimeSec: input.equipment.quenchTransferTimeSec,
    },
    austemper: {
      temperature: makeTemperatureWindow(
        austemperTemperatureC,
        grade.austemperRangeC,
        15,
        250,
        400,
      ),
      holdAfterCoreAtTemp: {
        minMin: round(austemperHoldMin),
        nominalMin: round((austemperHoldMin + austemperHoldMax) / 2),
        maxMin: round(austemperHoldMax),
      },
      processingWindowStatus: assessment.processingWindowStatus,
    },
    scores,
    confidence: assessment.confidence,
    warnings: assessment.warnings,
    validationChecks: assessment.validationChecks,
  };
}
