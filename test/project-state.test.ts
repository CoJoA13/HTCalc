import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
} from "../src/adi/index.js";
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

const pinnedComparisonBaseline = {
  label: "Initial baseline",
  pinnedAt: "2026-07-03T00:00:00.000Z",
  input: adiInput,
  calibration: DEFAULT_ADI_MODEL_CALIBRATION,
  recommendation,
};

describe("project state serialization", () => {
  it("creates a version 2 project state snapshot with review state", () => {
    const project = createProjectState({
      activeModeId: "adi",
      unitSystem: "imperial",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      metadata,
      validationChecklist,
      pinnedComparisonBaseline,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(project).toMatchObject({
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
    });
  });

  it("round-trips project state through formatted JSON", () => {
    const project = createProjectState({
      activeModeId: "adi",
      unitSystem: "metric",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      metadata,
      validationChecklist,
      pinnedComparisonBaseline,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    const parsed = parseProjectState(serializeProjectState(project));

    expect(parsed).toEqual(project);
  });

  it("round-trips default blank metadata", () => {
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
  });

  it("migrates version 1 project files to version 2 defaults", () => {
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
      htcalcProjectVersion: 2,
      metadata: {
        customerName: "",
        partName: "",
        notes: "",
      },
      validationChecklist: {
        items: [],
      },
      pinnedComparisonBaseline: null,
    });
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
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "steel-quenching",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata,
        adi: {
          input: adiInput,
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
        validationChecklist,
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/activeModeId/);

    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "adi",
        unitSystem: "si",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata,
        adi: {
          input: {
            ...adiInput,
            target: {
              ...adiInput.target,
              grade: "999-999-99",
            },
          },
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
        validationChecklist,
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/unitSystem/);
  });

  it("rejects invalid numeric ADI values before restoring state", () => {
    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata,
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
        validationChecklist,
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/geometry\.criticalSectionMm/);
  });

  it("rejects malformed nested project review objects", () => {
    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata: {
          customerName: "ACME",
          partName: "Bracket",
          notes: 12,
        },
        adi: {
          input: adiInput,
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
        validationChecklist,
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/metadata\.notes/);

    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata,
        adi: {
          input: adiInput,
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
        validationChecklist: {
          items: [
            {
              id: "confirm-grade-target",
              label: "Confirm ASTM grade target with drawing requirements.",
              checked: "yes",
              notes: "",
            },
          ],
        },
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/validationChecklist\.items\[0\]\.checked/);
  });

  it("rejects project files missing ADI input", () => {
    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 2,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        metadata,
        adi: {
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
        validationChecklist,
        pinnedComparisonBaseline: null,
      })),
    ).toThrow(/adi\.input/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseProjectState("{not-json")).toThrow(/valid JSON/);
  });
});
