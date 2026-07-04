import type {
  AdiProcessRecommendation,
  TimeWindow as AdiTimeWindow,
} from "../adi/index.js";
import type {
  MartemperingRecommendation,
  SteelAustemperingRecommendation,
  TimeWindow as SteelTimeWindow,
} from "../steel/index.js";
import type {
  HeatTreatQuoteConfidence,
  HeatTreatTimeAssumption,
  ImportedProcessAssumptions,
} from "./types.js";

type TimeWindow = AdiTimeWindow | SteelTimeWindow;

function timeAssumption(label: string, window: TimeWindow): HeatTreatTimeAssumption {
  return {
    label,
    minMin: window.minMin,
    nominalMin: window.nominalMin,
    maxMin: window.maxMin,
    source: "imported",
  };
}

function confidence(value: "green" | "yellow" | "red"): HeatTreatQuoteConfidence {
  return value;
}

export function quoteAssumptionsFromAdi(
  recommendation: AdiProcessRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "adi",
    processLabel: `ADI ${recommendation.expectedGrade}`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Review ADI validation checklist and required metallography before quoting.",
      "Include hardness traverse or tensile testing when required by the customer specification.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Austemper hold after core reaches bath temperature",
      recommendation.austemper.holdAfterCoreAtTemp,
    ),
    temperCount: 0,
  };
}

export function quoteAssumptionsFromSteelAustempering(
  recommendation: SteelAustemperingRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "steel-austempering",
    processLabel: `Steel Austempering - ${recommendation.expectedStructure}`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Include hardenability review, final hardness traverse, and microstructure validation in quote scope.",
      "Confirm final cooling and handling requirements before sending pricing.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Austemper hold after core reaches bath temperature",
      recommendation.austemper.holdAfterCoreAtTemp,
    ),
    temperCount: 0,
  };
}

export function quoteAssumptionsFromMartempering(
  recommendation: MartemperingRecommendation,
): ImportedProcessAssumptions {
  return {
    sourceMode: "martempering",
    processLabel: `Martempering - temper to ${recommendation.temper.targetHardnessHrc} HRC`,
    processConfidence: confidence(recommendation.confidence),
    processWarnings: recommendation.warnings,
    validationBurdenHints: [
      "Include tempering validation and final hardness verification in quote scope.",
      "Confirm retained-austenite, distortion, and prompt-temper risks before sending pricing.",
    ],
    austenitizeMinutes: timeAssumption(
      "Austenitize soak after core reaches temperature",
      recommendation.austenitize.soakAfterCoreAtTemp,
    ),
    bathMinutes: timeAssumption(
      "Martemper equalization time",
      recommendation.equalize,
    ),
    temperMinutes: timeAssumption(
      "Temper hold time",
      recommendation.temper.hold,
    ),
    temperCount: recommendation.temper.temperCount,
  };
}
