import type {
  AdiModelCalibration,
  AdiProcessInput,
} from "../adi/index.js";
import type { ProcessModeId } from "./process-modes.js";
import type { UnitSystem } from "./units.js";

export const HTCALC_PROJECT_VERSION = 1;

export interface HtcalcProjectState {
  readonly htcalcProjectVersion: typeof HTCALC_PROJECT_VERSION;
  readonly activeModeId: ProcessModeId;
  readonly unitSystem: UnitSystem;
  readonly exportedAt: string;
  readonly adi: {
    readonly input: AdiProcessInput;
    readonly calibration: AdiModelCalibration;
  };
}

export interface CreateProjectStateInput {
  readonly activeModeId: ProcessModeId;
  readonly unitSystem: UnitSystem;
  readonly adiInput: AdiProcessInput;
  readonly adiCalibration: AdiModelCalibration;
  readonly exportedAt?: string;
}

export function createProjectState(input: CreateProjectStateInput): HtcalcProjectState {
  return {
    htcalcProjectVersion: HTCALC_PROJECT_VERSION,
    activeModeId: input.activeModeId,
    unitSystem: input.unitSystem,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    adi: {
      input: structuredClone(input.adiInput),
      calibration: structuredClone(input.adiCalibration),
    },
  };
}

export function serializeProjectState(project: HtcalcProjectState): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProjectState(json: string): HtcalcProjectState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("HTCalc project file must contain valid JSON.");
  }

  assertRecord(parsed, "project");

  if (parsed.htcalcProjectVersion !== HTCALC_PROJECT_VERSION) {
    throw new Error(`Unsupported HTCalc project version: ${String(parsed.htcalcProjectVersion)}`);
  }

  assertString(parsed.activeModeId, "activeModeId");
  assertString(parsed.unitSystem, "unitSystem");
  assertString(parsed.exportedAt, "exportedAt");
  assertRecord(parsed.adi, "adi");
  assertRecord(parsed.adi.input, "adi.input");
  assertRecord(parsed.adi.calibration, "adi.calibration");

  return parsed as unknown as HtcalcProjectState;
}

function assertRecord(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`HTCalc project file is missing required object: ${path}`);
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`HTCalc project file is missing required string: ${path}`);
  }
}
