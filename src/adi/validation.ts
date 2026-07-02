import { getGradeData, THRESHOLDS } from "./data.js";
import type {
  AdiProcessInput,
  AdiScores,
  ConfidenceLevel,
  ProcessingWindowStatus,
} from "./types.js";

export interface WindowInputs {
  austemperHoldMin: number;
  austemperHoldMax: number;
}

export interface Assessment {
  warnings: string[];
  validationChecks: string[];
  confidence: ConfidenceLevel;
  processingWindowStatus: ProcessingWindowStatus;
}

export function buildWarningsAndConfidence(
  input: AdiProcessInput,
  scores: AdiScores,
  window: WindowInputs,
): Assessment {
  const warnings: string[] = [];
  let redFlag = false;
  let yellowFlag = true;

  if (scores.austemperabilityIndex < scores.requiredAustemperabilityIndex) {
    warnings.push(
      "Pearlite risk: austemperability is low for the selected critical section and transfer conditions.",
    );
    redFlag = true;
  }

  if (input.equipment.quenchTransferTimeSec > THRESHOLDS.maxPreferredTransferTimeSec) {
    warnings.push(
      "Transfer risk: quench transfer time is longer than the preferred ADI transfer window.",
    );
    yellowFlag = true;
  }

  if (scores.carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk) {
    warnings.push(
      "High carbide/segregation risk: Mn, Mo, Cr, and section effects may produce cell-boundary carbides or martensite.",
    );
    yellowFlag = true;
  }

  if (scores.carbideSegregationRisk > THRESHOLDS.extremeCarbideSegregationRisk) {
    redFlag = true;
  }

  if (input.microstructure.carbidesPresent) {
    warnings.push(
      "Starting carbide risk: existing carbides may not be fully corrected by heat treatment and require metallographic validation.",
    );
    yellowFlag = true;
  }

  const noduleCount = input.microstructure.noduleCountPerMm2;
  const nodularity = input.microstructure.nodularityPercent;
  if (
    (typeof noduleCount === "number" && noduleCount < THRESHOLDS.lowNoduleCountPerMm2) ||
    (typeof nodularity === "number" && nodularity < THRESHOLDS.poorNodularityPercent)
  ) {
    warnings.push(
      "Graphite quality risk: low nodule count or poor nodularity can make the recommendation unreliable.",
    );
    redFlag = true;
  }

  if (scores.atmosphereRisk >= 2) {
    warnings.push(
      "Atmosphere risk: air or uncontrolled atmosphere can scale or decarburize the surface.",
    );
    if (scores.atmosphereRisk === 3) {
      redFlag = true;
    }
  } else if (scores.atmosphereRisk === 1) {
    warnings.push(
      "Atmosphere validation required: carbon potential is controlled but not proven neutral for this ductile iron.",
    );
    yellowFlag = true;
  }

  if (
    input.geometry.minSectionMm < THRESHOLDS.thinSectionMm &&
    (input.target.priority === "fatigue" || scores.atmosphereRisk > 0)
  ) {
    warnings.push(
      "Thin-section surface risk: decarburization or carburization is a larger fraction of the section.",
    );
    yellowFlag = true;
  }

  const grade = getGradeData(input.target.grade);
  if (
    grade.gradeIndex >= 5 &&
    input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm
  ) {
    warnings.push(
      "High-strength heavy-section risk: grades 200-155-02 and 230-185-01 can have a narrow processing window in heavy sections.",
    );
    yellowFlag = true;
  }

  if (input.geometry.criticalSectionMm > THRESHOLDS.veryHeavySectionMm) {
    warnings.push(
      "Very heavy section: heat-transfer simulation or instrumented trial coupons are recommended.",
    );
    yellowFlag = true;
  }

  if (input.composition.Cr > 0.1 && input.target.priority !== "wear") {
    warnings.push(
      "Chromium caution: Cr increases carbide risk in conventional ADI unless a carbidic ADI wear target is intentional.",
    );
    yellowFlag = true;
  }

  if (input.composition.P > 0.05 || input.composition.S > 0.02) {
    warnings.push(
      "Residual element risk: elevated P or S cannot be fully corrected by the ADI heat treatment.",
    );
    redFlag = true;
  }

  if (
    input.equipment.bathAgitation === "poor" ||
    input.equipment.bathUniformityC > THRESHOLDS.poorBathUniformityC
  ) {
    warnings.push(
      "Bath control risk: poor agitation or wide bath uniformity can delay core cooling and transformation.",
    );
    yellowFlag = true;
  }

  const processingWindowStatus = classifyProcessingWindow(scores, window);
  if (processingWindowStatus === "invalid") {
    redFlag = true;
  }

  const confidence: ConfidenceLevel = redFlag ? "red" : yellowFlag ? "yellow" : "green";

  return {
    warnings,
    validationChecks: buildValidationChecks(input, scores),
    confidence,
    processingWindowStatus,
  };
}

function classifyProcessingWindow(
  scores: AdiScores,
  window: WindowInputs,
): ProcessingWindowStatus {
  const widthRatio = window.austemperHoldMax / window.austemperHoldMin;

  if (
    scores.carbideSegregationRisk > THRESHOLDS.extremeCarbideSegregationRisk &&
    scores.sectionFactor > Math.sqrt(THRESHOLDS.heavySectionMm / 25) &&
    widthRatio < 1.35
  ) {
    return "invalid";
  }

  if (
    scores.carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk ||
    widthRatio < 1.5
  ) {
    return "narrow";
  }

  return "robust";
}

function buildValidationChecks(
  input: AdiProcessInput,
  scores: AdiScores,
): string[] {
  const checks = [
    "Tensile test to ASTM A897.",
    "Brinell hardness test.",
    "Metallography for nodularity, nodule count, ausferrite, pearlite, martensite, carbides, and surface decarburization.",
  ];

  if (scores.atmosphereRisk > 0 || input.target.priority === "fatigue") {
    checks.push(
      "Surface hardness or microhardness traverse to verify no decarburized or carburized layer.",
    );
  }

  if (input.target.priority === "impact") {
    checks.push("Impact testing for the intended service temperature.");
  }

  if (input.target.dimensionalGrowthSensitive) {
    checks.push("Dimensional growth measurement on representative parts or coupons.");
  }

  if (input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm) {
    checks.push("Instrumented trial coupon or core-temperature verification for the critical section.");
  }

  return checks;
}
