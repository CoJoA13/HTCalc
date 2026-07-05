import type {
  HeatTreatQuoteInput,
  HeatTreatQuoteRecommendation,
} from "../quote/index.js";
import type {
  ProjectMetadata,
  ValidationChecklistState,
} from "./project-state.js";
import {
  quotePerWeightDisplay,
} from "./quote-display.js";
import type {
  UnitSystem,
} from "./units.js";

export interface CreateQuoteReportViewModelInput {
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly unitSystem: UnitSystem;
  readonly input: HeatTreatQuoteInput;
  readonly recommendation: HeatTreatQuoteRecommendation;
  readonly validationChecklist: ValidationChecklistState;
}

export interface QuoteReportViewModel extends CreateQuoteReportViewModelInput {
  readonly title: string;
}

export function createQuoteReportViewModel(
  input: CreateQuoteReportViewModelInput,
): QuoteReportViewModel {
  return {
    ...structuredClone(input),
    title: "HTCalc Heat-Treat RFQ Report",
  };
}

export function displayQuoteCustomerSummaryLines(
  recommendation: HeatTreatQuoteRecommendation,
  unitSystem: UnitSystem,
): string[] {
  const perWeight = quotePerWeightDisplay(recommendation.pricePerKg, unitSystem);
  const perWeightLabel = `Price per ${perWeight.unit}`;
  const perWeightValue = perWeight.value === null ? "unavailable" : formatMoney(perWeight.value);

  return recommendation.customerSummaryLines.map((line) => (
    quoteCustomerSummaryLine(line, perWeightLabel, perWeightValue)
  ));
}

export function serializeQuoteReportMarkdown(report: QuoteReportViewModel): string {
  const notes = report.metadata.notes.trim() || "No project notes entered.";
  const warningLines = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings.map((warning) => `- ${warning}`)
    : ["- No active quote warnings for the current input set."];
  const assumptionLines = report.recommendation.importedAssumptions.length > 0
    ? report.recommendation.importedAssumptions.map((assumption) => `- ${assumption}`)
    : ["- No imported assumptions."];
  const internalNoteLines = report.recommendation.internalNotes.length > 0
    ? report.recommendation.internalNotes.map((note) => `- ${note}`)
    : ["- No internal quote notes generated."];
  const validationCheckLines = report.validationChecklist.items.length > 0
    ? report.validationChecklist.items.flatMap((item) => [
      `- ${item.checked ? "Checked" : "Open"}: ${item.label}`,
      ...(item.notes.trim() ? [`  Notes: ${item.notes.trim()}`] : []),
    ])
    : ["- No validation checks generated."];
  const perWeight = quotePerWeightDisplay(report.recommendation.pricePerKg, report.unitSystem);
  const perWeightLabel = `Price per ${perWeight.unit}`;
  const perWeightValue = perWeight.value === null ? "Unavailable" : formatMoney(perWeight.value);
  const customerSummaryLines = report.recommendation.customerSummaryLines.length > 0
    ? displayQuoteCustomerSummaryLines(report.recommendation, report.unitSystem).map((line) => `- ${line}`)
    : ["- No customer quote summary lines generated."];

  return [
    `# ${report.title}`,
    "",
    `Generated: ${report.exportedAt}`,
    "",
    "## Project",
    `Customer: ${report.metadata.customerName || "Unspecified"}`,
    `Part: ${report.metadata.partName || "Unspecified"}`,
    "",
    "### Notes",
    notes,
    "",
    "## Quote Summary",
    `Process source: ${report.recommendation.processSummary}`,
    `Source mode: ${report.recommendation.sourceMode}`,
    `Quantity: ${formatNumber(report.input.lot.quantity)}`,
    `Total weight: ${report.recommendation.totalWeightKg === null ? "Unavailable" : `${formatNumber(report.recommendation.totalWeightKg)} kg`}`,
    `Cycle count: ${report.recommendation.cycleCount ?? "Manual"}`,
    `Lot price: ${formatMoney(report.recommendation.lotPrice)}`,
    `Unit price: ${formatMoney(report.recommendation.unitPrice)}`,
    `${perWeightLabel}: ${perWeightValue}`,
    `Confidence: ${report.recommendation.confidence}`,
    "",
    "## Customer Quote Summary",
    ...customerSummaryLines,
    "",
    "## Quote Assumptions",
    ...assumptionLines,
    "",
    "## Pricing Warnings",
    ...warningLines,
    "",
    "## Billable Hours",
    `- Furnace: ${formatNumber(report.recommendation.billableHours.furnace)} h`,
    `- Bath/quench: ${formatNumber(report.recommendation.billableHours.bathQuench)} h`,
    `- Temper: ${formatNumber(report.recommendation.billableHours.temper)} h`,
    `- Labor: ${formatNumber(report.recommendation.billableHours.labor)} h`,
    "",
    "## Internal Cost Breakdown",
    `- Setup/admin: ${formatMoney(report.recommendation.breakdown.setupAdmin)}`,
    `- Furnace: ${formatMoney(report.recommendation.breakdown.furnace)}`,
    `- Bath/quench: ${formatMoney(report.recommendation.breakdown.bathQuench)}`,
    `- Temper: ${formatMoney(report.recommendation.breakdown.temper)}`,
    `- Labor: ${formatMoney(report.recommendation.breakdown.labor)}`,
    `- Inspection: ${formatMoney(report.recommendation.breakdown.inspection)}`,
    `- Consumables: ${formatMoney(report.recommendation.breakdown.consumables)}`,
    `- Handling/packaging: ${formatMoney(report.recommendation.breakdown.handlingPackaging)}`,
    `- Scrap/rework reserve: ${formatMoney(report.recommendation.breakdown.scrapReworkReserve)}`,
    `- Overhead: ${formatMoney(report.recommendation.breakdown.overhead)}`,
    `- Margin: ${formatMoney(report.recommendation.breakdown.margin)}`,
    `- Expedite: ${formatMoney(report.recommendation.breakdown.expedite)}`,
    `- Manual adder/discount: ${formatMoney(report.recommendation.breakdown.manualAdderDiscount)}`,
    `- Minimum charge adjustment: ${formatMoney(report.recommendation.breakdown.minimumChargeAdjustment)}`,
    `- Total: ${formatMoney(report.recommendation.breakdown.total)}`,
    "",
    "## Internal Notes",
    ...internalNoteLines,
    "",
    "## Validation Checks",
    ...validationCheckLines,
    "",
    "## Model Notes",
    "Heat-treatment service pricing only. This quote excludes material, machining, outside services, freight, tax, and contractual terms unless entered separately as manual adjustments.",
    "",
  ].join("\n");
}

export function quoteReportMarkdownFilename(
  metadata: ProjectMetadata,
  exportedAt = new Date().toISOString(),
): string {
  const date = exportedAt.slice(0, 10);
  const slugParts = [metadata.customerName, metadata.partName]
    .map(slugify)
    .filter(Boolean);
  const prefix = slugParts.length > 0 ? `${slugParts.join("-")}-` : "";

  return `${prefix}htcalc-heat-treat-rfq-${date}.md`;
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

function formatMoney(value: number): string {
  const amount = `$${Math.abs(value).toFixed(2)}`;
  return value < 0 ? `-${amount}` : amount;
}

function quoteCustomerSummaryLine(
  line: string,
  perWeightLabel: string,
  perWeightValue: string,
): string {
  if (line.startsWith("Price per kg:") || line.startsWith("Price per weight:")) {
    return `${perWeightLabel}: ${perWeightValue}`;
  }

  return line;
}
