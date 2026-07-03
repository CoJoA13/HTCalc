import { describe, expect, it } from "vitest";
import { DEFAULT_ADI_MODEL_CALIBRATION } from "../src/adi/index.js";
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

describe("project state serialization", () => {
  it("creates a versioned project state snapshot", () => {
    const project = createProjectState({
      activeModeId: "adi",
      unitSystem: "imperial",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    expect(project).toMatchObject({
      htcalcProjectVersion: 1,
      activeModeId: "adi",
      unitSystem: "imperial",
      exportedAt: "2026-07-03T00:00:00.000Z",
      adi: {
        input: adiInput,
        calibration: DEFAULT_ADI_MODEL_CALIBRATION,
      },
    });
  });

  it("round-trips project state through formatted JSON", () => {
    const project = createProjectState({
      activeModeId: "adi",
      unitSystem: "metric",
      adiInput,
      adiCalibration: DEFAULT_ADI_MODEL_CALIBRATION,
      exportedAt: "2026-07-03T00:00:00.000Z",
    });

    const parsed = parseProjectState(serializeProjectState(project));

    expect(parsed).toEqual(project);
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

  it("rejects project files missing ADI input", () => {
    expect(() =>
      parseProjectState(JSON.stringify({
        htcalcProjectVersion: 1,
        activeModeId: "adi",
        unitSystem: "imperial",
        exportedAt: "2026-07-03T00:00:00.000Z",
        adi: {
          calibration: DEFAULT_ADI_MODEL_CALIBRATION,
        },
      })),
    ).toThrow(/adi\.input/);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseProjectState("{not-json")).toThrow(/valid JSON/);
  });
});
