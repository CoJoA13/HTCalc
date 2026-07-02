export function recommendAdiProcess(input: { target: { grade: string } }) {
  return {
    expectedGrade: input.target.grade,
  };
}
