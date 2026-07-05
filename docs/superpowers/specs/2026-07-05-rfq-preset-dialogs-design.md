# RFQ App-Native Preset Dialogs Design

## Goal

Replace browser-native `prompt` and `confirm` flows for Heat-Treat RFQ shop-rate preset save and delete actions with app-native dialogs that match the HTCalc workbench UI, preserve current preset behavior, and provide clearer blank-name, duplicate-name, cancel, and delete states.

## Context

RFQ shop-rate presets are already browser-local, importable/exportable, and project-file compatible. The remaining UX issue is that saving still uses `window.prompt` and deleting still uses `window.confirm`. Those browser dialogs break the app's technical workbench feel, are hard to style or validate inline, and do not provide enough context for repeated estimating work.

This task is RFQ-only. It builds on the existing preset library and staged RFQ accordion controls. It does not change preset storage format, preset import/export behavior, project file shape, quote math, or ADI/steel process models.

## Selected Approach

Use one app-native preset dialog with mode-specific content.

The dialog is opened by RFQ preset `Save` and `Delete` actions. A small UI-only state object controls whether the dialog is in save or delete mode, which preset is selected, the editable name value, and any inline validation message. Confirming the dialog calls the existing preset save/delete logic paths; canceling only closes the dialog.

This keeps the implementation small, follows the existing settings/report overlay vocabulary, and avoids adding an inline editor to the already dense Shop Rates accordion.

## Dialog Behavior

### Save Preset

Clicking `Save` opens a dialog titled `Save Rate Preset`.

The dialog includes:
- A compact text field labeled `Preset Name`.
- Supporting copy: `Save the current shop-rate table as a browser-local RFQ preset.`
- A cancel button.
- A primary action button.

The name field defaults to the currently selected preset name when a preset is selected. Otherwise it starts blank.

Blank names are blocked inside the dialog. The dialog remains open, the field is marked invalid, and the inline message reads:

`Preset name is required.`

No rates are saved when the name is blank.

If the entered name matches an existing preset after trimming and case-insensitive comparison, the dialog shows restrained helper copy:

`This will update the existing preset.`

The primary button changes to `Update Preset`. Confirming updates the existing preset using the existing overwrite semantics: preserve id and created timestamp, replace rates, refresh updated timestamp, select the preset, re-render the workspace, and show:

`Saved rate preset "<name>".`

If the entered name is new, the primary button reads `Save Preset`. Confirming creates and selects the preset, re-renders the workspace, and shows the same success status.

If local preset persistence fails, the dialog stays open and shows the existing failure copy inline and through project status:

`Could not save preset in this browser. Existing presets were unchanged.`

### Delete Preset

Clicking `Delete` opens a dialog titled `Delete Rate Preset`.

The dialog body names the selected preset and clarifies that the current quote rates will not change:

`Delete "<name>" from saved RFQ presets. Current quote rates will not change.`

The footer has:
- Cancel button.
- Destructive primary action `Delete Preset`.

Confirming deletes the selected preset from local storage, normalizes the selected preset id, re-renders the workspace, and shows:

`Deleted rate preset "<name>".`

If local preset persistence fails, the dialog stays open and shows the existing failure copy inline and through project status:

`Could not delete preset in this browser. Existing presets were unchanged.`

If no preset is selected when Delete is invoked, no dialog opens and the existing project status message remains:

`Select a rate preset before deleting.`

## Interaction Rules

- `Cancel`, `Escape`, and backdrop click close the dialog without mutating presets.
- Opening the dialog stores the triggering button so focus can return there on close.
- Opening save mode moves focus to the preset name field.
- Opening delete mode moves focus to the cancel button or delete button; either is acceptable if tab order remains logical.
- The dialog uses `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
- The save input uses `aria-invalid="true"` and `aria-describedby` when an inline validation message is visible.
- Confirm buttons are normal buttons, not form submission side effects hidden behind browser dialogs.
- The dialog remains compact and does not introduce decorative motion. If any transition is added, it must be short and respect reduced motion.

## Visual Design

The dialog uses the existing HTCalc overlay language:
- fixed backdrop with slate transparency
- white panel
- steel border rhythm
- compact title/body/footer
- existing `primary-action` and `secondary-action` button vocabulary
- danger copy and/or danger button treatment for delete confirmation

The dialog does not use cards inside cards, decorative gradients, glass effects, or oversized headings. It must feel like a focused workbench control, not a marketing modal.

## State Model

Add UI-only state in `src/ui/main.ts` for RFQ preset dialog rendering.

Recommended shape:

```ts
type QuoteRatePresetDialogMode = "save" | "delete";

interface QuoteRatePresetDialogState {
  readonly mode: QuoteRatePresetDialogMode;
  readonly presetId: string;
  readonly name: string;
  readonly message: string;
  readonly isError: boolean;
  readonly returnFocusSelector: string;
}
```

The exact shape can change during implementation if it follows existing local patterns. The state must not be persisted to project files or local storage.

## Data Flow

Saving continues to use `saveQuoteRatePreset`, `persistQuoteRatePresetLibrary`, `quoteRatePresetLibrary`, and `selectedQuoteRatePresetId`.

Deleting continues to use `deleteQuoteRatePreset`, `persistQuoteRatePresetLibrary`, `normalizeSelectedQuoteRatePresetId`, and existing workspace refresh behavior.

Import/export preset behavior remains unchanged.

Project files continue to preserve applied `heatTreatQuote.input.shopRates`; they do not save the preset dialog state.

## Error Handling

Inline dialog errors handle user-correctable problems:
- blank save name
- local storage save failure
- local storage delete failure

Project status remains the app-wide status channel for success and persistence failures. Dialog inline messages make the failure visible without requiring the user to look away from the action they attempted.

Cancel paths are silent and do not show project status messages.

## Testing

Update RFQ workflow jsdom tests to cover:
- save opens an app-native dialog and does not call `window.prompt`
- blank save name shows inline dialog validation and does not save
- entering a new name saves the preset, closes the dialog, selects the preset, and shows the existing success status
- entering an existing name shows update helper copy and `Update Preset`
- updating an existing preset preserves overwrite behavior and does not create a duplicate
- delete opens an app-native confirmation and does not call `window.confirm`
- canceling delete leaves the preset library unchanged
- confirming delete removes the preset and leaves current quote rate fields unchanged
- `Escape` or backdrop click closes the dialog without mutating presets

Existing preset import/export, project save/load, staged accordion, RFQ validation recovery, and quote report tests must continue to pass.

## Non-Goals

- No changes to preset storage schema.
- No server-side or account-based preset storage.
- No native dialogs for project load/save, report export, or preset import/export in this task.
- No new preset fields beyond `shopRates`.
- No quote math changes.
- No app-wide modal framework unless a tiny local helper is clearly cheaper than duplicated RFQ-specific code.
- No confidence explainer work.
- No mobile result-access affordance work.
- No palette-token cleanup.

## Follow-Up Order

After this task, continue with:
1. Confidence explainer.
2. Mobile result-access affordance.
3. Palette-token cleanup.
