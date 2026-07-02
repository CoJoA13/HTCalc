import { describe, expect, it } from "vitest";
import { recommendAdiProcess } from "../src/adi/index.js";

describe("recommendAdiProcess", () => {
  it("returns the selected ASTM grade in the recommendation", () => {
    const result = recommendAdiProcess({
      composition: {
        C: 3.6,
        Si: 2.5,
        Mn: 0.25,
        Cu: 0.7,
        Ni: 0.6,
        Mo: 0.15,
        Cr: 0.03,
        Mg: 0.04,
        P: 0.02,
        S: 0.01,
      },
      geometry: {
        maxSectionMm: 30,
        minSectionMm: 8,
        criticalSectionMm: 25,
      },
      microstructure: {
        startingMatrix: "ferritic-pearlitic",
        carbidesPresent: false,
        noduleCountPerMm2: 120,
        nodularityPercent: 90,
      },
      target: {
        grade: "150-110-07",
        priority: "strength",
      },
      equipment: {
        furnaceType: "controlled-atmosphere",
        atmosphereType: "endothermic-neutral",
        carbonPotentialControl: true,
        quenchTransferTimeSec: 8,
        austemperBathType: "salt",
        bathAgitation: "good",
        bathUniformityC: 5,
      },
    });

    expect(result.expectedGrade).toBe("150-110-07");
  });
});
