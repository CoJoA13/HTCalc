import type { TemperatureWindow } from "../adi/index.js";

export type UnitSystem = "imperial" | "metric";

const MM_PER_INCH = 25.4;
const KG_PER_POUND = 0.45359237;

const SECTION_PATHS = new Set([
  "geometry.maxSectionMm",
  "geometry.criticalSectionMm",
  "geometry.minSectionMm",
]);

export function isUnitSensitivePath(path: string): boolean {
  return (
    SECTION_PATHS.has(path) ||
    path === "geometry.estimatedMassKg" ||
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

  if (path === "geometry.estimatedMassKg") {
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

  if (path === "geometry.estimatedMassKg") {
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

  if (path === "geometry.estimatedMassKg") {
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
