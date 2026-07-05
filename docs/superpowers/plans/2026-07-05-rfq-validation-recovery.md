# RFQ Validation Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RFQ field-local validation and stale-result recovery so invalid quote inputs point to exact fields or sections while preserving the last valid quote result safely.

**Architecture:** Keep quote math and project data unchanged. Add UI-only validation/recovery state in `src/ui/main.ts`, render inline field and section messages through the existing RFQ field helpers, and reuse the current quote model errors as the validation source. Add jsdom workflow tests for user-visible behavior and restrained CSS in `src/ui/styles.css`.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, existing HTCalc RFQ quote model, existing RFQ accordion UI.

---

## File Structure

- Modify `test/ui-rfq-workflow.test.ts`: add RFQ validation/recovery workflow tests and helpers.
- Modify `src/ui/main.ts`: add UI-only RFQ validation state, field/section message rendering, stale result rendering, and disabled stale report actions.
- Modify `src/ui/styles.css`: add compact inline validation, section message, and stale-result notice styles.
- Modify `CHANGELOG.md`: add an Unreleased note for RFQ validation/recovery.

## Task 1: Failing RFQ Validation Workflow Tests

**Files:**
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add RFQ validation workflow tests**

Add these tests inside `describe("Heat-Treat RFQ UI workflow", () => { ... })`, immediately after the existing test named `"refreshes RFQ rate status when selecting a non-matching preset without applying it"`:

```ts
  it("shows RFQ margin validation at the field and section level", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    enterQuoteBasisAndRates();
    setQuoteNumber("shopRates.targetMarginPercent", "100");

    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("Target margin must be at least 0 and less than 100%.");
    expect(quoteControl<HTMLInputElement>("shopRates.targetMarginPercent").getAttribute("aria-invalid")).toBe("true");
    expect(quoteAccordionStatusText("rates")).toBe("Check rates");
    expect(quoteAccordionStatusText("review")).toBe("Needs correction");
    expect(recommendationText()).toContain("Current RFQ inputs need correction before a new quote can be calculated.");

    setQuoteNumber("shopRates.targetMarginPercent", "22");

    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("");
    expect(quoteControl<HTMLInputElement>("shopRates.targetMarginPercent").hasAttribute("aria-invalid")).toBe(false);
    expect(quoteAccordionStatusText("review")).not.toBe("Needs correction");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
  });

  it("shows missing RFQ quote basis as a Lot & Capacity correction", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");

    expect(quoteAccordionStatusText("lot")).toBe("Needs input");
    expect(quoteSectionMessage("lot")).toBe("Enter lot weight and load capacity, or provide manual billable hours.");
    expect(quoteAccordionStatusText("review")).toBe("Needs correction");
    expect(recommendationText()).toContain("Current RFQ inputs need correction before a new quote can be calculated.");
    expect(recommendationText()).toContain("Enter lot weight and load capacity, or provide manual billable hours.");
  });

  it("keeps the last valid RFQ result visible as stale after an invalid edit", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    enterQuoteBasisAndRates();

    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(quoteReportActionButton("open").disabled).toBe(false);
    const validRecommendation = recommendationText();

    setQuoteNumber("shopRates.targetMarginPercent", "100");

    expect(recommendationText()).toContain("Showing last valid quote. Current inputs need correction.");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(recommendationText()).toContain("Target margin must be at least 0 and less than 100%.");
    expect(recommendationText()).toContain(validRecommendation.match(/\$[0-9,.]+/)?.[0] ?? "$");
    expect(quoteReportActionButton("open").disabled).toBe(true);
    expect(quoteReportActionButton("print").disabled).toBe(true);
    expect(quoteReportActionButton("markdown").disabled).toBe(true);

    setQuoteNumber("shopRates.targetMarginPercent", "22");

    expect(recommendationText()).not.toContain("Showing last valid quote");
    expect(quoteFieldMessage("shopRates.targetMarginPercent")).toBe("");
    expect(quoteReportActionButton("open").disabled).toBe(false);
  });
```

- [ ] **Step 2: Add RFQ validation test helpers**

Add these helpers near the existing RFQ helpers, immediately after `function setQuoteNumber(path: string, value: string): void { ... }`:

```ts
function enterQuoteBasisAndRates(): void {
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
}
```

Add these helpers immediately after `function quoteAccordionStatusText(section: QuoteAccordionSection): string { ... }`:

```ts
function quoteFieldMessage(path: string): string {
  const message = document.querySelector<HTMLElement>(`[data-quote-field-message-for="${path}"]`);
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

function quoteSectionMessage(section: QuoteAccordionSection): string {
  const message = document.querySelector<HTMLElement>(`[data-quote-section-message-for="${section}"]`);
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

type QuoteReportAction = "open" | "print" | "markdown";

function quoteReportActionButton(action: QuoteReportAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-report-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}
```

- [ ] **Step 3: Run the targeted test and verify RED**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: FAIL because `[data-quote-field-message-for]`, `[data-quote-section-message-for]`, stale result copy, and disabled stale report actions do not exist yet.

## Task 2: RFQ Validation View State and Inline Messages

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add RFQ validation state types and module state**

In `src/ui/main.ts`, add these types after `type QuoteAccordionSectionId = "source" | "lot" | "rates" | "adjustments" | "review";`:

```ts
type QuoteValidationResultStatus = "ready" | "incomplete" | "invalid" | "stale";

interface QuoteValidationViewState {
  readonly fieldMessages: Readonly<Record<string, string>>;
  readonly sectionMessages: Partial<Record<QuoteAccordionSectionId, string>>;
  readonly resultStatus: QuoteValidationResultStatus;
  readonly summaryMessage: string;
}
```

Add this state after `let quoteAccordionOpenState: Record<QuoteAccordionSectionId, boolean> = { ... };`:

```ts
const emptyQuoteValidationViewState: QuoteValidationViewState = {
  fieldMessages: {},
  sectionMessages: {},
  resultStatus: "incomplete",
  summaryMessage: "",
};

let quoteValidationViewState: QuoteValidationViewState = emptyQuoteValidationViewState;
let lastValidQuoteRecommendation: HeatTreatQuoteRecommendation | null = null;
```

- [ ] **Step 2: Add RFQ validation message maps and state builders**

Add these helpers immediately after `quoteWorkspaceInput()`:

```ts
const quoteFieldValidationMessages: Readonly<Record<string, string>> = {
  "lot.quantity": "Quantity must be greater than zero.",
  "lot.pieceWeightKg": "Piece weight must be greater than zero.",
  "lot.totalWeightKg": "Total weight must be greater than zero.",
  "lot.loadCapacityKg": "Load capacity must be greater than zero.",
  "lot.laborHoursPerLoad": "Labor/load must be zero or greater.",
  "lot.cycleCountOverride": "Cycle override must be greater than zero.",
  "shopRates.minimumLotCharge": "Minimum lot charge must be zero or greater.",
  "shopRates.setupAdminCharge": "Setup/admin charge must be zero or greater.",
  "shopRates.laborRatePerHour": "Labor rate must be zero or greater.",
  "shopRates.furnaceRatePerHour": "Furnace rate must be zero or greater.",
  "shopRates.bathQuenchRatePerHour": "Bath/quench rate must be zero or greater.",
  "shopRates.temperFurnaceRatePerHour": "Temper rate must be zero or greater.",
  "shopRates.inspectionBaseCharge": "Inspection charge must be zero or greater.",
  "shopRates.consumablesPerKg": "Consumables must be zero or greater.",
  "shopRates.handlingPackagingCharge": "Handling/packaging charge must be zero or greater.",
  "shopRates.overheadPercent": "Overhead must be at least 0 and less than 100%.",
  "shopRates.targetMarginPercent": "Target margin must be at least 0 and less than 100%.",
  "manualOverrides.billableFurnaceHours": "Furnace hours must be zero or greater.",
  "manualOverrides.billableBathQuenchHours": "Bath/quench hours must be zero or greater.",
  "manualOverrides.billableTemperHours": "Temper hours must be zero or greater.",
  "manualOverrides.billableLaborHours": "Labor hours must be zero or greater.",
  "manualOverrides.billableCycleCount": "Billable cycles must be greater than zero.",
  "adjustments.complexityFactor": "Complexity must be greater than zero.",
  "adjustments.scrapReworkReservePercent": "Scrap reserve must be zero or greater.",
  "adjustments.expediteMultiplier": "Expedite multiplier must be greater than zero.",
  "adjustments.manualAdderDiscount": "Adder/discount must be a finite number.",
};

const quoteFieldSections: Readonly<Record<string, QuoteAccordionSectionId>> = {
  "lot.quantity": "lot",
  "lot.pieceWeightKg": "lot",
  "lot.totalWeightKg": "lot",
  "lot.loadCapacityKg": "lot",
  "lot.laborHoursPerLoad": "lot",
  "lot.cycleCountOverride": "lot",
  "shopRates.minimumLotCharge": "rates",
  "shopRates.setupAdminCharge": "rates",
  "shopRates.laborRatePerHour": "rates",
  "shopRates.furnaceRatePerHour": "rates",
  "shopRates.bathQuenchRatePerHour": "rates",
  "shopRates.temperFurnaceRatePerHour": "rates",
  "shopRates.inspectionBaseCharge": "rates",
  "shopRates.consumablesPerKg": "rates",
  "shopRates.handlingPackagingCharge": "rates",
  "shopRates.overheadPercent": "rates",
  "shopRates.targetMarginPercent": "rates",
  "manualOverrides.billableFurnaceHours": "adjustments",
  "manualOverrides.billableBathQuenchHours": "adjustments",
  "manualOverrides.billableTemperHours": "adjustments",
  "manualOverrides.billableLaborHours": "adjustments",
  "manualOverrides.billableCycleCount": "adjustments",
  "adjustments.complexityFactor": "adjustments",
  "adjustments.scrapReworkReservePercent": "adjustments",
  "adjustments.expediteMultiplier": "adjustments",
  "adjustments.manualAdderDiscount": "adjustments",
};

function readyQuoteValidationState(): QuoteValidationViewState {
  return {
    fieldMessages: {},
    sectionMessages: {},
    resultStatus: "ready",
    summaryMessage: "",
  };
}

function quoteValidationStateForPricingBasis(input: HeatTreatQuoteInput): QuoteValidationViewState | null {
  if (quoteInputHasPricingBasis(input)) {
    return null;
  }

  if (!quoteInputHasManualBillableHours(input)) {
    const message = "Enter lot weight and load capacity, or provide manual billable hours.";
    return {
      fieldMessages: {},
      sectionMessages: {
        lot: message,
      },
      resultStatus: "incomplete",
      summaryMessage: message,
    };
  }

  const message = "Imported process times need cycle basis or manual overrides for each imported time bucket.";
  return {
    fieldMessages: {},
    sectionMessages: {
      adjustments: message,
    },
    resultStatus: "invalid",
    summaryMessage: message,
  };
}

function quoteValidationStateFromError(error: unknown): QuoteValidationViewState {
  const message = error instanceof Error
    ? error.message
    : "Current RFQ inputs need correction before a new quote can be calculated.";
  const fieldPath = quoteFieldPathFromErrorMessage(message);

  if (fieldPath) {
    const fieldMessage = quoteFieldValidationMessages[fieldPath] ?? message.replace(/^Invalid heat-treat quote input: /, "");
    const section = quoteFieldSections[fieldPath] ?? "review";
    return {
      fieldMessages: {
        [fieldPath]: fieldMessage,
      },
      sectionMessages: {
        [section]: fieldMessage,
      },
      resultStatus: "invalid",
      summaryMessage: fieldMessage,
    };
  }

  return {
    fieldMessages: {},
    sectionMessages: {
      review: message,
    },
    resultStatus: "invalid",
    summaryMessage: message,
  };
}

function quoteFieldPathFromErrorMessage(message: string): string | null {
  const match = /^Invalid heat-treat quote input: ([^ ]+) must /.exec(message);
  return match?.[1] ?? null;
}
```

- [ ] **Step 3: Add RFQ field and section message render helpers**

Add these helpers near the existing quote field helpers, immediately before `function quoteSelectField(...)`:

```ts
function quoteFieldMessageId(path: string): string {
  return `quote-field-message-${path.replace(/[^a-z0-9]+/gi, "-")}`;
}

function quoteFieldValidationAttributes(path: string): string {
  const message = quoteValidationViewState.fieldMessages[path];
  const invalid = message ? ` aria-invalid="true"` : "";
  return ` aria-describedby="${quoteFieldMessageId(path)}"${invalid}`;
}

function quoteFieldMessageElement(path: string): string {
  const message = quoteValidationViewState.fieldMessages[path] ?? "";
  return `
    <p
      id="${quoteFieldMessageId(path)}"
      class="quote-field-message"
      data-quote-field-message-for="${path}"
      ${message ? "" : "hidden"}
    >${escapeHtml(message)}</p>
  `;
}

function quoteSectionMessage(sectionId: QuoteAccordionSectionId): string {
  const message = quoteValidationViewState.sectionMessages[sectionId] ?? "";
  return `
    <p class="quote-section-message" data-quote-section-message-for="${sectionId}" ${message ? "" : "hidden"}>
      ${escapeHtml(message)}
    </p>
  `;
}
```

- [ ] **Step 4: Replace RFQ field helpers to include validation attributes and messages**

Replace `quoteSelectField`, `quoteTextField`, and `quoteNumberField` with these implementations:

```ts
function quoteSelectField(
  path: string,
  label: string,
  options: Array<[string, string]>,
  value: string,
): string {
  return `
    <label class="field">
      ${fieldLabel(label)}
      <select data-quote-path="${path}"${quoteFieldValidationAttributes(path)}>
        ${options
          .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${optionValue === value ? "selected" : ""}>${optionLabel}</option>`)
          .join("")}
      </select>
      ${quoteFieldMessageElement(path)}
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
      <input data-quote-path="${path}" type="text" value="${escapeAttribute(value)}" ${readOnly ? "readonly" : ""}${quoteFieldValidationAttributes(path)} />
      ${quoteFieldMessageElement(path)}
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
        <input data-quote-path="${path}" type="number" value="${displayValue}" step="${step}"${minAttribute}${quoteFieldValidationAttributes(path)} />
        ${displayUnit ? `<span data-unit-for="${path}">${displayUnit}</span>` : ""}
      </div>
      ${quoteFieldMessageElement(path)}
    </label>
  `;
}
```

- [ ] **Step 5: Add section messages to RFQ accordion bodies**

In `quoteWorkspace()`, add `quoteSectionMessage(...)` inside the affected accordion bodies:

```ts
        ${quoteAccordionSection("lot", statuses.lot, `
          <div class="field-grid geometry-grid">
            ${quoteNumberField("lot.quantity", "Quantity", input.lot.quantity, "1", "pcs")}
            ${quoteNumberField("lot.pieceWeightKg", "Piece Weight", input.lot.pieceWeightKg, "0.1", "kg")}
            ${quoteNumberField("lot.totalWeightKg", "Total Weight", input.lot.totalWeightKg, "0.1", "kg")}
            ${quoteNumberField("lot.loadCapacityKg", "Load Capacity", input.lot.loadCapacityKg, "0.1", "kg")}
            ${quoteNumberField("lot.laborHoursPerLoad", "Labor/Load", input.lot.laborHoursPerLoad, "0.1", "h")}
            ${quoteNumberField("lot.cycleCountOverride", "Cycle Override", input.lot.cycleCountOverride, "1", "cycles")}
          </div>
          ${quoteSectionMessage("lot")}
        `)}
```

For the `rates` body, add `${quoteSectionMessage("rates")}` after `</div>` for `.quote-rate-groups`.

For the `adjustments` body, add `${quoteSectionMessage("adjustments")}` after the field grid.

- [ ] **Step 6: Update accordion status mapping for validation state**

Replace `quoteAccordionStatusMap` with:

```ts
function quoteAccordionStatusMap(
  input: HeatTreatQuoteInput,
  selectedPreset: QuoteRatePreset | undefined,
  activePreset: QuoteRatePreset | undefined,
  readiness: QuoteReviewReadiness,
): Record<QuoteAccordionSectionId, string> {
  return {
    source: input.sourceMode === "manual" ? "Manual" : "Imported",
    lot: quoteValidationViewState.sectionMessages.lot ? "Needs input" : input.lot.cycleCountOverride !== undefined ? "Cycle override" : "6 fields",
    rates: quoteValidationViewState.sectionMessages.rates ? "Check rates" : activePreset ? quoteRatePresetDisplayName(activePreset) : selectedPreset ? "Custom rates" : "No preset",
    adjustments: quoteValidationViewState.sectionMessages.adjustments ? "Check overrides" : quoteHasActiveOverridesOrAdjustments(input) ? "Overrides active" : "Optional",
    review: quoteValidationViewState.resultStatus === "ready" ? readiness.status : "Needs correction",
  };
}
```

- [ ] **Step 7: Add in-place validation UI refresh**

Add this helper immediately after `refreshQuoteAccordionSummary()`:

```ts
function refreshQuoteValidationUi(): void {
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-quote-path]").forEach((control) => {
    const path = control.dataset.quotePath ?? "";
    const message = quoteValidationViewState.fieldMessages[path] ?? "";
    control.setAttribute("aria-describedby", quoteFieldMessageId(path));
    if (message) {
      control.setAttribute("aria-invalid", "true");
    } else {
      control.removeAttribute("aria-invalid");
    }
  });

  document.querySelectorAll<HTMLElement>("[data-quote-field-message-for]").forEach((messageEl) => {
    const path = messageEl.dataset.quoteFieldMessageFor ?? "";
    const message = quoteValidationViewState.fieldMessages[path] ?? "";
    messageEl.textContent = message;
    messageEl.hidden = !message;
  });

  document.querySelectorAll<HTMLElement>("[data-quote-section-message-for]").forEach((messageEl) => {
    const sectionId = messageEl.dataset.quoteSectionMessageFor as QuoteAccordionSectionId | undefined;
    const message = sectionId ? quoteValidationViewState.sectionMessages[sectionId] ?? "" : "";
    messageEl.textContent = message;
    messageEl.hidden = !message;
  });
}
```

- [ ] **Step 8: Run the targeted test and verify partial GREEN**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: tests still fail because `renderQuoteRecommendation()` does not set `quoteValidationViewState`, stale result rendering does not exist, and stale report actions are not disabled yet.

## Task 3: RFQ Stale Result Rendering and Recovery

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add RFQ correction state and result rendering helpers**

Add this helper immediately before `renderQuoteRecommendation()`:

```ts
function renderQuoteCorrectionState(recommendationPanel: HTMLDivElement, validation: QuoteValidationViewState): void {
  recommendationPanel.innerHTML = `
    <div class="error-state quote-correction-state">
      <i class="ph ph-warning-octagon"></i>
      <h2>Current RFQ inputs need correction</h2>
      <p>Current RFQ inputs need correction before a new quote can be calculated.</p>
      ${validation.summaryMessage ? `<p>${escapeHtml(validation.summaryMessage)}</p>` : ""}
    </div>
  `;
}

function quoteStaleNotice(validation: QuoteValidationViewState): string {
  return `
    <div class="quote-stale-notice" role="status">
      <strong>Showing last valid quote.</strong>
      <span>Current inputs need correction.</span>
      ${validation.summaryMessage ? `<em>${escapeHtml(validation.summaryMessage)}</em>` : ""}
    </div>
  `;
}
```

- [ ] **Step 2: Extract the current RFQ recommendation HTML into a reusable renderer**

Add this function immediately before `renderQuoteRecommendation()`. It is the current successful RFQ result HTML with a `stale` option and disabled report actions:

```ts
function renderQuoteResult(
  recommendationPanel: HTMLDivElement,
  result: HeatTreatQuoteRecommendation,
  options: { readonly stale: boolean } = { stale: false },
): void {
  const confidenceClass = `confidence-${result.confidence}`;
  const assumptions = result.importedAssumptions.length > 0
    ? result.importedAssumptions
    : ["No imported assumptions for the current quote."];
  const warnings = result.warnings.length > 0
    ? result.warnings
    : ["No active quote warnings for the current input set."];
  const perWeight = quotePerWeightDisplay(result.pricePerKg, unitSystem);
  const customerSummaryLines = displayQuoteCustomerSummaryLines(result, unitSystem);
  const staleAttribute = options.stale ? " disabled aria-disabled=\"true\"" : "";

  recommendationPanel.innerHTML = `
    ${options.stale ? quoteStaleNotice(quoteValidationViewState) : ""}
    <div class="summary-header">
      <div>
        <div class="eyebrow">Heat-Treat RFQ</div>
        <h2>${formatCurrency(result.lotPrice)}</h2>
        <p>${escapeHtml(result.processSummary)}</p>
      </div>
      <div class="summary-side">
        <span class="confidence ${confidenceClass}">${result.confidence}</span>
        <div class="recommendation-actions">
          <button class="icon-button" data-quote-report-action="open" type="button" title="Open printable report"${staleAttribute}>
            <i class="ph ph-file-text"></i>
          </button>
          <button class="icon-button" data-quote-report-action="print" type="button" title="Print report"${staleAttribute}>
            <i class="ph ph-printer"></i>
          </button>
          <button class="icon-button" data-quote-report-action="markdown" type="button" title="Download Markdown report"${staleAttribute}>
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

  if (!options.stale) {
    bindQuoteRecommendationActions(result);
  }
  bindChecklistControls();
}
```

- [ ] **Step 3: Replace `renderQuoteRecommendation()`**

Replace the entire `renderQuoteRecommendation()` function with:

```ts
function renderQuoteRecommendation(): void {
  const recommendationPanel = document.querySelector<HTMLDivElement>("#recommendation");
  if (!recommendationPanel) {
    return;
  }

  try {
    const quoteInput = quoteInputForCurrentState();
    const pricingBasisValidation = quoteValidationStateForPricingBasis(quoteInput);
    if (pricingBasisValidation) {
      quoteValidationViewState = lastValidQuoteRecommendation
        ? { ...pricingBasisValidation, resultStatus: "stale" }
        : pricingBasisValidation;
      if (lastValidQuoteRecommendation) {
        renderQuoteResult(recommendationPanel, lastValidQuoteRecommendation, { stale: true });
      } else {
        renderQuoteCorrectionState(recommendationPanel, quoteValidationViewState);
      }
      refreshQuoteValidationUi();
      refreshQuoteAccordionSummary();
      return;
    }

    const result = recommendHeatTreatQuote(quoteInput);
    setValidationChecklist(
      "heat-treat-rfq",
      reconcileValidationChecklist(validationChecklists["heat-treat-rfq"], result.validationChecks),
    );
    lastValidQuoteRecommendation = result;
    quoteValidationViewState = readyQuoteValidationState();
    renderQuoteResult(recommendationPanel, result);
    refreshQuoteValidationUi();
    refreshQuoteAccordionSummary();
  } catch (error) {
    const validation = quoteValidationStateFromError(error);
    quoteValidationViewState = lastValidQuoteRecommendation
      ? { ...validation, resultStatus: "stale" }
      : validation;
    if (lastValidQuoteRecommendation) {
      renderQuoteResult(recommendationPanel, lastValidQuoteRecommendation, { stale: true });
    } else {
      renderQuoteCorrectionState(recommendationPanel, quoteValidationViewState);
    }
    refreshQuoteValidationUi();
    refreshQuoteAccordionSummary();
  }
}
```

- [ ] **Step 4: Keep `renderIncompleteQuoteState()` unused but remove the old broad message**

Delete the existing `renderIncompleteQuoteState()` function. It is replaced by `renderQuoteCorrectionState()`.

- [ ] **Step 5: Run targeted RFQ workflow tests**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: PASS for all RFQ workflow tests, including the three new validation/recovery tests.

- [ ] **Step 6: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit validation behavior**

Run:

```bash
git add src/ui/main.ts test/ui-rfq-workflow.test.ts
git commit -m "feat: add rfq validation recovery"
```

## Task 4: RFQ Validation Styling and Changelog

**Files:**
- Modify: `src/ui/styles.css`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add inline field and section message CSS**

Add this CSS after `.unit-input span { ... }` and before `.toggle-field`:

```css
.quote-field-message,
.quote-section-message {
  margin: 0;
  color: #b42318;
  font-size: 12px;
  font-weight: 680;
  line-height: 1.35;
}

.quote-field-message[hidden],
.quote-section-message[hidden] {
  display: none;
}

.quote-section-message {
  margin-top: 10px;
  padding: 9px 10px;
  border: 1px solid #f2b8b5;
  border-radius: 7px;
  background: #fee7e4;
}

.field [aria-invalid="true"] {
  border-color: #b42318;
}
```

- [ ] **Step 2: Add stale-result notice CSS**

Add this CSS before `.summary-header`:

```css
.quote-stale-notice {
  display: grid;
  gap: 3px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #d7e0ea;
  border-radius: 8px;
  background: #fff4dc;
  color: #693f00;
  font-size: 13px;
  line-height: 1.4;
}

.quote-stale-notice strong {
  color: #172033;
  font-size: 13px;
  font-weight: 820;
}

.quote-stale-notice em {
  color: #693f00;
  font-style: normal;
}
```

- [ ] **Step 3: Add changelog note**

Add this bullet at the top of the `## Unreleased` section in `CHANGELOG.md`:

```md
- Added RFQ field-level validation messages and stale-result recovery for invalid quote edits.
```

- [ ] **Step 4: Run verification**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 5: Commit styling and changelog**

Run:

```bash
git add src/ui/styles.css CHANGELOG.md
git commit -m "style: polish rfq validation states"
```

## Task 5: Final Verification

**Files:**
- No source edits in this task.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build completes successfully.

- [ ] **Step 3: Check branch diff and cleanliness**

Run:

```bash
git status -sb --ignored
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected:
- Only ignored `.superpowers/`, `dist/`, and `node_modules/` appear outside tracked branch changes.
- Branch includes the spec commit plus RFQ validation/recovery implementation commits.
- `git diff --check` has no output.

- [ ] **Step 4: Prepare PR after user approval**

Use this PR metadata after final review passes and the user approves publishing:

```md
Title: [codex] Add RFQ validation recovery

Summary:
- Add RFQ field-level and section-level validation feedback.
- Preserve the last valid RFQ result as stale when later edits become invalid.
- Disable stale report actions and restore live actions after correction.

Validation:
- npm test
- npm run build
- git diff --check main...HEAD
```
