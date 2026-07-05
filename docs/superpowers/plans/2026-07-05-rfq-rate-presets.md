# RFQ Rate Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add browser-local Heat-Treat RFQ shop-rate presets that users can save, apply, delete, and carry into project files as applied shop-rate values.

**Architecture:** Create a pure `src/ui/quote-rate-presets.ts` storage module that owns localStorage parsing, validation, sorting, saving, and deleting. Wire that module into the RFQ workspace in `src/ui/main.ts` with compact controls in section `3. Shop Rates`; project-file persistence continues through the existing `heatTreatQuote.input.shopRates` path.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, browser `localStorage`, existing HTCalc RFQ/project-state modules.

---

## File Structure

- Create `src/ui/quote-rate-presets.ts`: versioned local preset library, defensive parsing, shop-rate validation, save/delete helpers.
- Create `test/quote-rate-presets.test.ts`: pure tests for empty storage, save, overwrite, delete, malformed storage, and invalid rates.
- Modify `src/ui/main.ts`: render preset controls, bind Apply/Save Current/Delete actions, apply rates into `heatTreatQuoteState.shopRates`.
- Modify `src/ui/styles.css`: compact RFQ preset control row above the existing shop-rate field grid.
- Modify `test/ui-rfq-workflow.test.ts`: jsdom coverage for saving a preset, changing rates, applying it, saving/loading a project, and confirming applied rates persist.
- Modify `docs/quote-pricing-model.md`: explain browser-local rate presets and project-file behavior.
- Modify `CHANGELOG.md`: add an Unreleased entry for RFQ shop-rate presets.

## Task 1: Pure RFQ Rate Preset Storage

**Files:**
- Create: `src/ui/quote-rate-presets.ts`
- Create: `test/quote-rate-presets.test.ts`

- [ ] **Step 1: Write the failing pure tests**

Create `test/quote-rate-presets.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import type { HeatTreatShopRates } from "../src/quote/index.js";
import {
  QUOTE_RATE_PRESETS_STORAGE_KEY,
  deleteQuoteRatePreset,
  loadQuoteRatePresetLibrary,
  saveQuoteRatePreset,
} from "../src/ui/quote-rate-presets.js";

class FakeStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const sampleRates: HeatTreatShopRates = {
  minimumLotCharge: 500,
  setupAdminCharge: 100,
  laborRatePerHour: 80,
  furnaceRatePerHour: 120,
  bathQuenchRatePerHour: 90,
  temperFurnaceRatePerHour: 75,
  inspectionBaseCharge: 50,
  consumablesPerKg: 0.5,
  handlingPackagingCharge: 25,
  overheadPercent: 18,
  targetMarginPercent: 22,
};

describe("quote rate presets", () => {
  it("returns an empty library when storage is empty", () => {
    expect(loadQuoteRatePresetLibrary(new FakeStorage())).toEqual({
      version: 1,
      presets: [],
    });
  });

  it("saves a new preset with generated id and timestamps", () => {
    const result = saveQuoteRatePreset(
      { version: 1, presets: [] },
      " Standard RFQ ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );

    expect(result.preset).toEqual({
      id: "preset-1",
      name: "Standard RFQ",
      shopRates: sampleRates,
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-05T12:00:00.000Z",
    });
    expect(result.library.presets).toEqual([result.preset]);
  });

  it("overwrites an existing preset by case-insensitive trimmed name", () => {
    const first = saveQuoteRatePreset(
      { version: 1, presets: [] },
      "Standard RFQ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );
    const replacementRates = {
      ...sampleRates,
      furnaceRatePerHour: 140,
    };
    const second = saveQuoteRatePreset(
      first.library,
      " standard rfq ",
      replacementRates,
      {
        idFactory: () => "preset-2",
        now: new Date("2026-07-05T12:30:00.000Z"),
      },
    );

    expect(second.library.presets).toHaveLength(1);
    expect(second.preset).toMatchObject({
      id: "preset-1",
      name: "standard rfq",
      createdAt: "2026-07-05T12:00:00.000Z",
      updatedAt: "2026-07-05T12:30:00.000Z",
      shopRates: replacementRates,
    });
  });

  it("deletes a preset without mutating other presets", () => {
    const first = saveQuoteRatePreset(
      { version: 1, presets: [] },
      "Standard RFQ",
      sampleRates,
      {
        idFactory: () => "preset-1",
        now: new Date("2026-07-05T12:00:00.000Z"),
      },
    );
    const second = saveQuoteRatePreset(
      first.library,
      "Premium RFQ",
      { ...sampleRates, minimumLotCharge: 750 },
      {
        idFactory: () => "preset-2",
        now: new Date("2026-07-05T12:05:00.000Z"),
      },
    );

    const library = deleteQuoteRatePreset(second.library, "preset-1");

    expect(library.presets.map((preset) => preset.id)).toEqual(["preset-2"]);
  });

  it("returns an empty library when stored JSON is malformed", () => {
    const storage = new FakeStorage();
    storage.setItem(QUOTE_RATE_PRESETS_STORAGE_KEY, "{");

    expect(loadQuoteRatePresetLibrary(storage)).toEqual({
      version: 1,
      presets: [],
    });
  });

  it("rejects invalid shop-rate values when saving or loading", () => {
    expect(() => {
      saveQuoteRatePreset(
        { version: 1, presets: [] },
        "Invalid RFQ",
        { ...sampleRates, furnaceRatePerHour: -1 },
        {
          idFactory: () => "preset-1",
          now: new Date("2026-07-05T12:00:00.000Z"),
        },
      );
    }).toThrow("Invalid shop rate: furnaceRatePerHour.");

    const storage = new FakeStorage();
    storage.setItem(
      QUOTE_RATE_PRESETS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        presets: [
          {
            id: "preset-1",
            name: "Invalid RFQ",
            shopRates: { ...sampleRates, targetMarginPercent: 100 },
            createdAt: "2026-07-05T12:00:00.000Z",
            updatedAt: "2026-07-05T12:00:00.000Z",
          },
        ],
      }),
    );

    expect(loadQuoteRatePresetLibrary(storage)).toEqual({
      version: 1,
      presets: [],
    });
  });
});
```

- [ ] **Step 2: Run the focused tests to verify the module is missing**

Run: `npm test -- test/quote-rate-presets.test.ts`

Expected output includes:

```text
FAIL  test/quote-rate-presets.test.ts
Cannot find module '../src/ui/quote-rate-presets.js'
```

- [ ] **Step 3: Create the preset storage module**

Create `src/ui/quote-rate-presets.ts` with this content:

```ts
import type { HeatTreatShopRates } from "../quote/index.js";

export const QUOTE_RATE_PRESETS_STORAGE_KEY = "htcalc.quoteRatePresets.v1";

export interface QuoteRatePreset {
  readonly id: string;
  readonly name: string;
  readonly shopRates: HeatTreatShopRates;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface QuoteRatePresetLibrary {
  readonly version: 1;
  readonly presets: readonly QuoteRatePreset[];
}

export interface SaveQuoteRatePresetOptions {
  readonly idFactory?: () => string;
  readonly now?: Date;
}

export interface SaveQuoteRatePresetResult {
  readonly library: QuoteRatePresetLibrary;
  readonly preset: QuoteRatePreset;
}

export type QuoteRatePresetStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function emptyQuoteRatePresetLibrary(): QuoteRatePresetLibrary {
  return {
    version: 1,
    presets: [],
  };
}

export function loadQuoteRatePresetLibrary(
  storage: QuoteRatePresetStorage | null | undefined = safeLocalStorage(),
): QuoteRatePresetLibrary {
  if (!storage) {
    return emptyQuoteRatePresetLibrary();
  }

  try {
    const raw = storage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY);
    if (!raw) {
      return emptyQuoteRatePresetLibrary();
    }

    return parseQuoteRatePresetLibrary(JSON.parse(raw));
  } catch {
    return emptyQuoteRatePresetLibrary();
  }
}

export function persistQuoteRatePresetLibrary(
  library: QuoteRatePresetLibrary,
  storage: QuoteRatePresetStorage | null | undefined = safeLocalStorage(),
): boolean {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(QUOTE_RATE_PRESETS_STORAGE_KEY, JSON.stringify(parseQuoteRatePresetLibrary(library)));
    return true;
  } catch {
    return false;
  }
}

export function saveQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  name: string,
  shopRates: HeatTreatShopRates,
  options: SaveQuoteRatePresetOptions = {},
): SaveQuoteRatePresetResult {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Rate preset name is required.");
  }

  const normalizedName = normalizePresetName(trimmedName);
  const existingPreset = library.presets.find((preset) => normalizePresetName(preset.name) === normalizedName);
  const timestamp = (options.now ?? new Date()).toISOString();
  const preset: QuoteRatePreset = existingPreset
    ? {
        ...existingPreset,
        name: trimmedName,
        shopRates: cloneValidShopRates(shopRates),
        updatedAt: timestamp,
      }
    : {
        id: options.idFactory?.() ?? createPresetId(),
        name: trimmedName,
        shopRates: cloneValidShopRates(shopRates),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
  const presets = existingPreset
    ? library.presets.map((item) => (item.id === existingPreset.id ? preset : item))
    : [...library.presets, preset];
  const nextLibrary: QuoteRatePresetLibrary = {
    version: 1,
    presets: sortedPresets(presets),
  };

  return {
    library: nextLibrary,
    preset,
  };
}

export function deleteQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  id: string,
): QuoteRatePresetLibrary {
  return {
    version: 1,
    presets: library.presets.filter((preset) => preset.id !== id),
  };
}

export function sortedQuoteRatePresets(library: QuoteRatePresetLibrary): readonly QuoteRatePreset[] {
  return sortedPresets(library.presets);
}

export function findQuoteRatePreset(
  library: QuoteRatePresetLibrary,
  id: string,
): QuoteRatePreset | undefined {
  return library.presets.find((preset) => preset.id === id);
}

export function safeLocalStorage(): QuoteRatePresetStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseQuoteRatePresetLibrary(value: unknown): QuoteRatePresetLibrary {
  assertRecord(value);
  if (value.version !== 1 || !Array.isArray(value.presets)) {
    throw new Error("Invalid rate preset library.");
  }

  return {
    version: 1,
    presets: sortedPresets(value.presets.map(parseQuoteRatePreset)),
  };
}

function parseQuoteRatePreset(value: unknown): QuoteRatePreset {
  assertRecord(value);
  const id = requiredString(value.id, "id");
  const name = requiredString(value.name, "name").trim();
  if (!name) {
    throw new Error("Invalid rate preset name.");
  }

  const createdAt = requiredIsoTimestamp(value.createdAt, "createdAt");
  const updatedAt = requiredIsoTimestamp(value.updatedAt, "updatedAt");

  return {
    id,
    name,
    shopRates: cloneValidShopRates(value.shopRates),
    createdAt,
    updatedAt,
  };
}

function cloneValidShopRates(value: unknown): HeatTreatShopRates {
  assertRecord(value);
  const targetMarginPercent = finiteNonNegativeRate(value.targetMarginPercent, "targetMarginPercent");
  if (targetMarginPercent >= 100) {
    throw new Error("Invalid shop rate: targetMarginPercent.");
  }

  return {
    minimumLotCharge: finiteNonNegativeRate(value.minimumLotCharge, "minimumLotCharge"),
    setupAdminCharge: finiteNonNegativeRate(value.setupAdminCharge, "setupAdminCharge"),
    laborRatePerHour: finiteNonNegativeRate(value.laborRatePerHour, "laborRatePerHour"),
    furnaceRatePerHour: finiteNonNegativeRate(value.furnaceRatePerHour, "furnaceRatePerHour"),
    bathQuenchRatePerHour: finiteNonNegativeRate(value.bathQuenchRatePerHour, "bathQuenchRatePerHour"),
    temperFurnaceRatePerHour: finiteNonNegativeRate(
      value.temperFurnaceRatePerHour,
      "temperFurnaceRatePerHour",
    ),
    inspectionBaseCharge: finiteNonNegativeRate(value.inspectionBaseCharge, "inspectionBaseCharge"),
    consumablesPerKg: finiteNonNegativeRate(value.consumablesPerKg, "consumablesPerKg"),
    handlingPackagingCharge: finiteNonNegativeRate(value.handlingPackagingCharge, "handlingPackagingCharge"),
    overheadPercent: finiteNonNegativeRate(value.overheadPercent, "overheadPercent"),
    targetMarginPercent,
  };
}

function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected rate preset object.");
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid rate preset field: ${field}.`);
  }

  return value;
}

function requiredIsoTimestamp(value: unknown, field: string): string {
  const timestamp = requiredString(value, field);
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`Invalid rate preset field: ${field}.`);
  }

  return timestamp;
}

function finiteNonNegativeRate(value: unknown, field: keyof HeatTreatShopRates): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid shop rate: ${field}.`);
  }

  return value;
}

function sortedPresets(presets: readonly QuoteRatePreset[]): readonly QuoteRatePreset[] {
  return [...presets].sort((left, right) => left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
  }));
}

function normalizePresetName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

function createPresetId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `rate-${cryptoApi.randomUUID()}`;
  }

  return `rate-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

- [ ] **Step 4: Run focused storage tests**

Run: `npm test -- test/quote-rate-presets.test.ts`

Expected output includes:

```text
PASS  test/quote-rate-presets.test.ts
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected output includes no TypeScript errors and exits with status 0.

- [ ] **Step 6: Commit storage module**

Run:

```bash
git add src/ui/quote-rate-presets.ts test/quote-rate-presets.test.ts
git commit -m "feat: add rfq rate preset storage"
```

Expected output includes:

```text
[codex/rfq-rate-presets
```

## Task 2: RFQ Preset Controls and Workflow Coverage

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add failing jsdom workflow coverage**

In `test/ui-rfq-workflow.test.ts`, update `beforeEach` and `afterEach` to clear browser storage:

```ts
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    savedProjectBlob = null;
```

```ts
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
```

Add this test inside `describe("Heat-Treat RFQ UI workflow", () => { ... })` after the existing test:

```ts
  it("saves, applies, and preserves RFQ shop-rate presets through project files", async () => {
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("Standard RFQ");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("lot.quantity", "25");
    setQuoteNumber("lot.totalWeightKg", "100");
    setQuoteNumber("lot.loadCapacityKg", "100");
    setQuoteNumber("lot.laborHoursPerLoad", "1");
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

    clickRatePresetAction("save");

    expect(promptSpy).toHaveBeenCalledOnce();
    expect(ratePresetSelectText()).toContain("Standard RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "50");
    setQuoteNumber("shopRates.furnaceRatePerHour", "1");
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("50");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("1");

    clickRatePresetAction("apply");

    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("500");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(recommendationText()).toContain("Heat-Treat RFQ");

    document.querySelector<HTMLButtonElement>("#save-project")?.click();
    expect(savedProjectBlob).not.toBeNull();
    const savedProjectJson = await savedProjectBlob!.text();
    expect(JSON.parse(savedProjectJson).heatTreatQuote.input.shopRates).toMatchObject({
      minimumLotCharge: 500,
      furnaceRatePerHour: 125,
      targetMarginPercent: 22,
    });

    setQuoteNumber("shopRates.furnaceRatePerHour", "3");
    await loadProject(savedProjectJson);

    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("125");
    expect(recommendationText()).toContain("Heat-Treat RFQ");
  });
```

Add these helpers below `setQuoteNumber`:

```ts
function clickRatePresetAction(action: "apply" | "save" | "delete"): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-rate-preset-action="${action}"]`);
  expect(button).not.toBeNull();
  button!.click();
}

function ratePresetSelectText(): string {
  const select = document.querySelector<HTMLSelectElement>("#quote-rate-preset-select");
  expect(select).not.toBeNull();
  return compactText(select!.textContent ?? "");
}
```

- [ ] **Step 2: Run the focused workflow test to verify controls are missing**

Run: `npm test -- test/ui-rfq-workflow.test.ts`

Expected output includes a failure from `clickRatePresetAction("save")` because `[data-quote-rate-preset-action="save"]` is not rendered.

- [ ] **Step 3: Import preset helpers and add local UI state**

In `src/ui/main.ts`, extend the quote type import with `HeatTreatShopRates`:

```ts
  type HeatTreatQuoteInput,
  type HeatTreatQuoteRecommendation,
  type HeatTreatQuoteSourceMode,
  type HeatTreatShopRates,
  type ImportedProcessAssumptions,
} from "../quote/index.js";
```

Add this import after `quote-display.js`:

```ts
import {
  deleteQuoteRatePreset,
  findQuoteRatePreset,
  loadQuoteRatePresetLibrary,
  persistQuoteRatePresetLibrary,
  saveQuoteRatePreset,
  sortedQuoteRatePresets,
  type QuoteRatePreset,
  type QuoteRatePresetLibrary,
} from "./quote-rate-presets.js";
```

Add preset state immediately after `heatTreatQuoteState`:

```ts
let quoteRatePresetLibrary: QuoteRatePresetLibrary = loadQuoteRatePresetLibrary();
let selectedQuoteRatePresetId = "";
```

- [ ] **Step 4: Render the preset control row above the shop-rate fields**

In `quoteWorkspace()`, replace the section `3. Shop Rates` block with this block:

```ts
      <div class="section-block">
        <div class="section-heading"><i class="ph ph-currency-dollar"></i><span>3. Shop Rates</span></div>
        ${quoteRatePresetControls()}
        <div class="field-grid equipment-grid">
          ${quoteNumberField("shopRates.minimumLotCharge", "Minimum Lot", input.shopRates.minimumLotCharge, "1", "$")}
          ${quoteNumberField("shopRates.setupAdminCharge", "Setup/Admin", input.shopRates.setupAdminCharge, "1", "$")}
          ${quoteNumberField("shopRates.laborRatePerHour", "Labor Rate", input.shopRates.laborRatePerHour, "1", "$/h")}
          ${quoteNumberField("shopRates.furnaceRatePerHour", "Furnace Rate", input.shopRates.furnaceRatePerHour, "1", "$/h")}
          ${quoteNumberField("shopRates.bathQuenchRatePerHour", "Bath/Quench Rate", input.shopRates.bathQuenchRatePerHour, "1", "$/h")}
          ${quoteNumberField("shopRates.temperFurnaceRatePerHour", "Temper Rate", input.shopRates.temperFurnaceRatePerHour, "1", "$/h")}
          ${quoteNumberField("shopRates.inspectionBaseCharge", "Inspection", input.shopRates.inspectionBaseCharge, "1", "$")}
          ${quoteNumberField("shopRates.consumablesPerKg", "Consumables", input.shopRates.consumablesPerKg, "0.01", "$/kg")}
          ${quoteNumberField("shopRates.handlingPackagingCharge", "Handling/Pkg", input.shopRates.handlingPackagingCharge, "1", "$")}
          ${quoteNumberField("shopRates.overheadPercent", "Overhead", input.shopRates.overheadPercent, "0.1", "%")}
          ${quoteNumberField("shopRates.targetMarginPercent", "Margin", input.shopRates.targetMarginPercent, "0.1", "%")}
        </div>
      </div>
```

Add this helper near `quoteWorkspace()`:

```ts
function quoteRatePresetControls(): string {
  const presets = sortedQuoteRatePresets(quoteRatePresetLibrary);
  const selectedPresetIsValid = presets.some((preset) => preset.id === selectedQuoteRatePresetId);
  selectedQuoteRatePresetId = selectedPresetIsValid
    ? selectedQuoteRatePresetId
    : presets[0]?.id ?? "";
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
        <button class="secondary-action" type="button" data-quote-rate-preset-action="delete"${disabled}>
          <i class="ph ph-trash"></i><span>Delete</span>
        </button>
      </div>
    </div>
  `;
}
```

- [ ] **Step 5: Bind Apply, Save Current, and Delete actions**

In `bindQuoteInputs()`, call the preset binder after the quote-path listeners are attached:

```ts
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
    });
  });

  bindQuoteRatePresetControls();
```

Add these helpers near `bindQuoteInputs()`:

```ts
function bindQuoteRatePresetControls(): void {
  const select = document.querySelector<HTMLSelectElement>("#quote-rate-preset-select");
  select?.addEventListener("change", () => {
    selectedQuoteRatePresetId = select.value;
  });

  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="apply"]')
    ?.addEventListener("click", applySelectedQuoteRatePreset);
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="save"]')
    ?.addEventListener("click", saveCurrentQuoteRatePreset);
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="delete"]')
    ?.addEventListener("click", deleteSelectedQuoteRatePreset);
}

function selectedQuoteRatePreset(): QuoteRatePreset | undefined {
  return findQuoteRatePreset(quoteRatePresetLibrary, selectedQuoteRatePresetId);
}

function applySelectedQuoteRatePreset(): void {
  const preset = selectedQuoteRatePreset();
  if (!preset) {
    showProjectStatus("Select a rate preset before applying.", true);
    return;
  }

  replaceQuoteShopRates(preset.shopRates);
  renderWorkspace();
  showProjectStatus(`Applied rate preset "${preset.name}".`);
}

function saveCurrentQuoteRatePreset(): void {
  const enteredName = window.prompt("Rate preset name", selectedQuoteRatePreset()?.name ?? "");
  if (enteredName === null) {
    return;
  }

  const name = enteredName.trim();
  if (!name) {
    showProjectStatus("Rate preset name was blank; no rates saved.", true);
    return;
  }

  try {
    const result = saveQuoteRatePreset(quoteRatePresetLibrary, name, heatTreatQuoteState.shopRates);
    if (!persistQuoteRatePresetLibrary(result.library)) {
      showProjectStatus("Rate preset could not be saved in this browser.", true);
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

function deleteSelectedQuoteRatePreset(): void {
  const preset = selectedQuoteRatePreset();
  if (!preset) {
    showProjectStatus("Select a rate preset before deleting.", true);
    return;
  }

  if (!window.confirm(`Delete rate preset "${preset.name}"?`)) {
    return;
  }

  const nextLibrary = deleteQuoteRatePreset(quoteRatePresetLibrary, preset.id);
  if (!persistQuoteRatePresetLibrary(nextLibrary)) {
    showProjectStatus("Rate preset could not be deleted in this browser.", true);
    return;
  }

  quoteRatePresetLibrary = nextLibrary;
  selectedQuoteRatePresetId = sortedQuoteRatePresets(nextLibrary)[0]?.id ?? "";
  renderWorkspace();
  showProjectStatus(`Deleted rate preset "${preset.name}".`);
}

function replaceQuoteShopRates(shopRates: HeatTreatShopRates): void {
  heatTreatQuoteState = {
    ...heatTreatQuoteState,
    shopRates: structuredClone(shopRates),
  };
}
```

- [ ] **Step 6: Style the compact preset row**

In `src/ui/styles.css`, add these rules after `.equipment-grid`:

```css
.quote-rate-presets {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto;
  align-items: end;
  gap: 10px;
  margin-bottom: 12px;
}

.quote-rate-preset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quote-rate-preset-actions .secondary-action {
  height: 38px;
  padding: 0 12px;
  white-space: nowrap;
}
```

Inside the existing `@media (max-width: 760px)` block in `src/ui/styles.css`, add this block after the rule that sets `.metric-strip` to `grid-template-columns: 1fr`:

```css
  .quote-rate-presets {
    grid-template-columns: 1fr;
  }

  .quote-rate-preset-actions .secondary-action {
    flex: 1 1 120px;
  }
```

- [ ] **Step 7: Run focused workflow tests**

Run: `npm test -- test/ui-rfq-workflow.test.ts`

Expected output includes:

```text
PASS  test/ui-rfq-workflow.test.ts
```

- [ ] **Step 8: Run focused storage tests again**

Run: `npm test -- test/quote-rate-presets.test.ts`

Expected output includes:

```text
PASS  test/quote-rate-presets.test.ts
```

- [ ] **Step 9: Run typecheck**

Run: `npm run typecheck`

Expected output includes no TypeScript errors and exits with status 0.

- [ ] **Step 10: Commit UI workflow**

Run:

```bash
git add src/ui/main.ts src/ui/styles.css test/ui-rfq-workflow.test.ts
git commit -m "feat: add rfq rate preset controls"
```

Expected output includes:

```text
[codex/rfq-rate-presets
```

## Task 3: Documentation, Changelog, and Full Verification

**Files:**
- Modify: `docs/quote-pricing-model.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Document preset behavior**

In `docs/quote-pricing-model.md`, insert this section after `## Recipe Imports`:

```md
## Shop Rate Presets

The RFQ workspace can save shop-rate presets in the current browser. Presets store only the section `3. Shop Rates` values: lot minimums, setup/admin, labor, furnace, bath/quench, temper, inspection, consumables, handling/packaging, overhead, and margin.

Project files save the applied shop rates through `heatTreatQuote.input.shopRates`. A project opened on another machine restores the rates used for that quote even when that browser has a different preset library.
```

- [ ] **Step 2: Add the changelog entry**

In `CHANGELOG.md`, add this bullet under `## Unreleased` before the existing RFQ workflow coverage entry:

```md
- Added browser-local Heat-Treat RFQ shop-rate presets with project-file preservation of applied rates.
```

- [ ] **Step 3: Run all tests**

Run: `npm test`

Expected output includes:

```text
Test Files
Tests
```

and exits with status 0.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected output includes no TypeScript errors and exits with status 0.

- [ ] **Step 5: Run production build**

Run: `npm run build`

Expected output includes successful `tsc` and `vite build` completion and exits with status 0.

- [ ] **Step 6: Commit docs and verification updates**

Run:

```bash
git add docs/quote-pricing-model.md CHANGELOG.md
git commit -m "docs: document rfq rate presets"
```

Expected output includes:

```text
[codex/rfq-rate-presets
```

## Spec Coverage Check

- Preset scope is limited to `HeatTreatQuoteInput.shopRates` in Task 1 and Task 2.
- Browser-local versioned storage is implemented by `QUOTE_RATE_PRESETS_STORAGE_KEY` and `QuoteRatePresetLibrary.version`.
- Stable id, display name, created timestamp, updated timestamp, and shop rates are represented by `QuoteRatePreset`.
- Malformed storage returns `emptyQuoteRatePresetLibrary()` through `loadQuoteRatePresetLibrary()`.
- Case-insensitive overwrite by trimmed name is covered by the pure test and `normalizePresetName()`.
- Existing project persistence is preserved by leaving `project-state.ts` unchanged and asserting saved `heatTreatQuote.input.shopRates` in the jsdom workflow.
- RFQ section `3. Shop Rates` gets dropdown, Apply, Save Current, and Delete controls.
- Empty library behavior is rendered with `No saved presets` and disabled Apply/Delete actions.
- Sorted names are returned by `sortedQuoteRatePresets()`.
- Apply clones only `shopRates` into `heatTreatQuoteState`.
- Save Current prompts for a name, rejects blank names with status, and persists new or overwritten presets.
- Delete confirms, removes the selected preset, and leaves current quote rates unchanged.
- All user action feedback uses `showProjectStatus`.
- Full verification remains `npm test`, `npm run typecheck`, and `npm run build`.
