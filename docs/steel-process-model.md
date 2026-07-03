# Steel Process Model

HTCalc's steel process model recommends conservative starting windows for steel austempering and martempering review. It is a deterministic heuristic model, not a production qualification system.

## Supported Modes

### Steel Austempering

Steel austempering recommends:

- Austenitizing temperature and soak after core reaches temperature.
- Austemper bath temperature range and nominal set point.
- Hold after core reaches austemper bath temperature.
- Expected bainitic structure target.
- Estimated final hardness range.
- Confidence, processing-window status, warnings, and validation checks.

### Martempering

Martempering recommends:

- Austenitizing temperature and soak after core reaches temperature.
- Interrupted quench bath temperature range and nominal set point.
- Equalization time window.
- Final cooling guidance.
- Estimated as-quenched hardness range.
- Tempering temperature, hold, target hardness, and temper count.
- Confidence, processing-window status, warnings, and validation checks.

## Inputs

The shared steel model uses:

- Chemistry in weight percent: C, Mn, Si, Ni, Cr, Mo, V, Cu, and B.
- Geometry: maximum section, minimum section, critical section, and optional estimated mass.
- Starting condition: normalized, annealed, spheroidized, quenched-tempered, hot-rolled, or unknown.
- Target priority: hardness, toughness, distortion, wear, or fatigue.
- Optional target hardness in HRC.
- Furnace and atmosphere type.
- Carbon protection status.
- Quench medium, agitation, transfer time, and bath uniformity.

Steel austempering also uses bainite target, bath medium, optional bath temperature, and optional maximum hold.

Martempering also uses bath medium, optional bath temperature, equalization strategy, optional maximum equalization time, temper hold, and requested temper count.

## Transformation Estimates

The model estimates Ac1, Ac3, Ms, bainite start, relative hardenability, section severity, and retained-austenite risk from chemistry, geometry, and equipment inputs. These are planning estimates used to shape warnings and process windows.

The formulas are intentionally simple and conservative. They should be calibrated against the relevant grade family, supplier data, Jominy data, CCT/TTT diagrams, and representative trials before production release.

## Confidence and Window Status

Each recommendation includes:

- `robust`: no active window-narrowing rule applies.
- `narrow`: the process may be viable but needs added validation or tighter control.
- `invalid`: an input or calculated process window conflicts with the estimated transformation limits.

Confidence levels are:

- `green`: robust recommendation with no active warning gate.
- `yellow`: cautionary recommendation, such as air atmosphere risk, hardenability risk, transfer delay, bath uniformity risk, retained-austenite risk, or a narrow transformation window.
- `red`: invalid process window or input condition.

Air austenitizing or air atmosphere is treated as a confidence downgrade because decarburization can change surface hardness and fatigue behavior.

## Martempering Temper Count

The martempering wrapper preserves the higher temper count required by the tempering model. High-carbon or high-alloy inputs can therefore raise a one-temper user request to a two-temper recommendation when retained austenite risk warrants it.

## Required Validation

Before production use, validate recommendations with:

- Steel grade and chemistry confirmation from MTR or lab analysis.
- Jominy, CCT/TTT data, or representative quench trials.
- Core temperature verification for austenitize, austemper, or interrupted quench timing.
- Calibrated furnace and bath instrumentation.
- Hardness traverse on representative section or coupon.
- Metallography for martensite, bainite, pearlite, retained austenite, carbides, and decarburization.
- Dimensional checks for distortion-sensitive work.
- Tempering validation against final hardness and toughness requirements.

## Limitations

The steel model does not simulate heat transfer, phase transformation kinetics, alloy segregation, local carbon gradients, fixture mass, agitation field, or furnace gas chemistry. It does not certify a steel grade, final hardness, mechanical property, or customer specification.

Treat outputs as engineering-review starting points. Production recipes require documented process capability, material-specific validation, and approval under the applicable quality system.
