# RFQ Shop-Rate Presets Design

## Purpose

Add reusable Heat-Treat RFQ shop-rate presets so users do not need to re-enter the same rate table for every quote. Presets are a convenience layer for the RFQ UI. They do not change the quote pricing model, quote validation rules, or project file schema.

## Scope

Presets include only `HeatTreatQuoteInput.shopRates`:

- minimum lot charge
- setup/admin charge
- labor rate per hour
- furnace rate per hour
- bath/quench rate per hour
- temper furnace rate per hour
- inspection base charge
- consumables per kg
- handling/packaging charge
- overhead percent
- target margin percent

Presets do not include quote source, process summary, imported process assumptions, lot details, manual billable overrides, complexity, scrap reserve, expedite multiplier, or manual adder/discount.

## Storage Model

The preset library is browser-local and versioned in `localStorage`. A preset has:

- stable generated id
- display name
- shop rates
- ISO created timestamp
- ISO updated timestamp

Invalid or malformed local storage data must not break the RFQ workspace. The preset module should parse defensively and return an empty library when stored data is unreadable or invalid. Saving a preset with an existing name overwrites that preset's rates and updated timestamp while preserving its id and created timestamp.

Project files continue to save the applied `heatTreatQuote.input.shopRates` values through the existing project-state path. The project schema does not need to change for this feature. Loading a project restores the applied rates even if the local preset library is empty or different on another machine.

## UI Design

In the Heat-Treat RFQ workspace, section `3. Shop Rates` gains a compact preset control row above the numeric rate fields:

- preset dropdown
- Apply
- Save Current
- Delete

When no presets exist, the dropdown shows `No saved presets`, and Apply/Delete are disabled. When presets exist, the dropdown lists names sorted case-insensitively. Apply replaces the current `shopRates` object with the selected preset rates, re-renders the RFQ recommendation, and updates the rate inputs.

Save Current prompts for a preset name. Blank names are ignored with a user-visible status message. Saving with an existing name overwrites that preset. Saving with a new name creates a new preset and selects it. Delete removes the selected preset after confirmation and leaves the current quote's rate values unchanged.

All preset actions should use existing status feedback through `showProjectStatus`. The UI should stay compact and work-focused, matching the existing RFQ section layout.

## Data Flow

`src/ui/quote-rate-presets.ts` owns local-storage parsing and mutation. `src/ui/main.ts` owns binding UI controls and applying selected preset rates to `heatTreatQuoteState.shopRates`.

Applying a preset should:

1. Clone the selected preset rates into `heatTreatQuoteState.shopRates`.
2. Re-render the RFQ workspace or synchronize the affected inputs.
3. Recalculate the RFQ recommendation.
4. Show a status message identifying the applied preset.

Saving or deleting a preset should update the local preset library immediately and refresh only the preset selector row unless a full RFQ workspace render is simpler and safe.

## Error Handling

If `localStorage` is unavailable, throws, or contains invalid JSON, the app should keep RFQ usable with an empty preset library and show a status message only when a user action fails. Preset parsing should reject invalid rate values using the same non-negative and margin bounds expected by the quote model.

Name matching for overwrite should be case-insensitive after trimming whitespace. Display names should preserve the user's casing.

## Testing

Add pure tests for the preset module:

- empty library when no storage exists
- save new preset
- overwrite existing preset by case-insensitive name
- delete preset
- reject malformed storage by returning an empty library
- reject invalid shop-rate values

Add jsdom RFQ workflow coverage:

- enter shop rates
- save current rates as a named preset
- change visible rate fields
- apply the saved preset and verify fields/recommendation return to saved values
- save and reload a project and verify applied rates persist through project state

Existing full verification remains `npm test`, `npm run typecheck`, and `npm run build`.

## Non-Goals

- No server-side preset storage.
- No importing or exporting preset libraries.
- No project schema migration.
- No preset support for lot values, source modes, overrides, adjustments, or validation checklist state.
- No changes to heat-treatment quote math.
