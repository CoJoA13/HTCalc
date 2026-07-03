# Steel Austempering and Martempering Design

## Status

Approved for planning and implementation on branch `feature/steel-austempering-martempering-research`.

## Goal

Add implemented steel austempering and martempering process modes to HTCalc, using a deterministic advisory model that helps an engineer plan trial windows, review risk, and document required validation. The feature must not claim to replace TTT/CCT diagrams, Jominy data, plant quench trials, coupon testing, or customer specification approval.

## Research Basis

The design follows the same conservative pattern as the existing ADI model: generate a structured starting recommendation, expose the assumptions, and force validation through warnings and checklist rows.

Primary and technical references used for the model boundaries:

- ASTM A255-20, `Standard Test Methods for Determining Hardenability of Steel`, for the Jominy end-quench and Grossman composition-calculation context, plus the composition range where ASTM's calculation method applies: <https://store.astm.org/a0255-20.html>
- H. K. D. H. Bhadeshia / Cambridge and Queen Mary bainite repository, for bainite transformation background and bainitic steel resources: <https://www.phase-trans.msm.cam.ac.uk/bainite_NN.html>
- H. K. D. H. Bhadeshia, commentary on Davenport and Bain's isothermal transformation work: <https://www.phase-trans.msm.cam.ac.uk/2010/Bain.html>
- General steel heat-treatment literature for interrupted quench behavior, tempering, and Hollomon-Jaffe style time-temperature equivalence, treated as advisory heuristics rather than certified calculations.

## Scope

Build five additions:

1. Shared steel model core for composition, geometry, equipment, transformation estimates, hardness estimates, validation checks, warnings, confidence, and reusable windows.
2. Steel austempering model that recommends austenitize, quench-to-bainite, isothermal hold, final cooling, and validation requirements.
3. Martempering model that recommends austenitize, interrupted quench above martensite start, equalization, final cooling, and a follow-up tempering plan.
4. As-quenched hardness and tempering recommendation support for martempering, including target-hardness driven temper temperature and time suggestions.
5. UI, project-state, report, and process-mode integration for both steel modes.

Out of scope for this branch:

- Full CCT/TTT simulation.
- Steel grade database lookup.
- Certified ASTM A255 calculation output.
- Cloud sync, localStorage, generated PDF libraries, or new runtime dependencies.
- Advanced tool steel, stainless steel, carburized case-depth, induction hardening, cryogenic treatment, or nitriding workflows as separate implemented modes.

## Model Inputs

Both steel modes share:

- Steel composition in wt%: C, Mn, Si, Ni, Cr, Mo, V, Cu, and B.
- Geometry: maximum section, minimum section, critical section, estimated mass.
- Starting condition: normalized, annealed, spheroidized, quenched-and-tempered, hot-rolled, or unknown.
- Target: hardness/toughness/distortion/wear/fatigue priority and optional target HRC.
- Equipment: furnace type, atmosphere, carbon protection, quench medium, agitation, transfer time, bath temperature uniformity, equalization control.

Steel austempering adds:

- Desired bainite type: upper, lower, or balanced.
- Austemper bath medium: salt, high-temperature oil, fluidized bed, or furnace hold after interrupted quench.
- Available austemper bath temperature and hold constraints.

Martempering adds:

- Martemper bath medium: molten salt, hot oil, polymer, or other.
- Equalization strategy and max equalization time.
- Tempering time, number of tempers, and target hardness when known.

## Model Outputs

Both modes return:

- Austenitize temperature window and soak-after-core-at-temperature window.
- Transformation estimates: Ac1, Ac3, Ms, estimated bainite start, hardenability score, section severity, retained-austenite risk.
- Process windows with nominal set points and min/nominal/max ranges.
- Confidence level: green, yellow, or red.
- Processing-window status: robust, narrow, or invalid.
- Warnings and deterministic validation checklist strings.

Steel austempering returns:

- Austemper bath temperature window.
- Hold-after-core-at-bath-temperature window.
- Expected structure label: upper bainite, lower bainite, mixed bainite, or high-risk mixed structure.
- Expected hardness range in HRC.
- Explicit note that tempering is not normally required when the part is fully transformed to bainite.

Martempering returns:

- Martemper bath temperature window relative to estimated Ms.
- Equalization time window.
- Final cooling guidance.
- Estimated as-quenched HRC range.
- Recommended temper temperature and time window to approach the target HRC.
- Tempering cautions for low-carbon steels, high-carbon retained-austenite risk, secondary-hardening alloys, and embrittlement-sensitive temperature bands.

## Advisory Formulas

The formulas are deliberately simple and visible in code. They provide first-pass engineering review only.

- Critical temperatures use empirical composition estimates for Ac1, Ac3, Ms, and bainite-start-like guidance, clamped to practical steel heat-treatment bounds.
- Hardenability is scored from alloy contribution, section thickness, quench severity, agitation, and transfer time. ASTM A255 is cited as the correct validation path; HTCalc does not implement the ASTM standard calculation.
- As-quenched hardness is mainly carbon-driven, with penalties for low hardenability, heavy section, poor quench severity, and retained-austenite risk.
- Tempering uses bounded time-temperature heuristics and a Hollomon-Jaffe-style relationship for relative time/temperature tradeoffs. The model presents a target range and warnings instead of implying exact HRC prediction.
- Confidence is lowered when chemistry lies outside ASTM A255-style composition bounds, carbon is too low for meaningful hardening, section size exceeds plausible interrupted-quench capability, bath temperature conflicts with Ms, transfer time is excessive, or target HRC is incompatible with the estimated as-quenched range.

## UI Design

The existing process tabs stay in place. Steel Austempering and Martempering change from planned to implemented.

Each steel mode gets a compact workbench:

- Project Details remain shared.
- Input pane uses the same section-block pattern as ADI.
- Result pane shows a summary header, confidence badge, process windows, score strip, warnings, and validation checklist.
- Report actions stay in the recommendation pane.
- The UI should reuse the existing settings and unit-system controls. ADI calibration remains ADI-only; steel calibration is not added in this branch.

The steel UI should be practical and dense. No landing page, no decorative marketing layout, and no nested cards.

## Data Flow

State remains in `src/ui/main.ts` for this branch, with helper modules keeping model and formatting logic out of the renderer.

Planned module boundaries:

- `src/steel/types.ts`: shared steel input/output types.
- `src/steel/core.ts`: shared calculation helpers, validation, temperature/time windows, confidence helpers.
- `src/steel/austempering.ts`: steel austempering recommendation model.
- `src/steel/martempering.ts`: martempering recommendation model.
- `src/steel/index.ts`: public exports.
- `src/ui/steel-report.ts`: steel report view-model and Markdown serialization helpers if the current ADI-specific report helper cannot stay clean.
- `src/ui/project-state.ts`: persist and validate steel inputs and report-review state in project version 3 while migrating version 1 and 2 files.
- `src/ui/main.ts`: wire inputs, render steel workspaces, save/load, reports, and checklist reconciliation.

## Project Files

Project state moves to `htcalcProjectVersion: 3`.

Version 1 files migrate to version 3 with:

- ADI data from the file.
- Blank metadata.
- Empty validation checklist state.
- No pinned comparison baseline.
- Default steel austempering and martempering inputs.

Version 2 files migrate to version 3 with:

- Existing ADI, metadata, checklist, and baseline preserved.
- Default steel austempering and martempering inputs.

Version 3 files persist:

- Active mode and unit system.
- Metadata.
- ADI state.
- Steel austempering state.
- Martempering state.
- Per-mode validation checklist state.
- Existing ADI pinned baseline.

Project validation must reject invalid version values, process modes, unit systems, steel enum values, malformed required objects, non-finite numbers, negative impossible values, and invalid checklist shapes before mutating UI state.

## Reports

Steel reports should be engineering-review oriented:

- Include metadata and notes.
- Include steel chemistry, critical section, target, equipment assumptions, and selected process mode.
- Include process windows, estimated transformation temperatures, estimated hardness, warnings, validation checklist, and model limitations.
- Markdown filenames should include customer/part when available and mode-specific fallback names when metadata is blank.
- Printable report uses browser print; no PDF dependency is added.

## Error Handling and Validation

The recommendation model throws `RangeError` for impossible numeric inputs and invalid enum-like values.

The UI catches model errors and shows the existing "Input needs correction" pattern.

Warning and checklist examples:

- Confirm steel grade and chemistry with MTR or lab analysis.
- Validate hardenability with Jominy, CCT/TTT data, or representative quench trials.
- Verify core temperature before starting soak/hold timing.
- Confirm bath temperature is above Ms for martempering and in the desired bainite range for austempering.
- Verify final hardness traverse and microstructure.
- Temper martempered parts promptly unless a documented exception applies.

## Testing

Use TDD for implementation.

Add tests for:

- Steel core critical-temperature, hardenability, hardness, tempering, and warning behavior.
- Steel austempering recommendations for upper/lower bainite, invalid bath windows, low hardenability, and validation checklist generation.
- Martempering recommendations for Ms-relative bath windows, equalization, as-quenched hardness, target tempering, low-carbon infeasibility, and retained-austenite warnings.
- Process-mode metadata changing steel modes to implemented.
- Project-state version 3 creation, version 1 and 2 migration, steel persistence, and steel validation rejection paths.
- Report Markdown content and filenames for both steel modes.
- Unit formatting where steel geometry and temperature outputs surface in UI/report helpers.

Verification commands:

- `npm test`
- `npm run typecheck`
- `npm run build`
- Local dev smoke check through `npm run dev`

## Risks

- Exact steel heat treatment depends heavily on grade-specific TTT/CCT curves, prior austenite grain size, quench severity, section geometry, and plant equipment. The UI must label results as advisory and push validation.
- Martempering without tempering is rarely appropriate. The martempering mode should make tempering part of the default recommendation.
- Higher alloy, tool, stainless, and secondary-hardening steels can break simple temper-hardness assumptions. The first implementation should warn rather than overfit.
- Project state becomes larger. Versioned validation should remain strict and explicit to avoid partially restoring malformed steel data.

## Acceptance Criteria

- Steel Austempering and Martempering tabs are implemented, usable, saved, loaded, and reportable.
- ADI behavior remains intact.
- Existing version 1 and version 2 project files still load.
- Steel recommendations generate deterministic windows, scores, warnings, confidence, and validation checks.
- Martempering includes as-quenched hardness and tempering recommendations.
- Tests, typecheck, and build pass.
