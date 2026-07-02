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
  _input: AdiProcessInput,
  _scores: AdiScores,
  window: WindowInputs,
): Assessment {
  return {
    warnings: [],
    validationChecks: [
      "Tensile test to ASTM A897.",
      "Brinell hardness test.",
      "Metallography for ausferrite, pearlite, martensite, carbides, nodularity, nodule count, and surface decarburization.",
    ],
    confidence: "yellow",
    processingWindowStatus:
      window.austemperHoldMax / window.austemperHoldMin < 1.4 ? "narrow" : "robust",
  };
}
