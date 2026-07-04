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
    `Quantity: ${formatNumber(report.input.lot.quantity)}`,
    `Total weight: ${report.recommendation.totalWeightKg === null ? "Unavailable" : `${formatNumber(report.recommendation.totalWeightKg)} kg`}`,
    `Cycle count: ${report.recommendation.cycleCount ?? "Manual"}`,
    `Lot price: $${report.recommendation.lotPrice.toFixed(2)}`,
    `Unit price: $${report.recommendation.unitPrice.toFixed(2)}`,
    `Price per kg: ${report.recommendation.pricePerKg === null ? "Unavailable" : `$${report.recommendation.pricePerKg.toFixed(2)}`}`,
    `Confidence: ${report.recommendation.confidence}`,
    "",
    "## Quote Assumptions",
    ...assumptionLines,
    "",
    "## Pricing Warnings",
    ...warningLines,
    "",
    "## Internal Cost Breakdown",
    `- Setup/admin: $${report.recommendation.breakdown.setupAdmin.toFixed(2)}`,
    `- Furnace: $${report.recommendation.breakdown.furnace.toFixed(2)}`,
    `- Bath/quench: $${report.recommendation.breakdown.bathQuench.toFixed(2)}`,
    `- Temper: $${report.recommendation.breakdown.temper.toFixed(2)}`,
    `- Labor: $${report.recommendation.breakdown.labor.toFixed(2)}`,
    `- Inspection: $${report.recommendation.breakdown.inspection.toFixed(2)}`,
    `- Consumables: $${report.recommendation.breakdown.consumables.toFixed(2)}`,
    `- Handling/packaging: $${report.recommendation.breakdown.handlingPackaging.toFixed(2)}`,
    `- Scrap/rework reserve: $${report.recommendation.breakdown.scrapReworkReserve.toFixed(2)}`,
    `- Overhead: $${report.recommendation.breakdown.overhead.toFixed(2)}`,
    `- Margin: $${report.recommendation.breakdown.margin.toFixed(2)}`,
    `- Expedite: $${report.recommendation.breakdown.expedite.toFixed(2)}`,
    `- Manual adder/discount: $${report.recommendation.breakdown.manualAdderDiscount.toFixed(2)}`,
    `- Minimum charge adjustment: $${report.recommendation.breakdown.minimumChargeAdjustment.toFixed(2)}`,
    `- Total: $${report.recommendation.breakdown.total.toFixed(2)}`,
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
