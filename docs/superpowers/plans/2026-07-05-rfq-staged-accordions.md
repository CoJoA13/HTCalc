# RFQ Staged Accordions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Heat-Treat RFQ input pane into staged accordions that reduce visual overload while preserving existing quote math, preset workflows, imports, reports, and live recommendation output.

**Architecture:** Keep all RFQ behavior in the existing `src/ui/main.ts` browser UI module, adding UI-only accordion state and small render helpers around the current field groups. Add focused jsdom workflow tests in the existing RFQ workflow suite, then add restrained CSS in `src/ui/styles.css` using the approved HTCalc design tokens and flat workbench treatment.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, existing HTCalc RFQ quote modules, existing Phosphor icon web components.

---

## File Structure

- Modify `test/ui-rfq-workflow.test.ts`: add RFQ accordion workflow coverage and small DOM helpers.
- Modify `src/ui/main.ts`: add RFQ accordion section state, section render helpers, status helpers, review-readiness summary helpers, and accordion button binding.
- Modify `src/ui/styles.css`: add flat accordion shell, header, status, body, grouped-rate, review-readiness, and mobile rules.
- Modify `CHANGELOG.md`: add an Unreleased note for RFQ staged accordions.

## Task 1: Failing RFQ Accordion Workflow Tests

**Files:**
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add staged-accordion workflow tests**

Add these tests inside `describe("Heat-Treat RFQ UI workflow", () => { ... })`, immediately after the invalid preset import test:

```ts
  it("renders RFQ inputs as staged accordion sections with accessible defaults", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    expect(quoteAccordionText("source")).toContain("Source & Assumptions");
    expect(quoteAccordionText("source")).toContain("Manual");
    expect(quoteAccordionButton("source").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("source").hidden).toBe(false);

    expect(quoteAccordionText("lot")).toContain("Lot & Capacity");
    expect(quoteAccordionText("lot")).toContain("6 fields");
    expect(quoteAccordionButton("lot").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("lot").hidden).toBe(false);

    expect(quoteAccordionText("rates")).toContain("Shop Rates");
    expect(quoteAccordionText("rates")).toContain("No preset");
    expect(quoteAccordionButton("rates").getAttribute("aria-expanded")).toBe("true");
    expect(quoteAccordionPanel("rates").hidden).toBe(false);

    expect(quoteAccordionText("adjustments")).toContain("Overrides & Adjustments");
    expect(quoteAccordionText("adjustments")).toContain("Optional");
    expect(quoteAccordionButton("adjustments").getAttribute("aria-expanded")).toBe("false");
    expect(quoteAccordionPanel("adjustments").hidden).toBe(true);

    expect(quoteAccordionText("review")).toContain("Review & Export Readiness");
    expect(quoteAccordionPanel("review").hidden).toBe(false);
    expect(quoteReviewReadinessText()).toContain("Heat-treatment service pricing only");
  });

  it("toggles RFQ override staging without losing entered quote values", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(false);

    setQuoteNumber("manualOverrides.billableFurnaceHours", "2.5");
    setQuoteNumber("adjustments.manualAdderDiscount", "-25");
    expect(quoteAccordionText("adjustments")).toContain("Overrides active");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(true);
    expect(quoteControl<HTMLInputElement>("manualOverrides.billableFurnaceHours").value).toBe("2.5");
    expect(quoteControl<HTMLInputElement>("adjustments.manualAdderDiscount").value).toBe("-25");

    quoteAccordionButton("adjustments").click();
    expect(quoteAccordionPanel("adjustments").hidden).toBe(false);
    expect(quoteControl<HTMLInputElement>("manualOverrides.billableFurnaceHours").value).toBe("2.5");
    expect(quoteControl<HTMLInputElement>("adjustments.manualAdderDiscount").value).toBe("-25");
  });

  it("updates RFQ review readiness while preserving rate preset workflows", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Staged RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("lot.quantity", "30");
    setQuoteNumber("lot.totalWeightKg", "150");
    setQuoteNumber("lot.loadCapacityKg", "75");
    setQuoteNumber("lot.laborHoursPerLoad", "0.75");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.setupAdminCharge", "100");
    setQuoteNumber("shopRates.laborRatePerHour", "90");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    setQuoteNumber("shopRates.bathQuenchRatePerHour", "95");
    setQuoteNumber("shopRates.temperFurnaceRatePerHour", "80");
    setQuoteNumber("shopRates.inspectionBaseCharge", "60");
    setQuoteNumber("shopRates.consumablesPerKg", "0.55");
    setQuoteNumber("shopRates.handlingPackagingCharge", "30");
    setQuoteNumber("shopRates.overheadPercent", "18");
    setQuoteNumber("shopRates.targetMarginPercent", "22");

    expect(quoteReviewReadinessText()).toContain("Manual heat-treatment quote");
    expect(quoteReviewReadinessText()).toContain("Warnings");
    expect(quoteReviewReadinessText()).toContain("Open checks");

    clickRatePresetAction("save");
    expect(quoteAccordionText("rates")).toContain("Staged RFQ");

    setQuoteNumber("shopRates.furnaceRatePerHour", "5");
    clickRatePresetAction("apply");

    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(quoteReviewReadinessText()).toContain("Staged RFQ");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
  });
```

- [ ] **Step 2: Add RFQ accordion test helpers**

Add these helper types and functions near the existing RFQ test helpers, immediately before `type RatePresetAction = "apply" | "save" | "import" | "export" | "delete";`:

```ts
type QuoteAccordionSection = "source" | "lot" | "rates" | "adjustments" | "review";

function quoteAccordionButton(section: QuoteAccordionSection): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-accordion-toggle="${section}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function quoteAccordionPanel(section: QuoteAccordionSection): HTMLDivElement {
  const panel = document.querySelector<HTMLDivElement>(`[data-quote-accordion-panel="${section}"]`);
  expect(panel).not.toBeNull();
  return panel!;
}

function quoteAccordionText(section: QuoteAccordionSection): string {
  const container = document.querySelector<HTMLElement>(`[data-quote-accordion-section="${section}"]`);
  expect(container).not.toBeNull();
  return compactText(container!.textContent ?? "");
}

function quoteReviewReadinessText(): string {
  return compactText(document.querySelector("[data-quote-review-readiness]")?.textContent ?? "");
}
```

- [ ] **Step 3: Run the targeted test and confirm it fails**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: FAIL because `[data-quote-accordion-toggle]`, `[data-quote-accordion-panel]`, and `[data-quote-review-readiness]` do not exist yet.

## Task 2: RFQ Accordion State, Rendering, and Live Status Helpers

**Files:**
- Modify: `src/ui/main.ts`

- [ ] **Step 1: Add RFQ accordion types and default state**

Add this type and state block after `let selectedQuoteRatePresetId = "";`:

```ts
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
```

- [ ] **Step 2: Add RFQ review and status helper functions**

Add these helpers immediately after `quoteWorkspaceInput()`:

```ts
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
  readiness: QuoteReviewReadiness,
): Record<QuoteAccordionSectionId, string> {
  return {
    source: input.sourceMode === "manual" ? "Manual" : "Imported",
    lot: input.lot.cycleCountOverride !== undefined ? "Cycle override" : "6 fields",
    rates: selectedPreset ? quoteRatePresetDisplayName(selectedPreset) : "No preset",
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
    <dl class="quote-review-readiness" data-quote-review-readiness>
      <div class="quote-review-row"><dt>Source</dt><dd>${escapeHtml(readiness.sourceLabel)}</dd></div>
      <div class="quote-review-row"><dt>Process</dt><dd>${escapeHtml(readiness.processLabel)}</dd></div>
      <div class="quote-review-row"><dt>Rates</dt><dd>${escapeHtml(readiness.ratePresetLabel)}</dd></div>
      <div class="quote-review-row"><dt>Warnings</dt><dd>${readiness.warningCount}</dd></div>
      <div class="quote-review-row"><dt>Open checks</dt><dd>${readiness.openCheckCount}</dd></div>
      <div class="quote-review-note">
        Heat-treatment service pricing only. Excludes material, machining, outside services, freight, tax, and contract terms unless manually adjusted.
      </div>
    </dl>
  `;
}
```

- [ ] **Step 3: Add the generic RFQ accordion section renderer**

Add this helper immediately after the functions from Step 2:

```ts
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
```

- [ ] **Step 4: Add accordion event binding and live status refresh**

Add these functions immediately after `bindQuoteInputs()`:

```ts
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
  const preset = selectedQuoteRatePreset();
  const readiness = quoteReviewReadiness(input, preset);
  const statuses = quoteAccordionStatusMap(input, preset, readiness);

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
```

- [ ] **Step 5: Wire the new binding and refresh function into existing RFQ inputs**

In `bindQuoteInputs()`, add `bindQuoteAccordionControls();` immediately before `bindQuoteRatePresetControls();`.

Then replace the final `renderQuoteRecommendation();` call in the non-source input handler with:

```ts
      renderQuoteRecommendation();
      refreshQuoteAccordionSummary();
```

The finished tail of `bindQuoteInputs()` must read:

```ts
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
```

- [ ] **Step 6: Run the targeted test and confirm the original selectors still fail**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: FAIL because `quoteWorkspace()` still renders legacy `section-block` markup without the new accordion data attributes.

## Task 3: Replace the RFQ Input Pane Sections with Staged Accordions

**Files:**
- Modify: `src/ui/main.ts`

- [ ] **Step 1: Replace the `quoteWorkspace()` body with staged sections**

Replace the entire `quoteWorkspace()` function with this implementation:

```ts
function quoteWorkspace(): string {
  const input = quoteWorkspaceInput();
  normalizeSelectedQuoteRatePresetId();
  const selectedPreset = selectedQuoteRatePreset();
  const readiness = quoteReviewReadiness(input, selectedPreset);
  const statuses = quoteAccordionStatusMap(input, selectedPreset, readiness);

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
```

- [ ] **Step 2: Run the targeted RFQ workflow test**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: PASS for all tests in `test/ui-rfq-workflow.test.ts`.

- [ ] **Step 3: Commit the tested markup and behavior**

Run:

```bash
git add src/ui/main.ts test/ui-rfq-workflow.test.ts
git commit -m "feat: stage rfq inputs in accordions"
```

## Task 4: Accordion Visual Polish and Changelog

**Files:**
- Modify: `src/ui/styles.css`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add RFQ accordion CSS**

Add this CSS after the existing `.section-heading i` rule and before `.field-grid, .composition-grid`:

```css
.quote-accordion-stack {
  display: grid;
  gap: 10px;
}

.quote-accordion-section {
  overflow: hidden;
  border: 1px solid #dbe3ec;
  border-radius: 8px;
  background: #ffffff;
}

.quote-accordion-heading {
  margin: 0;
}

.quote-accordion-toggle {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 24px;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: 0;
  padding: 0 12px;
  background: #ffffff;
  color: #172033;
  text-align: left;
}

.quote-accordion-toggle:hover {
  background: #f8fafc;
}

.quote-accordion-toggle:focus-visible {
  outline: 3px solid rgb(15 118 110 / 20%);
  outline-offset: -3px;
}

.quote-accordion-title {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 800;
}

.quote-accordion-title i {
  flex: 0 0 auto;
  color: #0f766e;
  font-size: 19px;
}

.quote-accordion-status {
  display: inline-flex;
  max-width: 220px;
  min-height: 22px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid #d7e0ea;
  border-radius: 999px;
  padding: 2px 8px;
  background: #f8fafc;
  color: #526074;
  font-size: 11px;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-accordion-chevron {
  color: #607086;
  font-size: 16px;
  transition: transform 140ms ease;
}

.quote-accordion-section.is-open .quote-accordion-chevron {
  transform: rotate(180deg);
}

.quote-accordion-panel {
  border-top: 1px solid #dbe3ec;
  padding: 14px;
  background: #fbfcfd;
}

.quote-accordion-panel[hidden] {
  display: none;
}

.quote-assumption-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #dbe3ec;
}

.quote-assumption-summary div,
.quote-review-row {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.quote-assumption-summary span,
.quote-review-row dt {
  color: #607086;
  font-size: 11px;
  font-weight: 780;
  text-transform: uppercase;
}

.quote-assumption-summary strong,
.quote-review-row dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: #172033;
  font-size: 13px;
  font-weight: 680;
}

.quote-rate-groups {
  display: grid;
  gap: 14px;
}

.quote-rate-group {
  display: grid;
  gap: 9px;
}

.quote-rate-group-title {
  color: #526074;
  font-size: 12px;
  font-weight: 820;
  text-transform: uppercase;
}

.quote-review-readiness {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.quote-review-note {
  grid-column: 1 / -1;
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid #dbe3ec;
  color: #526074;
  font-size: 12px;
  line-height: 1.45;
}
```

- [ ] **Step 2: Add mobile CSS**

Inside `@media (max-width: 760px)`, add these rules after `.quote-rate-preset-actions .secondary-action { ... }`:

```css
  .quote-accordion-toggle {
    grid-template-columns: minmax(0, 1fr) auto 20px;
    padding: 0 10px;
  }

  .quote-accordion-title {
    font-size: 13px;
  }

  .quote-accordion-status {
    max-width: 128px;
  }

  .quote-assumption-summary,
  .quote-review-readiness {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 3: Add the changelog note**

Add this bullet at the top of the current Unreleased section in `CHANGELOG.md`:

```md
- Staged the Heat-Treat RFQ input pane into accessible accordions for source assumptions, lot capacity, shop rates, optional overrides, and review/export readiness.
```

- [ ] **Step 4: Run targeted tests and typecheck**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit the visual polish**

Run:

```bash
git add src/ui/styles.css CHANGELOG.md
git commit -m "style: polish rfq staged accordions"
```

## Task 5: Final Verification

**Files:**
- No source edits in this task.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: build completes and writes `dist/`.

- [ ] **Step 3: Inspect the final diff**

Run:

```bash
git status -sb
git diff --stat main...HEAD
```

Expected: branch contains the design/context commit plus RFQ staged-accordion implementation commits. No generated `.superpowers/`, `node_modules/`, or `dist/` files are staged.

- [ ] **Step 4: Push and open the PR after user approval**

Run these commands after the user approves PR creation:

```bash
git push -u origin codex/rfq-staged-accordions-design
gh pr create --title "[codex] Stage RFQ inputs in accordions" --body "## Summary
- Add approved Impeccable product/design context and RFQ staged-accordion spec
- Stage RFQ source, lot, shop rates, optional overrides, and review readiness in accessible accordions
- Preserve RFQ pricing, rate preset import/export/apply/delete, report, and project workflows

## Tests
- npm test
- npm run build"
```
