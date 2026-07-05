import "@phosphor-icons/web/regular";
import "../ui/styles.css";
import {
  ASTM_A897_GRADES,
  DEFAULT_ADI_MODEL_CALIBRATION,
  recommendAdiProcess,
  type AdiModelCalibration,
  type AdiProcessInput,
  type AdiProcessRecommendation,
  type AstmA897Grade,
  type AtmosphereType,
  type AustemperBathType,
  type BathAgitation,
  type FurnaceType,
  type ProcessPriority,
  type StartingMatrix,
} from "../adi/index.js";
import {
  quoteAssumptionsFromAdi,
  quoteAssumptionsFromMartempering,
  quoteAssumptionsFromSteelAustempering,
  recommendHeatTreatQuote,
  type HeatTreatQuoteInput,
  type HeatTreatQuoteRecommendation,
  type HeatTreatQuoteSourceMode,
  type HeatTreatShopRates,
  type ImportedProcessAssumptions,
} from "../quote/index.js";
import {
  recommendMartemperingProcess,
  recommendSteelAustemperingProcess,
  type MartemperingInput,
  type SteelAustemperingInput,
  type SteelBaseInput,
  type SteelComposition,
  type SteelProcessRecommendation,
} from "../steel/index.js";
import {
  reconcileValidationChecklist,
} from "./checklist.js";
import {
  compareToBaseline,
  createPinnedComparisonBaseline,
  type ComparisonViewModel,
} from "./comparison.js";
import {
  getProcessMode,
  PROCESS_MODES,
  type ProcessMode,
  type ProcessModeId,
} from "./process-modes.js";
import {
  createProjectState,
  parseProjectState,
  serializeProjectState,
  type HtcalcProjectState,
  type ModeValidationChecklists,
  type PinnedComparisonBaseline,
  type ProjectMetadata,
  type ValidationChecklistState,
} from "./project-state.js";
import {
  createQuoteReportViewModel,
  displayQuoteCustomerSummaryLines,
  quoteReportMarkdownFilename,
  serializeQuoteReportMarkdown,
  type QuoteReportViewModel,
} from "./quote-report.js";
import {
  quotePerWeightDisplay,
} from "./quote-display.js";
import {
  deleteQuoteRatePreset,
  findQuoteRatePreset,
  loadQuoteRatePresetLibrary,
  mergeQuoteRatePresetLibraries,
  parseQuoteRatePresetLibraryJson,
  persistQuoteRatePresetLibrary,
  quoteRatePresetExportFilename,
  saveQuoteRatePreset,
  serializeQuoteRatePresetLibrary,
  sortedQuoteRatePresets,
  type QuoteRatePreset,
  type QuoteRatePresetLibrary,
} from "./quote-rate-presets.js";
import {
  defaultHeatTreatQuoteInput,
  setHeatTreatQuoteInputValue,
} from "./quote-state.js";
import {
  createReportViewModel,
  reportMarkdownFilename,
  serializeReportMarkdown,
  type ReportViewModel,
} from "./report.js";
import {
  createSteelReportViewModel,
  serializeSteelReportMarkdown,
  steelReportMarkdownFilename,
  type SteelReportModeId,
  type SteelReportViewModel,
} from "./steel-report.js";
import {
  defaultMartemperingInput,
  defaultSteelAustemperingInput,
  setMartemperingInputValue,
  setSteelAustemperingInputValue,
} from "./steel-state.js";
import {
  isUnitSensitivePath,
  temperatureNominalLabel,
  temperatureRangeLabel,
  toDisplayValue,
  type UnitSystem,
  unitLabelForPath,
} from "./units.js";
import {
  calibrationControlShouldSync,
  parseNumericInputValue,
  windowStatusBadge,
} from "./view-model.js";

type CompositionKey = keyof AdiProcessInput["composition"];
type CalibrationKey = keyof AdiModelCalibration;
type SteelCompositionKey = keyof SteelComposition;
type SteelModeId = "steel-austempering" | "martempering";

function isSteelModeId(modeId: ProcessModeId): modeId is SteelModeId {
  return modeId === "steel-austempering" || modeId === "martempering";
}

const compositionKeys: CompositionKey[] = [
  "C",
  "Si",
  "Mn",
  "Cu",
  "Ni",
  "Mo",
  "Cr",
  "Mg",
  "P",
  "S",
];

const steelCompositionKeys: SteelCompositionKey[] = [
  "C",
  "Mn",
  "Si",
  "Ni",
  "Cr",
  "Mo",
  "V",
  "Cu",
  "B",
];

const helpCopy: Record<string, string> = {
  ASTM: "ASTM A897 grade sets the strength, yield, elongation, and hardness target band.",
  ADI: "ADI means austempered ductile iron: ductile iron heat treated to an ausferritic matrix.",
  wt: "wt% means weight percent of the element in the chemistry.",
  C: "Carbon. Total iron carbon is mostly graphite; matrix carbon controls austenite stability.",
  Si: "Silicon. Suppresses carbide formation and can raise the needed austenitizing temperature.",
  Mn: "Manganese. Adds austemperability but increases segregation and carbide or martensite risk.",
  Cu: "Copper. Moderately increases austemperability with lower carbide risk than Mo or Cr.",
  Ni: "Nickel. Improves austemperability and toughness, but can increase retained austenite.",
  Mo: "Molybdenum. Strongly increases austemperability for thick sections but is segregation-prone.",
  Cr: "Chromium. Raises hardenability but strongly increases carbide risk in standard ADI.",
  Mg: "Magnesium. Supports graphite nodularity; poor nodularity can limit achievable properties.",
  P: "Phosphorus. A harmful residual that can form brittle cell-boundary films.",
  S: "Sulfur. A harmful residual that burdens Mg treatment and nodule quality.",
  AI: "Austemperability Index. Higher values mean better chance of avoiding pearlite during quench.",
  CSR: "Carbide Segregation Risk. Higher values flag Mn/Mo/Cr/P and section-size risk.",
  CP: "Carbon potential. Furnace atmosphere setting used to avoid surface decarb or carburization.",
  HBW: "Brinell hardness. Used with tensile results to validate the selected ADI grade.",
  "Dimensional Growth Sensitive":
    "Reduces recommended austenitizing temperature when dimensional change is a priority.",
  "Carbides Present":
    "Adds heat-treatment severity and warnings because carbides may not fully dissolve.",
  "Carbon Potential Control":
    "Indicates the furnace can hold a neutral carbon condition during austenitizing.",
  "Critical Section":
    "The section that controls heat-up, quench severity, and austemper hold timing.",
  "Nodule Count":
    "Graphite nodules per square millimeter. Low counts reduce confidence in property predictions.",
  Nodularity:
    "Percent of graphite present as acceptable nodules. Poor nodularity can invalidate grade targets.",
};

const calibrationFields: Array<{
  key: CalibrationKey;
  label: string;
  description: string;
  min: number;
  max: number;
  step: string;
}> = [
  {
    key: "alloyAustemperabilityScale",
    label: "Alloy hardenability scale",
    description: "Raises or lowers the Ni/Cu/Mo/Mn/Cr benefit in the AI score.",
    min: 0.5,
    max: 1.5,
    step: "0.01",
  },
  {
    key: "sectionPenaltyScale",
    label: "Section cooling penalty",
    description: "Adjusts how strongly critical section thickness penalizes austemperability.",
    min: 0.5,
    max: 1.75,
    step: "0.01",
  },
  {
    key: "transferPenaltyScale",
    label: "Transfer delay penalty",
    description: "Adjusts how strongly quench transfer time lowers austemperability.",
    min: 0.5,
    max: 1.75,
    step: "0.01",
  },
  {
    key: "agitationPenaltyScale",
    label: "Bath agitation penalty",
    description: "Adjusts how much poor or fair bath agitation hurts the AI score.",
    min: 0.5,
    max: 1.75,
    step: "0.01",
  },
  {
    key: "carbideSegregationScale",
    label: "Carbide sensitivity",
    description: "Scales the Mn/Mo/Cr/P segregation and carbide warning score.",
    min: 0.5,
    max: 1.75,
    step: "0.01",
  },
  {
    key: "temperatureAdjustmentScale",
    label: "Temperature adjustment scale",
    description: "Scales chemistry, section, carbide, and growth-sensitive temperature offsets.",
    min: 0.5,
    max: 1.5,
    step: "0.01",
  },
  {
    key: "soakTimeScale",
    label: "Austenitize soak scale",
    description: "Scales added soak time from section, matrix, silicon, alloys, and carbides.",
    min: 0.5,
    max: 2,
    step: "0.01",
  },
  {
    key: "holdTimeScale",
    label: "Austemper hold scale",
    description: "Scales the calculated minimum austemper hold after the core reaches bath range.",
    min: 0.5,
    max: 2,
    step: "0.01",
  },
];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("HTCalc app root was not found.");
}

const state: AdiProcessInput = {
  composition: {
    C: 3.6,
    Si: 2.5,
    Mn: 0.3,
    Cu: 0.8,
    Ni: 0.8,
    Mo: 0.2,
    Cr: 0.2,
    Mg: 0.045,
    P: 0.03,
    S: 0.01,
  },
  geometry: {
    maxSectionMm: 25,
    minSectionMm: 8,
    criticalSectionMm: 25,
    estimatedMassKg: 24,
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
};

let steelAustemperingState: SteelAustemperingInput = defaultSteelAustemperingInput();
let martemperingState: MartemperingInput = defaultMartemperingInput();
let heatTreatQuoteState: HeatTreatQuoteInput = defaultHeatTreatQuoteInput();
let quoteRatePresetLibrary: QuoteRatePresetLibrary = loadQuoteRatePresetLibrary();
let selectedQuoteRatePresetId = "";

type QuoteAccordionSectionId = "source" | "lot" | "rates" | "adjustments" | "review";

const quoteAccordionSectionMeta: Record<QuoteAccordionSectionId, {
  readonly title: string;
  readonly icon: string;
}> = {
  source: { title: "Source & Assumptions", icon: "ph-git-branch" },
  lot: { title: "Lot & Capacity", icon: "ph-package" },
  rates: { title: "Shop Rates", icon: "ph-currency-dollar" },
  adjustments: { title: "Overrides & Adjustments", icon: "ph-sliders" },
  review: { title: "Review & Export Readiness", icon: "ph-clipboard-text" },
};

let quoteAccordionOpenState: Record<QuoteAccordionSectionId, boolean> = {
  source: true,
  lot: true,
  rates: true,
  adjustments: false,
  review: true,
};

let manualQuoteProcessSummary = heatTreatQuoteState.processSummary;
let manualQuoteImportedProcess: ImportedProcessAssumptions = structuredClone(heatTreatQuoteState.importedProcess);
let calibration: AdiModelCalibration = { ...DEFAULT_ADI_MODEL_CALIBRATION };
let unitSystem: UnitSystem = "imperial";
let activeModeId: ProcessModeId = "adi";
let projectMetadata: ProjectMetadata = {
  customerName: "",
  partName: "",
  notes: "",
};
let validationChecklists: ModeValidationChecklists = {
  adi: { items: [] },
  "steel-austempering": { items: [] },
  martempering: { items: [] },
  "heat-treat-rfq": { items: [] },
};
let pinnedComparisonBaseline: PinnedComparisonBaseline | null = null;

app.innerHTML = `
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark">HT</div>
      <div>
        <div class="brand-title">HTCalc</div>
        <div class="brand-subtitle">Process recommendation workbench</div>
      </div>
    </div>
    <nav class="process-tabs" aria-label="Process mode">
      ${processTabs()}
    </nav>
    <div class="header-actions">
      <button class="icon-button" id="load-project" type="button" title="Load project"><i class="ph ph-folder-open"></i></button>
      <button class="icon-button" id="save-project" type="button" title="Save project"><i class="ph ph-floppy-disk"></i></button>
      <button class="primary-action" id="settings-open" type="button"><i class="ph ph-sliders-horizontal"></i> Settings</button>
    </div>
  </header>

  <input id="project-file-input" class="file-input" type="file" accept=".json,.htcalc.json,application/json" />
  <div class="project-status" id="project-status" role="status" aria-live="polite"></div>

  <main class="workspace" id="workspace">
    ${adiWorkspace()}
  </main>

  <div class="settings-backdrop" id="settings-backdrop" hidden>
    <section class="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="settings-header">
        <div>
          <div class="eyebrow">Settings</div>
          <h2 id="settings-title">Model Settings</h2>
        </div>
        <button class="icon-button" id="settings-close" type="button" title="Close settings">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="settings-copy">
        Units apply across process modes. ADI model calibration applies only to the ADI recommendation model.
      </div>
      <div class="settings-section">
        <div class="settings-section-title">Units</div>
        <div class="segmented-control" role="radiogroup" aria-label="Unit system">
          <label>
            <input type="radio" name="unit-system" value="imperial" checked />
            <span>Imperial</span>
          </label>
          <label>
            <input type="radio" name="unit-system" value="metric" />
            <span>Metric</span>
          </label>
        </div>
      </div>
      <div class="settings-section">
        <div class="settings-section-title">ADI Model Calibration</div>
        <div class="settings-grid">
          ${settingsFields()}
        </div>
      </div>
      <div class="settings-footer">
        <button class="secondary-action" id="settings-reset" type="button">Reset Defaults</button>
        <button class="primary-action" id="settings-done" type="button">Done</button>
      </div>
    </section>
  </div>

  <div class="report-backdrop" id="report-backdrop" hidden>
    <section class="report-panel" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div class="report-toolbar">
        <div>
          <div class="eyebrow">Report</div>
          <h2 id="report-title">Printable Review</h2>
        </div>
        <div class="report-toolbar-actions">
          <button class="icon-button" id="report-download" type="button" title="Download Markdown">
            <i class="ph ph-download-simple"></i>
          </button>
          <button class="icon-button" id="report-print" type="button" title="Print">
            <i class="ph ph-printer"></i>
          </button>
          <button class="icon-button" id="report-close" type="button" title="Close report">
            <i class="ph ph-x"></i>
          </button>
        </div>
      </div>
      <article class="report-document" id="report-document"></article>
    </section>
  </div>
`;

function adiWorkspace(): string {
  return `
    <section class="input-pane" aria-label="ADI inputs">
      <div class="section-block project-details-block">
        <div class="section-heading"><i class="ph ph-clipboard-text"></i><span>Project Details</span></div>
        <div class="field-grid metadata-grid">
          ${metadataField("customerName", "Customer", projectMetadata.customerName)}
          ${metadataField("partName", "Part", projectMetadata.partName)}
          ${metadataNotesField()}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-crosshair"></i><span>1. ASTM Target</span></div>
        <div class="field-grid target-grid">
          ${selectField("grade", "ASTM Grade", ASTM_A897_GRADES.map((g) => [g.grade, `${g.grade} (${g.processDirection})`]), state.target.grade, "ASTM")}
          ${selectField("priority", "Priority", [
            ["strength", "Strength"],
            ["ductility", "Ductility"],
            ["impact", "Impact"],
            ["wear", "Wear"],
            ["fatigue", "Fatigue"],
            ["machinability", "Machinability"],
          ], state.target.priority)}
          ${toggleField("dimensionalGrowthSensitive", "Dimensional Growth Sensitive")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-flask"></i><span>2. Chemical Composition (wt%)</span>${helpButton("wt")}</div>
        <div class="composition-grid">
          ${compositionKeys
            .map((key) => numberField(`composition.${key}`, key, state.composition[key], "0.001", "", key))
            .join("")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-cube"></i><span>3. Geometry</span></div>
        <div class="field-grid geometry-grid">
          ${numberField("geometry.maxSectionMm", "Max Section", state.geometry.maxSectionMm, "0.1", "mm")}
          ${numberField("geometry.criticalSectionMm", "Critical Section", state.geometry.criticalSectionMm, "0.1", "mm", "Critical Section")}
          ${numberField("geometry.minSectionMm", "Min Section", state.geometry.minSectionMm, "0.1", "mm")}
          ${numberField("geometry.estimatedMassKg", "Estimated Mass", state.geometry.estimatedMassKg ?? 0, "0.1", "kg")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-grains"></i><span>4. Microstructure & Quality</span></div>
        <div class="field-grid micro-grid">
          ${selectField("startingMatrix", "Starting Matrix", [
            ["ferritic", "Ferritic"],
            ["pearlitic", "Pearlitic"],
            ["ferritic-pearlitic", "Ferritic-Pearlitic"],
          ], state.microstructure.startingMatrix)}
          ${toggleField("carbidesPresent", "Carbides Present")}
          ${numberField("microstructure.noduleCountPerMm2", "Nodule Count", state.microstructure.noduleCountPerMm2 ?? 0, "1", "/mm²", "Nodule Count")}
          ${numberField("microstructure.nodularityPercent", "Nodularity", state.microstructure.nodularityPercent ?? 0, "1", "%", "Nodularity")}
        </div>
      </div>

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-factory"></i><span>5. Equipment & Process Constraints</span></div>
        <div class="field-grid equipment-grid">
          ${selectField("furnaceType", "Austenitizing Furnace", [
            ["controlled-atmosphere", "Controlled Atmosphere"],
            ["air", "Air"],
            ["vacuum", "Vacuum"],
            ["inert", "Inert"],
            ["salt", "Salt"],
          ], state.equipment.furnaceType)}
          ${selectField("atmosphereType", "Atmosphere", [
            ["endothermic-neutral", "Endothermic Neutral"],
            ["nitrogen-methanol", "Nitrogen-Methanol"],
            ["nitrogen-hydrocarbon", "Nitrogen-Hydrocarbon"],
            ["vacuum", "Vacuum"],
            ["inert", "Inert"],
            ["air", "Air"],
            ["salt", "Salt"],
            ["unknown", "Unknown"],
          ], state.equipment.atmosphereType)}
          ${selectField("bathAgitation", "Bath Agitation", [
            ["poor", "Poor"],
            ["fair", "Fair"],
            ["good", "Good"],
          ], state.equipment.bathAgitation)}
          ${selectField("austemperBathType", "Austemper Medium", [
            ["salt", "Salt Bath"],
            ["fluidized-bed", "Fluidized Bed"],
            ["other", "Other"],
          ], state.equipment.austemperBathType)}
          ${numberField("equipment.quenchTransferTimeSec", "Transfer Time", state.equipment.quenchTransferTimeSec, "0.1", "s")}
          ${numberField("equipment.bathUniformityC", "Bath Uniformity", state.equipment.bathUniformityC, "0.1", "°C")}
          ${toggleField("carbonPotentialControl", "Carbon Potential Control", true)}
        </div>
      </div>
    </section>

    <aside class="result-pane" aria-label="ADI recommendation">
      <div id="recommendation"></div>
    </aside>
  `;
}

function plannedWorkspace(mode: ProcessMode): string {
  return `
    <section class="planned-pane" aria-label="${mode.label} planned mode">
      <div class="planned-header">
        <div class="planned-icon"><i class="ph ${mode.icon}"></i></div>
        <div>
          <div class="eyebrow">Planned Process Mode</div>
          <h1>${mode.label}</h1>
          <p>${mode.description}</p>
        </div>
      </div>
      <div class="planned-body">
        <div class="result-title"><i class="ph ph-list-checks"></i> Future Input Groups</div>
        <ul class="check-list">
          ${mode.plannedInputs.map((input) => `<li>${input}</li>`).join("")}
        </ul>
      </div>
    </section>
  `;
}

function quoteWorkspace(): string {
  const input = quoteWorkspaceInput();
  normalizeSelectedQuoteRatePresetId();
  const selectedPreset = selectedQuoteRatePreset();
  const activePreset = activeQuoteRatePreset(input);
  const readiness = quoteReviewReadiness(input, activePreset);
  const statuses = quoteAccordionStatusMap(input, selectedPreset, activePreset, readiness);

  return `
    <section class="input-pane" aria-label="Heat-treat RFQ inputs">
      ${projectDetailsSection()}

      <div class="quote-accordion-stack">
        ${quoteAccordionSection("source", statuses.source, `
          <div class="field-grid target-grid">
            ${quoteSelectField("sourceMode", "Source", [
              ["adi", "Use current ADI recipe"],
              ["steel-austempering", "Use current Steel Austempering recipe"],
              ["martempering", "Use current Martempering recipe"],
              ["manual", "Manual quote"],
            ], input.sourceMode)}
            ${quoteTextField("processSummary", "Process Summary", input.processSummary, input.sourceMode !== "manual")}
          </div>
          ${quoteImportedAssumptionsSummary(input)}
        `)}

        ${quoteAccordionSection("lot", statuses.lot, `
          <div class="field-grid geometry-grid">
            ${quoteNumberField("lot.quantity", "Quantity", input.lot.quantity, "1", "pcs")}
            ${quoteNumberField("lot.pieceWeightKg", "Piece Weight", input.lot.pieceWeightKg, "0.1", "kg")}
            ${quoteNumberField("lot.totalWeightKg", "Total Weight", input.lot.totalWeightKg, "0.1", "kg")}
            ${quoteNumberField("lot.loadCapacityKg", "Load Capacity", input.lot.loadCapacityKg, "0.1", "kg")}
            ${quoteNumberField("lot.laborHoursPerLoad", "Labor/Load", input.lot.laborHoursPerLoad, "0.1", "h")}
            ${quoteNumberField("lot.cycleCountOverride", "Cycle Override", input.lot.cycleCountOverride, "1", "cycles")}
          </div>
        `)}

        ${quoteAccordionSection("rates", statuses.rates, `
          ${quoteRatePresetControls()}
          <div class="quote-rate-groups">
            <div class="quote-rate-group">
              <div class="quote-rate-group-title">Fixed charges</div>
              <div class="field-grid equipment-grid">
                ${quoteNumberField("shopRates.minimumLotCharge", "Minimum Lot", input.shopRates.minimumLotCharge, "1", "$")}
                ${quoteNumberField("shopRates.setupAdminCharge", "Setup/Admin", input.shopRates.setupAdminCharge, "1", "$")}
                ${quoteNumberField("shopRates.inspectionBaseCharge", "Inspection", input.shopRates.inspectionBaseCharge, "1", "$")}
                ${quoteNumberField("shopRates.handlingPackagingCharge", "Handling/Pkg", input.shopRates.handlingPackagingCharge, "1", "$")}
              </div>
            </div>
            <div class="quote-rate-group">
              <div class="quote-rate-group-title">Hourly and equipment</div>
              <div class="field-grid equipment-grid">
                ${quoteNumberField("shopRates.laborRatePerHour", "Labor Rate", input.shopRates.laborRatePerHour, "1", "$/h")}
                ${quoteNumberField("shopRates.furnaceRatePerHour", "Furnace Rate", input.shopRates.furnaceRatePerHour, "1", "$/h")}
                ${quoteNumberField("shopRates.bathQuenchRatePerHour", "Bath/Quench Rate", input.shopRates.bathQuenchRatePerHour, "1", "$/h")}
                ${quoteNumberField("shopRates.temperFurnaceRatePerHour", "Temper Rate", input.shopRates.temperFurnaceRatePerHour, "1", "$/h")}
              </div>
            </div>
            <div class="quote-rate-group">
              <div class="quote-rate-group-title">Consumables and margin policy</div>
              <div class="field-grid equipment-grid">
                ${quoteNumberField("shopRates.consumablesPerKg", "Consumables", input.shopRates.consumablesPerKg, "0.01", "$/kg")}
                ${quoteNumberField("shopRates.overheadPercent", "Overhead", input.shopRates.overheadPercent, "0.1", "%")}
                ${quoteNumberField("shopRates.targetMarginPercent", "Margin", input.shopRates.targetMarginPercent, "0.1", "%")}
              </div>
            </div>
          </div>
        `)}

        ${quoteAccordionSection("adjustments", statuses.adjustments, `
          <div class="field-grid equipment-grid">
            ${quoteNumberField("manualOverrides.billableFurnaceHours", "Furnace Hours", input.manualOverrides.billableFurnaceHours, "0.1", "h")}
            ${quoteNumberField("manualOverrides.billableBathQuenchHours", "Bath/Quench Hours", input.manualOverrides.billableBathQuenchHours, "0.1", "h")}
            ${quoteNumberField("manualOverrides.billableTemperHours", "Temper Hours", input.manualOverrides.billableTemperHours, "0.1", "h")}
            ${quoteNumberField("manualOverrides.billableLaborHours", "Labor Hours", input.manualOverrides.billableLaborHours, "0.1", "h")}
            ${quoteNumberField("manualOverrides.billableCycleCount", "Billable Cycles", input.manualOverrides.billableCycleCount, "1", "cycles")}
            ${quoteNumberField("adjustments.complexityFactor", "Complexity", input.adjustments.complexityFactor, "0.05", "x")}
            ${quoteNumberField("adjustments.scrapReworkReservePercent", "Scrap Reserve", input.adjustments.scrapReworkReservePercent, "0.1", "%")}
            ${quoteNumberField("adjustments.expediteMultiplier", "Expedite", input.adjustments.expediteMultiplier, "0.05", "x")}
            ${quoteNumberField("adjustments.manualAdderDiscount", "Adder/Discount", input.adjustments.manualAdderDiscount, "1", "$")}
          </div>
        `)}

        ${quoteAccordionSection("review", statuses.review, quoteReviewReadinessPanel(readiness))}
      </div>
    </section>

    <aside class="result-pane" aria-label="Heat-treat RFQ recommendation">
      <div id="recommendation"></div>
    </aside>
  `;
}

function quoteRatePresetControls(): string {
  const presets = sortedQuoteRatePresets(quoteRatePresetLibrary);
  const hasPresets = presets.length > 0;
  const options = hasPresets
    ? presets
        .map((preset) => {
          const selected = preset.id === selectedQuoteRatePresetId ? " selected" : "";
          return `<option value="${escapeAttribute(preset.id)}"${selected}>${escapeHtml(preset.name)}</option>`;
        })
        .join("")
    : `<option value="">No saved presets</option>`;
  const disabled = hasPresets ? "" : " disabled";

  return `
    <div class="quote-rate-presets" data-quote-rate-presets>
      <label class="field quote-rate-preset-field" for="quote-rate-preset-select">
        <span class="field-label">Rate Preset</span>
        <select id="quote-rate-preset-select"${disabled}>
          ${options}
        </select>
      </label>
      <div class="quote-rate-preset-actions">
        <button class="secondary-action" type="button" data-quote-rate-preset-action="apply"${disabled}>
          <i class="ph ph-check"></i><span>Apply</span>
        </button>
        <button class="secondary-action" type="button" data-quote-rate-preset-action="save">
          <i class="ph ph-floppy-disk"></i><span>Save Current</span>
        </button>
        <button class="secondary-action" type="button" data-quote-rate-preset-action="import">
          <i class="ph ph-upload-simple"></i><span>Import</span>
        </button>
        <button class="secondary-action" type="button" data-quote-rate-preset-action="export"${disabled}>
          <i class="ph ph-download-simple"></i><span>Export</span>
        </button>
        <button class="secondary-action" type="button" data-quote-rate-preset-action="delete"${disabled}>
          <i class="ph ph-trash"></i><span>Delete</span>
        </button>
        <input id="quote-rate-preset-import-input" class="file-input" type="file" accept=".json,application/json" />
      </div>
    </div>
  `;
}

function normalizeSelectedQuoteRatePresetId(): void {
  const presets = sortedQuoteRatePresets(quoteRatePresetLibrary);
  const selectedPresetIsValid = presets.some((preset) => preset.id === selectedQuoteRatePresetId);
  selectedQuoteRatePresetId = selectedPresetIsValid
    ? selectedQuoteRatePresetId
    : presets[0]?.id ?? "";
}

function quoteWorkspaceInput(): HeatTreatQuoteInput {
  if (heatTreatQuoteState.sourceMode === "manual") {
    return heatTreatQuoteState;
  }

  try {
    return quoteInputForCurrentState();
  } catch {
    return heatTreatQuoteState;
  }
}

interface QuoteReviewReadiness {
  readonly status: string;
  readonly warningCount: number;
  readonly openCheckCount: number;
  readonly sourceLabel: string;
  readonly processLabel: string;
  readonly ratePresetLabel: string;
}

function quoteReviewReadiness(input: HeatTreatQuoteInput, selectedPreset: QuoteRatePreset | undefined): QuoteReviewReadiness {
  const fallbackChecklist = validationChecklists["heat-treat-rfq"];
  let status = "Needs basis";
  let warningCount = 0;
  let openCheckCount = fallbackChecklist.items.filter((item) => !item.checked).length;

  if (quoteInputHasPricingBasis(input)) {
    try {
      const result = recommendHeatTreatQuote(input);
      const checklist = reconcileValidationChecklist(fallbackChecklist, result.validationChecks);
      warningCount = result.warnings.length;
      openCheckCount = checklist.items.filter((item) => !item.checked).length;
      status = warningCount > 0 ? "Warnings" : "Ready";
    } catch {
      status = "Needs inputs";
    }
  }

  return {
    status,
    warningCount,
    openCheckCount,
    sourceLabel: quoteSourceLabel(input.sourceMode),
    processLabel: input.importedProcess.processLabel || input.processSummary,
    ratePresetLabel: selectedPreset ? quoteRatePresetDisplayName(selectedPreset) : "Custom rates",
  };
}

function quoteAccordionStatusMap(
  input: HeatTreatQuoteInput,
  selectedPreset: QuoteRatePreset | undefined,
  activePreset: QuoteRatePreset | undefined,
  readiness: QuoteReviewReadiness,
): Record<QuoteAccordionSectionId, string> {
  return {
    source: input.sourceMode === "manual" ? "Manual" : "Imported",
    lot: input.lot.cycleCountOverride !== undefined ? "Cycle override" : "6 fields",
    rates: activePreset ? quoteRatePresetDisplayName(activePreset) : selectedPreset ? "Custom rates" : "No preset",
    adjustments: quoteHasActiveOverridesOrAdjustments(input) ? "Overrides active" : "Optional",
    review: readiness.status,
  };
}

function quoteHasActiveOverridesOrAdjustments(input: HeatTreatQuoteInput): boolean {
  return (
    input.manualOverrides.billableFurnaceHours !== undefined ||
    input.manualOverrides.billableBathQuenchHours !== undefined ||
    input.manualOverrides.billableTemperHours !== undefined ||
    input.manualOverrides.billableLaborHours !== undefined ||
    input.manualOverrides.billableCycleCount !== undefined ||
    input.adjustments.complexityFactor !== 1 ||
    input.adjustments.scrapReworkReservePercent !== 0 ||
    input.adjustments.expediteMultiplier !== 1 ||
    input.adjustments.manualAdderDiscount !== 0
  );
}

function quoteImportedAssumptionsSummary(input: HeatTreatQuoteInput): string {
  if (input.sourceMode === "manual") {
    return `
      <div class="quote-assumption-summary">
        <div><span>Source</span><strong>Manual quote</strong></div>
        <div><span>Trace</span><strong>User-entered pricing basis</strong></div>
      </div>
    `;
  }

  const imported = input.importedProcess;
  const timeLines = [
    imported.austenitizeMinutes ? `Austenitize ${formatNumber(imported.austenitizeMinutes.nominalMin)} min` : "",
    imported.bathMinutes ? `Bath ${formatNumber(imported.bathMinutes.nominalMin)} min` : "",
    imported.temperMinutes ? `Temper ${formatNumber(imported.temperMinutes.nominalMin)} min x ${imported.temperCount}` : "",
  ].filter(Boolean);

  return `
    <div class="quote-assumption-summary">
      <div><span>Process</span><strong>${escapeHtml(imported.processLabel)}</strong></div>
      <div><span>Confidence</span><strong>${escapeHtml(imported.processConfidence)}</strong></div>
      <div><span>Time Basis</span><strong>${escapeHtml(timeLines.join(" | ") || "No imported time basis")}</strong></div>
    </div>
  `;
}

function quoteReviewReadinessPanel(readiness: QuoteReviewReadiness): string {
  return `
    <div class="quote-review-readiness" data-quote-review-readiness>
      <dl class="quote-review-list">
        <div class="quote-review-row"><dt>Source</dt><dd>${escapeHtml(readiness.sourceLabel)}</dd></div>
        <div class="quote-review-row"><dt>Process</dt><dd>${escapeHtml(readiness.processLabel)}</dd></div>
        <div class="quote-review-row"><dt>Rates</dt><dd>${escapeHtml(readiness.ratePresetLabel)}</dd></div>
        <div class="quote-review-row"><dt>Warnings</dt><dd>${readiness.warningCount}</dd></div>
        <div class="quote-review-row"><dt>Open checks</dt><dd>${readiness.openCheckCount}</dd></div>
      </dl>
      <p class="quote-review-note">
        Heat-treatment service pricing only. Excludes material, machining, outside services, freight, tax, and contract terms unless manually adjusted.
      </p>
    </div>
  `;
}

function quoteAccordionSection(
  id: QuoteAccordionSectionId,
  status: string,
  body: string,
): string {
  const meta = quoteAccordionSectionMeta[id];
  const isOpen = quoteAccordionOpenState[id];
  const panelId = `quote-accordion-${id}-panel`;
  const buttonId = `quote-accordion-${id}-button`;

  return `
    <section class="quote-accordion-section ${isOpen ? "is-open" : "is-collapsed"}" data-quote-accordion-section="${id}">
      <h2 class="quote-accordion-heading">
        <button
          id="${buttonId}"
          class="quote-accordion-toggle"
          type="button"
          data-quote-accordion-toggle="${id}"
          aria-expanded="${isOpen ? "true" : "false"}"
          aria-controls="${panelId}"
        >
          <span class="quote-accordion-title"><i class="ph ${meta.icon}"></i>${escapeHtml(meta.title)}</span>
          <span class="quote-accordion-status" data-quote-accordion-status="${id}">${escapeHtml(status)}</span>
          <i class="ph ph-caret-down quote-accordion-chevron" aria-hidden="true"></i>
        </button>
      </h2>
      <div
        id="${panelId}"
        class="quote-accordion-panel"
        data-quote-accordion-panel="${id}"
        role="region"
        aria-labelledby="${buttonId}"
        ${isOpen ? "" : "hidden"}
      >
        ${body}
      </div>
    </section>
  `;
}

function steelAustemperingWorkspace(): string {
  return `
    <section class="input-pane" aria-label="Steel austempering inputs">
      ${projectDetailsSection()}
      ${steelSharedInputSections(steelAustemperingState)}

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-drop"></i><span>6. Austempering</span></div>
        <div class="field-grid equipment-grid">
          ${steelSelectField("austemper.bainiteTarget", "Bainite Target", [
            ["upper", "Upper Bainite"],
            ["lower", "Lower Bainite"],
            ["balanced", "Balanced"],
          ], steelAustemperingState.austemper.bainiteTarget)}
          ${steelSelectField("austemper.bathMedium", "Bath Medium", [
            ["salt", "Salt"],
            ["hot-oil", "Hot Oil"],
            ["fluidized-bed", "Fluidized Bed"],
            ["furnace", "Furnace Hold"],
            ["other", "Other"],
          ], steelAustemperingState.austemper.bathMedium)}
          ${steelNumberField("austemper.bathTemperatureC", "Requested Bath", steelAustemperingState.austemper.bathTemperatureC, "1", "°C")}
          ${steelNumberField("austemper.maxHoldMin", "Max Hold", steelAustemperingState.austemper.maxHoldMin, "1", "min")}
        </div>
      </div>
    </section>

    <aside class="result-pane" aria-label="Steel austempering recommendation">
      <div id="recommendation"></div>
    </aside>
  `;
}

function martemperingWorkspace(): string {
  return `
    <section class="input-pane" aria-label="Martempering inputs">
      ${projectDetailsSection()}
      ${steelSharedInputSections(martemperingState)}

      <div class="section-block">
        <div class="section-heading"><i class="ph ph-lock-simple"></i><span>6. Martempering & Tempering</span></div>
        <div class="field-grid equipment-grid">
          ${steelSelectField("martemper.bathMedium", "Bath Medium", [
            ["salt", "Salt"],
            ["hot-oil", "Hot Oil"],
            ["polymer", "Polymer"],
            ["other", "Other"],
          ], martemperingState.martemper.bathMedium)}
          ${steelNumberField("martemper.bathTemperatureC", "Requested Bath", martemperingState.martemper.bathTemperatureC, "1", "°C")}
          ${steelSelectField("martemper.equalizationStrategy", "Equalization", [
            ["section-equalized", "Section Equalized"],
            ["surface-equalized", "Surface Equalized"],
            ["time-limited", "Time Limited"],
          ], martemperingState.martemper.equalizationStrategy)}
          ${steelNumberField("martemper.maxEqualizationMin", "Max Equalize", martemperingState.martemper.maxEqualizationMin, "1", "min")}
          ${steelNumberField("martemper.temperHoldMin", "Temper Hold", martemperingState.martemper.temperHoldMin, "1", "min")}
          ${steelNumberField("martemper.temperCount", "Tempers", martemperingState.martemper.temperCount, "1", "")}
        </div>
      </div>
    </section>

    <aside class="result-pane" aria-label="Martempering recommendation">
      <div id="recommendation"></div>
    </aside>
  `;
}

function projectDetailsSection(): string {
  return `
    <div class="section-block project-details-block">
      <div class="section-heading"><i class="ph ph-clipboard-text"></i><span>Project Details</span></div>
      <div class="field-grid metadata-grid">
        ${metadataField("customerName", "Customer", projectMetadata.customerName)}
        ${metadataField("partName", "Part", projectMetadata.partName)}
        ${metadataNotesField()}
      </div>
    </div>
  `;
}

function steelSharedInputSections(input: SteelBaseInput): string {
  return `
    <div class="section-block">
      <div class="section-heading"><i class="ph ph-flask"></i><span>1. Steel Chemistry (wt%)</span>${helpButton("wt")}</div>
      <div class="composition-grid">
        ${steelCompositionKeys
          .map((key) => steelNumberField(`composition.${key}`, key, input.composition[key], "0.001", "", key))
          .join("")}
      </div>
    </div>

    <div class="section-block">
      <div class="section-heading"><i class="ph ph-cube"></i><span>2. Geometry</span></div>
      <div class="field-grid geometry-grid">
        ${steelNumberField("geometry.maxSectionMm", "Max Section", input.geometry.maxSectionMm, "0.1", "mm")}
        ${steelNumberField("geometry.criticalSectionMm", "Critical Section", input.geometry.criticalSectionMm, "0.1", "mm", "Critical Section")}
        ${steelNumberField("geometry.minSectionMm", "Min Section", input.geometry.minSectionMm, "0.1", "mm")}
        ${steelNumberField("geometry.estimatedMassKg", "Estimated Mass", input.geometry.estimatedMassKg ?? 0, "0.1", "kg")}
      </div>
    </div>

    <div class="section-block">
      <div class="section-heading"><i class="ph ph-crosshair"></i><span>3. Target</span></div>
      <div class="field-grid target-grid">
        ${steelSelectField("startingCondition", "Starting Condition", [
          ["normalized", "Normalized"],
          ["annealed", "Annealed"],
          ["spheroidized", "Spheroidized"],
          ["quenched-tempered", "Quenched & Tempered"],
          ["hot-rolled", "Hot Rolled"],
          ["unknown", "Unknown"],
        ], input.startingCondition)}
        ${steelSelectField("target.priority", "Priority", [
          ["hardness", "Hardness"],
          ["toughness", "Toughness"],
          ["distortion", "Distortion"],
          ["wear", "Wear"],
          ["fatigue", "Fatigue"],
        ], input.target.priority)}
        ${steelNumberField("target.targetHardnessHrc", "Target Hardness", input.target.targetHardnessHrc ?? 0, "0.5", "HRC")}
      </div>
    </div>

    <div class="section-block">
      <div class="section-heading"><i class="ph ph-factory"></i><span>4. Equipment & Quench</span></div>
      <div class="field-grid equipment-grid">
        ${steelSelectField("equipment.furnaceType", "Austenitizing Furnace", [
          ["controlled-atmosphere", "Controlled Atmosphere"],
          ["air", "Air"],
          ["vacuum", "Vacuum"],
          ["inert", "Inert"],
          ["salt", "Salt"],
        ], input.equipment.furnaceType)}
        ${steelSelectField("equipment.atmosphereType", "Atmosphere", [
          ["endothermic-neutral", "Endothermic Neutral"],
          ["nitrogen-methanol", "Nitrogen-Methanol"],
          ["vacuum", "Vacuum"],
          ["inert", "Inert"],
          ["air", "Air"],
          ["salt", "Salt"],
          ["unknown", "Unknown"],
        ], input.equipment.atmosphereType)}
        ${steelSelectField("equipment.quenchMedium", "Quench Medium", [
          ["water", "Water"],
          ["oil", "Oil"],
          ["polymer", "Polymer"],
          ["salt", "Salt"],
          ["hot-oil", "Hot Oil"],
          ["air", "Air"],
          ["furnace", "Furnace"],
          ["other", "Other"],
        ], input.equipment.quenchMedium)}
        ${steelSelectField("equipment.agitation", "Agitation", [
          ["poor", "Poor"],
          ["fair", "Fair"],
          ["good", "Good"],
        ], input.equipment.agitation)}
        ${steelNumberField("equipment.transferTimeSec", "Transfer Time", input.equipment.transferTimeSec, "0.1", "s")}
        ${steelNumberField("equipment.bathUniformityC", "Bath Uniformity", input.equipment.bathUniformityC, "0.1", "°C")}
        ${steelToggleField("equipment.carbonProtection", "Carbon Protection", input.equipment.carbonProtection)}
      </div>
    </div>
  `;
}

function processTabs(): string {
  return PROCESS_MODES.map((mode) => `
    <button
      class="process-tab ${mode.id === activeModeId ? "is-active" : ""} ${mode.status === "planned" ? "is-planned" : ""}"
      type="button"
      data-process-mode="${mode.id}"
    >
      <i class="ph ${mode.icon}"></i>
      ${mode.label}
      ${mode.status === "planned" ? `<span>Planned</span>` : ""}
    </button>
  `).join("");
}

const workspaceRoot = document.querySelector<HTMLElement>("#workspace");

if (!workspaceRoot) {
  throw new Error("HTCalc workspace was not found.");
}

const workspaceEl = workspaceRoot;

bindProcessTabs();
bindAdiInputs();
bindHelpButtons();
bindProjectActions();
bindSettings();
bindReportDialog();
renderRecommendation();

function bindAdiInputs(): void {
  bindMetadataInputs();

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-path]").forEach((control) => {
    control.addEventListener("input", () => {
      setValue(control.dataset.path ?? "", control);
      renderRecommendation();
    });
  });

  bindCheckbox("dimensionalGrowthSensitive", (checked) => {
    state.target.dimensionalGrowthSensitive = checked;
  });
  bindCheckbox("carbidesPresent", (checked) => {
    state.microstructure.carbidesPresent = checked;
  });
  bindCheckbox("carbonPotentialControl", (checked) => {
    state.equipment.carbonPotentialControl = checked;
  });
}

function bindSteelInputs(modeId: SteelModeId): void {
  bindMetadataInputs();

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-steel-path]").forEach((control) => {
    const eventName = control instanceof HTMLInputElement && control.type === "checkbox" ? "change" : "input";
    control.addEventListener(eventName, () => {
      setSteelValue(modeId, control.dataset.steelPath ?? "", control);
      renderSteelRecommendation(modeId);
    });
  });
}

function bindQuoteInputs(): void {
  bindMetadataInputs();

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-quote-path]").forEach((control) => {
    const eventName = control instanceof HTMLSelectElement ? "change" : "input";
    control.addEventListener(eventName, () => {
      const path = control.dataset.quotePath ?? "";
      const previousSourceMode = heatTreatQuoteState.sourceMode;
      const value = control instanceof HTMLInputElement && control.type === "number"
        ? parseNumericInputValue(path, control.value, unitSystem)
        : control.value;

      if (path === "sourceMode" && previousSourceMode === "manual") {
        captureManualQuoteSource();
      }

      setHeatTreatQuoteInputValue(heatTreatQuoteState, path, value);

      if (path === "sourceMode") {
        if (heatTreatQuoteState.sourceMode === "manual") {
          restoreManualQuoteSource();
        } else {
          try {
            refreshQuoteSourceSummary();
          } catch (error) {
            showProjectStatus(error instanceof Error ? error.message : "Could not import quote assumptions.", true);
          }
        }
        renderWorkspace();
        return;
      }

      if (path === "processSummary" && heatTreatQuoteState.sourceMode === "manual") {
        syncManualQuoteSource();
      }

      renderQuoteRecommendation();
      refreshQuoteAccordionSummary();
    });
  });

  bindQuoteAccordionControls();
  bindQuoteRatePresetControls();
}

function bindQuoteAccordionControls(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-quote-accordion-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.quoteAccordionToggle as QuoteAccordionSectionId | undefined;
      if (!sectionId || !(sectionId in quoteAccordionOpenState)) {
        return;
      }

      quoteAccordionOpenState = {
        ...quoteAccordionOpenState,
        [sectionId]: !quoteAccordionOpenState[sectionId],
      };
      renderWorkspace();
    });
  });
}

function refreshQuoteAccordionSummary(): void {
  const input = quoteWorkspaceInput();
  const selectedPreset = selectedQuoteRatePreset();
  const activePreset = activeQuoteRatePreset(input);
  const readiness = quoteReviewReadiness(input, activePreset);
  const statuses = quoteAccordionStatusMap(input, selectedPreset, activePreset, readiness);

  for (const [sectionId, status] of Object.entries(statuses) as Array<[QuoteAccordionSectionId, string]>) {
    const statusEl = document.querySelector<HTMLElement>(`[data-quote-accordion-status="${sectionId}"]`);
    if (statusEl) {
      statusEl.textContent = status;
    }
  }

  const reviewEl = document.querySelector<HTMLElement>("[data-quote-review-readiness]");
  if (reviewEl) {
    reviewEl.outerHTML = quoteReviewReadinessPanel(readiness);
  }
}

function bindQuoteRatePresetControls(): void {
  const select = document.querySelector<HTMLSelectElement>("#quote-rate-preset-select");
  const importInput = document.querySelector<HTMLInputElement>("#quote-rate-preset-import-input");
  select?.addEventListener("change", () => {
    selectedQuoteRatePresetId = select.value;
    refreshQuoteAccordionSummary();
  });

  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="apply"]')
    ?.addEventListener("click", applySelectedQuoteRatePreset);
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="save"]')
    ?.addEventListener("click", saveCurrentQuoteRatePreset);
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="import"]')
    ?.addEventListener("click", () => {
      importInput?.click();
    });
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="export"]')
    ?.addEventListener("click", exportQuoteRatePresets);
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="delete"]')
    ?.addEventListener("click", deleteSelectedQuoteRatePreset);
  importInput?.addEventListener("change", () => {
    void importQuoteRatePresets(importInput);
  });
}

function selectedQuoteRatePreset(): QuoteRatePreset | undefined {
  return findQuoteRatePreset(quoteRatePresetLibrary, selectedQuoteRatePresetId);
}

function activeQuoteRatePreset(input: HeatTreatQuoteInput): QuoteRatePreset | undefined {
  const preset = selectedQuoteRatePreset();
  return preset && quoteRatePresetMatchesShopRates(preset, input.shopRates) ? preset : undefined;
}

function quoteRatePresetMatchesShopRates(preset: QuoteRatePreset, shopRates: HeatTreatShopRates): boolean {
  return (
    preset.shopRates.minimumLotCharge === shopRates.minimumLotCharge &&
    preset.shopRates.setupAdminCharge === shopRates.setupAdminCharge &&
    preset.shopRates.laborRatePerHour === shopRates.laborRatePerHour &&
    preset.shopRates.furnaceRatePerHour === shopRates.furnaceRatePerHour &&
    preset.shopRates.bathQuenchRatePerHour === shopRates.bathQuenchRatePerHour &&
    preset.shopRates.temperFurnaceRatePerHour === shopRates.temperFurnaceRatePerHour &&
    preset.shopRates.inspectionBaseCharge === shopRates.inspectionBaseCharge &&
    preset.shopRates.consumablesPerKg === shopRates.consumablesPerKg &&
    preset.shopRates.handlingPackagingCharge === shopRates.handlingPackagingCharge &&
    preset.shopRates.overheadPercent === shopRates.overheadPercent &&
    preset.shopRates.targetMarginPercent === shopRates.targetMarginPercent
  );
}

function applySelectedQuoteRatePreset(): void {
  const preset = selectedQuoteRatePreset();
  if (!preset) {
    showProjectStatus("Select a rate preset before applying.", true);
    return;
  }

  replaceQuoteShopRates(preset.shopRates);
  renderWorkspace();
  showProjectStatus(`Applied rate preset "${quoteRatePresetDisplayName(preset)}".`);
}

function quoteRatePresetDisplayName(preset: QuoteRatePreset): string {
  return preset.name.trim();
}

function saveCurrentQuoteRatePreset(): void {
  const enteredName = window.prompt("Rate preset name", selectedQuoteRatePreset()?.name ?? "");
  if (enteredName === null) {
    return;
  }

  const name = enteredName.trim();
  if (!name) {
    showProjectStatus("Preset name is required. No rates were saved.", true);
    return;
  }

  try {
    const result = saveQuoteRatePreset(quoteRatePresetLibrary, name, heatTreatQuoteState.shopRates);
    if (!persistQuoteRatePresetLibrary(result.library)) {
      showProjectStatus("Could not save preset in this browser. Existing presets were unchanged.", true);
      return;
    }

    quoteRatePresetLibrary = result.library;
    selectedQuoteRatePresetId = result.preset.id;
    renderWorkspace();
    showProjectStatus(`Saved rate preset "${result.preset.name}".`);
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not save rate preset.", true);
  }
}

function exportQuoteRatePresets(): void {
  if (quoteRatePresetLibrary.presets.length === 0) {
    showProjectStatus("Save a rate preset before exporting.", true);
    return;
  }

  try {
    const blob = new Blob([serializeQuoteRatePresetLibrary(quoteRatePresetLibrary)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = quoteRatePresetExportFilename();
      document.body.append(link);
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
    showProjectStatus(`Exported ${quoteRatePresetLibrary.presets.length} rate preset${quoteRatePresetLibrary.presets.length === 1 ? "" : "s"}.`);
  } catch {
    showProjectStatus("Could not export presets. Try again or check browser download permissions.", true);
  }
}

async function importQuoteRatePresets(input: HTMLInputElement): Promise<void> {
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const importedLibrary = parseQuoteRatePresetLibraryJson(await file.text());
    const result = mergeQuoteRatePresetLibraries(quoteRatePresetLibrary, importedLibrary);
    if (!persistQuoteRatePresetLibrary(result.library)) {
      showProjectStatus("Could not import presets in this browser. Existing presets were unchanged.", true);
      return;
    }

    quoteRatePresetLibrary = result.library;
    selectedQuoteRatePresetId = result.selectedPresetId || selectedQuoteRatePresetId;
    normalizeSelectedQuoteRatePresetId();
    renderWorkspace();
    showProjectStatus(`Imported rate presets: ${result.addedCount} added, ${result.updatedCount} updated.`);
  } catch {
    showProjectStatus("Could not import presets. Choose a valid HTCalc RFQ preset file.", true);
  } finally {
    input.value = "";
  }
}

function deleteSelectedQuoteRatePreset(): void {
  const preset = selectedQuoteRatePreset();
  if (!preset) {
    showProjectStatus("Select a rate preset before deleting.", true);
    return;
  }

  if (!window.confirm(`Delete rate preset "${quoteRatePresetDisplayName(preset)}"?`)) {
    return;
  }

  const nextLibrary = deleteQuoteRatePreset(quoteRatePresetLibrary, preset.id);
  if (!persistQuoteRatePresetLibrary(nextLibrary)) {
    showProjectStatus("Could not delete preset in this browser. Existing presets were unchanged.", true);
    return;
  }

  quoteRatePresetLibrary = nextLibrary;
  normalizeSelectedQuoteRatePresetId();
  renderWorkspace();
  showProjectStatus(`Deleted rate preset "${quoteRatePresetDisplayName(preset)}".`);
}

function replaceQuoteShopRates(shopRates: HeatTreatShopRates): void {
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    shopRates: structuredClone(shopRates),
  };
}

function syncManualQuoteSource(): HeatTreatQuoteInput {
  const processSummary = heatTreatQuoteState.processSummary;
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    sourceMode: "manual",
    processSummary,
    importedProcess: {
      ...heatTreatQuoteState.importedProcess,
      sourceMode: "manual",
      processLabel: processSummary,
    },
  };
  captureManualQuoteSource();

  return heatTreatQuoteState;
}

function captureManualQuoteSource(): void {
  manualQuoteProcessSummary = heatTreatQuoteState.processSummary;
  manualQuoteImportedProcess = structuredClone(heatTreatQuoteState.importedProcess);
}

function restoreManualQuoteSource(): void {
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    processSummary: manualQuoteProcessSummary,
    importedProcess: structuredClone(manualQuoteImportedProcess),
  };
  syncManualQuoteSource();
}

function resetManualQuoteSourceCache(input: HeatTreatQuoteInput): void {
  const manualInput = input.sourceMode === "manual"
    ? input
    : defaultHeatTreatQuoteInput();
  manualQuoteProcessSummary = manualInput.processSummary;
  manualQuoteImportedProcess = {
    ...structuredClone(manualInput.importedProcess),
    sourceMode: "manual",
    processLabel: manualInput.processSummary,
  };
}

function refreshQuoteSourceSummary(): void {
  if (heatTreatQuoteState.sourceMode === "manual") {
    return;
  }

  const importedProcess = quoteAssumptionsForSource(heatTreatQuoteState.sourceMode);
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    processSummary: importedProcess.processLabel,
    importedProcess,
  };
}

function bindMetadataInputs(): void {
  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-metadata]").forEach((control) => {
    control.addEventListener("input", () => {
      const key = control.dataset.metadata as keyof ProjectMetadata | undefined;
      if (!key) {
        return;
      }

      projectMetadata = {
        ...projectMetadata,
        [key]: control.value,
      };
    });
  });
}

function bindProcessTabs(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-process-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const modeId = button.dataset.processMode as ProcessModeId | undefined;
      if (!modeId || modeId === activeModeId) {
        return;
      }

      activeModeId = modeId;
      renderProcessTabs();
      renderWorkspace();
    });
  });
}

function renderProcessTabs(): void {
  const tabs = document.querySelector<HTMLElement>(".process-tabs");
  if (!tabs) {
    return;
  }

  tabs.innerHTML = processTabs();
  bindProcessTabs();
}

function renderWorkspace(): void {
  const mode = getProcessMode(activeModeId);
  workspaceEl.innerHTML = workspaceForMode(mode);

  if (mode.id === "adi") {
    bindAdiInputs();
    bindHelpButtons();
    syncUnitControls();
    renderRecommendation();
  } else if (isSteelModeId(mode.id)) {
    bindSteelInputs(mode.id);
    bindHelpButtons();
    syncUnitControls();
    renderSteelRecommendation(mode.id);
  } else if (mode.id === "heat-treat-rfq") {
    bindQuoteInputs();
    bindHelpButtons();
    syncUnitControls();
    renderQuoteRecommendation();
  } else {
    bindHelpButtons();
    syncUnitControls();
  }
}

function renderActiveRecommendation(): void {
  if (activeModeId === "adi") {
    renderRecommendation();
  } else if (isSteelModeId(activeModeId)) {
    renderSteelRecommendation(activeModeId);
  } else if (activeModeId === "heat-treat-rfq") {
    renderQuoteRecommendation();
  }
}

function workspaceForMode(mode: ProcessMode): string {
  switch (mode.id) {
    case "adi":
      return adiWorkspace();
    case "steel-austempering":
      return steelAustemperingWorkspace();
    case "martempering":
      return martemperingWorkspace();
    case "heat-treat-rfq":
      return quoteWorkspace();
    default:
      return plannedWorkspace(mode);
  }
}

function bindCheckbox(id: string, update: (checked: boolean) => void): void {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  input?.addEventListener("change", () => {
    update(input.checked);
    renderRecommendation();
  });
}

function bindHelpButtons(): void {
  document.querySelectorAll<HTMLElement>(".help-button").forEach((control) => {
    control.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
}

function bindProjectActions(): void {
  const fileInput = document.querySelector<HTMLInputElement>("#project-file-input");

  document.querySelector<HTMLButtonElement>("#save-project")?.addEventListener("click", () => {
    saveProject();
  });

  document.querySelector<HTMLButtonElement>("#load-project")?.addEventListener("click", () => {
    fileInput?.click();
  });

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }

    try {
      const project = parseProjectState(await file.text());
      restoreProject(project);
      showProjectStatus("Project loaded.");
    } catch (error) {
      showProjectStatus(error instanceof Error ? error.message : "Could not load project.", true);
    } finally {
      fileInput.value = "";
    }
  });
}

function saveProject(): void {
  const project = createProjectState({
    activeModeId,
    unitSystem,
    adiInput: state,
    adiCalibration: calibration,
    steelAustemperingInput: steelAustemperingState,
    martemperingInput: martemperingState,
    heatTreatQuoteInput: heatTreatQuoteState,
    metadata: projectMetadata,
    validationChecklists,
    pinnedComparisonBaseline,
  });
  const blob = new Blob([serializeProjectState(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `htcalc-project-${new Date().toISOString().slice(0, 10)}.htcalc.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showProjectStatus("Project saved.");
}

function restoreProject(project: HtcalcProjectState): void {
  activeModeId = project.activeModeId;
  unitSystem = project.unitSystem;
  calibration = { ...project.adi.calibration };
  projectMetadata = { ...project.metadata };
  validationChecklists = structuredClone(project.validationChecklists);
  steelAustemperingState = structuredClone(project.steelAustempering.input);
  martemperingState = structuredClone(project.martempering.input);
  heatTreatQuoteState = structuredClone(project.heatTreatQuote.input);
  resetManualQuoteSourceCache(project.heatTreatQuote.input);
  pinnedComparisonBaseline = project.pinnedComparisonBaseline
    ? structuredClone(project.pinnedComparisonBaseline)
    : null;
  replaceAdiInput(project.adi.input);

  renderProcessTabs();
  renderWorkspace();
  syncCalibrationControls();
  syncUnitPreferenceControls();
  syncUnitControls();
  renderActiveRecommendation();
}

function replaceAdiInput(input: AdiProcessInput): void {
  replaceObject(state.composition, input.composition);
  replaceObject(state.geometry, input.geometry);
  replaceObject(state.microstructure, input.microstructure);
  replaceObject(state.target, input.target);
  replaceObject(state.equipment, input.equipment);
}

function replaceObject<T extends object>(target: T, source: T): void {
  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key];
  }

  Object.assign(target, source);
}

function showProjectStatus(message: string, isError = false): void {
  const status = document.querySelector<HTMLDivElement>("#project-status");
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function bindSettings(): void {
  const backdrop = document.querySelector<HTMLDivElement>("#settings-backdrop");
  const openButton = document.querySelector<HTMLButtonElement>("#settings-open");
  const closeButtons = [
    document.querySelector<HTMLButtonElement>("#settings-close"),
    document.querySelector<HTMLButtonElement>("#settings-done"),
  ];

  openButton?.addEventListener("click", () => {
    if (backdrop) {
      backdrop.hidden = false;
    }
  });

  for (const button of closeButtons) {
    button?.addEventListener("click", () => {
      if (backdrop) {
        backdrop.hidden = true;
      }
    });
  }

  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      backdrop.hidden = true;
    }
  });

  document.querySelector<HTMLButtonElement>("#settings-reset")?.addEventListener("click", () => {
    calibration = { ...DEFAULT_ADI_MODEL_CALIBRATION };
    unitSystem = "imperial";
    syncCalibrationControls();
    syncUnitPreferenceControls();
    syncUnitControls();
    renderActiveRecommendation();
  });

  document.querySelectorAll<HTMLInputElement>("[data-calibration]").forEach((control) => {
    control.addEventListener("input", () => {
      const key = control.dataset.calibration as CalibrationKey | undefined;
      if (!key) {
        return;
      }

      calibration = {
        ...calibration,
        [key]: Number(control.value),
      };
      syncCalibrationControls(key);
      renderActiveRecommendation();
    });
  });

  document.querySelectorAll<HTMLInputElement>('input[name="unit-system"]').forEach((control) => {
    control.addEventListener("change", () => {
      if (!control.checked) {
        return;
      }

      unitSystem = control.value as UnitSystem;
      syncUnitControls();
      renderActiveRecommendation();
    });
  });
}

function bindReportDialog(): void {
  const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");

  document.querySelector<HTMLButtonElement>("#report-close")?.addEventListener("click", () => {
    closeReportDialog();
  });

  document.querySelector<HTMLButtonElement>("#report-print")?.addEventListener("click", () => {
    window.print();
  });

  document.querySelector<HTMLButtonElement>("#report-download")?.addEventListener("click", () => {
    if (activeModeId === "adi") {
      downloadCurrentMarkdownReport();
    } else if (isSteelModeId(activeModeId)) {
      downloadCurrentSteelMarkdownReport(activeModeId);
    } else if (activeModeId === "heat-treat-rfq") {
      downloadCurrentQuoteMarkdownReport();
    }
  });

  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeReportDialog();
    }
  });
}

function syncCalibrationControls(changedKey?: CalibrationKey): void {
  const selector = changedKey
    ? `[data-calibration="${changedKey}"]`
    : "[data-calibration]";

  document.querySelectorAll<HTMLInputElement>(selector).forEach((control) => {
    const key = control.dataset.calibration as CalibrationKey | undefined;
    if (key && calibrationControlShouldSync(key, changedKey, control === document.activeElement)) {
      control.value = calibration[key].toFixed(2);
    }
  });
}

function setValue(path: string, control: HTMLInputElement | HTMLSelectElement): void {
  const value = control instanceof HTMLInputElement && control.type === "number"
    ? parseNumericInputValue(path, control.value, unitSystem)
    : control.value;

  switch (path) {
    case "grade":
      state.target.grade = value as AstmA897Grade;
      break;
    case "priority":
      state.target.priority = value as ProcessPriority;
      break;
    case "startingMatrix":
      state.microstructure.startingMatrix = value as StartingMatrix;
      break;
    case "furnaceType":
      state.equipment.furnaceType = value as FurnaceType;
      break;
    case "atmosphereType":
      state.equipment.atmosphereType = value as AtmosphereType;
      break;
    case "bathAgitation":
      state.equipment.bathAgitation = value as BathAgitation;
      break;
    case "austemperBathType":
      state.equipment.austemperBathType = value as AustemperBathType;
      break;
    default:
      assignNumeric(path, typeof value === "number" ? value : undefined);
  }
}

function setSteelValue(
  modeId: SteelModeId,
  path: string,
  control: HTMLInputElement | HTMLSelectElement,
): void {
  const value = control instanceof HTMLInputElement && control.type === "checkbox"
    ? control.checked
    : control instanceof HTMLInputElement && control.type === "number"
      ? parseSteelNumericInputValue(path, control.value)
      : control.value;

  if (modeId === "steel-austempering") {
    setSteelAustemperingInputValue(steelAustemperingState, path, value);
  } else {
    setMartemperingInputValue(martemperingState, path, value);
  }
}

function parseSteelNumericInputValue(path: string, displayValue: string): number | undefined {
  if (displayValue.trim() === "" && isOptionalSteelNumericPath(path)) {
    return undefined;
  }

  return parseNumericInputValue(path, displayValue, unitSystem) ?? Number.NaN;
}

function isOptionalSteelNumericPath(path: string): boolean {
  return [
    "geometry.estimatedMassKg",
    "austemper.bathTemperatureC",
    "austemper.maxHoldMin",
    "martemper.bathTemperatureC",
    "martemper.maxEqualizationMin",
  ].includes(path);
}

function assignNumeric(path: string, value: number | undefined): void {
  const [group, key] = path.split(".") as [string, string];
  if (group === "composition") {
    state.composition[key as CompositionKey] = value ?? Number.NaN;
  }
  if (group === "geometry") {
    Object.assign(state.geometry, { [key]: value });
  }
  if (group === "microstructure") {
    Object.assign(state.microstructure, { [key]: value });
  }
  if (group === "equipment") {
    Object.assign(state.equipment, { [key]: value });
  }
}

function renderRecommendation(): void {
  const recommendationPanel = document.querySelector<HTMLDivElement>("#recommendation");
  if (!recommendationPanel) {
    return;
  }

  try {
    const result = recommendAdiProcess(state, calibration);
    setValidationChecklist(
      "adi",
      reconcileValidationChecklist(validationChecklists.adi, result.validationChecks),
    );
    const confidenceClass = `confidence-${result.confidence}`;
    const warnings = result.warnings.length > 0
      ? result.warnings
      : ["No active risk warnings for the current input set."];
    const cpRange = result.austenitize.carbonPotential.rangeCarbonEquivalentPercent
      ? `${result.austenitize.carbonPotential.rangeCarbonEquivalentPercent[0].toFixed(2)}-${result.austenitize.carbonPotential.rangeCarbonEquivalentPercent[1].toFixed(2)}% C eq.`
      : "Equipment calibrated";
    const comparison = pinnedComparisonBaseline
      ? compareToBaseline(pinnedComparisonBaseline, result, unitSystem)
      : null;

    recommendationPanel.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="eyebrow">Recommended ADI Process</div>
          <h2>${result.expectedGrade}</h2>
        </div>
        <div class="summary-side">
          <span class="confidence ${confidenceClass}">${result.confidence}</span>
          <div class="recommendation-actions">
            <button class="icon-button" data-report-action="open" type="button" title="Open printable report">
              <i class="ph ph-file-text"></i>
            </button>
            <button class="icon-button" data-report-action="print" type="button" title="Print report">
              <i class="ph ph-printer"></i>
            </button>
            <button class="icon-button" data-report-action="markdown" type="button" title="Download Markdown report">
              <i class="ph ph-download-simple"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="window-group">
        ${processWindow("ph-thermometer-hot", "Austenitize", temperatureRangeLabel(result.austenitize.temperature, unitSystem), temperatureNominalLabel(result.austenitize.temperature, unitSystem), "Soak after core temp", `${result.austenitize.soakAfterCoreAtTemp.minMin}-${result.austenitize.soakAfterCoreAtTemp.maxMin} min`, result.austemper.processingWindowStatus, result.austenitize.totalFurnaceTimeNote)}
        ${processWindow("ph-drop", "Austemper", temperatureRangeLabel(result.austemper.temperature, unitSystem), temperatureNominalLabel(result.austemper.temperature, unitSystem), "Hold after core temp", `${result.austemper.holdAfterCoreAtTemp.minMin}-${result.austemper.holdAfterCoreAtTemp.maxMin} min`, result.austemper.processingWindowStatus)}
      </div>

      <div class="metric-strip">
        ${metric("AI", result.scores.austemperabilityIndex.toFixed(2), `required ${result.scores.requiredAustemperabilityIndex.toFixed(2)}`, "AI")}
        ${metric("CSR", result.scores.carbideSegregationRisk.toFixed(2), "carbide risk", "CSR")}
        ${metric("Transfer", `${result.transfer.actualTransferTimeSec}s`, `max ${result.transfer.maxRecommendedTransferTimeSec}s`)}
        ${metric("Window", result.austemper.processingWindowStatus, "reaction")}
      </div>

      <div class="result-section baseline-actions">
        <div class="result-title"><i class="ph ph-push-pin"></i> Baseline</div>
        <div class="baseline-action-row">
          <button class="secondary-action" data-baseline-action="pin" type="button">
            <i class="ph ph-push-pin"></i> Pin Baseline
          </button>
          <button class="secondary-action" data-baseline-action="clear" type="button" ${pinnedComparisonBaseline ? "" : "disabled"}>
            <i class="ph ph-x-circle"></i> Clear Baseline
          </button>
        </div>
      </div>

      ${comparison ? comparisonPanel(comparison) : ""}

      <div class="result-section">
        <div class="result-title"><i class="ph ph-gauge"></i> Carbon Potential</div>
        <div class="cp-line"><strong>${cpRange}</strong><span>${result.austenitize.carbonPotential.category}</span></div>
        <p>${result.austenitize.carbonPotential.guidance}</p>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-warning"></i> Warnings</div>
        <ul class="warning-list">${warnings.map((warning) => `<li>${warning}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-check-square"></i> Validation Checks</div>
        ${validationChecklistRows(validationChecklists.adi)}
      </div>
    `;
    bindRecommendationActions(result);
    bindChecklistControls();
  } catch (error) {
    recommendationPanel.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-octagon"></i>
        <h2>Input needs correction</h2>
        <p>${error instanceof Error ? error.message : "Unable to calculate recommendation."}</p>
      </div>
    `;
  }
}

function renderSteelRecommendation(modeId: SteelModeId): void {
  const recommendationPanel = document.querySelector<HTMLDivElement>("#recommendation");
  if (!recommendationPanel) {
    return;
  }

  try {
    const result = recommendSteelForMode(modeId);
    setValidationChecklist(
      modeId,
      reconcileValidationChecklist(validationChecklists[modeId], result.validationChecks),
    );
    const confidenceClass = `confidence-${result.confidence}`;
    const warnings = result.warnings.length > 0
      ? result.warnings
      : ["No active risk warnings for the current input set."];

    recommendationPanel.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="eyebrow">Recommended ${escapeHtml(getProcessMode(modeId).label)} Process</div>
          <h2>${escapeHtml(steelSummaryTitle(result))}</h2>
        </div>
        <div class="summary-side">
          <span class="confidence ${confidenceClass}">${result.confidence}</span>
          <div class="recommendation-actions">
            <button class="icon-button" data-steel-report-action="open" type="button" title="Open printable report">
              <i class="ph ph-file-text"></i>
            </button>
            <button class="icon-button" data-steel-report-action="print" type="button" title="Print report">
              <i class="ph ph-printer"></i>
            </button>
            <button class="icon-button" data-steel-report-action="markdown" type="button" title="Download Markdown report">
              <i class="ph ph-download-simple"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="window-group">
        ${processWindow("ph-thermometer-hot", "Austenitize", temperatureRangeLabel(result.austenitize.temperature, unitSystem), temperatureNominalLabel(result.austenitize.temperature, unitSystem), "Soak after core temp", `${result.austenitize.soakAfterCoreAtTemp.minMin}-${result.austenitize.soakAfterCoreAtTemp.maxMin} min`, result.processingWindowStatus, result.austenitize.atmosphereGuidance)}
        ${steelModeProcessWindows(result)}
      </div>

      <div class="metric-strip">
        ${metric("Ms", `${result.transformation.msC} °C`, "estimated")}
        ${metric("Hardenability", result.transformation.hardenabilityScore.toFixed(2), "relative score")}
        ${metric("Hardness", steelHardnessMetric(result), "estimated HRC")}
        ${metric("Window", result.processingWindowStatus, "reaction")}
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-warning"></i> Warnings</div>
        <ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-check-square"></i> Validation Checks</div>
        ${validationChecklistRows(validationChecklists[modeId])}
      </div>
    `;
    bindSteelRecommendationActions(modeId, result);
    bindChecklistControls();
  } catch (error) {
    recommendationPanel.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-octagon"></i>
        <h2>Input needs correction</h2>
        <p>${error instanceof Error ? error.message : "Unable to calculate recommendation."}</p>
      </div>
    `;
  }
}

function renderQuoteRecommendation(): void {
  const recommendationPanel = document.querySelector<HTMLDivElement>("#recommendation");
  if (!recommendationPanel) {
    return;
  }

  try {
    const quoteInput = quoteInputForCurrentState();
    if (!quoteInputHasPricingBasis(quoteInput)) {
      renderIncompleteQuoteState(recommendationPanel);
      return;
    }

    const result = recommendHeatTreatQuote(quoteInput);
    setValidationChecklist(
      "heat-treat-rfq",
      reconcileValidationChecklist(validationChecklists["heat-treat-rfq"], result.validationChecks),
    );
    const confidenceClass = `confidence-${result.confidence}`;
    const assumptions = result.importedAssumptions.length > 0
      ? result.importedAssumptions
      : ["No imported assumptions for the current quote."];
    const warnings = result.warnings.length > 0
      ? result.warnings
      : ["No active quote warnings for the current input set."];
    const perWeight = quotePerWeightDisplay(result.pricePerKg, unitSystem);
    const customerSummaryLines = displayQuoteCustomerSummaryLines(result, unitSystem);

    recommendationPanel.innerHTML = `
      <div class="summary-header">
        <div>
          <div class="eyebrow">Heat-Treat RFQ</div>
          <h2>${formatCurrency(result.lotPrice)}</h2>
          <p>${escapeHtml(result.processSummary)}</p>
        </div>
        <div class="summary-side">
          <span class="confidence ${confidenceClass}">${result.confidence}</span>
          <div class="recommendation-actions">
            <button class="icon-button" data-quote-report-action="open" type="button" title="Open printable report">
              <i class="ph ph-file-text"></i>
            </button>
            <button class="icon-button" data-quote-report-action="print" type="button" title="Print report">
              <i class="ph ph-printer"></i>
            </button>
            <button class="icon-button" data-quote-report-action="markdown" type="button" title="Download Markdown report">
              <i class="ph ph-download-simple"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="metric-strip">
        ${metric("Unit Price", formatCurrency(result.unitPrice), "per piece")}
        ${metric(
          perWeight.label,
          perWeight.value === null ? "Unavailable" : `${formatCurrency(perWeight.value)}/${perWeight.unit}`,
          "weight basis",
        )}
        ${metric("Cycles", result.cycleCount === null ? "Manual" : String(result.cycleCount), "billable")}
        ${metric("Confidence", result.confidence, quoteSourceLabel(result.sourceMode))}
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-list-checks"></i> Customer Summary</div>
        <ul class="check-list">${customerSummaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-git-branch"></i> Imported Assumptions</div>
        <ul class="check-list">${assumptions.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-calculator"></i> Cost Breakdown</div>
        ${quoteCostBreakdownRows(result.breakdown)}
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-warning"></i> Warnings</div>
        <ul class="warning-list">${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
      </div>

      <div class="result-section">
        <div class="result-title"><i class="ph ph-check-square"></i> Validation Checks</div>
        ${validationChecklistRows(validationChecklists["heat-treat-rfq"])}
      </div>
    `;
    bindQuoteRecommendationActions(result);
    bindChecklistControls();
  } catch (error) {
    recommendationPanel.innerHTML = `
      <div class="error-state">
        <i class="ph ph-warning-octagon"></i>
        <h2>RFQ needs pricing inputs</h2>
        <p>${escapeHtml(error instanceof Error ? error.message : "Unable to calculate quote recommendation.")}</p>
      </div>
    `;
  }
}

function renderIncompleteQuoteState(recommendationPanel: HTMLDivElement): void {
  recommendationPanel.innerHTML = `
    <div class="result-section">
      <div class="result-title"><i class="ph ph-calculator"></i> Pricing Basis Needed</div>
      <p>Enter lot weight/load capacity or manual billable hours to calculate a quote.</p>
    </div>
  `;
}

function quoteInputForCurrentState(): HeatTreatQuoteInput {
  if (heatTreatQuoteState.sourceMode === "manual") {
    return syncManualQuoteSource();
  }

  const importedProcess = quoteAssumptionsForSource(heatTreatQuoteState.sourceMode);
  const input: HeatTreatQuoteInput = {
    ...heatTreatQuoteState,
    processSummary: importedProcess.processLabel,
    importedProcess,
  };
  heatTreatQuoteState = input;

  return input;
}

function quoteInputHasPricingBasis(input: HeatTreatQuoteInput): boolean {
  const hasTotalWeight = input.lot.totalWeightKg !== undefined || input.lot.pieceWeightKg !== undefined;
  const hasCycleBasis = (
    input.manualOverrides.billableCycleCount !== undefined ||
    input.lot.cycleCountOverride !== undefined ||
    (hasTotalWeight && input.lot.loadCapacityKg !== undefined)
  );

  if (hasCycleBasis) {
    return true;
  }

  if (!quoteInputHasManualBillableHours(input)) {
    return false;
  }

  return !quoteInputHasImportedTimeWithoutManualOverride(input);
}

function quoteInputHasManualBillableHours(input: HeatTreatQuoteInput): boolean {
  return (
    input.manualOverrides.billableFurnaceHours !== undefined ||
    input.manualOverrides.billableBathQuenchHours !== undefined ||
    input.manualOverrides.billableTemperHours !== undefined ||
    input.manualOverrides.billableLaborHours !== undefined
  );
}

function quoteInputHasImportedTimeWithoutManualOverride(input: HeatTreatQuoteInput): boolean {
  return (
    (input.importedProcess.austenitizeMinutes !== undefined &&
      input.manualOverrides.billableFurnaceHours === undefined) ||
    (input.importedProcess.bathMinutes !== undefined &&
      input.manualOverrides.billableBathQuenchHours === undefined) ||
    (input.importedProcess.temperMinutes !== undefined &&
      input.manualOverrides.billableTemperHours === undefined)
  );
}

function quoteAssumptionsForSource(sourceMode: HeatTreatQuoteSourceMode): ImportedProcessAssumptions {
  switch (sourceMode) {
    case "adi":
      return quoteAssumptionsFromAdi(recommendAdiProcess(state, calibration));
    case "steel-austempering":
      return quoteAssumptionsFromSteelAustempering(recommendSteelAustemperingProcess(steelAustemperingState));
    case "martempering":
      return quoteAssumptionsFromMartempering(recommendMartemperingProcess(martemperingState));
    case "manual":
      return {
        ...structuredClone(heatTreatQuoteState.importedProcess),
        sourceMode: "manual",
        processLabel: heatTreatQuoteState.processSummary || heatTreatQuoteState.importedProcess.processLabel,
      };
    default:
      throw new RangeError(`Unknown heat-treat quote source mode: ${String(sourceMode)}`);
  }
}

function recommendSteelForMode(modeId: SteelModeId): SteelProcessRecommendation {
  return modeId === "steel-austempering"
    ? recommendSteelAustemperingProcess(steelAustemperingState)
    : recommendMartemperingProcess(martemperingState);
}

function steelSummaryTitle(result: SteelProcessRecommendation): string {
  return result.mode === "steel-austempering"
    ? result.expectedStructure
    : `Temper to ${result.temper.targetHardnessHrc} HRC`;
}

function steelModeProcessWindows(result: SteelProcessRecommendation): string {
  if (result.mode === "steel-austempering") {
    return processWindow(
      "ph-drop",
      "Austemper",
      temperatureRangeLabel(result.austemper.temperature, unitSystem),
      temperatureNominalLabel(result.austemper.temperature, unitSystem),
      "Hold after core temp",
      `${result.austemper.holdAfterCoreAtTemp.minMin}-${result.austemper.holdAfterCoreAtTemp.maxMin} min`,
      result.processingWindowStatus,
      result.finalCoolGuidance,
    );
  }

  return [
    processWindow(
      "ph-drop",
      "Martemper",
      temperatureRangeLabel(result.martemper.temperature, unitSystem),
      temperatureNominalLabel(result.martemper.temperature, unitSystem),
      "Equalize",
      `${result.equalize.minMin}-${result.equalize.maxMin} min`,
      result.processingWindowStatus,
      result.finalCoolGuidance,
    ),
    processWindow(
      "ph-fire",
      "Temper",
      temperatureRangeLabel(result.temper.temperature, unitSystem),
      temperatureNominalLabel(result.temper.temperature, unitSystem),
      `${result.temper.temperCount} temper${result.temper.temperCount === 1 ? "" : "s"}`,
      `${result.temper.hold.minMin}-${result.temper.hold.maxMin} min`,
      result.processingWindowStatus,
    ),
  ].join("");
}

function steelHardnessMetric(result: SteelProcessRecommendation): string {
  const hardness = result.mode === "steel-austempering"
    ? result.expectedHardness
    : result.asQuenchedHardness;

  return `${hardness.nominalHrc} HRC`;
}

function bindRecommendationActions(result: AdiProcessRecommendation): void {
  document.querySelector<HTMLButtonElement>('[data-report-action="open"]')?.addEventListener("click", () => {
    openReportDialog(result);
  });

  document.querySelector<HTMLButtonElement>('[data-report-action="print"]')?.addEventListener("click", () => {
    openReportDialog(result);
    requestAnimationFrame(() => {
      window.print();
    });
  });

  document.querySelector<HTMLButtonElement>('[data-report-action="markdown"]')?.addEventListener("click", () => {
    downloadCurrentMarkdownReport(result);
  });

  document.querySelector<HTMLButtonElement>('[data-baseline-action="pin"]')?.addEventListener("click", () => {
    pinnedComparisonBaseline = createPinnedComparisonBaseline({
      input: state,
      calibration,
      recommendation: result,
      label: baselineLabel(result),
    });
    showProjectStatus("Baseline pinned.");
    renderRecommendation();
  });

  document.querySelector<HTMLButtonElement>('[data-baseline-action="clear"]')?.addEventListener("click", () => {
    pinnedComparisonBaseline = null;
    showProjectStatus("Baseline cleared.");
    renderRecommendation();
  });
}

function bindSteelRecommendationActions(
  modeId: SteelModeId,
  result: SteelProcessRecommendation,
): void {
  document.querySelector<HTMLButtonElement>('[data-steel-report-action="open"]')?.addEventListener("click", () => {
    openSteelReportDialog(modeId, result);
  });

  document.querySelector<HTMLButtonElement>('[data-steel-report-action="print"]')?.addEventListener("click", () => {
    openSteelReportDialog(modeId, result);
    requestAnimationFrame(() => {
      window.print();
    });
  });

  document.querySelector<HTMLButtonElement>('[data-steel-report-action="markdown"]')?.addEventListener("click", () => {
    downloadCurrentSteelMarkdownReport(modeId, result);
  });
}

function bindQuoteRecommendationActions(result: HeatTreatQuoteRecommendation): void {
  document.querySelector<HTMLButtonElement>('[data-quote-report-action="open"]')?.addEventListener("click", () => {
    openQuoteReportDialog(result);
  });

  document.querySelector<HTMLButtonElement>('[data-quote-report-action="print"]')?.addEventListener("click", () => {
    openQuoteReportDialog(result);
    requestAnimationFrame(() => {
      window.print();
    });
  });

  document.querySelector<HTMLButtonElement>('[data-quote-report-action="markdown"]')?.addEventListener("click", () => {
    downloadCurrentQuoteMarkdownReport(result);
  });
}

function bindChecklistControls(): void {
  document.querySelectorAll<HTMLInputElement>("[data-checklist-check]").forEach((control) => {
    control.addEventListener("change", () => {
      updateChecklistItem(control.dataset.checklistCheck ?? "", {
        checked: control.checked,
      });
    });
  });

  document.querySelectorAll<HTMLTextAreaElement>("[data-checklist-notes]").forEach((control) => {
    control.addEventListener("input", () => {
      updateChecklistItem(control.dataset.checklistNotes ?? "", {
        notes: control.value,
      });
    });
  });
}

function updateChecklistItem(
  id: string,
  patch: Partial<Pick<ValidationChecklistState["items"][number], "checked" | "notes">>,
): void {
  const modeId = activeModeId;
  setValidationChecklist(modeId, {
    items: validationChecklists[modeId].items.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  });
  if (modeId === "heat-treat-rfq") {
    refreshQuoteAccordionSummary();
  }
}

function setValidationChecklist(modeId: ProcessModeId, checklist: ValidationChecklistState): void {
  validationChecklists = {
    ...validationChecklists,
    [modeId]: checklist,
  };
}

function comparisonPanel(comparison: ComparisonViewModel): string {
  const summary = comparison.summary.length > 0
    ? `<ul class="comparison-summary">${comparison.summary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  return `
    <div class="result-section comparison-section">
      <div class="result-title"><i class="ph ph-arrows-left-right"></i> Current vs Pinned</div>
      <div class="comparison-meta">
        <strong>${escapeHtml(comparison.label)}</strong>
        <span>${escapeHtml(comparison.pinnedAt)}</span>
      </div>
      ${summary}
      <div class="comparison-table" role="table" aria-label="Current versus pinned baseline">
        <div class="comparison-row comparison-head" role="row">
          <span>Metric</span><span>Baseline</span><span>Current</span><span>Delta</span>
        </div>
        ${comparison.rows.map((row) => `
          <div class="comparison-row" role="row">
            <span>${escapeHtml(row.label)}</span>
            <span>${escapeHtml(row.baselineValue)}</span>
            <span>${escapeHtml(row.currentValue)}</span>
            <span>${escapeHtml(row.delta)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function validationChecklistRows(checklist: ValidationChecklistState): string {
  if (checklist.items.length === 0) {
    return `<p class="empty-note">No validation checks generated.</p>`;
  }

  return `
    <div class="validation-list">
      ${checklist.items.map((item) => `
        <div class="validation-item">
          <label>
            <input
              data-checklist-check="${escapeAttribute(item.id)}"
              type="checkbox"
              ${item.checked ? "checked" : ""}
            />
            <span>${escapeHtml(item.label)}</span>
          </label>
          <textarea
            data-checklist-notes="${escapeAttribute(item.id)}"
            aria-label="Notes for ${escapeAttribute(item.label)}"
            rows="2"
          >${escapeHtml(item.notes)}</textarea>
        </div>
      `).join("")}
    </div>
  `;
}

function baselineLabel(result: AdiProcessRecommendation): string {
  const projectLabel = projectMetadata.partName.trim() || projectMetadata.customerName.trim();
  return `${projectLabel || result.expectedGrade} baseline`;
}

function quoteCostBreakdownRows(breakdown: HeatTreatQuoteRecommendation["breakdown"]): string {
  return `
    <div class="comparison-table" role="table" aria-label="RFQ cost breakdown">
      <div class="comparison-row comparison-head" role="row">
        <span>Bucket</span><span>Amount</span>
      </div>
      ${quoteCostBreakdownEntries(breakdown).map(([label, value]) => `
        <div class="comparison-row" role="row">
          <span>${escapeHtml(label)}</span>
          <span>${formatCurrency(value)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function quoteCostBreakdownEntries(
  breakdown: HeatTreatQuoteRecommendation["breakdown"],
): Array<[string, number]> {
  return [
    ["Setup/admin", breakdown.setupAdmin],
    ["Furnace", breakdown.furnace],
    ["Bath/quench", breakdown.bathQuench],
    ["Temper", breakdown.temper],
    ["Labor", breakdown.labor],
    ["Inspection", breakdown.inspection],
    ["Consumables", breakdown.consumables],
    ["Handling/packaging", breakdown.handlingPackaging],
    ["Scrap/rework reserve", breakdown.scrapReworkReserve],
    ["Overhead", breakdown.overhead],
    ["Margin", breakdown.margin],
    ["Expedite", breakdown.expedite],
    ["Manual adder/discount", breakdown.manualAdderDiscount],
    ["Minimum charge adjustment", breakdown.minimumChargeAdjustment],
    ["Total", breakdown.total],
  ];
}

function quoteSourceLabel(sourceMode: HeatTreatQuoteSourceMode): string {
  switch (sourceMode) {
    case "adi":
      return "ADI";
    case "steel-austempering":
      return "Steel austempering";
    case "martempering":
      return "Martempering";
    case "manual":
      return "Manual";
    default:
      return sourceMode;
  }
}

function currentReportViewModel(result?: AdiProcessRecommendation): ReportViewModel {
  const recommendation = result ?? recommendAdiProcess(state, calibration);
  setValidationChecklist(
    "adi",
    reconcileValidationChecklist(validationChecklists.adi, recommendation.validationChecks),
  );
  const comparison = pinnedComparisonBaseline
    ? compareToBaseline(pinnedComparisonBaseline, recommendation, unitSystem)
    : null;
  const baseReport = {
    activeModeLabel: getProcessMode("adi").label,
    unitSystem,
    exportedAt: new Date().toISOString(),
    metadata: projectMetadata,
    input: state,
    calibration,
    recommendation,
    validationChecklist: validationChecklists.adi,
  };

  return comparison
    ? createReportViewModel({ ...baseReport, comparison })
    : createReportViewModel(baseReport);
}

function currentSteelReportViewModel(
  modeId: SteelModeId,
  result?: SteelProcessRecommendation,
): SteelReportViewModel {
  const recommendation = result ?? recommendSteelForMode(modeId);
  setValidationChecklist(
    modeId,
    reconcileValidationChecklist(validationChecklists[modeId], recommendation.validationChecks),
  );

  return createSteelReportViewModel({
    activeModeLabel: getProcessMode(modeId).label,
    unitSystem,
    exportedAt: new Date().toISOString(),
    metadata: projectMetadata,
    input: modeId === "steel-austempering" ? steelAustemperingState : martemperingState,
    recommendation,
    validationChecklist: validationChecklists[modeId],
  });
}

function currentQuoteReportViewModel(result?: HeatTreatQuoteRecommendation): QuoteReportViewModel {
  const input = quoteInputForCurrentState();
  const recommendation = result ?? recommendHeatTreatQuote(input);
  setValidationChecklist(
    "heat-treat-rfq",
    reconcileValidationChecklist(validationChecklists["heat-treat-rfq"], recommendation.validationChecks),
  );

  return createQuoteReportViewModel({
    exportedAt: new Date().toISOString(),
    metadata: projectMetadata,
    unitSystem,
    input,
    recommendation,
    validationChecklist: validationChecklists["heat-treat-rfq"],
  });
}

function openReportDialog(result?: AdiProcessRecommendation): void {
  try {
    const report = currentReportViewModel(result);
    const documentEl = document.querySelector<HTMLElement>("#report-document");
    const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");
    if (!documentEl || !backdrop) {
      return;
    }

    documentEl.innerHTML = reportHtml(report);
    backdrop.hidden = false;
    document.body.classList.add("is-report-open");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not create report.", true);
  }
}

function openSteelReportDialog(
  modeId: SteelModeId,
  result?: SteelProcessRecommendation,
): void {
  try {
    const report = currentSteelReportViewModel(modeId, result);
    const documentEl = document.querySelector<HTMLElement>("#report-document");
    const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");
    if (!documentEl || !backdrop) {
      return;
    }

    documentEl.innerHTML = steelReportHtml(report);
    backdrop.hidden = false;
    document.body.classList.add("is-report-open");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not create report.", true);
  }
}

function openQuoteReportDialog(result?: HeatTreatQuoteRecommendation): void {
  try {
    const report = currentQuoteReportViewModel(result);
    const documentEl = document.querySelector<HTMLElement>("#report-document");
    const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");
    if (!documentEl || !backdrop) {
      return;
    }

    documentEl.innerHTML = quoteReportHtml(report);
    backdrop.hidden = false;
    document.body.classList.add("is-report-open");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not create quote report.", true);
  }
}

function closeReportDialog(): void {
  const backdrop = document.querySelector<HTMLDivElement>("#report-backdrop");
  if (backdrop) {
    backdrop.hidden = true;
  }
  document.body.classList.remove("is-report-open");
}

function downloadCurrentSteelMarkdownReport(
  modeId: SteelModeId,
  result?: SteelProcessRecommendation,
): void {
  try {
    const report = currentSteelReportViewModel(modeId, result);
    const blob = new Blob([serializeSteelReportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = steelReportMarkdownFilename(modeId as SteelReportModeId, projectMetadata, report.exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showProjectStatus("Markdown report downloaded.");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not download report.", true);
  }
}

function downloadCurrentQuoteMarkdownReport(result?: HeatTreatQuoteRecommendation): void {
  try {
    const report = currentQuoteReportViewModel(result);
    const blob = new Blob([serializeQuoteReportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = quoteReportMarkdownFilename(projectMetadata, report.exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showProjectStatus("Markdown report downloaded.");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not download quote report.", true);
  }
}

function downloadCurrentMarkdownReport(result?: AdiProcessRecommendation): void {
  try {
    const report = currentReportViewModel(result);
    const blob = new Blob([serializeReportMarkdown(report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportMarkdownFilename(projectMetadata, report.exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showProjectStatus("Markdown report downloaded.");
  } catch (error) {
    showProjectStatus(error instanceof Error ? error.message : "Could not download report.", true);
  }
}

function quoteReportHtml(report: QuoteReportViewModel): string {
  const notes = report.metadata.notes.trim() || "No project notes entered.";
  const warnings = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings
    : ["No active quote warnings for the current input set."];
  const assumptions = report.recommendation.importedAssumptions.length > 0
    ? report.recommendation.importedAssumptions
    : ["No imported assumptions."];
  const customerSummaryLines = report.recommendation.customerSummaryLines.length > 0
    ? displayQuoteCustomerSummaryLines(report.recommendation, report.unitSystem)
    : ["No customer quote summary lines generated."];
  const internalNotes = report.recommendation.internalNotes.length > 0
    ? report.recommendation.internalNotes
    : ["No internal quote notes generated."];
  const perWeight = quotePerWeightDisplay(report.recommendation.pricePerKg, report.unitSystem);

  return `
    <header class="report-document-header">
      <h1>${escapeHtml(report.title)}</h1>
      <dl>
        <div><dt>Generated</dt><dd>${escapeHtml(report.exportedAt)}</dd></div>
        <div><dt>Customer</dt><dd>${escapeHtml(report.metadata.customerName || "Unspecified")}</dd></div>
        <div><dt>Part</dt><dd>${escapeHtml(report.metadata.partName || "Unspecified")}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(quoteSourceLabel(report.recommendation.sourceMode))}</dd></div>
      </dl>
    </header>
    <section>
      <h2>Project Notes</h2>
      <p>${escapeHtml(notes)}</p>
    </section>
    <section>
      <h2>Quote Summary</h2>
      <dl class="report-scores">
        <div><dt>Lot Price</dt><dd>${formatCurrency(report.recommendation.lotPrice)}</dd></div>
        <div><dt>Unit Price</dt><dd>${formatCurrency(report.recommendation.unitPrice)}</dd></div>
        <div><dt>${perWeight.label}</dt><dd>${perWeight.value === null ? "Unavailable" : formatCurrency(perWeight.value)}</dd></div>
        <div><dt>Cycles</dt><dd>${report.recommendation.cycleCount ?? "Manual"}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(report.recommendation.confidence)}</dd></div>
      </dl>
      <p>${escapeHtml(report.recommendation.processSummary)}</p>
    </section>
    <section>
      <h2>Customer Quote Summary</h2>
      <ul>${customerSummaryLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Quote Assumptions</h2>
      <ul>${assumptions.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Pricing Warnings</h2>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Billable Hours</h2>
      <ul>
        <li><strong>Furnace:</strong> ${formatNumber(report.recommendation.billableHours.furnace)} h</li>
        <li><strong>Bath/quench:</strong> ${formatNumber(report.recommendation.billableHours.bathQuench)} h</li>
        <li><strong>Temper:</strong> ${formatNumber(report.recommendation.billableHours.temper)} h</li>
        <li><strong>Labor:</strong> ${formatNumber(report.recommendation.billableHours.labor)} h</li>
      </ul>
    </section>
    <section>
      <h2>Internal Cost Breakdown</h2>
      <ul>
        ${quoteCostBreakdownEntries(report.recommendation.breakdown)
          .map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${formatCurrency(value)}</li>`)
          .join("")}
      </ul>
    </section>
    <section>
      <h2>Internal Notes</h2>
      <ul>${internalNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Validation Checks</h2>
      <ul class="report-checklist">
        ${quoteReportChecklistItems(report)}
      </ul>
    </section>
    <section>
      <h2>Model Notes</h2>
      <p>Heat-treatment service pricing only. This quote excludes material, machining, outside services, freight, tax, and contractual terms unless entered separately as manual adjustments.</p>
    </section>
  `;
}

function quoteReportChecklistItems(report: QuoteReportViewModel): string {
  if (report.validationChecklist.items.length === 0) {
    return `<li><span>Open</span>No validation checks generated.</li>`;
  }

  return report.validationChecklist.items.map((item) => `
    <li>
      <span>${item.checked ? "Checked" : "Open"}</span>
      ${escapeHtml(item.label)}
      ${item.notes.trim() ? `<em>Notes: ${escapeHtml(item.notes.trim())}</em>` : ""}
    </li>
  `).join("");
}

function reportHtml(report: ReportViewModel): string {
  const warnings = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings
    : ["No active risk warnings for the current input set."];
  const notes = report.metadata.notes.trim() || "No project notes entered.";

  return `
    <header class="report-document-header">
      <h1>${escapeHtml(report.title)}</h1>
      <dl>
        <div><dt>Generated</dt><dd>${escapeHtml(report.exportedAt)}</dd></div>
        <div><dt>Customer</dt><dd>${escapeHtml(report.metadata.customerName || "Unspecified")}</dd></div>
        <div><dt>Part</dt><dd>${escapeHtml(report.metadata.partName || "Unspecified")}</dd></div>
        <div><dt>Grade</dt><dd>${escapeHtml(report.input.target.grade)}</dd></div>
      </dl>
    </header>
    <section>
      <h2>Project Notes</h2>
      <p>${escapeHtml(notes)}</p>
    </section>
    <section>
      <h2>Process Windows</h2>
      <ul>
        <li><strong>Austenitize:</strong> ${temperatureRangeLabel(report.recommendation.austenitize.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.austenitize.temperature, report.unitSystem)}, soak ${report.recommendation.austenitize.soakAfterCoreAtTemp.minMin}-${report.recommendation.austenitize.soakAfterCoreAtTemp.maxMin} min</li>
        <li><strong>Austemper:</strong> ${temperatureRangeLabel(report.recommendation.austemper.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.austemper.temperature, report.unitSystem)}, hold ${report.recommendation.austemper.holdAfterCoreAtTemp.minMin}-${report.recommendation.austemper.holdAfterCoreAtTemp.maxMin} min</li>
        <li><strong>Transfer:</strong> actual ${report.recommendation.transfer.actualTransferTimeSec} s, max ${report.recommendation.transfer.maxRecommendedTransferTimeSec} s</li>
      </ul>
    </section>
    <section>
      <h2>Scores</h2>
      <dl class="report-scores">
        <div><dt>Confidence</dt><dd>${escapeHtml(report.recommendation.confidence)}</dd></div>
        <div><dt>AI</dt><dd>${report.recommendation.scores.austemperabilityIndex.toFixed(2)}</dd></div>
        <div><dt>Required AI</dt><dd>${report.recommendation.scores.requiredAustemperabilityIndex.toFixed(2)}</dd></div>
        <div><dt>CSR</dt><dd>${report.recommendation.scores.carbideSegregationRisk.toFixed(2)}</dd></div>
      </dl>
    </section>
    ${report.comparison ? reportComparisonHtml(report.comparison) : ""}
    <section>
      <h2>Warnings</h2>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Validation Checklist</h2>
      <ul class="report-checklist">
        ${report.validationChecklist.items.map((item) => `
          <li>
            <span>${item.checked ? "Checked" : "Open"}</span>
            ${escapeHtml(item.label)}
            ${item.notes.trim() ? `<em>Notes: ${escapeHtml(item.notes.trim())}</em>` : ""}
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function steelReportHtml(report: SteelReportViewModel): string {
  const warnings = report.recommendation.warnings.length > 0
    ? report.recommendation.warnings
    : ["No active risk warnings for the current input set."];
  const notes = report.metadata.notes.trim() || "No project notes entered.";

  return `
    <header class="report-document-header">
      <h1>${escapeHtml(report.title)}</h1>
      <dl>
        <div><dt>Generated</dt><dd>${escapeHtml(report.exportedAt)}</dd></div>
        <div><dt>Customer</dt><dd>${escapeHtml(report.metadata.customerName || "Unspecified")}</dd></div>
        <div><dt>Part</dt><dd>${escapeHtml(report.metadata.partName || "Unspecified")}</dd></div>
        <div><dt>Priority</dt><dd>${escapeHtml(report.input.target.priority)}</dd></div>
      </dl>
    </header>
    <section>
      <h2>Project Notes</h2>
      <p>${escapeHtml(notes)}</p>
    </section>
    <section>
      <h2>Transformation Estimates</h2>
      <dl class="report-scores">
        <div><dt>Ac1</dt><dd>${report.recommendation.transformation.ac1C} °C</dd></div>
        <div><dt>Ac3</dt><dd>${report.recommendation.transformation.ac3C} °C</dd></div>
        <div><dt>Ms</dt><dd>${report.recommendation.transformation.msC} °C</dd></div>
        <div><dt>Bainite Start</dt><dd>${report.recommendation.transformation.bainiteStartC} °C</dd></div>
      </dl>
    </section>
    <section>
      <h2>Process Windows</h2>
      <ul>
        <li><strong>Austenitize:</strong> ${temperatureRangeLabel(report.recommendation.austenitize.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.austenitize.temperature, report.unitSystem)}, soak ${report.recommendation.austenitize.soakAfterCoreAtTemp.minMin}-${report.recommendation.austenitize.soakAfterCoreAtTemp.maxMin} min</li>
        ${steelReportProcessItems(report)}
      </ul>
    </section>
    <section>
      <h2>Scores</h2>
      <dl class="report-scores">
        <div><dt>Confidence</dt><dd>${escapeHtml(report.recommendation.confidence)}</dd></div>
        <div><dt>Window</dt><dd>${escapeHtml(report.recommendation.processingWindowStatus)}</dd></div>
        <div><dt>Hardenability</dt><dd>${report.recommendation.transformation.hardenabilityScore.toFixed(2)}</dd></div>
        <div><dt>Retained Austenite Risk</dt><dd>${report.recommendation.transformation.retainedAusteniteRisk.toFixed(2)}</dd></div>
      </dl>
    </section>
    <section>
      <h2>Warnings</h2>
      <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
    </section>
    <section>
      <h2>Validation Checklist</h2>
      <ul class="report-checklist">
        ${report.validationChecklist.items.map((item) => `
          <li>
            <span>${item.checked ? "Checked" : "Open"}</span>
            ${escapeHtml(item.label)}
            ${item.notes.trim() ? `<em>Notes: ${escapeHtml(item.notes.trim())}</em>` : ""}
          </li>
        `).join("")}
      </ul>
    </section>
    <section>
      <h2>Model Notes</h2>
      <p>Advisory first-pass windows only; validate against steel grade data, Jominy/CCT/TTT behavior, representative coupons, hardness traverse, and metallography before production use.</p>
    </section>
  `;
}

function steelReportProcessItems(report: SteelReportViewModel): string {
  if (report.recommendation.mode === "steel-austempering") {
    return `
      <li><strong>Austemper:</strong> ${temperatureRangeLabel(report.recommendation.austemper.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.austemper.temperature, report.unitSystem)}, hold ${report.recommendation.austemper.holdAfterCoreAtTemp.minMin}-${report.recommendation.austemper.holdAfterCoreAtTemp.maxMin} min</li>
      <li><strong>Expected structure:</strong> ${escapeHtml(report.recommendation.expectedStructure)}</li>
      <li><strong>Expected hardness:</strong> ${report.recommendation.expectedHardness.minHrc}-${report.recommendation.expectedHardness.maxHrc} HRC</li>
    `;
  }

  return `
    <li><strong>Martemper:</strong> ${temperatureRangeLabel(report.recommendation.martemper.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.martemper.temperature, report.unitSystem)}, equalize ${report.recommendation.equalize.minMin}-${report.recommendation.equalize.maxMin} min</li>
    <li><strong>As-quenched hardness:</strong> ${report.recommendation.asQuenchedHardness.minHrc}-${report.recommendation.asQuenchedHardness.maxHrc} HRC</li>
    <li><strong>Temper:</strong> ${temperatureRangeLabel(report.recommendation.temper.temperature, report.unitSystem)}, nominal ${temperatureNominalLabel(report.recommendation.temper.temperature, report.unitSystem)}, hold ${report.recommendation.temper.hold.minMin}-${report.recommendation.temper.hold.maxMin} min, target ${report.recommendation.temper.targetHardnessHrc} HRC</li>
  `;
}

function reportComparisonHtml(comparison: ComparisonViewModel): string {
  return `
    <section>
      <h2>Current vs Pinned</h2>
      <p><strong>${escapeHtml(comparison.label)}</strong> ${escapeHtml(comparison.pinnedAt)}</p>
      <table>
        <thead>
          <tr><th>Metric</th><th>Baseline</th><th>Current</th><th>Delta</th></tr>
        </thead>
        <tbody>
          ${comparison.rows.map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${escapeHtml(row.baselineValue)}</td>
              <td>${escapeHtml(row.currentValue)}</td>
              <td>${escapeHtml(row.delta)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function settingsFields(): string {
  return calibrationFields
    .map((field) => {
      const value = calibration[field.key].toFixed(2);
      return `
        <div class="settings-field">
          <label for="setting-${field.key}">${field.label}</label>
          <p>${field.description}</p>
          <div class="settings-control">
            <input
              id="setting-${field.key}"
              data-calibration="${field.key}"
              type="range"
              min="${field.min}"
              max="${field.max}"
              step="${field.step}"
              value="${value}"
            />
            <input
              aria-label="${field.label} value"
              data-calibration="${field.key}"
              type="number"
              min="${field.min}"
              max="${field.max}"
              step="${field.step}"
              value="${value}"
            />
          </div>
        </div>
      `;
    })
    .join("");
}

function syncUnitControls(): void {
  document.querySelectorAll<HTMLInputElement>('[data-path][type="number"], [data-steel-path][type="number"], [data-quote-path][type="number"]').forEach((control) => {
    const path = control.dataset.path ?? control.dataset.steelPath ?? control.dataset.quotePath ?? "";
    if (!isUnitSensitivePath(path)) {
      return;
    }

    const metricValue = control.dataset.quotePath
      ? getQuoteNumericStateValue(path)
      : control.dataset.steelPath
        ? getSteelNumericStateValue(path)
        : getNumericStateValue(path);
    if (metricValue !== undefined) {
      control.value = formatNumber(toDisplayValue(path, metricValue, unitSystem));
    }
  });

  document.querySelectorAll<HTMLElement>("[data-unit-for]").forEach((unitEl) => {
    const path = unitEl.dataset.unitFor ?? "";
    unitEl.textContent = unitLabelForPath(path, unitSystem, unitEl.textContent ?? "");
  });
}

function syncUnitPreferenceControls(): void {
  document.querySelectorAll<HTMLInputElement>('input[name="unit-system"]').forEach((control) => {
    control.checked = control.value === unitSystem;
  });
}

function getNumericStateValue(path: string): number | undefined {
  switch (path) {
    case "geometry.maxSectionMm":
      return state.geometry.maxSectionMm;
    case "geometry.criticalSectionMm":
      return state.geometry.criticalSectionMm;
    case "geometry.minSectionMm":
      return state.geometry.minSectionMm;
    case "geometry.estimatedMassKg":
      return state.geometry.estimatedMassKg;
    case "equipment.bathUniformityC":
      return state.equipment.bathUniformityC;
    default:
      return undefined;
  }
}

function getSteelNumericStateValue(path: string): number | undefined {
  const input = activeModeId === "martempering"
    ? martemperingState
    : steelAustemperingState;

  switch (path) {
    case "geometry.maxSectionMm":
      return input.geometry.maxSectionMm;
    case "geometry.criticalSectionMm":
      return input.geometry.criticalSectionMm;
    case "geometry.minSectionMm":
      return input.geometry.minSectionMm;
    case "geometry.estimatedMassKg":
      return input.geometry.estimatedMassKg;
    case "equipment.bathUniformityC":
      return input.equipment.bathUniformityC;
    default:
      return undefined;
  }
}

function getQuoteNumericStateValue(path: string): number | undefined {
  switch (path) {
    case "lot.pieceWeightKg":
      return heatTreatQuoteState.lot.pieceWeightKg;
    case "lot.totalWeightKg":
      return heatTreatQuoteState.lot.totalWeightKg;
    case "lot.loadCapacityKg":
      return heatTreatQuoteState.lot.loadCapacityKg;
    default:
      return undefined;
  }
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

function formatCurrency(value: number): string {
  const amount = `$${Math.abs(value).toFixed(2)}`;
  return value < 0 ? `-${amount}` : amount;
}

function fieldLabel(label: string, helpKey?: string): string {
  return `<span class="field-label">${label}${helpKey ? helpButton(helpKey) : ""}</span>`;
}

function helpButton(helpKey: string): string {
  const text = helpCopy[helpKey];
  if (!text) {
    return "";
  }

  return `
    <span class="help-button" role="img" tabindex="0" aria-label="${helpKey} help" data-tooltip="${text}">
      ?
    </span>
  `;
}

function metadataField(key: keyof ProjectMetadata, label: string, value: string): string {
  return `
    <label class="field">
      <span class="field-label">${label}</span>
      <input data-metadata="${key}" type="text" value="${escapeAttribute(value)}" />
    </label>
  `;
}

function metadataNotesField(): string {
  return `
    <label class="field metadata-notes-field">
      <span class="field-label">Notes</span>
      <textarea data-metadata="notes" rows="3">${escapeHtml(projectMetadata.notes)}</textarea>
    </label>
  `;
}

function selectField(
  id: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
  helpKey?: string,
): string {
  return `
    <label class="field">
      ${fieldLabel(label, helpKey)}
      <select data-path="${id}">
        ${options
          .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function steelSelectField(
  path: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
  helpKey?: string,
): string {
  return `
    <label class="field">
      ${fieldLabel(label, helpKey)}
      <select data-steel-path="${path}">
        ${options
          .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function quoteSelectField(
  path: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
): string {
  return `
    <label class="field">
      ${fieldLabel(label)}
      <select data-quote-path="${path}">
        ${options
          .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function quoteTextField(
  path: string,
  label: string,
  value: string,
  readOnly = false,
): string {
  return `
    <label class="field">
      ${fieldLabel(label)}
      <input data-quote-path="${path}" type="text" value="${escapeAttribute(value)}" ${readOnly ? "readonly" : ""} />
    </label>
  `;
}

function numberField(
  id: string,
  label: string,
  value: number,
  step: string,
  unit = "",
  helpKey?: string,
): string {
  const displayValue = toDisplayValue(id, value, unitSystem);
  const displayUnit = unitLabelForPath(id, unitSystem, unit);
  const minAttribute = id.startsWith("composition.") ? ` min="0"` : "";

  return `
    <label class="field">
      ${fieldLabel(label, helpKey)}
      <div class="unit-input">
        <input data-path="${id}" type="number" value="${formatNumber(displayValue)}" step="${step}"${minAttribute} />
        ${displayUnit ? `<span data-unit-for="${id}">${displayUnit}</span>` : ""}
      </div>
    </label>
  `;
}

function quoteNumberField(
  path: string,
  label: string,
  value: number | undefined,
  step: string,
  unit = "",
): string {
  const displayValue = value === undefined || Number.isNaN(value)
    ? ""
    : formatNumber(toDisplayValue(path, value, unitSystem));
  const displayUnit = unitLabelForPath(path, unitSystem, unit);
  const minAttribute = path === "adjustments.manualAdderDiscount" ? "" : ` min="0"`;

  return `
    <label class="field">
      ${fieldLabel(label)}
      <div class="unit-input">
        <input data-quote-path="${path}" type="number" value="${displayValue}" step="${step}"${minAttribute} />
        ${displayUnit ? `<span data-unit-for="${path}">${displayUnit}</span>` : ""}
      </div>
    </label>
  `;
}

function steelNumberField(
  path: string,
  label: string,
  value: number | undefined,
  step: string,
  unit = "",
  helpKey?: string,
): string {
  const displayValue = value === undefined || Number.isNaN(value)
    ? ""
    : formatNumber(toDisplayValue(path, value, unitSystem));
  const displayUnit = unitLabelForPath(path, unitSystem, unit);

  return `
    <label class="field">
      ${fieldLabel(label, helpKey)}
      <div class="unit-input">
        <input data-steel-path="${path}" type="number" value="${displayValue}" step="${step}" min="0" />
        ${displayUnit ? `<span data-unit-for="${path}">${displayUnit}</span>` : ""}
      </div>
    </label>
  `;
}

function toggleField(id: string, label: string, checked = false): string {
  return `
    <label class="field toggle-field">
      ${fieldLabel(label, label)}
      <span class="toggle-control">
        <input id="${id}" type="checkbox" ${checked ? "checked" : ""} />
      </span>
    </label>
  `;
}

function steelToggleField(path: string, label: string, checked = false): string {
  return `
    <label class="field toggle-field">
      ${fieldLabel(label, label)}
      <span class="toggle-control">
        <input data-steel-path="${path}" type="checkbox" ${checked ? "checked" : ""} />
      </span>
    </label>
  `;
}

function processWindow(
  icon: string,
  title: string,
  range: string,
  nominal: string,
  timeLabel: string,
  timeValue: string,
  status: "robust" | "narrow" | "invalid",
  note = "",
): string {
  const badge = windowStatusBadge(status);

  return `
    <div class="process-window">
      <div class="window-title"><i class="ph ${icon}"></i>${title}<span class="${badge.className}">${badge.label}</span></div>
      <div class="window-main">${range}</div>
      <div class="window-details">
        <span>Recommended <strong>${nominal}</strong></span>
        <span>${timeLabel} <strong>${timeValue}</strong></span>
      </div>
      ${note ? `<p class="window-note">${note}</p>` : ""}
    </div>
  `;
}

function metric(label: string, value: string, hint: string, helpKey?: string): string {
  return `
    <div class="metric">
      <span>${label}${helpKey ? helpButton(helpKey) : ""}</span>
      <strong>${value}</strong>
      <em>${hint}</em>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
