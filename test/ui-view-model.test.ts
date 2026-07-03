import { describe, expect, it } from "vitest";
import {
  calibrationControlShouldSync,
  parseNumericInputValue,
  windowStatusBadge,
} from "../src/ui/view-model.js";

describe("UI view model helpers", () => {
  it("preserves blank optional numeric inputs as undefined", () => {
    expect(parseNumericInputValue("geometry.estimatedMassKg", "", "imperial")).toBeUndefined();
    expect(parseNumericInputValue("microstructure.noduleCountPerMm2", "", "imperial")).toBeUndefined();
    expect(parseNumericInputValue("microstructure.nodularityPercent", "", "metric")).toBeUndefined();
  });

  it("keeps blank required numeric inputs invalid instead of optional", () => {
    expect(Number.isNaN(parseNumericInputValue("geometry.criticalSectionMm", "", "imperial"))).toBe(true);
  });

  it("converts non-blank numeric inputs through the selected unit system", () => {
    expect(parseNumericInputValue("geometry.criticalSectionMm", "2", "imperial")).toBeCloseTo(50.8);
    expect(parseNumericInputValue("geometry.criticalSectionMm", "50.8", "metric")).toBeCloseTo(50.8);
  });

  it("clamps negative composition inputs to zero for UI entry", () => {
    expect(parseNumericInputValue("composition.Mo", "-0.2", "imperial")).toBe(0);
    expect(parseNumericInputValue("composition.C", "-1", "metric")).toBe(0);
  });

  it("labels processing window badges from computed status", () => {
    expect(windowStatusBadge("robust")).toEqual({ label: "OK", className: "status-robust" });
    expect(windowStatusBadge("narrow")).toEqual({ label: "Narrow", className: "status-narrow" });
    expect(windowStatusBadge("invalid")).toEqual({ label: "Invalid", className: "status-invalid" });
  });

  it("does not reformat the active calibration control while typing", () => {
    expect(calibrationControlShouldSync("holdTimeScale", "holdTimeScale", true)).toBe(false);
    expect(calibrationControlShouldSync("holdTimeScale", "holdTimeScale", false)).toBe(true);
    expect(calibrationControlShouldSync("holdTimeScale", "soakTimeScale", true)).toBe(false);
  });
});
