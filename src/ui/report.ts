import type {
  AdiModelCalibration,
  AdiProcessInput,
  AdiProcessRecommendation,
} from "../adi/index.js";
import type {
  ProjectMetadata,
  ValidationChecklistState,
} from "./project-state.js";
import {
  temperatureNominalLabel,
  temperatureRangeLabel,
  type UnitSystem,
} from "./units.js";
import type { ComparisonViewModel } from "./comparison.js";

export interface CreateReportViewModelInput {
  readonly activeModeLabel: string;
  readonly unitSystem: UnitSystem;
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly input: AdiProcessInput;
  readonly calibration: AdiModelCalibration;
  readonly recommendation: AdiProcessRecommendation;
  readonly validationChecklist: ValidationChecklistState;
  readonly comparison?: ComparisonViewModel;
}

export interface ReportViewModel extends CreateReportViewModelInput {
  readonly title: string;
}

export function createReportViewModel(input: CreateReportViewModelInput): ReportViewModel {
  return {
    ...structuredClone(input),
    title: `HTCalc ${input.activeModeLabel} Report`,
  };
}

export function serializeReportMarkdown(report: ReportViewModel): string {
  const warningLines = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings.map((warning) => `- ${warning}`)
    : ["- No active risk warnings for the current input set."];
  const checklistLines = report.validationChecklist.items.length > 0
    ? report.validationChecklist.items.flatMap((item) => [
      `- [${item.checked ? "x" : " "}] ${item.label}`,
      ...(item.notes.trim() ? [`  Notes: ${item.notes.trim()}`] : []),
    ])
    : ["- [ ] No validation checks generated."];
  const notes = report.metadata.notes.trim()
    ? report.metadata.notes.trim()
    : "No project notes entered.";
  const comparison = report.comparison ? comparisonLines(report.comparison) : [];

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
    "## Target",
    `ASTM grade: ${report.input.target.grade}`,
    `Priority: ${report.input.target.priority}`,
    `Critical section: ${formatNumber(report.input.geometry.criticalSectionMm)} mm`,
    "",
    "## Process Windows",
    `- Austenitize: ${temperatureRangeLabel(report.recommendation.austenitize.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.austenitize.temperature, report.unitSystem)}; soak ${report.recommendation.austenitize.soakAfterCoreAtTemp.minMin}-${report.recommendation.austenitize.soakAfterCoreAtTemp.maxMin} min`,
    `- Austemper: ${temperatureRangeLabel(report.recommendation.austemper.temperature, report.unitSystem)}; nominal ${temperatureNominalLabel(report.recommendation.austemper.temperature, report.unitSystem)}; hold ${report.recommendation.austemper.holdAfterCoreAtTemp.minMin}-${report.recommendation.austemper.holdAfterCoreAtTemp.maxMin} min`,
    `- Transfer: actual ${report.recommendation.transfer.actualTransferTimeSec} s; max ${report.recommendation.transfer.maxRecommendedTransferTimeSec} s`,
    "",
    "## Scores",
    `Confidence: ${report.recommendation.confidence}`,
    `AI: ${report.recommendation.scores.austemperabilityIndex.toFixed(2)}`,
    `Required AI: ${report.recommendation.scores.requiredAustemperabilityIndex.toFixed(2)}`,
    `CSR: ${report.recommendation.scores.carbideSegregationRisk.toFixed(2)}`,
    "",
    "## Warnings",
    ...warningLines,
    "",
    "## Validation Checklist",
    ...checklistLines,
    ...comparison,
    "",
    "## Calibration",
    ...Object.entries(report.calibration).map(([key, value]) => `- ${key}: ${value.toFixed(2)}`),
    "",
  ].join("\n");
}

export function reportMarkdownFilename(metadata: ProjectMetadata, exportedAt = new Date().toISOString()): string {
  const date = exportedAt.slice(0, 10);
  const slugParts = [metadata.customerName, metadata.partName]
    .map(slugify)
    .filter(Boolean);
  const prefix = slugParts.length > 0 ? `${slugParts.join("-")}-` : "";

  return `${prefix}htcalc-adi-report-${date}.md`;
}

function comparisonLines(comparison: ComparisonViewModel): string[] {
  return [
    "",
    "## Pinned Baseline Comparison",
    `Baseline: ${comparison.label}`,
    `Pinned at: ${comparison.pinnedAt}`,
    ...(comparison.summary.length > 0
      ? comparison.summary.map((item) => `- ${item}`)
      : ["- No comparison changes."]
    ),
    "",
    "| Metric | Baseline | Current | Delta |",
    "| --- | ---: | ---: | ---: |",
    ...comparison.rows.map((row) =>
      `| ${row.label} | ${row.baselineValue} | ${row.currentValue} | ${row.delta} |`
    ),
  ];
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
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
