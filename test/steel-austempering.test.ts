import { describe, expect, it } from "vitest";
import {
  recommendSteelAustemperingProcess,
  type SteelAustemperingInput,
} from "../src/steel/index.js";

const input: SteelAustemperingInput = {
  composition: {
    C: 0.42,
    Mn: 0.85,
    Si: 1.5,
    Ni: 0.2,
    Cr: 0.8,
    Mo: 0.25,
    V: 0.02,
    Cu: 0.15,
    B: 0.0007,
  },
  geometry: {
    maxSectionMm: 45,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 22,
  },
  startingCondition: "normalized",
  target: {
    priority: "toughness",
    targetHardnessHrc: 42,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 7,
    bathUniformityC: 5,
  },
  austemper: {
    bainiteTarget: "lower",
    bathMedium: "salt",
  },
};

describe("steel austempering recommendation", () => {
  it("recommends a bath above Ms and below bainite start", () => {
    const result = recommendSteelAustemperingProcess(input);

    expect(result.austemper.temperature.nominalC).toBeGreaterThan(result.transformation.msC);
    expect(result.austemper.temperature.nominalC).toBeLessThan(result.transformation.bainiteStartC);
    expect(result.expectedStructure).toContain("bainite");
  });

  it("uses lower temperatures and higher hardness for lower bainite than upper bainite", () => {
    const lower = recommendSteelAustemperingProcess(input);
    const upper = recommendSteelAustemperingProcess({
      ...input,
      austemper: {
        ...input.austemper,
        bainiteTarget: "upper",
      },
    });

    expect(lower.austemper.temperature.nominalC).toBeLessThan(upper.austemper.temperature.nominalC);
    expect(lower.expectedHardness.nominalHrc).toBeGreaterThan(upper.expectedHardness.nominalHrc);
  });

  it("marks the window invalid when requested bath is below Ms", () => {
    const result = recommendSteelAustemperingProcess({
      ...input,
      austemper: {
        ...input.austemper,
        bathTemperatureC: 250,
      },
    });

    expect(result.processingWindowStatus).toBe("invalid");
    expect(result.confidence).toBe("red");
    expect(result.warnings.join(" ")).toMatch(/below estimated Ms/);
  });

  it("generates validation checks for trial qualification", () => {
    const result = recommendSteelAustemperingProcess(input);

    expect(result.validationChecks).toContain(
      "Validate hardenability with Jominy, CCT/TTT data, or representative quench trials.",
    );
    expect(result.validationChecks.some((check) => check.includes("microstructure"))).toBe(true);
  });
});
