# RFQ Markdown Units and Preset Import Export Design

## Purpose

Add three focused RFQ follow-ups:

- Make RFQ Markdown report total weight follow the active unit system.
- Let users export and import browser-local RFQ shop-rate presets.
- Polish RFQ preset action feedback for blank names and failed save, delete, import, or export paths.

This work builds on the existing Heat-Treat RFQ pricing and shop-rate preset features. It does not change quote math, project schema, recipe imports, or stored metric project values.

## Scope

### RFQ Markdown Weight Units

RFQ quote calculations and project files remain metric internally. `HeatTreatQuoteRecommendation.totalWeightKg` stays the source value.

Markdown report serialization should display total weight using `QuoteReportViewModel.unitSystem`:

- metric: `Total weight: 200 kg`
- imperial: `Total weight: 440.925 lb`
- unavailable: `Total weight: Unavailable`

The display should be handled through a small UI-layer helper, parallel to `quotePerWeightDisplay`, so Markdown, report HTML, and additional UI surfaces can use the same conversion behavior when needed.

### Preset Export

The RFQ section `3. Shop Rates` preset control row should gain an `Export` action.

Export behavior:

- Exports the current browser-local preset library as JSON.
- Uses the existing versioned preset library format from `src/ui/quote-rate-presets.ts`.
- Produces a stable human-readable filename such as `htcalc-rfq-rate-presets-YYYY-MM-DD.json`.
- If there are no saved presets, Export is disabled.
- If browser download creation fails, the app shows a user-visible status error and leaves presets unchanged.

The export file is only the preset library. It is not a project file and does not include lot details, selected quote source, imported assumptions, manual overrides, adjustments, validation checklist state, or customer metadata.

### Preset Import

The RFQ section `3. Shop Rates` preset control row should gain an `Import` action backed by a hidden file input.

Import behavior:

- Accepts a JSON file using the same versioned preset library format as export.
- Parses and validates defensively.
- Merges imported presets into the current browser-local library.
- Matching names overwrite existing presets case-insensitively after trimming.
- Existing preset `id` and `createdAt` are preserved for overwritten local presets.
- Imported rates and display name replace the overwritten preset values.
- Imported presets without matching names are added.
- Imported preset ids are preserved when they do not collide with existing local ids.
- If an imported id collides with a different local preset, the imported preset receives a new generated id.
- The import operation is atomic: invalid JSON, invalid version, invalid preset shape, invalid rate values, or persistence failure leave the existing local preset library unchanged.
- After a successful import, the selector refreshes and selects the first imported or overwritten preset when possible.
- Import status should say how many presets were added and how many were updated.

### Preset UX Polish

Preset action status messages should be specific, short, and user-facing:

- Blank Save Current names: `Preset name is required. No rates were saved.`
- Save persistence failure: `Could not save preset in this browser. Existing presets were unchanged.`
- Delete persistence failure: `Could not delete preset in this browser. Existing presets were unchanged.`
- Export failure: `Could not export presets. Try again or check browser download permissions.`
- Import parse or validation failure: `Could not import presets. Choose a valid HTCalc RFQ preset file.`
- Import persistence failure: `Could not import presets in this browser. Existing presets were unchanged.`

All messages continue to use `showProjectStatus`.

## Data Model

No project-state schema changes are needed.

`src/ui/quote-rate-presets.ts` should own import/export library serialization and merge behavior. The UI should not duplicate JSON parsing or merge rules.

New or updated module responsibilities:

- Parse exported preset JSON strictly enough to reject malformed files.
- Serialize a valid preset library for download.
- Merge one valid library into another using case-insensitive name matching.
- Return a merge result with the next library, selected preset id, added count, and updated count.

Existing localStorage loading remains defensive and still returns an empty library for malformed stored data.

## UI Design

The RFQ preset row stays compact and work-focused:

- Dropdown
- Apply
- Save Current
- Import
- Export
- Delete

Import and Export should use the same secondary button style and icon language as the existing controls. Export and Delete are disabled when no presets exist. Import remains enabled so users can seed an empty browser with presets.

The hidden file input should accept `.json,application/json`.

Full RFQ workspace re-rendering after import/export-related state changes is acceptable because the current RFQ input values and recommendation state are already preserved in `heatTreatQuoteState`.

## Error Handling

Import must never partially apply bad data. The UI should update local in-memory preset state only after parsing, merging, and persistence all succeed.

Export should validate the current preset library before serializing. If serialization or download setup fails, it should show the export failure message.

For localStorage unavailability:

- Existing load behavior remains an empty preset library.
- Save, delete, and import persistence failures show status messages and do not mutate in-memory preset library state.
- Export can still export the current in-memory library if presets are available.

## Testing

Add pure tests for preset import/export helpers:

- serializes a preset library to JSON.
- parses valid exported JSON.
- rejects malformed JSON and invalid library shape.
- merges imported presets by case-insensitive name.
- preserves local id and created timestamp on overwrite.
- avoids id collisions for new imported presets.
- returns added and updated counts.

Add RFQ report Markdown tests:

- metric reports continue to show total weight in kg.
- imperial reports show total weight in lb.
- unavailable total weight remains `Unavailable`.

Add jsdom RFQ workflow coverage:

- blank Save Current name shows the required-name status and does not create a preset.
- Export downloads a JSON preset file with the saved preset library.
- Import into an empty local library creates presets and refreshes controls.
- Import into a library with a matching name overwrites that preset and reports updated count.
- Invalid import file shows an error and leaves existing presets unchanged.

Existing full verification remains:

- `npm test`
- `npm run typecheck`
- `npm run build`

## Non-Goals

- No server-side preset storage.
- No project-file schema changes.
- No quote math changes.
- No import/export for full projects through the preset controls.
- No CSV import/export.
- No preset categories, tags, or sharing service.
