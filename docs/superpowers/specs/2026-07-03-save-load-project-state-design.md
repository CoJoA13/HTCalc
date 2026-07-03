# Save Load Project State Design

## Goal

Add local JSON save/load for HTCalc project state so users can preserve and share calculator inputs and settings.

## Design

Use a versioned JSON project format with `htcalcProjectVersion: 1`. The saved payload contains active process mode, unit system, ADI input state, and ADI model calibration settings. Exported files use `.htcalc.json`.

The existing header buttons become functional. Save downloads a JSON file generated from current UI state. Load opens a hidden file input, reads JSON, validates the project version and required fields, then restores the UI state and recommendation. Unsupported versions and invalid JSON are rejected with a visible status message.

This feature is file-based only. It does not add autosave, cloud storage, or browser localStorage.

## Testing

Add pure tests for serialization, parsing, version rejection, and required-field validation. UI wiring is verified through TypeScript/build checks.
