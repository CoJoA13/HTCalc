# ADI Calculation Core Design

## Objective

Build the first HTCalc deliverable as a TypeScript calculation core for austempered ductile iron process recommendations. The module will turn ASTM grade, composition, section geometry, starting microstructure, and equipment constraints into conservative process windows, warnings, confidence level, and validation requirements.

This first version is a heuristic engineering aid. It must not claim to certify ASTM A897 compliance or replace plant trials, metallography, tensile testing, hardness checks, or furnace/bath validation.

## Scope

In scope:

- Typed ADI recommendation inputs and outputs.
- ASTM A897 grade metadata and baseline process windows.
- Heuristic scoring for austemperability, carbide/segregation risk, atmosphere risk, and process confidence.
- Recommended austenitizing and austempering nominal set points plus ranges.
- Carbon-potential guidance as calibrated furnace-control categories, not a universal ductile-iron carbon formula.
- Warning generation for pearlite, martensite, carbide, decarburization, retained-austenite, nodularity, and equipment risks.
- Unit tests covering representative ductile, balanced, high-strength, heavy-section, and high-risk cases.

Out of scope for this iteration:

- Browser UI.
- Material database persistence.
- Certified process recipes.
- Heat-transfer simulation.
- Machine-learning calibration.
- Automatic ASTM pass/fail from test data.

## Project Structure

The repo will start as a small TypeScript package:

- `package.json`: scripts for build, typecheck, and tests.
- `tsconfig.json`: strict TypeScript configuration.
- `vitest.config.ts`: unit-test configuration.
- `src/adi/types.ts`: public input and output types.
- `src/adi/data.ts`: ASTM grade table and baseline process windows.
- `src/adi/model.ts`: recommendation model and scoring functions.
- `src/adi/validation.ts`: input validation, warning rules, and confidence gates.
- `src/adi/index.ts`: public exports.
- `test/adi-model.test.ts`: representative model behavior tests.
- `docs/adi-process-model.md`: user-facing model notes, formulas, assumptions, and validation requirements.

## Public API

The main API will be:

```ts
recommendAdiProcess(input: AdiProcessInput): AdiProcessRecommendation
```

`AdiProcessInput` will include:

- `composition`: C, Si, Mn, Cu, Ni, Mo, Cr, Mg, P, S in weight percent.
- `geometry`: maximum, minimum, and critical section thickness in mm, with optional mass and surface-area-to-volume ratio.
- `microstructure`: starting matrix, carbide presence, optional nodule count, optional nodularity, and optional segregation/chill risk.
- `target`: ASTM A897 grade and process priority.
- `equipment`: furnace type, atmosphere type, carbon-potential control flag, quench transfer time, austemper bath type, bath agitation, and bath uniformity.

`AdiProcessRecommendation` will include:

- Austenitizing temperature range, nominal set point, soak after core reaches temperature, and total-time note.
- Carbon-potential category and atmosphere guidance.
- Quench and transfer warnings.
- Austempering temperature range, nominal set point, minimum hold, maximum hold, and processing-window status.
- Internal scores for austemperability, carbide/segregation risk, atmosphere risk, and confidence.
- Expected ASTM target grade, warnings, validation checks, and green/yellow/red confidence level.

## Model Behavior

The ASTM grade sets the starting property direction. Higher grades start with lower austempering temperatures and longer transformation times. Lower grades start with higher austempering temperatures and more ductility-focused process windows.

The model then adjusts for:

- Section thickness through a square-root section factor using 25 mm as the reference section.
- Alloy composition through separate austemperability and carbide/segregation terms.
- Starting matrix and carbide presence through austenitizing temperature/time adjustments.
- Process priority through austempering-temperature bias.
- Equipment risk through atmosphere, transfer-time, agitation, and bath-uniformity warnings.

The model must return windows, not a single recipe. Nominal values are starting points inside those windows.

## Core Formulas

Use the research brief's first-pass heuristics:

- `SectionFactor = sqrt(criticalSectionMm / 25)`
- `AustemperabilityIndex = 1.0 + 0.35*Ni + 0.25*Cu + 0.90*Mo + 0.45*Mn + 0.60*Cr - 0.04*S - 0.02*transferTimeSec`
- `CarbideSegregationRisk = 1.0*Mo + 0.8*Mn + 1.2*Cr + 2.0*Mo*Mn + 2.0*Mo*Cr + 1.5*Mn*Cr + 0.01*S + 2.0*P`
- `T_gamma_base_C = 925 - 12*(gradeIndex - 1)`, clamped to 840-950 C after adjustments.
- `t_gamma_soak_min = 60 + section/matrix/alloy/carbide adjustments`, clamped to 45-180 minutes.
- Austempering base temperatures by grade: 385, 370, 350, 325, 300, and 275 C.
- `tA_base_min = 60 * exp((385 - T_austemper_C) / 95)`
- `tA_min` adjusted by section and Mn/Mo/Ni/Cu.
- `tA_max = tA_min * 1.8`, or `1.3` when carbide risk is high.

Threshold constants will be named and centralized so plant data can later calibrate them.

## Warning Rules

Warnings must be explicit and actionable:

- Low austemperability for section size: pearlite risk.
- Short transfer time capability missing or transfer time too long: pearlite risk.
- Low austempering temperature with high Mn/Mo/Cr: slow reaction, segregation, carbide, and martensite risk.
- Carbides in starting iron: solutionizing and validation warning.
- Poor nodularity or low nodule count: recommendation reliability warning.
- Air furnace or unknown atmosphere control: scale and decarburization warning.
- Thin or fatigue-critical sections without controlled atmosphere: surface-property risk.
- High-strength grades in heavy sections: narrow processing-window warning.
- Excessive P/S or Cr in non-CADI use: quality-gate warning.

## Confidence Gates

Use three levels:

- `green`: inputs are within conservative bounds and no major equipment/composition warnings are active.
- `yellow`: plausible starting window, but coupon validation is required before production.
- `red`: selected target is not recommended with the supplied composition, section, or equipment without redesign, grade change, or process capability changes.

New recipes should normally be at least `yellow` until validated plant data exists. `green` is allowed only for internally validated future data or conservative benchmark cases.

## Testing

Initial tests will verify:

- Ductile grade recommendations use high austempering temperatures and shorter holds.
- High-strength grades use lower austempering temperatures and longer holds.
- Heavy sections increase hold time and pearlite warnings.
- High Mn/Mo/Cr raises carbide/segregation warnings and can narrow the processing window.
- Air or uncontrolled atmosphere produces decarburization warnings.
- Poor nodularity degrades confidence.
- Returned ranges contain nominal set points.

## Documentation

`docs/adi-process-model.md` will document the formulas, assumptions, limitations, warning meanings, and required production validation checks:

- ASTM A897 tensile and hardness testing.
- Metallography for nodularity, nodule count, ausferrite, pearlite, martensite, carbides, and decarburized surface layer.
- Surface hardness or microhardness traverse when atmosphere risk exists.
- Impact and dimensional-growth checks where relevant.

## Implementation Notes

Keep the calculation module deterministic and side-effect free. Do not hide warnings behind UI-specific formatting. Do not bake plant-specific calibration into unnamed constants. Prefer readable, named thresholds over clever compact formulas because metallurgical review matters more than code density.
