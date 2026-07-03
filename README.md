# HTCalc

HTCalc is a heat-treatment process recommendation workbench for engineering review. It currently covers austempered ductile iron (ADI), steel austempering, and steel martempering planning workflows.

The app is a deterministic first-pass calculator. It is not a certification tool, production traveler, or substitute for grade data, CCT/TTT/Jominy data, representative trials, hardness traverse, tensile testing, or metallography.

## Current Capabilities

- ADI process window recommendations for ASTM A897 grades.
- Steel austempering recommendations with austenitize, austemper, hardness, warning, and validation outputs.
- Steel martempering recommendations with interrupted quench, equalization, as-quenched hardness, tempering, warning, and validation outputs.
- Project save/load using `.htcalc.json`.
- Project metadata, validation checklists, pinned ADI comparison baselines, printable reports, and Markdown report export.
- Imperial/metric display toggle for relevant inputs and outputs.

Steel austempering and martempering are implemented as planning models. They should be calibrated against plant data before production use.

## Local Development

Install dependencies:

```bash
npm ci
```

Run the UI locally:

```bash
npm run dev
```

Run validation:

```bash
npm test
npm run typecheck
npm run build
```

Build outputs are written to `dist/`.

## Project Files and Reports

HTCalc project files use JSON and the `.htcalc.json` suffix. They persist process inputs, active mode, units, metadata, validation checklist state, ADI calibration, and ADI pinned comparison baseline.

Reports can be opened in a printable view. Browser print handles PDF output through the browser's "Save as PDF" flow. Markdown export downloads a `.md` report file.

## Documentation

- [Documentation index](docs/index.md)
- [ADI process model](docs/adi-process-model.md)
- [Steel process model](docs/steel-process-model.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Repository Layout

```txt
src/adi/       ADI model, validation, and types
src/steel/     Steel transformation, austempering, and martempering models
src/ui/        Browser UI, project state, reports, units, and view models
test/          Vitest coverage for models, project files, reports, and UI helpers
docs/          Public model notes plus internal implementation specs/plans
```

## Model Limitations

HTCalc does not simulate heat transfer, diffusion, segregation, furnace gas chemistry, part-specific fixtures, or true transformation kinetics. Recommendations are starting points for review and trial planning only.

Production release should be based on the relevant specification, representative coupons or parts, calibrated equipment, documented furnace/bath capability, hardness traverse, tensile or impact testing when required, and metallographic validation.

## License

MIT. See [LICENSE](LICENSE).
