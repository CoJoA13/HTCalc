import {
  clamp,
  estimateAsQuenchedHardness,
  estimateSteelTransformation,
  makeTemperatureWindow,
  recommendAustenitize,
  round,
} from "./core.js";
import type {
  ConfidenceLevel,
  HardnessRange,
  ProcessingWindowStatus,
  SteelAustemperingInput,
  SteelAustemperingRecommendation,
  SteelTransformationEstimate,
} from "./types.js";

function invalidAustemperInput(fieldPath: string, requirement = "a finite non-negative number"): RangeError {
  return new RangeError(`Invalid steel austempering input: ${fieldPath} must be ${requirement}`);
}

function requestedBathTemperature(input: SteelAustemperingInput): number | undefined {
  const requested = input.austemper.bathTemperatureC;
  if (requested === undefined) {
    return undefined;
  }

  if (!Number.isFinite(requested) || requested < 0) {
    throw invalidAustemperInput("austemper.bathTemperatureC");
  }

  return requested;
}

function maxHoldMin(input: SteelAustemperingInput): number | undefined {
  const requested = input.austemper.maxHoldMin;
  if (requested === undefined) {
    return undefined;
  }

  if (!Number.isFinite(requested) || requested <= 0) {
    throw invalidAustemperInput("austemper.maxHoldMin", "a finite positive number");
  }

  return requested;
}

function defaultBathTemperatureC(
  input: SteelAustemperingInput,
  transformation: SteelTransformationEstimate,
): number {
  const lowerBound = transformation.msC + 25;
  const upperBound = transformation.bainiteStartC - 25;

  if (input.austemper.bainiteTarget === "upper") {
    return clamp(385, lowerBound, Math.min(upperBound, 430));
  }

  if (input.austemper.bainiteTarget === "lower") {
    return clamp(335, lowerBound, Math.min(upperBound, 360));
  }

  return clamp(360, lowerBound, Math.min(upperBound, 400));
}

function estimateAustemperHoldMin(
  input: SteelAustemperingInput,
  bathTemperatureC: number,
): number {
  const sectionMultiplier = Math.max(1, Math.sqrt(input.geometry.criticalSectionMm / 25));
  const alloyMultiplier =
    1 +
    0.10 * input.composition.Mn +
    0.15 * input.composition.Mo +
    0.05 * input.composition.Cr +
    0.03 * input.composition.Ni;
  const mediumMultiplier =
    input.austemper.bathMedium === "salt"
      ? 1
      : input.austemper.bathMedium === "fluidized-bed"
        ? 1.15
        : input.austemper.bathMedium === "hot-oil"
          ? 1.25
          : 1.35;

  return 45 * Math.exp((360 - bathTemperatureC) / 120) * sectionMultiplier * alloyMultiplier * mediumMultiplier;
}

function estimateAustemperedHardness(
  input: SteelAustemperingInput,
  bathTemperatureC: number,
): HardnessRange {
  const asQuenched = estimateAsQuenchedHardness(input);
  const targetOffset =
    input.austemper.bainiteTarget === "lower"
      ? 5
      : input.austemper.bainiteTarget === "upper"
        ? 10
        : 7;
  const bathSoftening = Math.max(0, bathTemperatureC - 320) * 0.08;
  const nominalHrc = clamp(asQuenched.nominalHrc - targetOffset - bathSoftening, 18, asQuenched.nominalHrc);

  return {
    minHrc: round(clamp(nominalHrc - 3, 10, 67), 1),
    nominalHrc: round(nominalHrc, 1),
    maxHrc: round(clamp(nominalHrc + 3, 10, 67), 1),
    warnings: asQuenched.warnings,
  };
}

function expectedStructure(input: SteelAustemperingInput, status: ProcessingWindowStatus): string {
  if (status === "invalid") {
    return "high-risk mixed structure";
  }

  if (input.austemper.bainiteTarget === "upper") {
    return "upper bainite";
  }

  if (input.austemper.bainiteTarget === "lower") {
    return "lower bainite";
  }

  return "mixed upper/lower bainite";
}

function baseValidationChecks(): string[] {
  return [
    "Confirm steel grade and chemistry with MTR or lab analysis.",
    "Validate hardenability with Jominy, CCT/TTT data, or representative quench trials.",
    "Verify core temperature before starting austenitize and austemper hold timing.",
    "Verify final microstructure for bainite, martensite, pearlite, retained austenite, and carbides.",
    "Confirm final hardness traverse on representative section or coupon.",
  ];
}

export function recommendSteelAustemperingProcess(
  input: SteelAustemperingInput,
): SteelAustemperingRecommendation {
  const transformation = estimateSteelTransformation(input);
  const requestedBathC = requestedBathTemperature(input);
  const bathTemperatureC = requestedBathC ?? defaultBathTemperatureC(input, transformation);
  const requestedMaxHoldMin = maxHoldMin(input);
  const warnings = [...transformation.warnings];
  let status: ProcessingWindowStatus = "robust";
  let confidence: ConfidenceLevel = "green";

  if (bathTemperatureC <= transformation.msC + 5) {
    warnings.push("Austemper bath is below estimated Ms; martensite can form before bainite transformation.");
    status = "invalid";
    confidence = "red";
  }

  if (bathTemperatureC >= transformation.bainiteStartC - 10) {
    warnings.push("Austemper bath is near or above estimated bainite start; validate transformation kinetics.");
    status = "invalid";
    confidence = "red";
  }

  if (transformation.hardenabilityScore < 1.1) {
    warnings.push("Hardenability risk: selected steel, section, or quench severity may miss the bainite window.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (input.equipment.transferTimeSec > 12) {
    warnings.push("Transfer delay risk: move from austenitize to austemper bath faster or validate pearlite avoidance.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (input.equipment.bathUniformityC > 10) {
    warnings.push("Bath uniformity risk: steel austempering needs tight bath temperature control.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (transformation.warnings.some((warning) => warning.startsWith("Atmosphere risk")) && status !== "invalid") {
    status = "narrow";
    confidence = "yellow";
  }

  const holdMin = estimateAustemperHoldMin(input, bathTemperatureC);
  const holdMax = requestedMaxHoldMin !== undefined
    ? Math.max(requestedMaxHoldMin, holdMin)
    : holdMin * 2.1;
  const expectedHardness = estimateAustemperedHardness(input, bathTemperatureC);

  return {
    mode: "steel-austempering",
    transformation,
    austenitize: recommendAustenitize(input),
    austemper: {
      temperature: makeTemperatureWindow(bathTemperatureC, 15, 0, 450),
      holdAfterCoreAtTemp: {
        minMin: round(holdMin),
        nominalMin: round((holdMin + holdMax) / 2),
        maxMin: round(holdMax),
      },
    },
    expectedStructure: expectedStructure(input, status),
    expectedHardness,
    finalCoolGuidance:
      "After bainite transformation is complete, cool in still air unless the steel or fixture requires a documented alternative.",
    confidence,
    processingWindowStatus: status,
    warnings: [...warnings, ...expectedHardness.warnings].filter((warning, index, all) =>
      all.indexOf(warning) === index
    ),
    validationChecks: baseValidationChecks(),
  };
}
