import { describe, expect, it } from "vitest";
import { quotePerWeightDisplay } from "../src/ui/quote-display.js";

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
});
