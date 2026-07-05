# Changelog

All notable project changes are summarized here.

## Unreleased

- Added RFQ field-level validation messages and stale-result recovery for invalid quote edits.
- Staged the Heat-Treat RFQ input pane into accessible accordions for source assumptions, lot capacity, shop rates, optional overrides, and review/export readiness.
- Added RFQ preset import/export, clearer preset action statuses, and unit-system-aware RFQ Markdown total weight.
- Added browser-local Heat-Treat RFQ shop-rate presets with project-file preservation of applied rates.
- Added browser-like Heat-Treat RFQ workflow coverage and imperial `$/lb` per-weight quote display.
- Added Heat-Treat RFQ pricing design and implementation for recipe-imported heat-treatment service estimates.
- Added public repository documentation, contribution guidance, GitHub issue and PR templates, Dependabot configuration, and MIT licensing.

## 0.1.0 - 2026-07-03

- Added ADI process recommendation workflow for ASTM A897 planning.
- Added project save/load with metadata, validation checklist state, ADI calibration, unit system, active mode, and pinned comparison baseline.
- Added printable and Markdown reports.
- Added imperial/metric display toggle.
- Added process mode shell for ADI, steel austempering, martempering, and planned future steel modes.
- Added steel austempering model with transformation estimates, austemper windows, estimated hardness, warnings, and validation checks.
- Added martempering model with interrupted quench, equalization, as-quenched hardness, tempering, warnings, and validation checks.
- Added CI for tests, typecheck, and build.
