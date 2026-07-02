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
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid critical section value %s",
    (criticalSectionMm) => {
      expect(() =>
        recommendAdiProcess({
          ...baseInput,
          geometry: {
            ...baseInput.geometry,
            criticalSectionMm,
          },
        }),
      ).toThrow(RangeError);
      expect(() =>
        recommendAdiProcess({
          ...baseInput,
          geometry: {
            ...baseInput.geometry,
            criticalSectionMm,
          },
        }),
      ).toThrow(/geometry\.criticalSectionMm/);
    },
  );

  it("rejects invalid negative composition values with the field path", () => {
    expect(() =>
      recommendAdiProcess({
        ...baseInput,
        composition: {
          ...baseInput.composition,
          Mo: -0.01,
        },
      }),
    ).toThrow(RangeError);
    expect(() =>
      recommendAdiProcess({
        ...baseInput,
        composition: {
          ...baseInput.composition,
          Mo: -0.01,
        },
      }),
    ).toThrow(/composition\.Mo/);
  });

  it("allows zero bath uniformity and rejects negative bath uniformity", () => {
    expect(() =>
      recommendAdiProcess({
        ...baseInput,
        equipment: {
          ...baseInput.equipment,
          bathUniformityC: 0,
        },
      }),
    ).not.toThrow();
    expect(() =>
      recommendAdiProcess({
        ...baseInput,
        equipment: {
          ...baseInput.equipment,
          bathUniformityC: -1,
        },
      }),
    ).toThrow(/equipment\.bathUniformityC/);
  });

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

  it("keeps nominal time windows inside their recommended ranges", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.austenitize.soakAfterCoreAtTemp.nominalMin).toBeGreaterThanOrEqual(
      result.austenitize.soakAfterCoreAtTemp.minMin,
    );
    expect(result.austenitize.soakAfterCoreAtTemp.nominalMin).toBeLessThanOrEqual(
      result.austenitize.soakAfterCoreAtTemp.maxMin,
    );
    expect(result.austemper.holdAfterCoreAtTemp.nominalMin).toBeGreaterThanOrEqual(
      result.austemper.holdAfterCoreAtTemp.minMin,
    );
    expect(result.austemper.holdAfterCoreAtTemp.nominalMin).toBeLessThanOrEqual(
      result.austemper.holdAfterCoreAtTemp.maxMin,
    );
  });

  it("does not use carbide segregation risk for austenitize carbide-present adjustments", () => {
    const highSegregationRiskInput = {
      ...baseInput,
      composition: {
        ...baseInput.composition,
        Mn: 0.5,
        Mo: 0.5,
        Cr: 0.2,
      },
      microstructure: {
        ...baseInput.microstructure,
        carbidesPresent: false,
      },
    };
    const withoutCarbides = recommendAdiProcess(highSegregationRiskInput);
    const withCarbides = recommendAdiProcess({
      ...highSegregationRiskInput,
      microstructure: {
        ...highSegregationRiskInput.microstructure,
        carbidesPresent: true,
      },
    });

    expect(withoutCarbides.scores.carbideSegregationRisk).toBeGreaterThan(
      adi.THRESHOLDS.highCarbideSegregationRisk,
    );
    expect(withCarbides.austenitize.temperature.nominalC).toBe(
      withoutCarbides.austenitize.temperature.nominalC + 15,
    );
    expect(withCarbides.austenitize.soakAfterCoreAtTemp.nominalMin).toBe(
      withoutCarbides.austenitize.soakAfterCoreAtTemp.nominalMin + 30,
    );
  });
});

describe("ADI warning and confidence rules", () => {
  it("warns when a heavy section lacks enough austemperability", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      composition: {
        ...baseInput.composition,
        Cu: 0.1,
        Ni: 0.1,
        Mo: 0.02,
        Mn: 0.15,
      },
      geometry: {
        maxSectionMm: 90,
        minSectionMm: 20,
        criticalSectionMm: 80,
      },
      equipment: {
        ...baseInput.equipment,
        quenchTransferTimeSec: 18,
        bathAgitation: "fair",
      },
    });

    expect(result.warnings).toContain(
      "Pearlite risk: austemperability is low for the selected critical section and transfer conditions.",
    );
    expect(result.confidence).toBe("red");
  });

  it("warns when Mn, Mo, and Cr create high carbide segregation risk", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      composition: {
        ...baseInput.composition,
        Mn: 0.65,
        Mo: 0.35,
        Cr: 0.2,
      },
    });

    expect(result.warnings).toContain(
      "High carbide/segregation risk: Mn, Mo, Cr, and section effects may produce cell-boundary carbides or martensite.",
    );
    expect(result.austemper.processingWindowStatus).toBe("narrow");
  });

  it("warns for air furnaces and uncontrolled atmosphere", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      equipment: {
        ...baseInput.equipment,
        furnaceType: "air",
        atmosphereType: "air",
        carbonPotentialControl: false,
      },
    });

    expect(result.warnings).toContain(
      "Atmosphere risk: air or uncontrolled atmosphere can scale or decarburize the surface.",
    );
    expect(result.confidence).toBe("red");
  });

  it("degrades confidence for poor nodularity", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      microstructure: {
        ...baseInput.microstructure,
        noduleCountPerMm2: 50,
        nodularityPercent: 72,
      },
    });

    expect(result.warnings).toContain(
      "Graphite quality risk: low nodule count or poor nodularity can make the recommendation unreliable.",
    );
    expect(result.confidence).toBe("red");
  });
});
