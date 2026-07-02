export { ASTM_A897_GRADES, THRESHOLDS, getGradeData } from "./data.js";
export type * from "./types.js";

import type { AdiProcessInput } from "./types.js";

export function recommendAdiProcess(input: AdiProcessInput) {
  return {
    expectedGrade: input.target.grade,
  };
}
