import { describe, expect, it } from "vitest";
import {
  estimateAsQuenchedHardness,
  estimateSteelTransformation,
  recommendTempering,
  validateSteelInput,
  type SteelBaseInput,
} from "../src/steel/index.js";

const baseSteel: SteelBaseInput = {
  composition: {
    C: 0.4,
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
    priority: "toughness",
    targetHardnessHrc: 45,
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
};

describe("shared steel core", () => {
  it("estimates transformation temperatures from composition", () => {
    const result = estimateSteelTransformation(baseSteel);

    expect(result.ac1C).toBeGreaterThan(690);
    expect(result.ac3C).toBeGreaterThan(result.ac1C);
    expect(result.msC).toBeGreaterThan(300);
    expect(result.bainiteStartC).toBeGreaterThan(result.msC);
  });

  it("rejects non-finite and impossible steel inputs", () => {
    expect(() => validateSteelInput({
      ...baseSteel,
      composition: {
        ...baseSteel.composition,
        C: Number.NaN,
      },
    })).toThrow(/composition\.C/);

    expect(() => validateSteelInput({
      ...baseSteel,
      geometry: {
        ...baseSteel.geometry,
        criticalSectionMm: 0,
      },
    })).toThrow(/geometry\.criticalSectionMm/);
  });

  it("rejects invalid enum-like fields before scoring", () => {
    expect(() => estimateSteelTransformation({
      ...baseSteel,
      equipment: {
        ...baseSteel.equipment,
        quenchMedium: "lava" as SteelBaseInput["equipment"]["quenchMedium"],
      },
    })).toThrow(/equipment\.quenchMedium/);

    expect(() => validateSteelInput({
      ...baseSteel,
      target: {
        ...baseSteel.target,
        priority: "speed" as SteelBaseInput["target"]["priority"],
      },
    })).toThrow(/target\.priority/);
  });

  it("estimates as-quenched hardness lower when hardenability is insufficient", () => {
    const good = estimateAsQuenchedHardness(baseSteel);
    const weak = estimateAsQuenchedHardness({
      ...baseSteel,
      composition: {
        ...baseSteel.composition,
        Mn: 0.3,
        Cr: 0.05,
        Mo: 0,
        Ni: 0,
        B: 0,
      },
      geometry: {
        ...baseSteel.geometry,
        criticalSectionMm: 90,
      },
      equipment: {
        ...baseSteel.equipment,
        quenchMedium: "air",
        agitation: "poor",
        transferTimeSec: 30,
      },
    });

    expect(good.nominalHrc).toBeGreaterThan(weak.nominalHrc);
    expect(weak.warnings.length).toBeGreaterThan(0);
  });

  it("recommends tempering below as-quenched hardness for a target HRC", () => {
    const asQuenched = estimateAsQuenchedHardness(baseSteel);
    const temper = recommendTempering(baseSteel, asQuenched);

    expect(temper.temperature.nominalC).toBeGreaterThanOrEqual(150);
    expect(temper.targetHardnessHrc).toBe(45);
    expect(temper.hold.nominalMin).toBeGreaterThanOrEqual(60);
  });
});
