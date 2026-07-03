import { describe, expect, it } from "vitest";
import {
  isUnitSensitivePath,
  temperatureNominalLabel,
  temperatureRangeLabel,
  toDisplayValue,
  toMetricValue,
  unitLabelForPath,
} from "../src/ui/units.js";

describe("UI unit conversion helpers", () => {
  it("converts section lengths between millimeters and inches", () => {
    expect(toDisplayValue("geometry.criticalSectionMm", 25.4, "imperial")).toBeCloseTo(1);
    expect(toMetricValue("geometry.criticalSectionMm", 2, "imperial")).toBeCloseTo(50.8);
    expect(toDisplayValue("geometry.criticalSectionMm", 25.4, "metric")).toBe(25.4);
  });

  it("converts mass between kilograms and pounds", () => {
    expect(toDisplayValue("geometry.estimatedMassKg", 0.45359237, "imperial")).toBeCloseTo(1);
    expect(toMetricValue("geometry.estimatedMassKg", 10, "imperial")).toBeCloseTo(4.5359237);
    expect(toMetricValue("geometry.estimatedMassKg", 10, "metric")).toBe(10);
  });

  it("converts bath uniformity as a temperature delta", () => {
    expect(toDisplayValue("equipment.bathUniformityC", 5, "imperial")).toBe(9);
    expect(toMetricValue("equipment.bathUniformityC", 9, "imperial")).toBe(5);
  });

  it("labels unit-sensitive paths by unit system", () => {
    expect(unitLabelForPath("geometry.maxSectionMm", "imperial")).toBe("in");
    expect(unitLabelForPath("geometry.maxSectionMm", "metric")).toBe("mm");
    expect(unitLabelForPath("geometry.estimatedMassKg", "imperial")).toBe("lb");
    expect(unitLabelForPath("equipment.bathUniformityC", "metric")).toBe("°C");
    expect(isUnitSensitivePath("composition.C")).toBe(false);
  });

  it("formats recommendation temperature windows by unit system", () => {
    const window = {
      minC: 330,
      nominalC: 350,
      maxC: 370,
      minF: 626,
      nominalF: 662,
      maxF: 698,
    };

    expect(temperatureRangeLabel(window, "imperial")).toBe("626-698 °F");
    expect(temperatureNominalLabel(window, "imperial")).toBe("662 °F");
    expect(temperatureRangeLabel(window, "metric")).toBe("330-370 °C");
  });
});
