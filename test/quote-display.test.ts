import { describe, expect, it } from "vitest";
import {
  quotePerWeightDisplay,
  quoteWeightDisplay,
} from "../src/ui/quote-display.js";

describe("RFQ quote display helpers", () => {
  it("keeps RFQ per-weight pricing metric in metric mode", () => {
    expect(quotePerWeightDisplay(7.33, "metric")).toEqual({
      label: "Price/kg",
      unit: "kg",
      value: 7.33,
    });
  });

  it("converts RFQ per-weight pricing to pounds in imperial mode", () => {
    const display = quotePerWeightDisplay(10, "imperial");

    expect(display.label).toBe("Price/lb");
    expect(display.unit).toBe("lb");
    expect(display.value).toBeCloseTo(4.5359237);
  });

  it("preserves unavailable RFQ per-weight pricing with the active unit label", () => {
    expect(quotePerWeightDisplay(null, "imperial")).toEqual({
      label: "Price/lb",
      unit: "lb",
      value: null,
    });

    expect(quotePerWeightDisplay(null, "metric")).toEqual({
      label: "Price/kg",
      unit: "kg",
      value: null,
    });
  });

  it("keeps RFQ total weight metric in metric mode", () => {
    expect(quoteWeightDisplay(200, "metric")).toEqual({
      label: "Total weight",
      unit: "kg",
      value: 200,
    });
  });

  it("converts RFQ total weight to pounds in imperial mode", () => {
    const display = quoteWeightDisplay(200, "imperial");

    expect(display.label).toBe("Total weight");
    expect(display.unit).toBe("lb");
    expect(display.value).toBeCloseTo(440.924524);
  });

  it("preserves unavailable RFQ total weight with the active unit label", () => {
    expect(quoteWeightDisplay(null, "imperial")).toEqual({
      label: "Total weight",
      unit: "lb",
      value: null,
    });

    expect(quoteWeightDisplay(null, "metric")).toEqual({
      label: "Total weight",
      unit: "kg",
      value: null,
    });
  });
});
