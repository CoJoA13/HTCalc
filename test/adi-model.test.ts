import { describe, expect, it } from "vitest";
import { ASTM_A897_GRADES, getGradeData, recommendAdiProcess } from "../src/adi/index.js";

const baseInput = {
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
} as const;

describe("ASTM A897 grade data", () => {
  it("orders grades from ductile to high-strength behavior", () => {
    expect(ASTM_A897_GRADES.map((grade) => grade.grade)).toEqual([
      "110-70-11",
      "130-90-09",
      "150-110-07",
      "175-125-04",
      "200-155-02",
      "230-185-01",
    ]);
  });

  it("returns grade metadata by grade id", () => {
    expect(getGradeData("200-155-02")).toMatchObject({
      grade: "200-155-02",
      gradeIndex: 5,
      tensileStrengthKsi: 200,
      yieldStrengthKsi: 155,
      elongationPercent: 2,
    });
  });
});

describe("recommendAdiProcess", () => {
  it("returns the selected ASTM grade in the recommendation", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.expectedGrade).toBe("150-110-07");
  });
});
