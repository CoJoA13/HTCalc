# RFQ Workflow Imperial Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real Heat-Treat RFQ UI workflow test and display RFQ per-weight pricing as `$/lb` for imperial users.

**Architecture:** Keep the quote domain model metric-only and add a small UI display helper that converts `pricePerKg` to the active display unit. Use that helper from the RFQ result pane and printable RFQ HTML report. Add one jsdom workflow test that imports the actual UI module and drives real DOM controls.

**Tech Stack:** TypeScript, Vitest, jsdom, Vite, existing HTCalc UI modules.

---

## File Structure

- Create `src/ui/quote-display.ts`
  - Owns RFQ display-only conversion from `pricePerKg` to active unit-system labels and values.
- Create `test/quote-display.test.ts`
  - Pure unit coverage for metric, imperial, and unavailable RFQ per-weight display values.
- Create `test/ui-rfq-workflow.test.ts`
  - jsdom workflow test for RFQ tab switching, ADI import, quote entry, unit switching, project save/load, and printable report output.
- Modify `src/ui/main.ts`
  - Import `quotePerWeightDisplay`.
  - Use it in `renderQuoteRecommendation`.
  - Use it in `quoteReportHtml`.
- Modify `package.json` and `package-lock.json`
  - Add `jsdom` as a dev dependency for the workflow test environment.
- Modify `CHANGELOG.md`
  - Add an Unreleased entry for imperial RFQ per-weight display and RFQ workflow coverage.

---

### Task 1: RFQ Per-Weight Display Helper

**Files:**
- Create: `src/ui/quote-display.ts`
- Create: `test/quote-display.test.ts`

- [ ] **Step 1: Write the failing helper test**

Create `test/quote-display.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { quotePerWeightDisplay } from "../src/ui/quote-display.js";

describe("RFQ quote display helpers", () => {
  it("keeps RFQ per-weight pricing metric in metric mode", () => {
    expect(quotePerWeightDisplay(7.33, "metric")).toEqual({
      label: "Price/kg",
      unit: "kg",
      value: 7.33,
    });
  });

  it("converts RFQ per-weight pricing to pounds in imperial mode", () => {
    const display = quotePerWeightDisplay(10, "imperial");

    expect(display.label).toBe("Price/lb");
    expect(display.unit).toBe("lb");
    expect(display.value).toBeCloseTo(4.5359237);
  });

  it("preserves unavailable RFQ per-weight pricing with the active unit label", () => {
    expect(quotePerWeightDisplay(null, "imperial")).toEqual({
      label: "Price/lb",
      unit: "lb",
      value: null,
    });

    expect(quotePerWeightDisplay(null, "metric")).toEqual({
      label: "Price/kg",
      unit: "kg",
      value: null,
    });
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
npm test -- test/quote-display.test.ts
```

Expected: FAIL because `../src/ui/quote-display.js` does not exist.

- [ ] **Step 3: Add the minimal display helper**

Create `src/ui/quote-display.ts`:

```typescript
import type { UnitSystem } from "./units.js";

const KG_PER_POUND = 0.45359237;

export interface QuotePerWeightDisplay {
  readonly label: "Price/kg" | "Price/lb";
  readonly unit: "kg" | "lb";
  readonly value: number | null;
}

export function quotePerWeightDisplay(
  pricePerKg: number | null,
  unitSystem: UnitSystem,
): QuotePerWeightDisplay {
  if (unitSystem === "imperial") {
    return {
      label: "Price/lb",
      unit: "lb",
      value: pricePerKg === null ? null : pricePerKg * KG_PER_POUND,
    };
  }

  return {
    label: "Price/kg",
    unit: "kg",
    value: pricePerKg,
  };
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
npm test -- test/quote-display.test.ts
```

Expected: PASS for all tests in `test/quote-display.test.ts`.

- [ ] **Step 5: Commit the helper**

Run:

```bash
git add src/ui/quote-display.ts test/quote-display.test.ts
git commit -m "test: add rfq per-weight display helper"
```

---

### Task 2: RFQ jsdom Workflow and UI Wiring

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `test/ui-rfq-workflow.test.ts`
- Modify: `src/ui/main.ts`

- [ ] **Step 1: Add the jsdom test dependency**

Run:

```bash
npm install -D jsdom
```

Expected: `package.json` and `package-lock.json` include `jsdom` under development dependencies.

- [ ] **Step 2: Write the failing jsdom workflow test**

Create `test/ui-rfq-workflow.test.ts`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let savedProjectBlob: Blob | null = null;

describe("Heat-Treat RFQ UI workflow", () => {
  beforeEach(() => {
    vi.resetModules();
    savedProjectBlob = null;
    document.body.innerHTML = `<div id="app"></div>`;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn((blob: Blob) => {
        savedProjectBlob = blob;
        return "blob:htcalc-project";
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "print", {
      configurable: true,
      value: vi.fn(),
    });

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("imports ADI assumptions, switches RFQ units, saves, reloads, and renders the printable report", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    selectQuoteSource("adi");
    setQuoteNumber("lot.quantity", "40");
    setQuoteNumber("lot.totalWeightKg", "220");
    setQuoteNumber("lot.loadCapacityKg", "110");
    setQuoteNumber("lot.laborHoursPerLoad", "0.5");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.setupAdminCharge", "100");
    setQuoteNumber("shopRates.laborRatePerHour", "80");
    setQuoteNumber("shopRates.furnaceRatePerHour", "120");
    setQuoteNumber("shopRates.bathQuenchRatePerHour", "90");
    setQuoteNumber("shopRates.temperFurnaceRatePerHour", "75");
    setQuoteNumber("shopRates.inspectionBaseCharge", "50");
    setQuoteNumber("shopRates.consumablesPerKg", "0.5");
    setQuoteNumber("shopRates.handlingPackagingCharge", "25");

    expect(recommendationText()).toContain("Heat-Treat RFQ");
    expect(recommendationText()).toContain("Imported Assumptions");
    expect(recommendationText()).toContain("Validation Checks");
    expect(document.querySelector('[data-quote-report-action="open"]')).not.toBeNull();
    expect(document.querySelector('[data-quote-report-action="print"]')).not.toBeNull();
    expect(document.querySelector('[data-quote-report-action="markdown"]')).not.toBeNull();

    switchUnits("metric");
    expect(metricStripText()).toContain("Price/kg");
    expect(metricStripText()).toContain("/kg");

    switchUnits("imperial");
    expect(metricStripText()).toContain("Price/lb");
    expect(metricStripText()).toContain("/lb");
    expect(metricStripText()).not.toContain("Price/kg");
    expect(metricStripText()).not.toContain("/kg");

    document.querySelector<HTMLButtonElement>('[data-quote-report-action="open"]')?.click();
    expect(reportText()).toContain("Quote Summary");
    expect(reportText()).toContain("Price/lb");
    expect(reportText()).not.toContain("Price/kg");
    document.querySelector<HTMLButtonElement>("#report-close")?.click();

    document.querySelector<HTMLButtonElement>("#save-project")?.click();
    expect(savedProjectBlob).not.toBeNull();
    const savedProjectJson = await savedProjectBlob!.text();
    expect(JSON.parse(savedProjectJson)).toMatchObject({
      activeModeId: "heat-treat-rfq",
      unitSystem: "imperial",
    });

    await loadProject(savedProjectJson);

    expect(document.querySelector<HTMLButtonElement>('[data-process-mode="heat-treat-rfq"]')?.className).toContain("is-active");
    expect(metricStripText()).toContain("Price/lb");
    expect(metricStripText()).not.toContain("Price/kg");
    expect(document.querySelector('[data-quote-report-action="open"]')).not.toBeNull();
  });
});

function clickMode(modeId: string): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-process-mode="${modeId}"]`);
  expect(button).not.toBeNull();
  button!.click();
}

function selectQuoteSource(sourceMode: string): void {
  const select = quoteControl<HTMLSelectElement>("sourceMode");
  select.value = sourceMode;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function setQuoteNumber(path: string, value: string): void {
  const input = quoteControl<HTMLInputElement>(path);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function switchUnits(unitSystem: "imperial" | "metric"): void {
  document.querySelector<HTMLButtonElement>("#settings-open")?.click();
  const input = document.querySelector<HTMLInputElement>(`input[name="unit-system"][value="${unitSystem}"]`);
  expect(input).not.toBeNull();
  input!.checked = true;
  input!.dispatchEvent(new Event("change", { bubbles: true }));
}

function quoteControl<T extends HTMLInputElement | HTMLSelectElement>(path: string): T {
  const control = document.querySelector<T>(`[data-quote-path="${path}"]`);
  expect(control).not.toBeNull();
  return control!;
}

function recommendationText(): string {
  return compactText(document.querySelector("#recommendation")?.textContent ?? "");
}

function metricStripText(): string {
  return compactText(document.querySelector(".metric-strip")?.textContent ?? "");
}

function reportText(): string {
  return compactText(document.querySelector("#report-document")?.textContent ?? "");
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function loadProject(projectJson: string): Promise<void> {
  const fileInput = document.querySelector<HTMLInputElement>("#project-file-input");
  expect(fileInput).not.toBeNull();
  const file = new File([projectJson], "rfq.htcalc.json", { type: "application/json" });
  Object.defineProperty(fileInput!, "files", {
    configurable: true,
    value: [file],
  });
  fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}
```

- [ ] **Step 3: Run the workflow test to verify it fails**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: FAIL because the RFQ result pane and printable report still render `Price/kg` in imperial mode.

- [ ] **Step 4: Wire the per-weight helper into `src/ui/main.ts`**

Add this import near the other UI imports in `src/ui/main.ts`:

```typescript
import {
  quotePerWeightDisplay,
} from "./quote-display.js";
```

Inside `renderQuoteRecommendation`, after the `warnings` constant, add:

```typescript
    const perWeight = quotePerWeightDisplay(result.pricePerKg, unitSystem);
```

Replace the RFQ per-weight metric line in the `metric-strip`:

```typescript
        ${metric(
          perWeight.label,
          perWeight.value === null ? "Unavailable" : `${formatCurrency(perWeight.value)}/${perWeight.unit}`,
          "weight basis",
        )}
```

Inside `quoteReportHtml`, after `internalNotes` is defined and before the template return, add:

```typescript
  const perWeight = quotePerWeightDisplay(report.recommendation.pricePerKg, unitSystem);
```

Replace the printable report per-weight row:

```typescript
        <div><dt>${perWeight.label}</dt><dd>${perWeight.value === null ? "Unavailable" : formatCurrency(perWeight.value)}</dd></div>
```

- [ ] **Step 5: Run targeted tests to verify the helper and workflow pass**

Run:

```bash
npm test -- test/quote-display.test.ts test/ui-rfq-workflow.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 6: Commit the UI workflow and display behavior**

Run:

```bash
git add package.json package-lock.json src/ui/main.ts test/ui-rfq-workflow.test.ts
git commit -m "test: cover rfq workflow and imperial pricing"
```

---

### Task 3: Changelog and Full Verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the changelog entry**

In `CHANGELOG.md`, under `## Unreleased`, add this bullet above the existing RFQ bullet:

```markdown
- Added browser-like Heat-Treat RFQ workflow coverage and imperial `$/lb` per-weight quote display.
```

- [ ] **Step 2: Run the full verification set**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected:

- `npm test`: all Vitest files pass.
- `npm run typecheck`: exits 0.
- `npm run build`: exits 0 and emits the UI bundle.

- [ ] **Step 3: Check final git status**

Run:

```bash
git status -sb
```

Expected: only the unrelated `Austempered ductile iron.txt` may appear untracked if the user has not moved it yet. No uncommitted tracked changes should remain after the next commit.

- [ ] **Step 4: Commit the changelog**

Run:

```bash
git add CHANGELOG.md
git commit -m "docs: note rfq workflow polish"
```

- [ ] **Step 5: Final verification after commit**

Run:

```bash
npm test
npm run typecheck
npm run build
git status -sb
```

Expected:

- Tests, typecheck, and build pass.
- Branch remains `codex/rfq-workflow-imperial-pricing`.
- No uncommitted tracked changes remain.

---

## Self-Review Checklist

- The helper has unit coverage for metric, imperial, and unavailable values.
- The jsdom workflow test exercises the actual UI module and real DOM controls.
- The UI result pane and printable report both use the same per-weight helper.
- Markdown RFQ export remains metric-only for this slice, matching the approved design.
- The quote model, project schema, and stored metric values are unchanged.
- The unrelated `Austempered ductile iron.txt` file is not staged or modified.
