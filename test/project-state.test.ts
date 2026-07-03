import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
} from "../src/adi/index.js";
import type {
  MartemperingInput,
  SteelAustemperingInput,
} from "../src/steel/index.js";
import {
  createProjectState,
  parseProjectState,
  serializeProjectState,
} from "../src/ui/project-state.js";

const adiInput = {
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

const steelAustemperingInput: SteelAustemperingInput = {
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

const recommendation = recommendAdiProcess(adiInput, DEFAULT_ADI_MODEL_CALIBRATION);

const metadata = {
  customerName: "ACME Castings",
  partName: "Pump bracket",
  notes: "Qualification run for engineering review.",
};

const validationChecklist = {
  items: [
    {
      id: "confirm-grade-target",
      label: "Confirm ASTM grade target with drawing requirements.",
      checked: true,
      notes: "Drawing calls out Grade 3.",
    },
  ],
};

const validationChecklists = {
  adi: validationChecklist,
  "steel-austempering": {
    items: [
      {
        id: "confirm-jominy-data",
        label: "Validate hardenability with Jominy data.",
        checked: false,
        notes: "",
      },
    ],
  },
  martempering: {
    items: [],
  },
};

const pinnedComparisonBaseline = {
  label: "Initial baseline",
  pinnedAt: "2026-07-03T00:00:00.000Z",
  input: adiInput,
  calibration: DEFAULT_ADI_MODEL_CALIBRATION,
  recommendation,
};

function version3Project(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    htcalcProjectVersion: 3,
    activeModeId: "adi",
    unitSystem: "imperial",
    exportedAt: "2026-07-03T00:00:00.000Z",
    metadata,
    adi: {
      input: adiInput,
      calibration: DEFAULT_ADI_MODEL_CALIBRATION,
    },
    steelAustempering: {
      input: steelAustemperingInput,
    },
    martempering: {
      input: martemperingInput,
    },
    validationChecklists,
    pinnedComparisonBaseline: null,
    ...overrides,
  };
}

describe("project state serialization", () => {
  it("creates a version 3 project state snapshot with steel and review state", () => {
    const project = createProjectState({
      activeModeId: "martempering",
      unitSystem: "imperial",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      steelAustemperingInput,
      martemperingInput,
      metadata,
      validationChecklists,
      pinnedComparisonBaseline,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(project).toMatchObject({
      htcalcProjectVersion: 3,
      activeModeId: "martempering",
      unitSystem: "imperial",
      exportedAt: "2026-07-03T00:00:00.000Z",
      metadata,
      adi: {
        input: adiInput,
        calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      },
      steelAustempering: {
        input: steelAustemperingInput,
      },
      martempering: {
        input: martemperingInput,
      },
      validationChecklists,
      pinnedComparisonBaseline,
    });
  });

  it("round-trips project state through formatted JSON", () => {
    const project = createProjectState({
      activeModeId: "steel-austempering",
      unitSystem: "metric",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      steelAustemperingInput,
      martemperingInput,
      metadata,
      validationChecklists,
      pinnedComparisonBaseline,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    const parsed = parseProjectState(serializeProjectState(project));

    expect(parsed).toEqual(project);
  });

  it("round-trips default blank metadata and default steel states", () => {
    const project = createProjectState({
      activeModeId: "adi",
      unitSystem: "metric",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    const parsed = parseProjectState(serializeProjectState(project));

    expect(parsed.metadata).toEqual({
      customerName: "",
      partName: "",
      notes: "",
    });
    expect(parsed.steelAustempering.input.composition.C).toBeGreaterThan(0);
    expect(parsed.martempering.input.martemper.temperHoldMin).toBeGreaterThan(0);
    expect(parsed.validationChecklists.adi.items).toEqual([]);
  });

  it("migrates version 1 project files to version 3 defaults", () => {
    const parsed = parseProjectState(JSON.stringify({
      htcalcProjectVersion: 1,
      activeModeId: "adi",
      unitSystem: "imperial",
      exportedAt: "2026-07-03T00:00:00.000Z",
      adi: {
        input: adiInput,
        calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      },
    }));

    expect(parsed).toMatchObject({
      htcalcProjectVersion: 3,
      metadata: {
        customerName: "",
        partName: "",
        notes: "",
      },
      validationChecklists: {
        adi: {
          items: [],
        },
        "steel-austempering": {
          items: [],
        },
        martempering: {
          items: [],
        },
      },
      pinnedComparisonBaseline: null,
    });
    expect(parsed.steelAustempering.input.composition.C).toBeGreaterThan(0);
    expect(parsed.martempering.input.martemper.temperCount).toBe(1);
  });

  it("migrates version 2 project files to version 3 while preserving ADI review state", () => {
    const parsed = parseProjectState(JSON.stringify({
      htcalcProjectVersion: 2,
      activeModeId: "adi",
      unitSystem: "imperial",
      exportedAt: "2026-07-03T00:00:00.000Z",
      metadata,
      adi: {
        input: adiInput,
        calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      },
      validationChecklist,
      pinnedComparisonBaseline,
    }));

    expect(parsed.htcalcProjectVersion).toBe(3);
    expect(parsed.metadata).toEqual(metadata);
    expect(parsed.validationChecklists.adi).toEqual(validationChecklist);
    expect(parsed.validationChecklists["steel-austempering"].items).toEqual([]);
    expect(parsed.pinnedComparisonBaseline).toEqual(pinnedComparisonBaseline);
  });

  it("rejects unsupported project versions", () => {
    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 99,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        adi: {
          input: adiInput,
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
      })),
    ).toThrow(/Unsupported HTCalc project version/);
  });

  it("rejects invalid project enum values", () => {
    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        activeModeId: "steel-quenching",
      }))),
    ).toThrow(/activeModeId/);

    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        unitSystem: "si",
      }))),
    ).toThrow(/unitSystem/);
  });

  it("rejects invalid numeric ADI and steel values before restoring state", () => {
    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        adi: {
          input: {
            ...adiInput,
            geometry: {
              ...adiInput.geometry,
              criticalSectionMm: -1,
            },
          },
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
      }))),
    ).toThrow(/geometry\.criticalSectionMm/);

    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        steelAustempering: {
          input: {
            ...steelAustemperingInput,
            composition: {
              ...steelAustemperingInput.composition,
              C: -0.1,
            },
          },
        },
      }))),
    ).toThrow(/steelAustempering\.input\.composition\.C/);
  });

  it("rejects invalid steel enum values", () => {
    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        steelAustempering: {
          input: {
            ...steelAustemperingInput,
            austemper: {
              ...steelAustemperingInput.austemper,
              bainiteTarget: "middle",
            },
          },
        },
      }))),
    ).toThrow(/steelAustempering\.input\.austemper\.bainiteTarget/);
  });

  it("rejects malformed nested project review objects", () => {
    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        metadata: {
          customerName: "ACME",
          partName: "Bracket",
          notes: 12,
        },
      }))),
    ).toThrow(/metadata\.notes/);

    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        validationChecklists: {
          ...validationChecklists,
          adi: {
            items: [
              {
                id: "confirm-grade-target",
                label: "Confirm ASTM grade target with drawing requirements.",
                checked: "yes",
                notes: "",
              },
            ],
          },
        },
      }))),
    ).toThrow(/validationChecklists\.adi\.items\[0\]\.checked/);
  });

  it("rejects project files missing ADI or steel input", () => {
    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        adi: {
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
      }))),
    ).toThrow(/adi\.input/);

    expect(() =>
      parseProjectState(JSON.stringify(version3Project({
        martempering: {},
      }))),
    ).toThrow(/martempering\.input/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseProjectState("{not-json")).toThrow(/valid JSON/);
  });
});
