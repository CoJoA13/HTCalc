import { describe, expect, it } from "vitest";
import {
  defaultMartemperingInput,
  defaultSteelAustemperingInput,
  setMartemperingInputValue,
  setSteelAustemperingInputValue,
} from "../src/ui/steel-state.js";

describe("steel UI state helpers", () => {
  it("creates independent default steel inputs", () => {
    const first = defaultSteelAustemperingInput();
    const second = defaultSteelAustemperingInput();

    first.composition.C = 0.5;

    expect(second.composition.C).not.toBe(0.5);
  });

  it("updates steel austempering numeric and enum paths", () => {
    const input = defaultSteelAustemperingInput();

    setSteelAustemperingInputValue(input, "composition.C", 0.45);
    setSteelAustemperingInputValue(input, "austemper.bainiteTarget", "upper");

    expect(input.composition.C).toBe(0.45);
    expect(input.austemper.bainiteTarget).toBe("upper");
  });

  it("updates martempering target and tempering paths", () => {
    const input = defaultMartemperingInput();

    setMartemperingInputValue(input, "target.targetHardnessHrc", 43);
    setMartemperingInputValue(input, "martemper.temperCount", 2);

    expect(input.target.targetHardnessHrc).toBe(43);
    expect(input.martemper.temperCount).toBe(2);
  });
});
