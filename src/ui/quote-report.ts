import type {
  HeatTreatQuoteInput,
  HeatTreatQuoteRecommendation,
} from "../quote/index.js";
import type { ProjectMetadata } from "./project-state.js";

export interface CreateQuoteReportViewModelInput {
  readonly exportedAt: string;
  readonly metadata: ProjectMetadata;
  readonly input: HeatTreatQuoteInput;
  readonly recommendation: HeatTreatQuoteRecommendation;
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

export function serializeQuoteReportMarkdown(report: QuoteReportViewModel): string {
  const notes = report.metadata.notes.trim() || "No project notes entered.";
  const warningLines = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings.map((warning) => `- ${warning}`)
    : ["- No active quote warnings for the current input set."];
  const assumptionLines = report.recommendation.importedAssumptions.length > 0
    ? report.recommendation.importedAssumptions.map((assumption) => `- ${assumption}`)
    : ["- No imported assumptions."];
  const customerSummaryLines = report.recommendation.customerSummaryLines.length > 0
    ? report.recommendation.customerSummaryLines.map((line) => `- ${line}`)
    : ["- No customer quote summary lines generated."];
  const internalNoteLines = report.recommendation.internalNotes.length > 0
    ? report.recommendation.internalNotes.map((note) => `- ${note}`)
    : ["- No internal quote notes generated."];
  const validationCheckLines = report.recommendation.validationChecks.length > 0
    ? report.recommendation.validationChecks.map((check) => `- ${check}`)
    : ["- No validation checks generated."];

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
    `Price per kg: ${report.recommendation.pricePerKg === null ? "Unavailable" : formatMoney(report.recommendation.pricePerKg)}`,
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
