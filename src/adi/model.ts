import { getGradeData, THRESHOLDS } from "./data.js";
import type {
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

function calculateAustemperabilityIndex(input: AdiProcessInput): number {
  const { composition, equipment, geometry } = input;
  const agitationPenalty =
    equipment.bathAgitation === "poor" ? 0.4 : equipment.bathAgitation === "fair" ? 0.2 : 0;

  return (
    1.0 +
    0.35 * composition.Ni +
    0.25 * composition.Cu +
    0.9 * composition.Mo +
    0.45 * composition.Mn +
    0.6 * composition.Cr -
    0.04 * geometry.criticalSectionMm -
    0.02 * equipment.quenchTransferTimeSec -
    agitationPenalty
  );
}

function requiredAiForSection(sectionMm: number): number {
  return 0.25 + 0.015 * sectionMm;
}

function calculateCarbideSegregationRisk(input: AdiProcessInput): number {
  const { composition, geometry } = input;

  return (
    1.0 * composition.Mo +
    0.8 * composition.Mn +
    1.2 * composition.Cr +
    2.0 * composition.Mo * composition.Mn +
    2.0 * composition.Mo * composition.Cr +
    1.5 * composition.Mn * composition.Cr +
    0.01 * geometry.criticalSectionMm +
    2.0 * composition.P
  );
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
): number {
  const { composition, microstructure, target } = input;
  let temperatureC = 925 - 12 * (grade.gradeIndex - 1);

  temperatureC += 10 * Math.max(0, composition.Si - 2.5);
  temperatureC += 5 * Math.max(0, sectionFactor(input) - 1);

  if (microstructure.startingMatrix === "ferritic") {
    temperatureC += 10;
  }

  if (microstructure.carbidesPresent) {
    temperatureC += 15;
  }

  if (target.dimensionalGrowthSensitive) {
    temperatureC -= 10;
  }

  return clamp(temperatureC, 840, 950);
}

function calculateAustenitizeSoakMin(input: AdiProcessInput): number {
  const { composition, microstructure } = input;
  const alloyTotal =
    composition.Ni + composition.Cu + composition.Mo + composition.Mn;
  let soakMin = 60 + 20 * Math.max(0, sectionFactor(input) - 1);

  if (microstructure.startingMatrix === "ferritic") {
    soakMin += 20;
  }

  if (composition.Si > 3.0) {
    soakMin += 15;
  }

  if (alloyTotal > 2.0) {
    soakMin += 15;
  }

  if (microstructure.carbidesPresent) {
    soakMin += 30;
  }

  return clamp(soakMin, 45, 180);
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
    alloyMultiplier
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

export function recommendAdiProcess(input: AdiProcessInput): AdiProcessRecommendation {
  validateAdiProcessInput(input);

  const grade = getGradeData(input.target.grade);
  const carbideSegregationRisk = calculateCarbideSegregationRisk(input);
  const austenitizeTemperatureC = calculateAustenitizeTemperatureC(
    input,
    grade,
  );
  const austenitizeSoakMin = calculateAustenitizeSoakMin(input);
  const austemperTemperatureC = calculateAustemperTemperatureC(
    input,
    grade,
    carbideSegregationRisk,
  );
  const austemperHoldMin = calculateAustemperHoldMin(
    input,
    austemperTemperatureC,
  );
  const austemperHoldMax =
    austemperHoldMin *
    (carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk ? 1.3 : 1.8);
  const scores = roundScores({
    sectionFactor: sectionFactor(input),
    austemperabilityIndex: calculateAustemperabilityIndex(input),
    requiredAustemperabilityIndex: requiredAiForSection(input.geometry.criticalSectionMm),
    carbideSegregationRisk,
    atmosphereRisk: calculateAtmosphereRisk(input),
  });
  const assessment = buildWarningsAndConfidence(input, scores, {
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
