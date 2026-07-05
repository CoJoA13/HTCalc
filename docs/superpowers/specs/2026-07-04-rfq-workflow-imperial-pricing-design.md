# RFQ Workflow Test and Imperial Pricing Design

## Purpose

Add a real UI workflow test for the Heat-Treat RFQ tab and polish RFQ per-weight pricing so imperial users see `$/lb` instead of `$/kg`. This work covers test depth and display behavior only. It does not change the quote cost model, stored metric values, project schema, or shop-rate inputs.

## Scope

The RFQ result pane and printable RFQ report must show a unit-system-specific per-weight price:

- Metric mode: label `Price/kg`, value formatted as `$X.XX/kg`.
- Imperial mode: label `Price/lb`, value formatted as `$X.XX/lb`.
- Missing weight basis: value `Unavailable` with the active label.

The RFQ calculation model remains metric internally and continues to return `pricePerKg`. The UI converts that value for display by multiplying by kilograms per pound when the active unit system is imperial.

## UI Workflow Test

Add a Vitest jsdom test that imports the actual UI module after creating a `#app` element. The test must drive real DOM controls:

1. Switch from ADI to Heat-Treat RFQ with the `data-process-mode="heat-treat-rfq"` tab.
2. Select an imported source, starting with ADI assumptions.
3. Enter enough lot and shop-rate inputs to produce a quote.
4. Verify the RFQ result renders a lot price, imported assumptions, validation checks, and report buttons.
5. Switch units to metric and confirm the per-weight metric is `Price/kg`.
6. Switch units back to imperial and confirm the per-weight metric is `Price/lb` and no `Price/kg` metric remains in the result pane.
7. Trigger project save and capture the generated JSON blob.
8. Load the saved project through the file input and confirm the Heat-Treat RFQ workspace restores with the same imperial per-weight display and report controls.

The test may stub browser APIs that jsdom does not implement, including `URL.createObjectURL`, `URL.revokeObjectURL`, anchor `click`, and `window.print`. The stubs must only support the workflow under test.

## Implementation Boundaries

Add small RFQ display helpers in the UI layer rather than changing the quote domain model. The helper should accept `pricePerKg` and `unitSystem`, then return the active label, display value, and unit suffix. The same helper should be used by the RFQ result pane and printable RFQ HTML report to avoid divergent behavior.

The Markdown RFQ report can remain metric for this slice because it is serialized from the report model without a live UI unit toggle. A future report-model change can add unit-system-aware Markdown export if needed.

## Error Handling

The workflow test should fail on normal Vitest assertions, not swallow rendering errors. Test setup should restore global stubs after each test. If quote inputs are incomplete, the UI must continue to show the existing incomplete pricing-basis message rather than the generic RFQ error state.

## Testing

Use test-first implementation:

- Add a unit test for the RFQ per-weight display helper showing metric, imperial, and unavailable cases.
- Add the jsdom RFQ workflow test and verify it fails before implementation.
- Implement the helper and UI usage.
- Run the targeted tests, then the full verification set: `npm test`, `npm run typecheck`, and `npm run build`.

## Non-Goals

- No pricing-model formula changes.
- No project-state schema migration.
- No raw material, freight, tax, or commercial terms.
- No Playwright browser installation.
- No changes to the unrelated local `Austempered ductile iron.txt` file.
