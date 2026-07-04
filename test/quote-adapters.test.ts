import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
  type AdiProcessInput,
} from "../src/adi/index.js";
import {
  recommendMartemperingProcess,
  recommendSteelAustemperingProcess,
  type MartemperingInput,
  type SteelAustemperingInput,
} from "../src/steel/index.js";
import {
  quoteAssumptionsFromAdi,
  quoteAssumptionsFromMartempering,
  quoteAssumptionsFromSteelAustempering,
} from "../src/quote/index.js";

const adiInput: AdiProcessInput = {
  composition: { C: 3.6, Si: 2.5, Mn: 0.25, Cu: 0.7, Ni: 0.6, Mo: 0.15, Cr: 0.03, Mg: 0.04, P: 0.02, S: 0.01 },
  geometry: { maxSectionMm: 30, minSectionMm: 8, criticalSectionMm: 25 },
  microstructure: { startingMatrix: "ferritic-pearlitic", carbidesPresent: false, noduleCountPerMm2: 120, nodularityPercent: 90 },
  target: { grade: "150-110-07", priority: "strength" },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonPotentialControl: true, quenchTransferTimeSec: 8, austemperBathType: "salt", bathAgitation: "good", bathUniformityC: 5 },
};

const steelAustemperingInput: SteelAustemperingInput = {
  composition: { C: 0.42, Mn: 0.85, Si: 1.5, Ni: 0.2, Cr: 0.8, Mo: 0.25, V: 0.02, Cu: 0.15, B: 0.0007 },
  geometry: { maxSectionMm: 45, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 22 },
  startingCondition: "normalized",
  target: { priority: "toughness", targetHardnessHrc: 42 },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonProtection: true, quenchMedium: "salt", agitation: "good", transferTimeSec: 7, bathUniformityC: 5 },
  austemper: { bainiteTarget: "lower", bathMedium: "salt" },
};

const martemperingInput: MartemperingInput = {
  composition: { C: 0.45, Mn: 0.8, Si: 0.25, Ni: 0.2, Cr: 0.9, Mo: 0.2, V: 0.02, Cu: 0.15, B: 0.0005 },
  geometry: { maxSectionMm: 38, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 18 },
  startingCondition: "normalized",
  target: { priority: "distortion", targetHardnessHrc: 44 },
  equipment: { furnaceType: "controlled-atmosphere", atmosphereType: "endothermic-neutral", carbonProtection: true, quenchMedium: "salt", agitation: "good", transferTimeSec: 6, bathUniformityC: 5 },
  martemper: { bathMedium: "salt", equalizationStrategy: "section-equalized", temperHoldMin: 120, temperCount: 2 },
};

describe("quote recipe adapters", () => {
  it("imports ADI process time and risk context", () => {
    const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);
    const assumptions = quoteAssumptionsFromAdi(recommendation);

    expect(assumptions.sourceMode).toBe("adi");
    expect(assumptions.processLabel).toBe(`ADI ${recommendation.expectedGrade}`);
    expect(assumptions.processConfidence).toBe(recommendation.confidence);
    expect(assumptions.processWarnings).toEqual(recommendation.warnings);
    expect(assumptions.processWarnings).not.toBe(recommendation.warnings);
    expect(assumptions.austenitizeMinutes).toEqual({
      label: "Austenitize soak after core reaches temperature",
      minMin: recommendation.austenitize.soakAfterCoreAtTemp.minMin,
      nominalMin: recommendation.austenitize.soakAfterCoreAtTemp.nominalMin,
      maxMin: recommendation.austenitize.soakAfterCoreAtTemp.maxMin,
      source: "imported",
    });
    expect(assumptions.bathMinutes).toEqual({
      label: "Austemper hold after core reaches bath temperature",
      minMin: recommendation.austemper.holdAfterCoreAtTemp.minMin,
      nominalMin: recommendation.austemper.holdAfterCoreAtTemp.nominalMin,
      maxMin: recommendation.austemper.holdAfterCoreAtTemp.maxMin,
      source: "imported",
    });
    expect(assumptions.temperCount).toBe(0);
    expect(assumptions.validationBurdenHints).toEqual([
      "Review ADI validation checklist and required metallography before quoting.",
      "Include hardness traverse or tensile testing when required by the customer specification.",
    ]);
  });

  it("imports steel austempering process time and confidence", () => {
    const recommendation = recommendSteelAustemperingProcess(steelAustemperingInput);
    const recommendationWithWarning = {
      ...recommendation,
      warnings: ["Steel quote warning fixture."],
    };
    const assumptions = quoteAssumptionsFromSteelAustempering(recommendationWithWarning);

    expect(assumptions.sourceMode).toBe("steel-austempering");
    expect(assumptions.processLabel).toBe(`Steel Austempering - ${recommendation.expectedStructure}`);
    expect(assumptions.processWarnings).toEqual(["Steel quote warning fixture."]);
    expect(assumptions.processWarnings).not.toBe(recommendationWithWarning.warnings);
    expect(assumptions.austenitizeMinutes).toEqual({
      label: "Austenitize soak after core reaches temperature",
      minMin: recommendation.austenitize.soakAfterCoreAtTemp.minMin,
      nominalMin: recommendation.austenitize.soakAfterCoreAtTemp.nominalMin,
      maxMin: recommendation.austenitize.soakAfterCoreAtTemp.maxMin,
      source: "imported",
    });
    expect(assumptions.bathMinutes).toEqual({
      label: "Austemper hold after core reaches bath temperature",
      minMin: recommendation.austemper.holdAfterCoreAtTemp.minMin,
      nominalMin: recommendation.austemper.holdAfterCoreAtTemp.nominalMin,
      maxMin: recommendation.austemper.holdAfterCoreAtTemp.maxMin,
      source: "imported",
    });
    expect(assumptions.processConfidence).toBe(recommendation.confidence);
    expect(assumptions.temperCount).toBe(0);
    expect(assumptions.validationBurdenHints).toEqual([
      "Include hardenability review, final hardness traverse, and microstructure validation in quote scope.",
      "Confirm final cooling and handling requirements before sending pricing.",
    ]);
  });

  it("imports martempering equalization and temper cycle assumptions", () => {
    const recommendation = recommendMartemperingProcess(martemperingInput);
    const assumptions = quoteAssumptionsFromMartempering(recommendation);

    expect(assumptions.sourceMode).toBe("martempering");
    expect(assumptions.processLabel).toBe(`Martempering - temper to ${recommendation.temper.targetHardnessHrc} HRC`);
    expect(assumptions.processConfidence).toBe(recommendation.confidence);
    expect(assumptions.processWarnings).toEqual(recommendation.warnings);
    expect(assumptions.processWarnings).not.toBe(recommendation.warnings);
    expect(assumptions.austenitizeMinutes).toEqual({
      label: "Austenitize soak after core reaches temperature",
      minMin: recommendation.austenitize.soakAfterCoreAtTemp.minMin,
      nominalMin: recommendation.austenitize.soakAfterCoreAtTemp.nominalMin,
      maxMin: recommendation.austenitize.soakAfterCoreAtTemp.maxMin,
      source: "imported",
    });
    expect(assumptions.bathMinutes).toEqual({
      label: "Martemper equalization time",
      minMin: recommendation.equalize.minMin,
      nominalMin: recommendation.equalize.nominalMin,
      maxMin: recommendation.equalize.maxMin,
      source: "imported",
    });
    expect(assumptions.temperMinutes).toEqual({
      label: "Temper hold time",
      minMin: recommendation.temper.hold.minMin,
      nominalMin: recommendation.temper.hold.nominalMin,
      maxMin: recommendation.temper.hold.maxMin,
      source: "imported",
    });
    expect(assumptions.temperCount).toBe(recommendation.temper.temperCount);
    expect(assumptions.validationBurdenHints).toEqual([
      "Include tempering validation and final hardness verification in quote scope.",
      "Confirm retained-austenite, distortion, and prompt-temper risks before sending pricing.",
    ]);
  });
});
