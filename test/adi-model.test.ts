import { describe, expect, it } from "vitest";
import * as adi from "../src/adi/index.js";
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
  it("exports process thresholds from the public API", () => {
    expect(adi.THRESHOLDS.heavySectionMm).toBe(50);
  });

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

  it("prevents consumers from mutating canonical grade metadata", () => {
    const mutableGrades = ASTM_A897_GRADES as unknown as unknown[];
    const mutableGrade = getGradeData("200-155-02") as unknown as {
      tensileStrengthKsi: number;
      austenitizeRangeC: number[];
    };

    expect(() => {
      mutableGrades.push({ grade: "mutated" });
    }).toThrow(TypeError);
    expect(() => {
      mutableGrade.tensileStrengthKsi = 999;
    }).toThrow(TypeError);
    expect(() => {
      mutableGrade.austenitizeRangeC[0] = 0;
    }).toThrow(TypeError);
  });
});

describe("recommendAdiProcess", () => {
  it("returns the selected ASTM grade in the recommendation", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.expectedGrade).toBe("150-110-07");
  });
});

describe("ADI recommendation model", () => {
  it("uses higher austempering temperatures for ductile grades than high-strength grades", () => {
    const ductile = recommendAdiProcess({
      ...baseInput,
      target: { grade: "110-70-11", priority: "ductility" },
    });
    const highStrength = recommendAdiProcess({
      ...baseInput,
      target: { grade: "200-155-02", priority: "strength" },
    });

    expect(ductile.austemper.temperature.nominalC).toBeGreaterThan(
      highStrength.austemper.temperature.nominalC,
    );
    expect(highStrength.austemper.holdAfterCoreAtTemp.nominalMin).toBeGreaterThan(
      ductile.austemper.holdAfterCoreAtTemp.nominalMin,
    );
  });

  it("keeps nominal temperatures inside their recommended ranges", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.austenitize.temperature.nominalC).toBeGreaterThanOrEqual(
      result.austenitize.temperature.minC,
    );
    expect(result.austenitize.temperature.nominalC).toBeLessThanOrEqual(
      result.austenitize.temperature.maxC,
    );
    expect(result.austemper.temperature.nominalC).toBeGreaterThanOrEqual(
      result.austemper.temperature.minC,
    );
    expect(result.austemper.temperature.nominalC).toBeLessThanOrEqual(
      result.austemper.temperature.maxC,
    );
  });
});
