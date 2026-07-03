import type {
  MartemperingInput,
  SteelAustemperingInput,
  SteelProcessRecommendation,
} from "../steel/index.js";
import type {
  ProjectMetadata,
  ValidationChecklistState,
} from "./project-state.js";
import {
  temperatureNominalLabel,
  temperatureRangeLabel,
  toDisplayValue,
  type UnitSystem,
  unitLabelForPath,
} from "./units.js";

export type SteelReportModeId = "steel-austempering" | "martempering";
export type SteelReportInput = SteelAustemperingInput | MartemperingInput;

export interface CreateSteelReportViewModelInput {
  readonly activeModeLabel: string;
  readonly unitSystem: UnitSystem;
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly input: SteelReportInput;
  readonly recommendation: SteelProcessRecommendation;
  readonly validationChecklist: ValidationChecklistState;
}

export interface SteelReportViewModel extends CreateSteelReportViewModelInput {
  readonly title: string;
}

export function createSteelReportViewModel(
  input: CreateSteelReportViewModelInput,
): SteelReportViewModel {
  return {
    ...structuredClone(input),
    title: `HTCalc ${input.activeModeLabel} Report`,
  };
}

export function serializeSteelReportMarkdown(report: SteelReportViewModel): string {
  const notes = report.metadata.notes.trim() || "No project notes entered.";
  const warningLines = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings.map((warning) => `- ${warning}`)
    : ["- No active risk warnings for the current input set."];
  const checklistLines = report.validationChecklist.items.length > 0
    ? report.validationChecklist.items.flatMap((item) => [
      `- [${item.checked ? "x" : " "}] ${item.label}`,
      ...(item.notes.trim() ? [`  Notes: ${item.notes.trim()}`] : []),
    ])
    : ["- [ ] No validation checks generated."];
  const criticalSectionPath = "geometry.criticalSectionMm";
  const criticalSection = formatNumber(toDisplayValue(
    criticalSectionPath,
    report.input.geometry.criticalSectionMm,
    report.unitSystem,
  ));
  const criticalSectionUnit = unitLabelForPath(criticalSectionPath, report.unitSystem, "mm");

  return [
    `# ${report.title}`,
    "",
    `Generated: ${report.exportedAt}`,
    `Process: ${report.activeModeLabel}`,
    "",
    "## Project",
    `Customer: ${report.metadata.customerName || "Unspecified"}`,
    `Part: ${report.metadata.partName || "Unspecified"}`,
    "",
    "### Notes",
    notes,
    "",
    "## Steel Input",
    `Composition: ${compositionLine(report.input)}`,
    `Starting condition: ${report.input.startingCondition}`,
    `Priority: ${report.input.target.priority}`,
    `Target hardness: ${report.input.target.targetHardnessHrc ?? "Unspecified"} HRC`,
    `Critical section: ${criticalSection} ${criticalSectionUnit}`,
    `Quench medium: ${report.input.equipment.quenchMedium}`,
    "",
    "## Transformation Estimates",
    `Ac1: ${report.recommendation.transformation.ac1C} °C`,
    `Ac3: ${report.recommendation.transformation.ac3C} °C`,
    `Ms: ${report.recommendation.transformation.msC} °C`,
    `Bainite start estimate: ${report.recommendation.transformation.bainiteStartC} °C`,
    `Hardenability score: ${report.recommendation.transformation.hardenabilityScore.toFixed(2)}`,
    `Retained austenite risk: ${report.recommendation.transformation.retainedAusteniteRisk.toFixed(2)}`,
    "",
    "## Process Windows",
    `- Austenitize: ${temperatureRangeLabel(report.recommendation.austenitize.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.austenitize.temperature, report.unitSystem)}; soak ${report.recommendation.austenitize.soakAfterCoreAtTemp.minMin}-${report.recommendation.austenitize.soakAfterCoreAtTemp.maxMin} min`,
    ...modeSpecificProcessLines(report),
    "",
    "## Scores",
    `Confidence: ${report.recommendation.confidence}`,
    `Window: ${report.recommendation.processingWindowStatus}`,
    "",
    "## Warnings",
    ...warningLines,
    "",
    "## Validation Checklist",
    ...checklistLines,
    "",
    "## Model Notes",
    "Model limitations: advisory first-pass windows only; validate against steel grade data, Jominy/CCT/TTT behavior, representative coupons, hardness traverse, and metallography before production use.",
    "",
  ].join("\n");
}

export function steelReportMarkdownFilename(
  modeId: SteelReportModeId,
  metadata: ProjectMetadata,
  exportedAt = new Date().toISOString(),
): string {
  const date = exportedAt.slice(0, 10);
  const slugParts = [metadata.customerName, metadata.partName]
    .map(slugify)
    .filter(Boolean);
  const prefix = slugParts.length > 0 ? `${slugParts.join("-")}-` : "";

  return `${prefix}htcalc-${modeId}-report-${date}.md`;
}

function modeSpecificProcessLines(report: SteelReportViewModel): string[] {
  if (report.recommendation.mode === "steel-austempering") {
    return [
      `- Austemper: ${temperatureRangeLabel(report.recommendation.austemper.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.austemper.temperature, report.unitSystem)}; hold ${report.recommendation.austemper.holdAfterCoreAtTemp.minMin}-${report.recommendation.austemper.holdAfterCoreAtTemp.maxMin} min`,
      `Expected structure: ${report.recommendation.expectedStructure}`,
      `Expected hardness: ${hardnessLabel(report.recommendation.expectedHardness)}`,
      `Final cool: ${report.recommendation.finalCoolGuidance}`,
    ];
  }

  return [
    `- Martemper: ${temperatureRangeLabel(report.recommendation.martemper.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.martemper.temperature, report.unitSystem)}`,
    `- Equalize: ${report.recommendation.equalize.minMin}-${report.recommendation.equalize.maxMin} min; nominal ${report.recommendation.equalize.nominalMin} min`,
    `As-quenched hardness: ${hardnessLabel(report.recommendation.asQuenchedHardness)}`,
    `Temper: ${temperatureRangeLabel(report.recommendation.temper.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.temper.temperature, report.unitSystem)}; hold ${report.recommendation.temper.hold.minMin}-${report.recommendation.temper.hold.maxMin} min; target ${report.recommendation.temper.targetHardnessHrc} HRC`,
    `Final cool: ${report.recommendation.finalCoolGuidance}`,
  ];
}

function compositionLine(input: SteelReportInput): string {
  return Object.entries(input.composition)
    .map(([key, value]) => `${key} ${formatNumber(value)}%`)
    .join(", ");
}

function hardnessLabel(hardness: { minHrc: number; nominalHrc: number; maxHrc: number }): string {
  return `${hardness.minHrc}-${hardness.maxHrc} HRC; nominal ${hardness.nominalHrc} HRC`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}
