import { describe, expect, it } from "vitest";
import {
  recommendMartemperingProcess,
  recommendSteelAustemperingProcess,
  type MartemperingInput,
  type SteelAustemperingInput,
} from "../src/steel/index.js";
import {
  createSteelReportViewModel,
  serializeSteelReportMarkdown,
  steelReportMarkdownFilename,
} from "../src/ui/steel-report.js";

const austemperingInput: SteelAustemperingInput = {
  composition: {
    C: 0.42,
    Mn: 0.85,
    Si: 1.5,
    Ni: 0.2,
    Cr: 0.8,
    Mo: 0.25,
    V: 0.02,
    Cu: 0.15,
    B: 0.0007,
  },
  geometry: {
    maxSectionMm: 45,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 22,
  },
  startingCondition: "normalized",
  target: {
    priority: "toughness",
    targetHardnessHrc: 42,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 7,
    bathUniformityC: 5,
  },
  austemper: {
    bainiteTarget: "lower",
    bathMedium: "salt",
  },
};

const martemperingInput: MartemperingInput = {
  composition: {
    C: 0.45,
    Mn: 0.8,
    Si: 0.25,
    Ni: 0.2,
    Cr: 0.9,
    Mo: 0.2,
    V: 0.02,
    Cu: 0.15,
    B: 0.0005,
  },
  geometry: {
    maxSectionMm: 38,
    minSectionMm: 12,
    criticalSectionMm: 32,
    estimatedMassKg: 18,
  },
  startingCondition: "normalized",
  target: {
    priority: "distortion",
    targetHardnessHrc: 44,
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
  martemper: {
    bathMedium: "salt",
    equalizationStrategy: "section-equalized",
    temperHoldMin: 120,
    temperCount: 1,
  },
};

describe("steel report helpers", () => {
  it("serializes austempering reports with metadata, windows, hardness, warnings, and checklist", () => {
    const recommendation = recommendSteelAustemperingProcess(austemperingInput);
    const markdown = serializeSteelReportMarkdown(createSteelReportViewModel({
      activeModeLabel: "Steel Austempering",
      exportedAt: "2026-07-03T00:00:00.000Z",
      unitSystem: "imperial",
      metadata: {
        customerName: "ACME",
        partName: "Shaft",
        notes: "Trial load.",
      },
      input: austemperingInput,
      recommendation,
      validationChecklist: {
        items: [
          {
            id: "microstructure",
            label: "Verify final microstructure.",
            checked: true,
            notes: "Cut test coupon.",
          },
        ],
      },
    }));

    expect(markdown).toContain("Customer: ACME");
    expect(markdown).toContain("Process: Steel Austempering");
    expect(markdown).toContain("Expected structure:");
    expect(markdown).toContain("Expected hardness:");
    expect(markdown).toContain("## Warnings");
    expect(markdown).toContain("- [x] Verify final microstructure.");
    expect(markdown).toContain("Notes: Cut test coupon.");
  });

  it("serializes martempering reports with as-quenched and tempering recommendations", () => {
    const recommendation = recommendMartemperingProcess(martemperingInput);
    const markdown = serializeSteelReportMarkdown(createSteelReportViewModel({
      activeModeLabel: "Martempering",
      exportedAt: "2026-07-03T00:00:00.000Z",
      unitSystem: "metric",
      metadata: {
        customerName: "",
        partName: "",
        notes: "",
      },
      input: martemperingInput,
      recommendation,
      validationChecklist: {
        items: [],
      },
    }));

    expect(markdown).toContain("Process: Martempering");
    expect(markdown).toContain("As-quenched hardness:");
    expect(markdown).toContain("Temper:");
    expect(markdown).toContain("Model limitations:");
  });

  it("uses a safe mode-specific fallback filename", () => {
    expect(steelReportMarkdownFilename(
      "martempering",
      {
        customerName: "",
        partName: "",
        notes: "",
      },
      "2026-07-03T00:00:00.000Z",
    )).toBe("htcalc-martempering-report-2026-07-03.md");
  });
});
