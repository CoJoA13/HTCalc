import type { ProcessingWindowStatus } from "../adi/index.js";
import { toMetricValue, type UnitSystem } from "./units.js";

const OPTIONAL_NUMERIC_PATHS = new Set([
  "geometry.estimatedMassKg",
  "microstructure.noduleCountPerMm2",
  "microstructure.nodularityPercent",
  "lot.pieceWeightKg",
  "lot.totalWeightKg",
  "lot.loadCapacityKg",
  "lot.laborHoursPerLoad",
  "lot.cycleCountOverride",
  "manualOverrides.billableFurnaceHours",
  "manualOverrides.billableBathQuenchHours",
  "manualOverrides.billableTemperHours",
  "manualOverrides.billableLaborHours",
  "manualOverrides.billableCycleCount",
]);

function isCompositionPath(path: string): boolean {
  return path.startsWith("composition.");
}

export interface StatusBadge {
  readonly label: string;
  readonly className: string;
}

export function parseNumericInputValue(
  path: string,
  rawValue: string,
  unitSystem: UnitSystem,
): number | undefined {
  if (rawValue.trim() === "") {
    return OPTIONAL_NUMERIC_PATHS.has(path) ? undefined : Number.NaN;
  }

  const value = toMetricValue(path, Number(rawValue), unitSystem);
  return isCompositionPath(path) ? Math.max(0, value) : value;
}

export function windowStatusBadge(status: ProcessingWindowStatus): StatusBadge {
  if (status === "narrow") {
    return { label: "Narrow", className: "status-narrow" };
  }

  if (status === "invalid") {
    return { label: "Invalid", className: "status-invalid" };
  }

  return { label: "OK", className: "status-robust" };
}

export function calibrationControlShouldSync(
  controlKey: string | undefined,
  changedKey: string | undefined,
  isActiveElement: boolean,
): boolean {
  if (!controlKey) {
    return false;
  }

  if (changedKey && controlKey !== changedKey) {
    return false;
  }

  return !isActiveElement;
}
