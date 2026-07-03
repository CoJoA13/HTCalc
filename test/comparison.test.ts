import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
  type AdiProcessInput,
  type AdiProcessRecommendation,
} from "../src/adi/index.js";
import {
  compareToBaseline,
  createPinnedComparisonBaseline,
  formatNumericDelta,
} from "../src/ui/comparison.js";

const adiInput: AdiProcessInput = {
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
};

describe("comparison helpers", () => {
  it("creates a cloned pinned baseline snapshot", () => {
    const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);
    const baseline = createPinnedComparisonBaseline({
      input: adiInput,
      calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      recommendation,
      label: "Initial review",
      pinnedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(baseline).toMatchObject({
      label: "Initial review",
      pinnedAt: "2026-07-03T00:00:00.000Z",
      recommendation,
    });
    expect(baseline.input).not.toBe(adiInput);
    expect(baseline.calibration).not.toBe(DEFAULT_ADI_MODEL_CALIBRATION);
  });

  it("formats signed numeric deltas with precision and units", () => {
    expect(formatNumericDelta(10, 7, "s")).toBe("+3 s");
    expect(formatNumericDelta(7, 10, "s")).toBe("-3 s");
    expect(formatNumericDelta(0.74, 0.49, "", 2)).toBe("+0.25");
    expect(formatNumericDelta(0.49, 0.49, "", 2)).toBe("0.00");
  });

  it("summarizes changed confidence and warning counts", () => {
    const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);
    const baseline = createPinnedComparisonBaseline({
      input: adiInput,
      calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      recommendation,
      pinnedAt: "2026-07-03T00:00:00.000Z",
    });
    const current: AdiProcessRecommendation = {
      ...recommendation,
      confidence: "yellow",
      warnings: [...recommendation.warnings, "New review warning."],
      scores: {
        ...recommendation.scores,
        austemperabilityIndex: recommendation.scores.austemperabilityIndex + 0.25,
      },
      transfer: {
        ...recommendation.transfer,
        actualTransferTimeSec: recommendation.transfer.actualTransferTimeSec + 2,
      },
    };

    const comparison = compareToBaseline(baseline, current);
    const rowByLabel = new Map(comparison.rows.map((row) => [row.label, row]));

    expect(comparison.summary).toEqual([
      `Confidence ${recommendation.confidence} -> yellow`,
      "Warnings +1",
    ]);
    expect(rowByLabel.get("AI")?.delta).toBe("+0.25");
    expect(rowByLabel.get("Transfer time")?.delta).toBe("+2 s");
    expect(rowByLabel.get("Warning count")?.delta).toBe("+1");
  });
});
