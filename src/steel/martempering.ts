import {
  clamp,
  estimateAsQuenchedHardness,
  estimateSteelTransformation,
  makeTemperatureWindow,
  makeTimeWindow,
  recommendAustenitize,
  recommendTempering,
  round,
} from "./core.js";
import type {
  ConfidenceLevel,
  MartemperingInput,
  MartemperingRecommendation,
  ProcessingWindowStatus,
  TemperingRecommendation,
} from "./types.js";

function invalidMartemperInput(fieldPath: string, requirement = "a finite non-negative number"): RangeError {
  return new RangeError(`Invalid martempering input: ${fieldPath} must be ${requirement}`);
}

function requestedBathTemperature(input: MartemperingInput): number | undefined {
  const requested = input.martemper.bathTemperatureC;
  if (requested === undefined) {
    return undefined;
  }

  if (!Number.isFinite(requested) || requested < 0) {
    throw invalidMartemperInput("martemper.bathTemperatureC");
  }

  return requested;
}

function validateMartemperingFields(input: MartemperingInput): void {
  if (!Number.isFinite(input.martemper.temperHoldMin) || input.martemper.temperHoldMin <= 0) {
    throw invalidMartemperInput("martemper.temperHoldMin", "a finite positive number");
  }

  if (
    !Number.isInteger(input.martemper.temperCount) ||
    input.martemper.temperCount < 1 ||
    input.martemper.temperCount > 3
  ) {
    throw invalidMartemperInput("martemper.temperCount", "an integer from 1 to 3");
  }

  if (
    input.martemper.maxEqualizationMin !== undefined &&
    (!Number.isFinite(input.martemper.maxEqualizationMin) || input.martemper.maxEqualizationMin <= 0)
  ) {
    throw invalidMartemperInput("martemper.maxEqualizationMin", "a finite positive number");
  }
}

function equalizationNominalMin(input: MartemperingInput): number {
  const sectionMin =
    input.martemper.equalizationStrategy === "surface-equalized"
      ? 3 + 0.22 * input.geometry.criticalSectionMm
      : input.martemper.equalizationStrategy === "time-limited"
        ? 5 + 0.25 * input.geometry.criticalSectionMm
        : 4 + 0.42 * input.geometry.criticalSectionMm;
  const massAdjustment = input.geometry.estimatedMassKg ? Math.min(12, input.geometry.estimatedMassKg * 0.06) : 0;
  const nominal = sectionMin + massAdjustment;

  return input.martemper.maxEqualizationMin
    ? Math.min(nominal, input.martemper.maxEqualizationMin)
    : nominal;
}

function temperWithRequestedHold(
  input: MartemperingInput,
  baseTemper: TemperingRecommendation,
): TemperingRecommendation {
  return {
    ...baseTemper,
    hold: makeTimeWindow(input.martemper.temperHoldMin, 30, 30, 300),
    temperCount: input.martemper.temperCount,
  };
}

function validationChecks(): string[] {
  return [
    "Confirm steel grade and chemistry with MTR or lab analysis.",
    "Validate hardenability with Jominy, CCT/TTT data, or representative quench trials.",
    "Confirm martemper bath is above estimated Ms with calibrated instrumentation.",
    "Temper martempered parts promptly after final cooling unless a documented exception applies.",
    "Verify final hardness traverse and microstructure for martensite, retained austenite, bainite, pearlite, and carbides.",
  ];
}

export function recommendMartemperingProcess(input: MartemperingInput): MartemperingRecommendation {
  validateMartemperingFields(input);
  const transformation = estimateSteelTransformation(input);
  const requestedBathC = requestedBathTemperature(input);
  const bathTemperatureC = requestedBathC ?? clamp(transformation.msC + 20, 120, 360);
  const warnings = [...transformation.warnings];
  let status: ProcessingWindowStatus = "robust";
  let confidence: ConfidenceLevel = "green";

  if (bathTemperatureC <= transformation.msC + 5) {
    warnings.push("Martemper bath must be above estimated Ms before equalization; requested bath is too low.");
    status = "invalid";
    confidence = "red";
  }

  if (bathTemperatureC > transformation.msC + 55) {
    warnings.push("Martemper bath is far above estimated Ms; validate equalization time does not enter bainite or pearlite transformation.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (transformation.hardenabilityScore < 1.05) {
    warnings.push("Hardenability risk: selected steel, section, or quench severity may not through-harden before final cooling.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (input.equipment.transferTimeSec > 12) {
    warnings.push("Transfer delay risk: reduce transfer time from austenitize to interrupted quench bath.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  if (input.composition.C > 0.75 || transformation.retainedAusteniteRisk > 1) {
    warnings.push("Retained austenite risk: high carbon or alloy content requires hardness and metallographic validation.");
    if (status !== "invalid") {
      status = "narrow";
      confidence = "yellow";
    }
  }

  const asQuenchedHardness = estimateAsQuenchedHardness(input);
  const temper = temperWithRequestedHold(input, recommendTempering(input, asQuenchedHardness));
  const equalizeNominalMin = equalizationNominalMin(input);

  return {
    mode: "martempering",
    transformation,
    austenitize: recommendAustenitize(input),
    martemper: {
      temperature: makeTemperatureWindow(bathTemperatureC, 10, 80, 420),
    },
    equalize: {
      minMin: round(Math.max(3, equalizeNominalMin - 5)),
      nominalMin: round(equalizeNominalMin),
      maxMin: round(input.martemper.maxEqualizationMin ?? equalizeNominalMin + 10),
    },
    finalCoolGuidance:
      "After section equalization, remove from the bath and cool through martensite formation, then temper promptly.",
    asQuenchedHardness,
    temper,
    confidence,
    processingWindowStatus: status,
    warnings: [...warnings, ...asQuenchedHardness.warnings, ...temper.warnings].filter((warning, index, all) =>
      all.indexOf(warning) === index
    ),
    validationChecks: validationChecks(),
  };
}
