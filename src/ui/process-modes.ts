export type ProcessModeId = "adi" | "steel-austempering" | "martempering";
export type ProcessModeStatus = "implemented" | "planned";

export interface ProcessMode {
  readonly id: ProcessModeId;
  readonly label: string;
  readonly icon: string;
  readonly status: ProcessModeStatus;
  readonly description: string;
  readonly plannedInputs: readonly string[];
}

export const PROCESS_MODES: readonly ProcessMode[] = Object.freeze([
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
    status: "planned",
    description: "Future steel austempering workflow for bainitic steel transformations.",
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
    status: "planned",
    description: "Future martempering workflow for interrupted quench and equalization control.",
    plannedInputs: [
      "Steel grade and martensite-start estimate",
      "Austenitizing temperature and soak",
      "Interrupted quench bath temperature",
      "Equalization, final cooling, and tempering plan",
    ],
  },
]);

export function getProcessMode(id: ProcessModeId): ProcessMode {
  const mode = PROCESS_MODES.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new RangeError(`Unknown process mode: ${id}`);
  }

  return mode;
}

export function implementedProcessModes(): readonly ProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "implemented");
}

export function plannedProcessModes(): readonly ProcessMode[] {
  return PROCESS_MODES.filter((mode) => mode.status === "planned");
}
