import { describe, expect, it } from "vitest";
import {
  recommendMartemperingProcess,
  type MartemperingInput,
} from "../src/steel/index.js";

const input: MartemperingInput = {
  composition: {
    C: 0.45,
    Mn: 0.8,
    Si: 0.25,
    Ni: 0.2,
    Cr: 0.9,
    Mo: 0.2,
    V: 0.02,
    Cu: 0.15,
    B: 0.0005,
  },
  geometry: {
    maxSectionMm: 38,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 18,
  },
  startingCondition: "normalized",
  target: {
    priority: "distortion",
    targetHardnessHrc: 44,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
  martemper: {
    bathMedium: "salt",
    equalizationStrategy: "section-equalized",
    temperHoldMin: 120,
    temperCount: 1,
  },
};

describe("martempering recommendation", () => {
  it("places the interrupted quench bath above Ms", () => {
    const result = recommendMartemperingProcess(input);

    expect(result.martemper.temperature.nominalC).toBeGreaterThan(result.transformation.msC);
    expect(result.equalize.nominalMin).toBeGreaterThan(0);
    expect(result.finalCoolGuidance).toMatch(/cool through martensite/);
  });

  it("estimates as-quenched hardness and recommends tempering toward target HRC", () => {
    const result = recommendMartemperingProcess(input);

    expect(result.asQuenchedHardness.nominalHrc).toBeGreaterThan(result.temper.targetHardnessHrc);
    expect(result.temper.temperature.nominalC).toBeGreaterThanOrEqual(150);
    expect(result.temper.hold.nominalMin).toBe(120);
  });

  it("flags bath temperatures at or below Ms as invalid", () => {
    const result = recommendMartemperingProcess({
      ...input,
      martemper: {
        ...input.martemper,
        bathTemperatureC: 250,
      },
    });

    expect(result.processingWindowStatus).toBe("invalid");
    expect(result.confidence).toBe("red");
    expect(result.warnings.join(" ")).toMatch(/above estimated Ms/);
  });

  it("warns for high-carbon retained austenite risk", () => {
    const result = recommendMartemperingProcess({
      ...input,
      composition: {
        ...input.composition,
        C: 0.95,
      },
    });

    expect(result.warnings.join(" ")).toMatch(/retained austenite/i);
  });

  it("rejects equalization caps below the minimum window", () => {
    expect(() => recommendMartemperingProcess({
      ...input,
      martemper: {
        ...input.martemper,
        maxEqualizationMin: 1,
      },
    })).toThrow(/martemper\.maxEqualizationMin/);
  });

  it("preserves required multiple-temper recommendations", () => {
    const result = recommendMartemperingProcess({
      ...input,
      composition: {
        ...input.composition,
        C: 0.95,
      },
      martemper: {
        ...input.martemper,
        temperCount: 1,
      },
    });

    expect(result.temper.temperCount).toBe(2);
  });

  it("downgrades confidence for air austenitizing risk", () => {
    const result = recommendMartemperingProcess({
      ...input,
      equipment: {
        ...input.equipment,
        furnaceType: "air",
        atmosphereType: "air",
      },
    });

    expect(result.processingWindowStatus).toBe("narrow");
    expect(result.confidence).toBe("yellow");
    expect(result.warnings.join(" ")).toMatch(/Atmosphere risk/);
  });
});
