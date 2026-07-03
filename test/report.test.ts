import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
  type AdiProcessInput,
} from "../src/adi/index.js";
import {
  createReportViewModel,
  reportMarkdownFilename,
  serializeReportMarkdown,
} from "../src/ui/report.js";

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

describe("report helpers", () => {
  it("serializes an engineering review Markdown report", () => {
    const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);
    const viewModel = createReportViewModel({
      activeModeLabel: "ADI",
      unitSystem: "imperial",
      exportedAt: "2026-07-03T00:00:00.000Z",
      metadata: {
        customerName: "ACME Castings",
        partName: "Pump bracket",
        notes: "Qualification run for engineering review.",
      },
      input: adiInput,
      calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      recommendation,
      validationChecklist: {
        items: [
          {
            id: "confirm-grade-target",
            label: "Confirm ASTM grade target with drawing requirements.",
            checked: true,
            notes: "Drawing calls out Grade 3.",
          },
          {
            id: "metallography",
            label: "Metallography for nodularity, nodule count, and ausferrite.",
            checked: false,
            notes: "",
          },
        ],
      },
    });

    const markdown = serializeReportMarkdown(viewModel);

    expect(markdown).toContain("# HTCalc ADI Report");
    expect(markdown).toContain("Customer: ACME Castings");
    expect(markdown).toContain("Part: Pump bracket");
    expect(markdown).toContain("Qualification run for engineering review.");
    expect(markdown).toContain("Austenitize");
    expect(markdown).toContain("Austemper");
    expect(markdown).toContain(`AI: ${recommendation.scores.austemperabilityIndex.toFixed(2)}`);
    expect(markdown).toContain(`CSR: ${recommendation.scores.carbideSegregationRisk.toFixed(2)}`);
    expect(markdown).toContain(recommendation.warnings[0]);
    expect(markdown).toContain("- [x] Confirm ASTM grade target with drawing requirements.");
    expect(markdown).toContain("Notes: Drawing calls out Grade 3.");
    expect(markdown).toContain("- [ ] Metallography for nodularity, nodule count, and ausferrite.");
  });

  it("uses a safe fallback filename when metadata is blank", () => {
    expect(reportMarkdownFilename({
      customerName: "",
      partName: "",
      notes: "",
    }, "2026-07-03T00:00:00.000Z")).toBe("htcalc-adi-report-2026-07-03.md");
  });
});
