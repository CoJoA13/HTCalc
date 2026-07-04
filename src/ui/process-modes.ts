export type ProcessModeId = "adi" | "steel-austempering" | "martempering";
export type ProjectProcessModeId = ProcessModeId | "heat-treat-rfq";
export type ProcessModeStatus = "implemented" | "planned";

export interface ProcessMode {
  readonly id: ProjectProcessModeId;
  readonly label: string;
  readonly icon: string;
  readonly status: ProcessModeStatus;
  readonly description: string;
  readonly plannedInputs: readonly string[];
}

interface RenderedProcessMode extends ProcessMode {
  readonly id: ProcessModeId;
}

interface HeatTreatRfqProcessMode extends ProcessMode {
  readonly id: "heat-treat-rfq";
}

type AnyProcessMode = RenderedProcessMode | HeatTreatRfqProcessMode;

export const PROCESS_MODES: readonly AnyProcessMode[] = Object.freeze([
  {
    id: "adi",
    label: "ADI",
    icon: "ph-target",
    status: "implemented",
    description: "Austempered ductile iron process recommendation.",
    plannedInputs: [],
  },
  {
    id: "steel-austempering",
    label: "Steel Austempering",
    icon: "ph-thermometer-hot",
    status: "implemented",
    description: "Bainitic steel austempering process recommendation.",
    plannedInputs: [
      "Steel composition and hardenability",
      "Austenitizing temperature and soak",
      "Quench severity and transfer timing",
      "Austemper bath temperature and hold",
    ],
  },
  {
    id: "martempering",
    label: "Martempering",
    icon: "ph-lock-simple",
    status: "implemented",
    description: "Interrupted quench, equalization, and tempering process recommendation.",
    plannedInputs: [
      "Steel grade and martensite-start estimate",
      "Austenitizing temperature and soak",
      "Interrupted quench bath temperature",
      "Equalization, final cooling, and tempering plan",
    ],
  },
  {
    id: "heat-treat-rfq",
    label: "Heat-Treat RFQ",
    icon: "ph-currency-dollar",
    status: "implemented",
    description: "Heat-treatment service quote estimate.",
    plannedInputs: [],
  },
]);

export function getProcessMode(id: ProcessModeId): RenderedProcessMode;
export function getProcessMode(id: "heat-treat-rfq"): HeatTreatRfqProcessMode;
export function getProcessMode(id: ProjectProcessModeId): AnyProcessMode;
export function getProcessMode(id: ProjectProcessModeId): AnyProcessMode {
  const mode = PROCESS_MODES.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new RangeError(`Unknown process mode: ${id}`);
  }

  return mode;
}

export function implementedProcessModes(): readonly AnyProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "implemented");
}

export function plannedProcessModes(): readonly AnyProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "planned");
}
