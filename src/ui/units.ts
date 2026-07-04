export type UnitSystem = "imperial" | "metric";

export interface TemperatureWindow {
  readonly minC: number;
  readonly nominalC: number;
  readonly maxC: number;
  readonly minF: number;
  readonly nominalF: number;
  readonly maxF: number;
}

const MM_PER_INCH = 25.4;
const KG_PER_POUND = 0.45359237;

const SECTION_PATHS = new Set([
  "geometry.maxSectionMm",
  "geometry.criticalSectionMm",
  "geometry.minSectionMm",
]);
const WEIGHT_PATHS = new Set([
  "geometry.estimatedMassKg",
  "lot.pieceWeightKg",
  "lot.totalWeightKg",
  "lot.loadCapacityKg",
]);

export function isUnitSensitivePath(path: string): boolean {
  return (
    SECTION_PATHS.has(path) ||
    WEIGHT_PATHS.has(path) ||
    path === "equipment.bathUniformityC"
  );
}

export function toDisplayValue(path: string, metricValue: number, unitSystem: UnitSystem): number {
  if (unitSystem === "metric") {
    return metricValue;
  }

  if (SECTION_PATHS.has(path)) {
    return metricValue / MM_PER_INCH;
  }

  if (WEIGHT_PATHS.has(path)) {
    return metricValue / KG_PER_POUND;
  }

  if (path === "equipment.bathUniformityC") {
    return metricValue * 1.8;
  }

  return metricValue;
}

export function toMetricValue(path: string, displayValue: number, unitSystem: UnitSystem): number {
  if (unitSystem === "metric") {
    return displayValue;
  }

  if (SECTION_PATHS.has(path)) {
    return displayValue * MM_PER_INCH;
  }

  if (WEIGHT_PATHS.has(path)) {
    return displayValue * KG_PER_POUND;
  }

  if (path === "equipment.bathUniformityC") {
    return displayValue / 1.8;
  }

  return displayValue;
}

export function unitLabelForPath(path: string, unitSystem: UnitSystem, fallback = ""): string {
  if (SECTION_PATHS.has(path)) {
    return unitSystem === "imperial" ? "in" : "mm";
  }

  if (WEIGHT_PATHS.has(path)) {
    return unitSystem === "imperial" ? "lb" : "kg";
  }

  if (path === "equipment.bathUniformityC") {
    return unitSystem === "imperial" ? "°F" : "°C";
  }

  return fallback;
}

export function temperatureRangeLabel(window: TemperatureWindow, unitSystem: UnitSystem): string {
  return unitSystem === "imperial"
    ? `${window.minF}-${window.maxF} °F`
    : `${window.minC}-${window.maxC} °C`;
}

export function temperatureNominalLabel(window: TemperatureWindow, unitSystem: UnitSystem): string {
  return unitSystem === "imperial"
    ? `${window.nominalF} °F`
    : `${window.nominalC} °C`;
}
