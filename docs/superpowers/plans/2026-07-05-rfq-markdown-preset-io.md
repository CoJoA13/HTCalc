# RFQ Markdown Units and Preset Import Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish RFQ Markdown total-weight units, add browser-local RFQ rate preset import/export, and improve preset action status feedback.

**Architecture:** Keep quote math and project files metric-only. Add display-only weight conversion beside the existing RFQ per-weight display helper, extend the pure preset storage module with JSON serialization and merge-on-import helpers, then wire Import and Export into the existing RFQ preset control row in `src/ui/main.ts`.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, browser `localStorage`, browser `Blob` downloads and file inputs.

---

## File Structure

- Modify `src/ui/quote-display.ts`: add RFQ total-weight display conversion.
- Modify `test/quote-display.test.ts`: unit coverage for total-weight display.
- Modify `src/ui/quote-report.ts`: use total-weight display helper for RFQ Markdown.
- Modify `test/quote-report.test.ts`: Markdown coverage for metric, imperial, and unavailable total weight.
- Modify `src/ui/quote-rate-presets.ts`: add preset JSON serialize/parse, filename, and merge-on-import helpers.
- Modify `test/quote-rate-presets.test.ts`: pure import/export and merge tests.
- Modify `src/ui/main.ts`: add Import/Export controls, hidden file input, improved status messages, and import/export handlers.
- Modify `test/ui-rfq-workflow.test.ts`: jsdom workflow coverage for blank save, export, import, merge overwrite, and invalid import.
- Modify `src/ui/styles.css`: keep preset action row compact with the larger action set if needed.
- Modify `docs/quote-pricing-model.md`: document preset import/export behavior.
- Modify `CHANGELOG.md`: add an Unreleased entry.

## Task 1: RFQ Markdown Total-Weight Units

**Files:**
- Modify: `src/ui/quote-display.ts`
- Modify: `test/quote-display.test.ts`
- Modify: `src/ui/quote-report.ts`
- Modify: `test/quote-report.test.ts`

- [ ] **Step 1: Add failing display-helper tests**

In `test/quote-display.test.ts`, change the import to:

```ts
import {
  quotePerWeightDisplay,
  quoteWeightDisplay,
} from "../src/ui/quote-display.js";
```

Add these tests inside `describe("RFQ quote display helpers", () => { ... })`:

```ts
  it("keeps RFQ total weight metric in metric mode", () => {
    expect(quoteWeightDisplay(200, "metric")).toEqual({
      label: "Total weight",
      unit: "kg",
      value: 200,
    });
  });

  it("converts RFQ total weight to pounds in imperial mode", () => {
    const display = quoteWeightDisplay(200, "imperial");

    expect(display.label).toBe("Total weight");
    expect(display.unit).toBe("lb");
    expect(display.value).toBeCloseTo(440.924524);
  });

  it("preserves unavailable RFQ total weight with the active unit label", () => {
    expect(quoteWeightDisplay(null, "imperial")).toEqual({
      label: "Total weight",
      unit: "lb",
      value: null,
    });

    expect(quoteWeightDisplay(null, "metric")).toEqual({
      label: "Total weight",
      unit: "kg",
      value: null,
    });
  });
```

- [ ] **Step 2: Verify display-helper tests fail**

Run: `npm test -- test/quote-display.test.ts`

Expected output includes:

```text
FAIL  test/quote-display.test.ts
quoteWeightDisplay is not a function
```

- [ ] **Step 3: Implement total-weight display helper**

In `src/ui/quote-display.ts`, add this interface after `QuotePerWeightDisplay`:

```ts
export interface QuoteWeightDisplay {
  readonly label: "Total weight";
  readonly unit: "kg" | "lb";
  readonly value: number | null;
}
```

Add this function after `quotePerWeightDisplay`:

```ts
export function quoteWeightDisplay(
  totalWeightKg: number | null,
  unitSystem: UnitSystem,
): QuoteWeightDisplay {
  if (unitSystem === "imperial") {
    return {
      label: "Total weight",
      unit: "lb",
      value: totalWeightKg === null ? null : totalWeightKg / KG_PER_POUND,
    };
  }

  return {
    label: "Total weight",
    unit: "kg",
    value: totalWeightKg,
  };
}
```

- [ ] **Step 4: Verify display-helper tests pass**

Run: `npm test -- test/quote-display.test.ts`

Expected output includes:

```text
PASS  test/quote-display.test.ts
```

- [ ] **Step 5: Add failing Markdown total-weight tests**

In `test/quote-report.test.ts`, change the display import to:

```ts
import {
  quotePerWeightDisplay,
  quoteWeightDisplay,
} from "../src/ui/quote-display.js";
```

In the existing test named `serializes imperial RFQ per-weight pricing in pounds`, add these assertions after `const perWeight = ...`:

```ts
    const totalWeight = quoteWeightDisplay(recommendation.totalWeightKg, "imperial");

    expect(markdown).toContain(`Total weight: ${formatExpectedNumber(totalWeight.value ?? 0)} lb`);
    expect(markdown).not.toContain("Total weight: 200 kg");
```

In the existing test named `serializes unavailable imperial RFQ per-weight pricing with the active label`, add this assertion after `const markdown = serializeQuoteReportMarkdown(report);`:

```ts
    expect(markdown).toContain("Total weight: Unavailable");
```

- [ ] **Step 6: Verify Markdown test fails for imperial weight**

Run: `npm test -- test/quote-report.test.ts`

Expected output includes:

```text
FAIL  test/quote-report.test.ts
expected markdown to contain "Total weight: 440.925 lb"
```

- [ ] **Step 7: Use total-weight helper in RFQ Markdown serialization**

In `src/ui/quote-report.ts`, change the display import to:

```ts
import {
  quotePerWeightDisplay,
  quoteWeightDisplay,
} from "./quote-display.js";
```

Inside `serializeQuoteReportMarkdown`, add this after the per-weight constants:

```ts
  const totalWeight = quoteWeightDisplay(report.recommendation.totalWeightKg, report.unitSystem);
  const totalWeightValue = totalWeight.value === null
    ? "Unavailable"
    : `${formatNumber(totalWeight.value)} ${totalWeight.unit}`;
```

Replace the current total-weight Markdown line:

```ts
    `Total weight: ${report.recommendation.totalWeightKg === null ? "Unavailable" : `${formatNumber(report.recommendation.totalWeightKg)} kg`}`,
```

with:

```ts
    `Total weight: ${totalWeightValue}`,
```

- [ ] **Step 8: Verify report tests pass**

Run: `npm test -- test/quote-display.test.ts test/quote-report.test.ts`

Expected output includes:

```text
PASS  test/quote-display.test.ts
PASS  test/quote-report.test.ts
```

- [ ] **Step 9: Commit Markdown unit polish**

Run:

```bash
git add src/ui/quote-display.ts test/quote-display.test.ts src/ui/quote-report.ts test/quote-report.test.ts
git commit -m "fix: show rfq markdown weight in active units"
```

Expected output includes:

```text
[codex/rfq-preset-io-markdown-polish
```

## Task 2: Preset Import Export Pure Helpers

**Files:**
- Modify: `src/ui/quote-rate-presets.ts`
- Modify: `test/quote-rate-presets.test.ts`

- [ ] **Step 1: Add failing pure import/export tests**

In `test/quote-rate-presets.test.ts`, extend the import list from `../src/ui/quote-rate-presets.js` to include:

```ts
  mergeQuoteRatePresetLibraries,
  parseQuoteRatePresetLibraryJson,
  quoteRatePresetExportFilename,
  serializeQuoteRatePresetLibrary,
```

Add these tests before the existing invalid shop-rate test:

```ts
  it("serializes and parses preset library JSON", () => {
    const library: QuoteRatePresetLibrary = {
      version: 1,
      presets: [makePreset("preset-1", "Standard RFQ")],
    };

    const serialized = serializeQuoteRatePresetLibrary(library);

    expect(serialized.endsWith("\n")).toBe(true);
    expect(parseQuoteRatePresetLibraryJson(serialized)).toEqual(library);
  });

  it("rejects malformed preset import JSON and invalid library shapes", () => {
    expect(() => parseQuoteRatePresetLibraryJson("{")).toThrow();
    expect(() => parseQuoteRatePresetLibraryJson(JSON.stringify({ version: 2, presets: [] }))).toThrow(
      "Invalid rate preset library.",
    );
  });

  it("builds rate preset export filenames from the export date", () => {
    expect(quoteRatePresetExportFilename(new Date("2026-07-05T12:00:00.000Z"))).toBe(
      "htcalc-rfq-rate-presets-2026-07-05.json",
    );
  });

  it("merges imported presets by case-insensitive name and reports counts", () => {
    const localPreset = makePreset("local-1", "Standard RFQ");
    const importedPreset: QuoteRatePreset = {
      ...makePreset("imported-1", " standard rfq "),
      shopRates: { ...sampleRates, furnaceRatePerHour: 150 },
      updatedAt: "2026-07-05T13:00:00.000Z",
    };

    const result = mergeQuoteRatePresetLibraries(
      { version: 1, presets: [localPreset] },
      { version: 1, presets: [importedPreset] },
    );

    expect(result.addedCount).toBe(0);
    expect(result.updatedCount).toBe(1);
    expect(result.selectedPresetId).toBe("local-1");
    expect(result.library.presets).toEqual([
      {
        ...importedPreset,
        id: "local-1",
        createdAt: localPreset.createdAt,
      },
    ]);
  });

  it("adds imported presets and avoids id collisions", () => {
    const localPreset = makePreset("preset-1", "Local RFQ");
    const importedPreset = makePreset("preset-1", "Imported RFQ");

    const result = mergeQuoteRatePresetLibraries(
      { version: 1, presets: [localPreset] },
      { version: 1, presets: [importedPreset] },
      { idFactory: () => "imported-2" },
    );

    expect(result.addedCount).toBe(1);
    expect(result.updatedCount).toBe(0);
    expect(result.selectedPresetId).toBe("imported-2");
    expect(result.library.presets.map((preset) => preset.id).sort()).toEqual(["imported-2", "preset-1"]);
    expect(findQuoteRatePreset(result.library, "imported-2")).toMatchObject({
      name: "Imported RFQ",
      shopRates: sampleRates,
    });
  });
```

- [ ] **Step 2: Verify pure helper tests fail**

Run: `npm test -- test/quote-rate-presets.test.ts`

Expected output includes:

```text
FAIL  test/quote-rate-presets.test.ts
mergeQuoteRatePresetLibraries is not a function
```

- [ ] **Step 3: Implement preset JSON and merge helpers**

In `src/ui/quote-rate-presets.ts`, add these interfaces after `SaveQuoteRatePresetResult`:

```ts
export interface MergeQuoteRatePresetLibrariesOptions {
  readonly idFactory?: () => string;
}

export interface MergeQuoteRatePresetLibrariesResult {
  readonly library: QuoteRatePresetLibrary;
  readonly selectedPresetId: string;
  readonly addedCount: number;
  readonly updatedCount: number;
}
```

Add these exported functions after `persistQuoteRatePresetLibrary`:

```ts
export function serializeQuoteRatePresetLibrary(library: QuoteRatePresetLibrary): string {
  return `${JSON.stringify(parseQuoteRatePresetLibrary(library), null, 2)}\n`;
}

export function parseQuoteRatePresetLibraryJson(json: string): QuoteRatePresetLibrary {
  return parseQuoteRatePresetLibrary(JSON.parse(json));
}

export function quoteRatePresetExportFilename(exportedAt = new Date()): string {
  return `htcalc-rfq-rate-presets-${exportedAt.toISOString().slice(0, 10)}.json`;
}

export function mergeQuoteRatePresetLibraries(
  localLibrary: QuoteRatePresetLibrary,
  importedLibrary: QuoteRatePresetLibrary,
  options: MergeQuoteRatePresetLibrariesOptions = {},
): MergeQuoteRatePresetLibrariesResult {
  const local = parseQuoteRatePresetLibrary(localLibrary);
  const imported = parseQuoteRatePresetLibrary(importedLibrary);
  const presets = [...local.presets];
  const usedIds = new Set(presets.map((preset) => preset.id));
  const touchedPresetIds: string[] = [];
  let addedCount = 0;
  let updatedCount = 0;

  for (const importedPreset of imported.presets) {
    const existingIndex = presets.findIndex(
      (preset) => normalizePresetName(preset.name) === normalizePresetName(importedPreset.name),
    );

    if (existingIndex >= 0) {
      const existingPreset = presets[existingIndex];
      const preset: QuoteRatePreset = {
        ...importedPreset,
        id: existingPreset.id,
        createdAt: existingPreset.createdAt,
        shopRates: cloneValidShopRates(importedPreset.shopRates),
      };
      presets[existingIndex] = preset;
      touchedPresetIds.push(preset.id);
      updatedCount += 1;
      continue;
    }

    const preset: QuoteRatePreset = {
      ...importedPreset,
      id: uniquePresetId(importedPreset.id, usedIds, options.idFactory),
      shopRates: cloneValidShopRates(importedPreset.shopRates),
    };
    presets.push(preset);
    touchedPresetIds.push(preset.id);
    addedCount += 1;
  }

  return {
    library: {
      version: 1,
      presets: sortedPresets(presets),
    },
    selectedPresetId: touchedPresetIds[0] ?? "",
    addedCount,
    updatedCount,
  };
}
```

Add this helper near `createPresetId`:

```ts
function uniquePresetId(
  preferredId: string,
  usedIds: Set<string>,
  idFactory: (() => string) | undefined,
): string {
  let id = preferredId;
  while (usedIds.has(id)) {
    id = idFactory?.() ?? createPresetId();
  }
  usedIds.add(id);
  return id;
}
```

- [ ] **Step 4: Verify pure helper tests pass**

Run: `npm test -- test/quote-rate-presets.test.ts`

Expected output includes:

```text
PASS  test/quote-rate-presets.test.ts
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected output includes no TypeScript errors and exits with status 0.

- [ ] **Step 6: Commit pure preset import/export helpers**

Run:

```bash
git add src/ui/quote-rate-presets.ts test/quote-rate-presets.test.ts
git commit -m "feat: add rfq preset import export helpers"
```

Expected output includes:

```text
[codex/rfq-preset-io-markdown-polish
```

## Task 3: RFQ Preset Import Export UI and UX Polish

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add failing jsdom workflow coverage**

In `test/ui-rfq-workflow.test.ts`, change the preset import to:

```ts
import {
  QUOTE_RATE_PRESETS_STORAGE_KEY,
  type QuoteRatePresetLibrary,
} from "../src/ui/quote-rate-presets.js";
```

Change `clickRatePresetAction` and `ratePresetActionButton` action unions to:

```ts
type RatePresetAction = "apply" | "save" | "import" | "export" | "delete";

function clickRatePresetAction(action: RatePresetAction): void {
  ratePresetActionButton(action).click();
}

function ratePresetActionButton(action: RatePresetAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-rate-preset-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}
```

Add these helpers below `ratePresetSelect`:

```ts
function projectStatusText(): string {
  return compactText(document.querySelector("#project-status")?.textContent ?? "");
}

async function importRatePresetFile(contents: string, filename = "presets.json"): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("#quote-rate-preset-import-input");
  expect(input).not.toBeNull();
  const file = new File([contents], filename, { type: "application/json" });
  Object.defineProperty(input!, "files", {
    configurable: true,
    value: [file],
  });
  input!.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function presetLibraryJson(name: string, overrides: Partial<QuoteRatePresetLibrary["presets"][number]["shopRates"]> = {}): string {
  return JSON.stringify({
    version: 1,
    presets: [
      {
        id: `imported-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        name,
        shopRates: {
          minimumLotCharge: 700,
          setupAdminCharge: 110,
          laborRatePerHour: 95,
          furnaceRatePerHour: 150,
          bathQuenchRatePerHour: 105,
          temperFurnaceRatePerHour: 85,
          inspectionBaseCharge: 65,
          consumablesPerKg: 0.65,
          handlingPackagingCharge: 35,
          overheadPercent: 19,
          targetMarginPercent: 24,
          ...overrides,
        },
        createdAt: "2026-07-05T14:00:00.000Z",
        updatedAt: "2026-07-05T14:00:00.000Z",
      },
    ],
  });
}
```

Add these tests inside `describe("Heat-Treat RFQ UI workflow", () => { ... })`:

```ts
  it("requires a name before saving RFQ shop-rate presets", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("   ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    clickRatePresetAction("save");

    expect(projectStatusText()).toBe("Preset name is required. No rates were saved.");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();
  });

  it("exports RFQ shop-rate presets as a preset library JSON file", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Exported RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    clickRatePresetAction("save");
    clickRatePresetAction("export");

    expect(clickedDownloadNames.at(-1)).toMatch(/^htcalc-rfq-rate-presets-\d{4}-\d{2}-\d{2}\.json$/);
    const exported = JSON.parse(await latestCreatedBlob().text()) as QuoteRatePresetLibrary;
    expect(exported).toMatchObject({
      version: 1,
      presets: [
        {
          name: "Exported RFQ",
          shopRates: {
            minimumLotCharge: 500,
            furnaceRatePerHour: 125,
          },
        },
      ],
    });
  });

  it("imports RFQ shop-rate presets into an empty local library", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    await importRatePresetFile(presetLibraryJson("Imported RFQ"));

    expect(ratePresetSelectText()).toContain("Imported RFQ");
    expect(projectStatusText()).toBe("Imported rate presets: 1 added, 0 updated.");
    expect(ratePresetActionButton("apply").disabled).toBe(false);
    expect(ratePresetActionButton("export").disabled).toBe(false);
  });

  it("merges imported RFQ shop-rate presets by name", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Merge RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "300");
    setQuoteNumber("shopRates.furnaceRatePerHour", "90");
    clickRatePresetAction("save");

    await importRatePresetFile(presetLibraryJson(" merge rfq ", {
      minimumLotCharge: 850,
      furnaceRatePerHour: 175,
    }));
    expect(projectStatusText()).toBe("Imported rate presets: 0 added, 1 updated.");
    clickRatePresetAction("apply");

    expect(projectStatusText()).toBe("Applied rate preset \"merge rfq\".");
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("850");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("175");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
  });

  it("rejects invalid RFQ preset import files without changing existing presets", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("Existing RFQ");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    clickRatePresetAction("save");
    await importRatePresetFile("{");

    expect(projectStatusText()).toBe("Could not import presets. Choose a valid HTCalc RFQ preset file.");
    expect(ratePresetSelectText()).toContain("Existing RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets.map((preset) => preset.name)).toEqual(["Existing RFQ"]);
  });
```

- [ ] **Step 2: Verify jsdom workflow tests fail**

Run: `npm test -- test/ui-rfq-workflow.test.ts`

Expected output includes a failure because `[data-quote-rate-preset-action="import"]` and `[data-quote-rate-preset-action="export"]` are not rendered.

- [ ] **Step 3: Import preset import/export helpers in UI**

In `src/ui/main.ts`, extend the import from `./quote-rate-presets.js` to include:

```ts
  mergeQuoteRatePresetLibraries,
  parseQuoteRatePresetLibraryJson,
  quoteRatePresetExportFilename,
  serializeQuoteRatePresetLibrary,
```

- [ ] **Step 4: Render Import and Export controls**

In `quoteRatePresetControls()`, replace the action buttons block with:

```ts
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
```

- [ ] **Step 5: Bind Import and Export actions**

In `bindQuoteRatePresetControls()`, add:

```ts
  const importInput = document.querySelector<HTMLInputElement>("#quote-rate-preset-import-input");
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="import"]')
    ?.addEventListener("click", () => {
      importInput?.click();
    });
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="export"]')
    ?.addEventListener("click", exportQuoteRatePresets);
  importInput?.addEventListener("change", () => {
    void importQuoteRatePresets(importInput);
  });
```

Add these functions near the existing preset action functions:

```ts
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
    link.href = url;
    link.download = quoteRatePresetExportFilename();
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
```

- [ ] **Step 6: Polish save and delete failure statuses**

In `saveCurrentQuoteRatePreset()`, replace:

```ts
    showProjectStatus("Rate preset name was blank; no rates saved.", true);
```

with:

```ts
    showProjectStatus("Preset name is required. No rates were saved.", true);
```

Replace:

```ts
      showProjectStatus("Rate preset could not be saved in this browser.", true);
```

with:

```ts
      showProjectStatus("Could not save preset in this browser. Existing presets were unchanged.", true);
```

In `deleteSelectedQuoteRatePreset()`, replace:

```ts
    showProjectStatus("Rate preset could not be deleted in this browser.", true);
```

with:

```ts
    showProjectStatus("Could not delete preset in this browser. Existing presets were unchanged.", true);
```

- [ ] **Step 7: Keep the expanded action row compact**

In `src/ui/styles.css`, update `.quote-rate-presets` to:

```css
.quote-rate-presets {
  display: grid;
  grid-template-columns: minmax(220px, 320px) minmax(0, 1fr);
  align-items: end;
  gap: 10px;
  margin-bottom: 12px;
}
```

Update `.quote-rate-preset-actions .secondary-action` to:

```css
.quote-rate-preset-actions .secondary-action {
  height: 38px;
  padding: 0 11px;
  white-space: nowrap;
}
```

- [ ] **Step 8: Verify UI workflow tests pass**

Run: `npm test -- test/ui-rfq-workflow.test.ts`

Expected output includes:

```text
PASS  test/ui-rfq-workflow.test.ts
```

- [ ] **Step 9: Run focused related tests and typecheck**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts test/quote-rate-presets.test.ts
npm run typecheck
```

Expected output includes both test files passing and no TypeScript errors.

- [ ] **Step 10: Commit RFQ preset import/export UI**

Run:

```bash
git add src/ui/main.ts src/ui/styles.css test/ui-rfq-workflow.test.ts
git commit -m "feat: add rfq preset import export controls"
```

Expected output includes:

```text
[codex/rfq-preset-io-markdown-polish
```

## Task 4: Documentation, Changelog, and Full Verification

**Files:**
- Modify: `docs/quote-pricing-model.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Document preset import/export**

In `docs/quote-pricing-model.md`, replace the existing `## Shop Rate Presets` section with:

```md
## Shop Rate Presets

The RFQ workspace can save shop-rate presets in the current browser. Presets store only the section `3. Shop Rates` values: lot minimums, setup/admin, labor, furnace, bath/quench, temper, inspection, consumables, handling/packaging, overhead, and margin.

Preset export downloads the browser-local preset library as JSON. Preset import accepts that JSON format and merges it into the current browser library. Imported presets with matching names overwrite local preset rates case-insensitively while preserving the local preset identity; new names are added.

Project files save the applied shop rates through `heatTreatQuote.input.shopRates`. A project opened on another machine restores the rates used for that quote even when that browser has a different preset library.
```

- [ ] **Step 2: Add changelog entry**

In `CHANGELOG.md`, add this bullet under `## Unreleased` above the existing RFQ preset bullet:

```md
- Added RFQ preset import/export, clearer preset action statuses, and unit-system-aware RFQ Markdown total weight.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected output:

```text
Test Files  22 passed
```

`npm run typecheck` and `npm run build` exit with status 0.

- [ ] **Step 4: Commit docs and verification update**

Run:

```bash
git add docs/quote-pricing-model.md CHANGELOG.md
git commit -m "docs: document rfq preset import export"
```

Expected output includes:

```text
[codex/rfq-preset-io-markdown-polish
```

## Spec Coverage Check

- RFQ Markdown total weight uses `QuoteReportViewModel.unitSystem` through Task 1.
- Metric, imperial, and unavailable Markdown weight cases are covered by Task 1 tests.
- Preset export uses the existing versioned preset library format through Task 2 helpers and Task 3 UI.
- Export is disabled with no presets through existing disabled-state logic updated in Task 3.
- Import accepts JSON, validates it in the pure module, and merges on import through Task 2.
- Matching names overwrite case-insensitively while preserving local id and created timestamp through Task 2 tests.
- Imported id collisions are handled through `uniquePresetId` and covered by Task 2 tests.
- Atomic import behavior is achieved by assigning UI state only after parse, merge, and persistence success in Task 3.
- Import status reports added and updated counts through Task 3.
- Blank save, save failure, delete failure, export failure, import parse failure, and import persistence failure messages are represented in Task 3 implementation. Blank save and invalid import have jsdom coverage; storage module tests cover persistence return paths.
- Project schema and quote math are untouched.
- Full verification commands are included in Task 4.
