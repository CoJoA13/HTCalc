# RFQ Preset Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RFQ shop-rate preset browser prompts/confirms with app-native save/update/delete dialogs that preserve current preset behavior and add inline dialog feedback.

**Architecture:** Keep preset storage and quote math unchanged. Add RFQ preset dialog UI-only state and rendering in `src/ui/main.ts`, bind the existing preset Save/Delete buttons to open the dialog, and reuse the current preset save/delete module functions for mutation. Add jsdom workflow coverage for dialog save, update, cancel, delete, Escape, and backdrop behavior, then add restrained CSS and changelog polish.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, existing HTCalc RFQ preset library, existing HTCalc app shell and CSS.

---

## File Structure

- Modify `test/ui-rfq-workflow.test.ts`: replace prompt/confirm-driven preset workflow tests with app-native dialog tests and helper functions.
- Modify `src/ui/main.ts`: add RFQ preset dialog state, markup, rendering, focus handling, save/update/delete confirmation handlers, and keyboard/backdrop close handling.
- Modify `src/ui/styles.css`: add compact RFQ preset dialog overlay, panel, field, message, and destructive action styles.
- Modify `CHANGELOG.md`: add an Unreleased note for app-native RFQ preset dialogs.

## Task 1: Failing RFQ Preset Dialog Workflow Tests

**Files:**
- Modify: `test/ui-rfq-workflow.test.ts`

- [ ] **Step 1: Add app-native preset dialog helper functions**

Add these helpers near the existing RFQ preset helpers, immediately after `function clickRatePresetAction(action: RatePresetAction): void { ... }`:

```ts
type QuotePresetDialogAction = "confirm" | "cancel";

function quotePresetDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>("[data-quote-rate-preset-dialog]");
  expect(dialog).not.toBeNull();
  return dialog!;
}

function quotePresetDialogText(): string {
  return compactText(quotePresetDialog().textContent ?? "");
}

function quotePresetDialogInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("[data-quote-rate-preset-dialog-name]");
  expect(input).not.toBeNull();
  return input!;
}

function quotePresetDialogMessage(): string {
  const message = document.querySelector<HTMLElement>("[data-quote-rate-preset-dialog-message]");
  expect(message).not.toBeNull();
  return message!.hidden ? "" : compactText(message!.textContent ?? "");
}

function quotePresetDialogAction(action: QuotePresetDialogAction): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`[data-quote-rate-preset-dialog-action="${action}"]`);
  expect(button).not.toBeNull();
  return button!;
}

function openSaveRatePresetDialog(): void {
  clickRatePresetAction("save");
  expect(quotePresetDialog().hidden).toBe(false);
  expect(quotePresetDialogText()).toContain("Save Rate Preset");
}

function saveRatePreset(name: string): void {
  openSaveRatePresetDialog();
  const input = quotePresetDialogInput();
  input.value = name;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  quotePresetDialogAction("confirm").click();
}

function openDeleteRatePresetDialog(): void {
  clickRatePresetAction("delete");
  expect(quotePresetDialog().hidden).toBe(false);
  expect(quotePresetDialogText()).toContain("Delete Rate Preset");
}
```

- [ ] **Step 2: Convert existing save-based tests to dialog helper calls**

In `test/ui-rfq-workflow.test.ts`, replace each `window.prompt`-driven save setup with `saveRatePreset(...)` and delete the obsolete prompt expectations.

Use this exact mapping:

```ts
// In "saves, applies, and preserves RFQ shop-rate presets through project files"
const promptSpy = vi.spyOn(window, "prompt");
const confirmSpy = vi.spyOn(window, "confirm");
...
saveRatePreset("Standard RFQ");
expect(promptSpy).not.toHaveBeenCalled();
expect(confirmSpy).not.toHaveBeenCalled();
expect(quotePresetDialog().hidden).toBe(true);
expect(ratePresetSelectText()).toContain("Standard RFQ");
```

```ts
// In "shows custom RFQ rates when current shop rates differ from the selected preset"
saveRatePreset("Dirty RFQ");
```

```ts
// In "refreshes RFQ rate status when selecting a non-matching preset without applying it"
saveRatePreset("Preset A");
setQuoteNumber("shopRates.minimumLotCharge", "800");
saveRatePreset("Preset B");
```

```ts
// In "exports RFQ shop-rate presets as a preset library JSON file"
saveRatePreset("Exported RFQ");
```

```ts
// In "cleans up RFQ preset export downloads when the browser click fails"
saveRatePreset("Blocked Export RFQ");
```

```ts
// In "merges imported RFQ shop-rate presets by name"
saveRatePreset("Merge RFQ");
```

```ts
// In "keeps RFQ presets intact after failed import"
saveRatePreset("Existing RFQ");
```

```ts
// In "updates RFQ review readiness while preserving rate preset workflows"
saveRatePreset("Staged RFQ");
```

Remove all `vi.spyOn(window, "prompt").mockReturnValue(...)` lines that only exist to save a preset.

- [ ] **Step 3: Replace the blank-name test with an inline dialog validation test**

Replace the current test named `"requires a name before saving RFQ shop-rate presets"` with this test:

```ts
  it("validates RFQ preset names inside the save dialog without calling prompt", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    openSaveRatePresetDialog();

    expect(promptSpy).not.toHaveBeenCalled();
    expect(quotePresetDialogInput().value).toBe("");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Save Preset");

    const input = quotePresetDialogInput();
    input.value = "   ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    quotePresetDialogAction("confirm").click();

    expect(quotePresetDialog().hidden).toBe(false);
    expect(quotePresetDialogMessage()).toBe("Preset name is required.");
    expect(quotePresetDialogInput().getAttribute("aria-invalid")).toBe("true");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();

    input.value = "Dialog RFQ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    quotePresetDialogAction("confirm").click();

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Dialog RFQ");
    expect(projectStatusText()).toBe('Saved rate preset "Dialog RFQ".');
  });
```

- [ ] **Step 4: Add duplicate-name update dialog coverage**

Add this test immediately after the blank-name dialog validation test:

```ts
  it("updates existing RFQ presets from the save dialog without creating duplicates", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "300");
    setQuoteNumber("shopRates.furnaceRatePerHour", "90");
    saveRatePreset("Existing RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "725");
    setQuoteNumber("shopRates.furnaceRatePerHour", "155");
    openSaveRatePresetDialog();

    expect(quotePresetDialogInput().value).toBe("Existing RFQ");
    expect(quotePresetDialogText()).toContain("This will update the existing preset.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Update Preset");

    const input = quotePresetDialogInput();
    input.value = " existing rfq ";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(quotePresetDialogText()).toContain("This will update the existing preset.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Update Preset");

    quotePresetDialogAction("confirm").click();

    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0]?.name).toBe("existing rfq");
    expect(stored.presets[0]?.shopRates.minimumLotCharge).toBe(725);
    expect(stored.presets[0]?.shopRates.furnaceRatePerHour).toBe(155);
    expect(ratePresetSelectText()).toContain("existing rfq");
  });
```

- [ ] **Step 5: Replace delete confirmation coverage**

Replace the current test named `"deletes RFQ shop-rate presets without changing current quote rates"` with:

```ts
  it("deletes RFQ shop-rate presets through an app-native confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    saveRatePreset("Delete Me RFQ");
    expect(ratePresetSelectText()).toContain("Delete Me RFQ");

    setQuoteNumber("shopRates.minimumLotCharge", "50");
    setQuoteNumber("shopRates.furnaceRatePerHour", "1");
    openDeleteRatePresetDialog();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(quotePresetDialogText()).toContain('Delete "Delete Me RFQ" from saved RFQ presets.');
    expect(quotePresetDialogText()).toContain("Current quote rates will not change.");
    expect(quotePresetDialogAction("confirm").textContent).toContain("Delete Preset");

    quotePresetDialogAction("confirm").click();

    expect(quotePresetDialog().hidden).toBe(true);
    expect(quoteControl<HTMLInputElement>("shopRates.minimumLotCharge").value).toBe("50");
    expect(quoteControl<HTMLInputElement>("shopRates.furnaceRatePerHour").value).toBe("1");
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(ratePresetSelect().disabled).toBe(true);
    expect(ratePresetActionButton("apply").disabled).toBe(true);
    expect(ratePresetActionButton("delete").disabled).toBe(true);
    expect(JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}").presets).toEqual([]);
  });
```

Add this test immediately after it:

```ts
  it("cancels RFQ preset delete dialog without mutating presets", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    setQuoteNumber("shopRates.minimumLotCharge", "500");
    setQuoteNumber("shopRates.furnaceRatePerHour", "125");
    saveRatePreset("Keep RFQ");

    openDeleteRatePresetDialog();
    quotePresetDialogAction("cancel").click();

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Keep RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
    expect(stored.presets[0]?.name).toBe("Keep RFQ");
  });
```

- [ ] **Step 6: Add Escape and backdrop close coverage**

Add this test after the delete cancel test:

```ts
  it("closes RFQ preset dialogs with Escape and backdrop without mutating presets", async () => {
    await import("../src/ui/main.js");

    clickMode("heat-treat-rfq");
    openSaveRatePresetDialog();
    quotePresetDialogInput().value = "Escape RFQ";
    quotePresetDialogInput().dispatchEvent(new Event("input", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("No saved presets");
    expect(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY)).toBeNull();

    saveRatePreset("Backdrop RFQ");
    openDeleteRatePresetDialog();
    quotePresetDialog().dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(quotePresetDialog().hidden).toBe(true);
    expect(ratePresetSelectText()).toContain("Backdrop RFQ");
    const stored = JSON.parse(window.localStorage.getItem(QUOTE_RATE_PRESETS_STORAGE_KEY) ?? "{}") as QuoteRatePresetLibrary;
    expect(stored.presets).toHaveLength(1);
  });
```

- [ ] **Step 7: Run targeted tests and verify RED**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
```

Expected: FAIL because `[data-quote-rate-preset-dialog]`, `[data-quote-rate-preset-dialog-name]`, `[data-quote-rate-preset-dialog-message]`, and `[data-quote-rate-preset-dialog-action]` do not exist, and Save/Delete still call browser prompt/confirm.

## Task 2: RFQ Preset Dialog Behavior

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `test/ui-rfq-workflow.test.ts` only if a selector typo from Task 1 needs correction without weakening behavior.

- [ ] **Step 1: Add RFQ preset dialog state types**

In `src/ui/main.ts`, add these types after `type QuoteValidationResultStatus = "ready" | "incomplete" | "invalid" | "stale";`:

```ts
type QuoteRatePresetDialogMode = "save" | "delete";

interface QuoteRatePresetDialogState {
  readonly mode: QuoteRatePresetDialogMode;
  readonly presetId: string;
  readonly name: string;
  readonly message: string;
  readonly isError: boolean;
  readonly returnFocus: HTMLElement | null;
}
```

Add this module state after `let lastValidQuoteRecommendation: HeatTreatQuoteRecommendation | null = null;`:

```ts
let quoteRatePresetDialogState: QuoteRatePresetDialogState | null = null;
```

- [ ] **Step 2: Add the persistent dialog shell to the app template**

In the top-level `app.innerHTML` template, add this block after the report backdrop block and before the closing backtick:

```html
  <div class="quote-rate-preset-dialog-backdrop" id="quote-rate-preset-dialog-backdrop" data-quote-rate-preset-dialog hidden>
    <section
      class="quote-rate-preset-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-rate-preset-dialog-title"
      aria-describedby="quote-rate-preset-dialog-description"
    >
      <div id="quote-rate-preset-dialog-content"></div>
    </section>
  </div>
```

- [ ] **Step 3: Bind the persistent dialog once at startup**

After the existing startup calls:

```ts
bindProjectActions();
bindSettings();
bindReportDialog();
```

add:

```ts
bindQuoteRatePresetDialog();
renderQuoteRatePresetDialog();
```

- [ ] **Step 4: Replace Save/Delete button bindings to open the dialog**

In `bindQuoteRatePresetControls()`, replace the Save and Delete event bindings:

```ts
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="save"]')
    ?.addEventListener("click", saveCurrentQuoteRatePreset);
```

with:

```ts
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="save"]')
    ?.addEventListener("click", (event) => {
      openQuoteRatePresetSaveDialog(event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
    });
```

Replace:

```ts
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="delete"]')
    ?.addEventListener("click", deleteSelectedQuoteRatePreset);
```

with:

```ts
  document
    .querySelector<HTMLButtonElement>('[data-quote-rate-preset-action="delete"]')
    ?.addEventListener("click", (event) => {
      openQuoteRatePresetDeleteDialog(event.currentTarget instanceof HTMLElement ? event.currentTarget : null);
    });
```

- [ ] **Step 5: Add dialog open, close, and render helpers**

Add these helpers immediately before `function selectedQuoteRatePreset(): QuoteRatePreset | undefined { ... }`:

```ts
function openQuoteRatePresetSaveDialog(returnFocus: HTMLElement | null): void {
  const preset = selectedQuoteRatePreset();
  quoteRatePresetDialogState = {
    mode: "save",
    presetId: preset?.id ?? "",
    name: preset?.name ?? "",
    message: "",
    isError: false,
    returnFocus,
  };
  renderQuoteRatePresetDialog();
  requestAnimationFrame(() => {
    document.querySelector<HTMLInputElement>("[data-quote-rate-preset-dialog-name]")?.focus();
  });
}

function openQuoteRatePresetDeleteDialog(returnFocus: HTMLElement | null): void {
  const preset = selectedQuoteRatePreset();
  if (!preset) {
    showProjectStatus("Select a rate preset before deleting.", true);
    return;
  }

  quoteRatePresetDialogState = {
    mode: "delete",
    presetId: preset.id,
    name: quoteRatePresetDisplayName(preset),
    message: "",
    isError: false,
    returnFocus,
  };
  renderQuoteRatePresetDialog();
  requestAnimationFrame(() => {
    document.querySelector<HTMLButtonElement>('[data-quote-rate-preset-dialog-action="cancel"]')?.focus();
  });
}

function closeQuoteRatePresetDialog(): void {
  const returnFocus = quoteRatePresetDialogState?.returnFocus ?? null;
  quoteRatePresetDialogState = null;
  renderQuoteRatePresetDialog();
  returnFocus?.focus();
}

function renderQuoteRatePresetDialog(): void {
  const backdrop = document.querySelector<HTMLDivElement>("#quote-rate-preset-dialog-backdrop");
  const content = document.querySelector<HTMLDivElement>("#quote-rate-preset-dialog-content");
  if (!backdrop || !content) {
    return;
  }

  const state = quoteRatePresetDialogState;
  if (!state) {
    backdrop.hidden = true;
    content.innerHTML = "";
    return;
  }

  backdrop.hidden = false;
  content.innerHTML = state.mode === "save"
    ? quoteRatePresetSaveDialogContent(state)
    : quoteRatePresetDeleteDialogContent(state);
  bindQuoteRatePresetDialogContent();
}

function quoteRatePresetSaveDialogContent(state: QuoteRatePresetDialogState): string {
  const existingPreset = quoteRatePresetByName(state.name);
  const isUpdate = Boolean(existingPreset);
  const helperMessage = state.message || (isUpdate ? "This will update the existing preset." : "");
  const helperClass = state.isError ? " is-error" : "";
  const messageHidden = helperMessage ? "" : " hidden";
  const invalid = state.isError ? ` aria-invalid="true"` : "";

  return `
    <div class="quote-rate-preset-dialog-header">
      <div>
        <div class="eyebrow">RFQ Preset</div>
        <h2 id="quote-rate-preset-dialog-title">Save Rate Preset</h2>
      </div>
      <button class="icon-button" type="button" title="Close preset dialog" data-quote-rate-preset-dialog-action="cancel">
        <i class="ph ph-x"></i>
      </button>
    </div>
    <div class="quote-rate-preset-dialog-body" id="quote-rate-preset-dialog-description">
      <p>Save the current shop-rate table as a browser-local RFQ preset.</p>
      <label class="field" for="quote-rate-preset-dialog-name">
        <span class="field-label">Preset Name</span>
        <input
          id="quote-rate-preset-dialog-name"
          data-quote-rate-preset-dialog-name
          type="text"
          value="${escapeAttribute(state.name)}"
          aria-describedby="quote-rate-preset-dialog-message"
          ${invalid}
        />
      </label>
      <p
        id="quote-rate-preset-dialog-message"
        class="quote-rate-preset-dialog-message${helperClass}"
        data-quote-rate-preset-dialog-message
        ${messageHidden}
      >${escapeHtml(helperMessage)}</p>
    </div>
    <div class="quote-rate-preset-dialog-footer">
      <button class="secondary-action" type="button" data-quote-rate-preset-dialog-action="cancel">Cancel</button>
      <button class="primary-action" type="button" data-quote-rate-preset-dialog-action="confirm">
        ${isUpdate ? "Update Preset" : "Save Preset"}
      </button>
    </div>
  `;
}

function quoteRatePresetDeleteDialogContent(state: QuoteRatePresetDialogState): string {
  const message = state.message;
  const messageHidden = message ? "" : " hidden";
  return `
    <div class="quote-rate-preset-dialog-header">
      <div>
        <div class="eyebrow">RFQ Preset</div>
        <h2 id="quote-rate-preset-dialog-title">Delete Rate Preset</h2>
      </div>
      <button class="icon-button" type="button" title="Close preset dialog" data-quote-rate-preset-dialog-action="cancel">
        <i class="ph ph-x"></i>
      </button>
    </div>
    <div class="quote-rate-preset-dialog-body" id="quote-rate-preset-dialog-description">
      <p>Delete "${escapeHtml(state.name)}" from saved RFQ presets. Current quote rates will not change.</p>
      <p
        id="quote-rate-preset-dialog-message"
        class="quote-rate-preset-dialog-message is-error"
        data-quote-rate-preset-dialog-message
        ${messageHidden}
      >${escapeHtml(message)}</p>
    </div>
    <div class="quote-rate-preset-dialog-footer">
      <button class="secondary-action" type="button" data-quote-rate-preset-dialog-action="cancel">Cancel</button>
      <button class="primary-action quote-rate-preset-delete-action" type="button" data-quote-rate-preset-dialog-action="confirm">
        Delete Preset
      </button>
    </div>
  `;
}
```

- [ ] **Step 6: Add dialog event binding helpers**

Add these helpers immediately after `renderQuoteRatePresetDialog()` and content helpers:

```ts
function bindQuoteRatePresetDialog(): void {
  const backdrop = document.querySelector<HTMLDivElement>("#quote-rate-preset-dialog-backdrop");
  backdrop?.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      closeQuoteRatePresetDialog();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quoteRatePresetDialogState) {
      closeQuoteRatePresetDialog();
    }
  });
}

function bindQuoteRatePresetDialogContent(): void {
  document.querySelector<HTMLInputElement>("[data-quote-rate-preset-dialog-name]")?.addEventListener("input", (event) => {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement) || !quoteRatePresetDialogState) {
      return;
    }

    quoteRatePresetDialogState = {
      ...quoteRatePresetDialogState,
      name: input.value,
      message: "",
      isError: false,
    };
    renderQuoteRatePresetDialog();
    requestAnimationFrame(() => {
      const nextInput = document.querySelector<HTMLInputElement>("[data-quote-rate-preset-dialog-name]");
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
      }
    });
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-quote-rate-preset-dialog-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.quoteRatePresetDialogAction;
        if (action === "cancel") {
          closeQuoteRatePresetDialog();
          return;
        }
        if (action === "confirm") {
          confirmQuoteRatePresetDialog();
        }
      });
    });
}

function confirmQuoteRatePresetDialog(): void {
  if (!quoteRatePresetDialogState) {
    return;
  }

  if (quoteRatePresetDialogState.mode === "save") {
    confirmQuoteRatePresetSave();
    return;
  }

  confirmQuoteRatePresetDelete();
}
```

- [ ] **Step 7: Replace prompt/confirm save and delete implementations**

Replace the entire `saveCurrentQuoteRatePreset()` function with:

```ts
function confirmQuoteRatePresetSave(): void {
  if (!quoteRatePresetDialogState) {
    return;
  }

  const name = quoteRatePresetDialogState.name.trim();
  if (!name) {
    quoteRatePresetDialogState = {
      ...quoteRatePresetDialogState,
      message: "Preset name is required.",
      isError: true,
    };
    renderQuoteRatePresetDialog();
    return;
  }

  try {
    const result = saveQuoteRatePreset(quoteRatePresetLibrary, name, heatTreatQuoteState.shopRates);
    if (!persistQuoteRatePresetLibrary(result.library)) {
      const message = "Could not save preset in this browser. Existing presets were unchanged.";
      quoteRatePresetDialogState = {
        ...quoteRatePresetDialogState,
        message,
        isError: true,
      };
      renderQuoteRatePresetDialog();
      showProjectStatus(message, true);
      return;
    }

    quoteRatePresetLibrary = result.library;
    selectedQuoteRatePresetId = result.preset.id;
    quoteRatePresetDialogState = null;
    renderWorkspace();
    renderQuoteRatePresetDialog();
    showProjectStatus(`Saved rate preset "${result.preset.name}".`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save rate preset.";
    quoteRatePresetDialogState = {
      ...quoteRatePresetDialogState,
      message,
      isError: true,
    };
    renderQuoteRatePresetDialog();
    showProjectStatus(message, true);
  }
}
```

Replace the entire `deleteSelectedQuoteRatePreset()` function with:

```ts
function confirmQuoteRatePresetDelete(): void {
  if (!quoteRatePresetDialogState) {
    return;
  }

  const preset = findQuoteRatePreset(quoteRatePresetLibrary, quoteRatePresetDialogState.presetId);
  if (!preset) {
    showProjectStatus("Select a rate preset before deleting.", true);
    closeQuoteRatePresetDialog();
    return;
  }

  const nextLibrary = deleteQuoteRatePreset(quoteRatePresetLibrary, preset.id);
  if (!persistQuoteRatePresetLibrary(nextLibrary)) {
    const message = "Could not delete preset in this browser. Existing presets were unchanged.";
    quoteRatePresetDialogState = {
      ...quoteRatePresetDialogState,
      message,
      isError: true,
    };
    renderQuoteRatePresetDialog();
    showProjectStatus(message, true);
    return;
  }

  quoteRatePresetLibrary = nextLibrary;
  normalizeSelectedQuoteRatePresetId();
  quoteRatePresetDialogState = null;
  renderWorkspace();
  renderQuoteRatePresetDialog();
  showProjectStatus(`Deleted rate preset "${quoteRatePresetDisplayName(preset)}".`);
}
```

- [ ] **Step 8: Add duplicate-name lookup helper**

Add this helper immediately after `quoteRatePresetDisplayName(preset)`:

```ts
function quoteRatePresetByName(name: string): QuoteRatePreset | undefined {
  const normalizedName = normalizeQuoteRatePresetName(name);
  if (!normalizedName) {
    return undefined;
  }

  return quoteRatePresetLibrary.presets.find((preset) => normalizeQuoteRatePresetName(preset.name) === normalizedName);
}

function normalizeQuoteRatePresetName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
```

- [ ] **Step 9: Run targeted tests and typecheck**

Run:

```bash
npm test -- test/ui-rfq-workflow.test.ts
npm run typecheck
```

Expected: both commands pass. If focus-only assertions are unstable in jsdom, keep behavior assertions and remove only direct active-element assertions; do not remove dialog close/open/mutation coverage.

- [ ] **Step 10: Commit dialog behavior**

Run:

```bash
git add src/ui/main.ts test/ui-rfq-workflow.test.ts
git commit -m "feat: add rfq preset dialogs"
```

## Task 3: Dialog Styling and Changelog

**Files:**
- Modify: `src/ui/styles.css`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add RFQ preset dialog styles**

In `src/ui/styles.css`, add this block after `.settings-backdrop[hidden] { ... }` and before `.settings-panel { ... }`:

```css
.quote-rate-preset-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 11;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgb(15 23 42 / 34%);
}

.quote-rate-preset-dialog-backdrop[hidden] {
  display: none;
}

.quote-rate-preset-dialog {
  width: min(460px, 100%);
  border: 1px solid #dbe3ec;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 20px 50px rgb(15 23 42 / 20%);
}

.quote-rate-preset-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  border-bottom: 1px solid #dbe3ec;
}

.quote-rate-preset-dialog-header h2 {
  margin: 4px 0 0;
  color: #172033;
  font-size: 20px;
}

.quote-rate-preset-dialog-body {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
}

.quote-rate-preset-dialog-body p {
  margin: 0;
  color: #526074;
  font-size: 13px;
  line-height: 1.45;
}

.quote-rate-preset-dialog-body input {
  height: 38px;
  border: 1px solid #c9d3df;
  border-radius: 6px;
  padding: 0 10px;
  color: #172033;
}

.quote-rate-preset-dialog-body input:focus {
  border-color: #0f766e;
  outline: 3px solid rgb(15 118 110 / 20%);
  outline-offset: 1px;
}

.quote-rate-preset-dialog-body input[aria-invalid="true"] {
  border-color: #b42318;
}

.quote-rate-preset-dialog-message {
  margin: 0;
  color: #526074;
  font-size: 12px;
  font-weight: 680;
  line-height: 1.35;
}

.quote-rate-preset-dialog-message[hidden] {
  display: none;
}

.quote-rate-preset-dialog-message.is-error {
  color: #b42318;
}

.quote-rate-preset-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid #dbe3ec;
  background: #fbfcfd;
}

.quote-rate-preset-delete-action {
  border-color: #b42318;
  background: #b42318;
  color: #ffffff;
}
```

- [ ] **Step 2: Add mobile footer wrapping**

Inside the existing mobile media query that contains `.quote-rate-presets { grid-template-columns: 1fr; }`, add:

```css
  .quote-rate-preset-dialog-footer {
    flex-direction: column-reverse;
  }

  .quote-rate-preset-dialog-footer .primary-action,
  .quote-rate-preset-dialog-footer .secondary-action {
    width: 100%;
  }
```

- [ ] **Step 3: Add changelog note**

Add this bullet at the top of the `## Unreleased` section in `CHANGELOG.md`:

```md
- Replaced RFQ preset save/delete browser prompts with app-native dialogs.
```

- [ ] **Step 4: Run targeted tests and typecheck**

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
git commit -m "style: polish rfq preset dialogs"
```

## Task 4: Full Verification

**Files:**
- No source edits in this task.

- [ ] **Step 1: Run full test suite**

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

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 4: Check branch cleanliness and diff**

Run:

```bash
git status -sb --ignored
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected:
- Tracked tree is clean.
- Only ignored `.superpowers/`, `dist/`, and `node_modules/` appear.
- Branch diff includes the spec, implementation, CSS/changelog, and tests.
- `git diff --check` has no output.

- [ ] **Step 5: Prepare PR metadata**

Use this PR metadata after final review passes and the user approves publishing:

```md
Title: [codex] Add RFQ preset dialogs

Summary:
- Replace RFQ preset save/delete browser prompts with app-native dialogs.
- Add inline save-name validation, duplicate-name update copy, cancel, Escape, and backdrop close behavior.
- Preserve current preset save/update/delete storage behavior and current quote rates during delete.

Validation:
- npm test
- npm run build
- npm run typecheck
- git diff --check main...HEAD
```
