import type { UnitSystem } from "./units.js";

const KG_PER_POUND = 0.45359237;

export interface QuotePerWeightDisplay {
  readonly label: "Price/kg" | "Price/lb";
  readonly unit: "kg" | "lb";
  readonly value: number | null;
}

export interface QuoteWeightDisplay {
  readonly label: "Total weight";
  readonly unit: "kg" | "lb";
  readonly value: number | null;
}

export function quotePerWeightDisplay(
  pricePerKg: number | null,
  unitSystem: UnitSystem,
): QuotePerWeightDisplay {
  if (unitSystem === "imperial") {
    return {
      label: "Price/lb",
      unit: "lb",
      value: pricePerKg === null ? null : pricePerKg * KG_PER_POUND,
    };
  }

  return {
    label: "Price/kg",
    unit: "kg",
    value: pricePerKg,
  };
}

export function quoteWeightDisplay(
  totalWeightKg: number | null,
  unitSystem: UnitSystem,
): QuoteWeightDisplay {
  if (unitSystem === "imperial") {
    return {
      label: "Total weight",
      unit: "lb",
      value: totalWeightKg === null ? null : totalWeightKg / KG_PER_POUND,
    };
  }

  return {
    label: "Total weight",
    unit: "kg",
    value: totalWeightKg,
  };
}
