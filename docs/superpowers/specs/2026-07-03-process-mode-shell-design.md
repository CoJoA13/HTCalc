# Process Mode Shell Design

## Goal

Prepare the HTCalc UI for multiple heat-treatment process families while keeping ADI as the only implemented calculator.

## Design

Add a process-mode metadata layer with three modes: ADI, steel austempering, and martempering. ADI remains active and implemented. Steel austempering and martempering are selectable planned modes, not disabled controls, and show a compact placeholder panel with expected future input categories.

The UI should no longer hard-code process tab labels directly in the page template. Mode metadata should own the mode id, label, icon class, implementation status, short description, and planned input bullets. This keeps the shell extensible without building steel or martempering formulas prematurely.

Settings remain shared for units, while the existing model calibration section should be labeled as ADI model calibration to avoid implying those coefficients apply to steel or martempering.

## Behavior

Selecting ADI renders the existing ADI input pane and recommendation panel. Selecting a planned mode renders a full-width placeholder state in the workspace and hides ADI recommendations. The placeholder should clearly say the mode is planned and list likely future input groups so users understand why no calculation is shown.

## Testing

Add unit tests for the process-mode metadata and helper behavior. Existing ADI model, unit, and view-model tests should continue to pass.
