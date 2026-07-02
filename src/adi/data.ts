import type { AstmA897Grade, AstmGradeData } from "./types.js";

function freezeGrade<T extends AstmGradeData>(grade: T): Readonly<T> {
  Object.freeze(grade.austenitizeRangeC);
  Object.freeze(grade.austemperRangeC);
  Object.freeze(grade.soakRangeMin);
  Object.freeze(grade.holdRangeMin);

  return Object.freeze(grade);
}

export const ASTM_A897_GRADES: readonly AstmGradeData[] = Object.freeze(
  (
    [
      {
        grade: "110-70-11",
        gradeIndex: 1,
        tensileStrengthKsi: 110,
        yieldStrengthKsi: 70,
        elongationPercent: 11,
        typicalHardnessHbw: "lower",
        processDirection: "Highest ductility, upper austemper range",
        austenitizeRangeC: [900, 930],
        austemperRangeC: [370, 400],
        soakRangeMin: [60, 120],
        holdRangeMin: [60, 120],
      },
      {
        grade: "130-90-09",
        gradeIndex: 2,
        tensileStrengthKsi: 130,
        yieldStrengthKsi: 90,
        elongationPercent: 9,
        typicalHardnessHbw: "269-341",
        processDirection: "Ductile structural ADI",
        austenitizeRangeC: [890, 920],
        austemperRangeC: [350, 385],
        soakRangeMin: [60, 120],
        holdRangeMin: [60, 135],
      },
      {
        grade: "150-110-07",
        gradeIndex: 3,
        tensileStrengthKsi: 150,
        yieldStrengthKsi: 110,
        elongationPercent: 7,
        typicalHardnessHbw: "302-375",
        processDirection: "Balanced strength and ductility",
        austenitizeRangeC: [870, 910],
        austemperRangeC: [330, 370],
        soakRangeMin: [60, 135],
        holdRangeMin: [75, 150],
      },
      {
        grade: "175-125-04",
        gradeIndex: 4,
        tensileStrengthKsi: 175,
        yieldStrengthKsi: 125,
        elongationPercent: 4,
        typicalHardnessHbw: "341-444",
        processDirection: "High strength",
        austenitizeRangeC: [860, 900],
        austemperRangeC: [300, 345],
        soakRangeMin: [75, 150],
        holdRangeMin: [90, 180],
      },
      {
        grade: "200-155-02",
        gradeIndex: 5,
        tensileStrengthKsi: 200,
        yieldStrengthKsi: 155,
        elongationPercent: 2,
        typicalHardnessHbw: "388-477",
        processDirection: "Very high strength and hardness",
        austenitizeRangeC: [850, 890],
        austemperRangeC: [275, 320],
        soakRangeMin: [90, 165],
        holdRangeMin: [120, 240],
      },
      {
        grade: "230-185-01",
        gradeIndex: 6,
        tensileStrengthKsi: 230,
        yieldStrengthKsi: 185,
        elongationPercent: 1,
        typicalHardnessHbw: "highest",
        processDirection: "Specialty high-hardness and low-ductility grade",
        austenitizeRangeC: [840, 880],
        austemperRangeC: [250, 290],
        soakRangeMin: [90, 180],
        holdRangeMin: [150, 300],
      },
    ] satisfies AstmGradeData[]
  ).map(freezeGrade),
);

export const THRESHOLDS = Object.freeze({
  highCarbideSegregationRisk: 1.2,
  extremeCarbideSegregationRisk: 1.8,
  heavySectionMm: 50,
  veryHeavySectionMm: 75,
  thinSectionMm: 12,
  poorNodularityPercent: 80,
  lowNoduleCountPerMm2: 80,
  maxPreferredTransferTimeSec: 10,
  poorBathUniformityC: 10,
} as const);

export function getGradeData(grade: AstmA897Grade): AstmGradeData {
  const data = ASTM_A897_GRADES.find((entry) => entry.grade === grade);
  if (!data) {
    throw new Error(`Unsupported ASTM A897 grade: ${grade}`);
  }

  return data;
}
