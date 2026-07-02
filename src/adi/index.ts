export interface AdiRecommendationInput {
  target: {
    grade: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function recommendAdiProcess(input: AdiRecommendationInput) {
  return {
    expectedGrade: input.target.grade,
  };
}
