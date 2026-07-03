import type {
  HardnessRange,
  SteelBaseInput,
  SteelComposition,
  SteelTransformationEstimate,
  TemperingRecommendation,
  TemperatureWindow,
  TimeWindow,
} from "./types.js";

export const STEEL_COMPOSITION_KEYS = [
  "C",
  "Mn",
  "Si",
  "Ni",
  "Cr",
  "Mo",
  "V",
  "Cu",
  "B",
] as const satisfies readonly (keyof SteelComposition)[];

function invalidInput(fieldPath: string, requirement: string): RangeError {
  return new RangeError(`Invalid steel input: ${fieldPath} must be ${requirement}`);
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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function cToF(temperatureC: number): number {
  return round((temperatureC * 9) / 5 + 32);
}

export function makeTemperatureWindow(
  nominalC: number,
  spreadC: number,
  lowerClampC: number,
  upperClampC: number,
): TemperatureWindow {
  const minC = clamp(nominalC - spreadC, lowerClampC, upperClampC);
  const maxC = clamp(nominalC + spreadC, lowerClampC, upperClampC);
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

export function makeTimeWindow(
  nominalMin: number,
  spreadMin: number,
  lowerClampMin: number,
  upperClampMin: number,
): TimeWindow {
  const minMin = clamp(nominalMin - spreadMin, lowerClampMin, upperClampMin);
  const maxMin = clamp(nominalMin + spreadMin, lowerClampMin, upperClampMin);
  const clampedNominalMin = clamp(nominalMin, minMin, maxMin);

  return {
    minMin: round(minMin),
    nominalMin: round(clampedNominalMin),
    maxMin: round(maxMin),
  };
}

export function validateSteelInput(input: SteelBaseInput): void {
  for (const field of STEEL_COMPOSITION_KEYS) {
    assertFiniteNonNegative(input.composition[field], `composition.${field}`);
  }

  assertFinitePositive(input.geometry.maxSectionMm, "geometry.maxSectionMm");
  assertFinitePositive(input.geometry.minSectionMm, "geometry.minSectionMm");
  assertFinitePositive(input.geometry.criticalSectionMm, "geometry.criticalSectionMm");

  if (input.geometry.estimatedMassKg !== undefined) {
    assertFinitePositive(input.geometry.estimatedMassKg, "geometry.estimatedMassKg");
  }

  if (input.target.targetHardnessHrc !== undefined) {
    const hardness = input.target.targetHardnessHrc;
    if (!Number.isFinite(hardness) || hardness < 5 || hardness > 70) {
      throw invalidInput("target.targetHardnessHrc", "a finite HRC value from 5 to 70");
    }
  }

  assertFiniteNonNegative(input.equipment.transferTimeSec, "equipment.transferTimeSec");
  assertFiniteNonNegative(input.equipment.bathUniformityC, "equipment.bathUniformityC");
}

export function sectionSeverity(input: SteelBaseInput): number {
  return Math.sqrt(input.geometry.criticalSectionMm / 25);
}

export function estimateRetainedAusteniteRisk(input: SteelBaseInput): number {
  const { C, Ni, Mn, Cr } = input.composition;
  const carbonRisk = Math.max(0, C - 0.65) * 4.5;
  const alloyRisk = 0.10 * Ni + 0.08 * Mn + 0.05 * Cr;

  return round(clamp(carbonRisk + alloyRisk, 0, 3), 2);
}

export function estimateHardenabilityScore(input: SteelBaseInput): number {
  validateSteelInput(input);
  const { composition, equipment } = input;
  const quenchSeverity = {
    water: 1.25,
    oil: 0.9,
    polymer: 0.95,
    salt: 0.8,
    "hot-oil": 0.72,
    air: 0.2,
    furnace: 0.1,
    other: 0.5,
  }[equipment.quenchMedium];
  const agitationPenalty =
    equipment.agitation === "poor" ? 0.25 : equipment.agitation === "fair" ? 0.1 : 0;
  const boronEffect =
    composition.B >= 0.0003 && composition.B <= 0.003
      ? 0.55
      : composition.B > 0.003
        ? 0.2
        : 0;
  const alloyContribution =
    0.5 * composition.Mn +
    0.3 * composition.Si +
    0.65 * composition.Ni +
    1.1 * composition.Cr +
    1.5 * composition.Mo +
    1.2 * composition.V +
    0.35 * composition.Cu +
    boronEffect;
  const uniformityPenalty = Math.max(0, equipment.bathUniformityC - 10) * 0.01;

  return round(
    clamp(
      0.75 +
        0.45 * composition.C +
        0.25 * alloyContribution +
        quenchSeverity -
        0.35 * sectionSeverity(input) -
        0.015 * equipment.transferTimeSec -
        agitationPenalty -
        uniformityPenalty,
      0,
      4,
    ),
    2,
  );
}

export function estimateSteelTransformation(input: SteelBaseInput): SteelTransformationEstimate {
  validateSteelInput(input);
  const { C, Mn, Si, Ni, Cr, Mo } = input.composition;
  const boundedCarbon = clamp(C, 0.02, 1.2);
  const rawAc1 = 723 - 10.7 * Mn - 16.9 * Ni + 29.1 * Si + 16.9 * Cr + 6.4 * Mo;
  const ac1C = clamp(rawAc1, 680, 780);
  const rawAc3 =
    910 -
    203 * Math.sqrt(boundedCarbon) +
    44.7 * Si -
    30 * Mn -
    15 * Ni -
    11 * Cr +
    31.5 * Mo;
  const ac3C = clamp(Math.max(rawAc3, ac1C + 25), ac1C + 25, 950);
  const rawMs = 539 - 423 * C - 30.4 * Mn - 17.7 * Ni - 12.1 * Cr - 7.5 * Mo - 7.5 * Si;
  const msC = clamp(rawMs, 80, 500);
  const rawBainiteStart = 830 - 270 * C - 90 * Mn - 37 * Ni - 70 * Cr - 83 * Mo;
  const bainiteStartC = clamp(rawBainiteStart, msC + 40, 650);
  const hardenabilityScore = estimateHardenabilityScore(input);
  const retainedAusteniteRisk = estimateRetainedAusteniteRisk(input);
  const warnings: string[] = [];

  if (input.composition.C < 0.25) {
    warnings.push("Low carbon steel may not reach meaningful through-hardening response.");
  }

  if (input.composition.C > 0.75) {
    warnings.push("High carbon increases retained austenite and cracking risk; validate with metallography.");
  }

  if (hardenabilityScore < 1) {
    warnings.push("Hardenability risk: section size, alloy content, or quench severity may not support full transformation.");
  }

  if (input.equipment.furnaceType === "air" || input.equipment.atmosphereType === "air") {
    warnings.push("Atmosphere risk: air austenitizing can decarburize steel surfaces.");
  }

  return {
    ac1C: round(ac1C),
    ac3C: round(ac3C),
    msC: round(msC),
    bainiteStartC: round(bainiteStartC),
    hardenabilityScore,
    sectionSeverity: round(sectionSeverity(input), 2),
    retainedAusteniteRisk,
    warnings,
  };
}

export function estimateAsQuenchedHardness(input: SteelBaseInput): HardnessRange {
  const transformation = estimateSteelTransformation(input);
  const carbonLimitedHrc = clamp(
    20 + 95 * input.composition.C - 30 * input.composition.C * input.composition.C,
    18,
    67,
  );
  const hardenabilityPenalty = Math.max(0, 1.15 - transformation.hardenabilityScore) * 10;
  const heavySectionPenalty = Math.max(0, input.geometry.criticalSectionMm - 50) * 0.05;
  const retainedAustenitePenalty = transformation.retainedAusteniteRisk * 3;
  const nominalHrc = clamp(
    carbonLimitedHrc - hardenabilityPenalty - heavySectionPenalty - retainedAustenitePenalty,
    10,
    67,
  );
  const spread = 2 + Math.max(0, 1.15 - transformation.hardenabilityScore) * 2;
  const warnings = [...transformation.warnings];

  if (input.equipment.quenchMedium === "air" || input.equipment.quenchMedium === "furnace") {
    warnings.push("Quench severity risk: selected medium is unlikely to produce maximum as-quenched hardness.");
  }

  if (input.geometry.criticalSectionMm > 75) {
    warnings.push("Heavy-section hardness requires Jominy, CCT/TTT, or representative coupon validation.");
  }

  return {
    minHrc: round(clamp(nominalHrc - spread, 5, 67), 1),
    nominalHrc: round(nominalHrc, 1),
    maxHrc: round(clamp(nominalHrc + spread, 5, 67), 1),
    warnings,
  };
}

export function recommendAustenitize(input: SteelBaseInput): {
  temperature: TemperatureWindow;
  soakAfterCoreAtTemp: TimeWindow;
  atmosphereGuidance: string;
} {
  const transformation = estimateSteelTransformation(input);
  const carbon = input.composition.C;
  const baseTemperatureC = carbon > 0.77
    ? transformation.ac1C + 55
    : transformation.ac3C + 45;
  const startingConditionOffset =
    input.startingCondition === "spheroidized" ? 15 : input.startingCondition === "annealed" ? 10 : 0;
  const temperature = makeTemperatureWindow(
    clamp(baseTemperatureC + startingConditionOffset, 760, 930),
    15,
    730,
    950,
  );
  const soakBase = 35 + 1.1 * input.geometry.criticalSectionMm;
  const alloySoak =
    6 * (input.composition.Cr + input.composition.Mo + input.composition.V) +
    (input.startingCondition === "spheroidized" ? 20 : 0);
  const atmosphereGuidance = input.equipment.carbonProtection
    ? "Maintain neutral carbon protection and verify with coupons or surface hardness traverse."
    : "Add carbon protection or validate decarburization risk with coupons and surface hardness traverse.";

  return {
    temperature,
    soakAfterCoreAtTemp: makeTimeWindow(soakBase + alloySoak, 20, 30, 180),
    atmosphereGuidance,
  };
}

export function recommendTempering(
  input: SteelBaseInput,
  asQuenched: HardnessRange,
): TemperingRecommendation {
  validateSteelInput(input);
  const defaultDrop =
    input.target.priority === "toughness" || input.target.priority === "distortion" ? 8 : 5;
  const targetHardnessHrc = clamp(
    input.target.targetHardnessHrc ?? asQuenched.nominalHrc - defaultDrop,
    5,
    Math.max(5, asQuenched.nominalHrc - 1),
  );
  const hardnessDrop = Math.max(0, asQuenched.nominalHrc - targetHardnessHrc);
  const alloyResistance =
    8 * input.composition.Cr + 18 * input.composition.Mo + 18 * input.composition.V;
  const nominalTemperatureC = clamp(150 + 21 * hardnessDrop + alloyResistance, 150, 650);
  const temperCount =
    input.composition.C > 0.75 ||
    input.composition.Cr + input.composition.Mo + input.composition.V > 2.5
      ? 2
      : 1;
  const warnings: string[] = [];

  if (input.target.targetHardnessHrc !== undefined && input.target.targetHardnessHrc >= asQuenched.nominalHrc) {
    warnings.push("Target hardness is at or above estimated as-quenched hardness; validate target feasibility.");
  }

  if (nominalTemperatureC >= 230 && nominalTemperatureC <= 315) {
    warnings.push("Tempering embrittlement caution: validate toughness before using this temperature band.");
  }

  if (nominalTemperatureC >= 375 && nominalTemperatureC <= 575) {
    warnings.push("Temper embrittlement caution: alloy steels can need cooling-rate and chemistry controls in this band.");
  }

  return {
    temperature: makeTemperatureWindow(nominalTemperatureC, 15, 150, 650),
    hold: makeTimeWindow(120, 60, 60, 240),
    targetHardnessHrc: round(targetHardnessHrc, 1),
    temperCount,
    warnings,
  };
}
