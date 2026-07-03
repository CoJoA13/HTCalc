import type {
  AdiModelCalibration,
  AdiProcessInput,
  AdiProcessRecommendation,
  TemperatureWindow,
} from "../adi/index.js";
import type { PinnedComparisonBaseline } from "./project-state.js";
import type { UnitSystem } from "./units.js";

export interface CreatePinnedComparisonBaselineInput {
  readonly input: AdiProcessInput;
  readonly calibration: AdiModelCalibration;
  readonly recommendation: AdiProcessRecommendation;
  readonly label?: string;
  readonly pinnedAt?: string;
}

export interface ComparisonRow {
  readonly label: string;
  readonly baselineValue: string;
  readonly currentValue: string;
  readonly delta: string;
}

export interface ComparisonViewModel {
  readonly label: string;
  readonly pinnedAt: string;
  readonly summary: readonly string[];
  readonly rows: readonly ComparisonRow[];
}

export function createPinnedComparisonBaseline(
  input: CreatePinnedComparisonBaselineInput,
): PinnedComparisonBaseline {
  return {
    label: input.label ?? "Pinned baseline",
    pinnedAt: input.pinnedAt ?? new Date().toISOString(),
    input: structuredClone(input.input),
    calibration: structuredClone(input.calibration),
    recommendation: structuredClone(input.recommendation),
  };
}

export function compareToBaseline(
  baseline: PinnedComparisonBaseline,
  current: AdiProcessRecommendation,
  unitSystem: UnitSystem = "metric",
): ComparisonViewModel {
  const pinned = baseline.recommendation;
  const warningDelta = current.warnings.length - pinned.warnings.length;
  const summary = [
    ...(pinned.confidence !== current.confidence
      ? [`Confidence ${pinned.confidence} -> ${current.confidence}`]
      : []),
    ...(warningDelta !== 0 ? [`Warnings ${signedInteger(warningDelta)}`] : []),
  ];

  return {
    label: baseline.label,
    pinnedAt: baseline.pinnedAt,
    summary,
    rows: [
      textRow("Grade", pinned.expectedGrade, current.expectedGrade),
      textRow("Confidence", pinned.confidence, current.confidence),
      temperatureRow(
        "Austenitize nominal",
        pinned.austenitize.temperature,
        current.austenitize.temperature,
        unitSystem,
      ),
      temperatureRow(
        "Austemper nominal",
        pinned.austemper.temperature,
        current.austemper.temperature,
        unitSystem,
      ),
      rangeRow(
        "Hold range",
        pinned.austemper.holdAfterCoreAtTemp.minMin,
        pinned.austemper.holdAfterCoreAtTemp.maxMin,
        current.austemper.holdAfterCoreAtTemp.minMin,
        current.austemper.holdAfterCoreAtTemp.maxMin,
      ),
      numberRow(
        "AI",
        pinned.scores.austemperabilityIndex,
        current.scores.austemperabilityIndex,
        "",
        2,
      ),
      numberRow(
        "CSR",
        pinned.scores.carbideSegregationRisk,
        current.scores.carbideSegregationRisk,
        "",
        2,
      ),
      numberRow(
        "Transfer time",
        pinned.transfer.actualTransferTimeSec,
        current.transfer.actualTransferTimeSec,
        "s",
      ),
      numberRow("Warning count", pinned.warnings.length, current.warnings.length),
    ],
  };
}

export function formatNumericDelta(
  current: number,
  baseline: number,
  unit = "",
  precision = 0,
): string {
  const delta = current - baseline;
  const prefix = delta > 0 ? "+" : "";
  const suffix = unit ? ` ${unit}` : "";

  return `${prefix}${delta.toFixed(precision)}${suffix}`;
}

function textRow(label: string, baselineValue: string, currentValue: string): ComparisonRow {
  return {
    label,
    baselineValue,
    currentValue,
    delta: baselineValue === currentValue ? "unchanged" : "changed",
  };
}

function numberRow(
  label: string,
  baseline: number,
  current: number,
  unit = "",
  precision = 0,
): ComparisonRow {
  return {
    label,
    baselineValue: formatNumericValue(baseline, unit, precision),
    currentValue: formatNumericValue(current, unit, precision),
    delta: formatNumericDelta(current, baseline, unit, precision),
  };
}

function temperatureRow(
  label: string,
  baseline: TemperatureWindow,
  current: TemperatureWindow,
  unitSystem: UnitSystem,
): ComparisonRow {
  return unitSystem === "imperial"
    ? numberRow(label, baseline.nominalF, current.nominalF, "°F")
    : numberRow(label, baseline.nominalC, current.nominalC, "°C");
}

function rangeRow(
  label: string,
  baselineMin: number,
  baselineMax: number,
  currentMin: number,
  currentMax: number,
): ComparisonRow {
  return {
    label,
    baselineValue: `${baselineMin}-${baselineMax} min`,
    currentValue: `${currentMin}-${currentMax} min`,
    delta: `${formatNumericDelta(currentMin, baselineMin)} / ${formatNumericDelta(currentMax, baselineMax)} min`,
  };
}

function formatNumericValue(value: number, unit = "", precision = 0): string {
  const suffix = unit ? ` ${unit}` : "";
  return `${value.toFixed(precision)}${suffix}`;
}

function signedInteger(value: number): string {
  return `${value > 0 ? "+" : ""}${value}`;
}
