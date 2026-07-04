import { describe, expect, it } from "vitest";
import {
  defaultHeatTreatQuoteInput,
  setHeatTreatQuoteInputValue,
} from "../src/ui/quote-state.js";

describe("quote UI state", () => {
  it("creates editable shop-specific default quote input", () => {
    const input = defaultHeatTreatQuoteInput();

    expect(input.sourceMode).toBe("manual");
    expect(input.processSummary).toBe("Manual heat-treatment quote");
    expect(input.shopRates.targetMarginPercent).toBe(20);
    expect(input.adjustments.complexityFactor).toBe(1);
    expect(input.adjustments.expediteMultiplier).toBe(1);
  });

  it("updates nested quote fields from UI paths", () => {
    const input = defaultHeatTreatQuoteInput();

    setHeatTreatQuoteInputValue(input, "sourceMode", "adi");
    setHeatTreatQuoteInputValue(input, "lot.quantity", 250);
    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", 1200);
    setHeatTreatQuoteInputValue(input, "shopRates.furnaceRatePerHour", 145);
    setHeatTreatQuoteInputValue(input, "manualOverrides.billableFurnaceHours", 6.5);
    setHeatTreatQuoteInputValue(input, "adjustments.manualAdderDiscount", -75);

    expect(input.sourceMode).toBe("adi");
    expect(input.lot.quantity).toBe(250);
    expect(input.lot.totalWeightKg).toBe(1200);
    expect(input.shopRates.furnaceRatePerHour).toBe(145);
    expect(input.manualOverrides.billableFurnaceHours).toBe(6.5);
    expect(input.adjustments.manualAdderDiscount).toBe(-75);
  });

  it("clears optional numeric fields when the UI sends undefined", () => {
    const input = defaultHeatTreatQuoteInput();

    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", 1200);
    setHeatTreatQuoteInputValue(input, "lot.totalWeightKg", undefined);

    expect(input.lot.totalWeightKg).toBeUndefined();
  });

  it("clears optional numeric fields when the UI sends an empty string", () => {
    const input = defaultHeatTreatQuoteInput();

    setHeatTreatQuoteInputValue(input, "manualOverrides.billableFurnaceHours", 6.5);
    setHeatTreatQuoteInputValue(input, "manualOverrides.billableFurnaceHours", "");

    expect(input.manualOverrides.billableFurnaceHours).toBeUndefined();
  });

  it("rejects invalid source modes", () => {
    const input = defaultHeatTreatQuoteInput();

    expect(() =>
      setHeatTreatQuoteInputValue(input, "sourceMode", "powder-coating"),
    ).toThrow("Unknown heat-treat quote source mode: powder-coating");
    expect(input.sourceMode).toBe("manual");
  });

  it("rejects unknown quote paths", () => {
    const input = defaultHeatTreatQuoteInput();

    expect(() =>
      setHeatTreatQuoteInputValue(input, "lot.typoWeightKg", 1200),
    ).toThrow("Unknown heat-treat quote input path: lot.typoWeightKg");
  });
});
