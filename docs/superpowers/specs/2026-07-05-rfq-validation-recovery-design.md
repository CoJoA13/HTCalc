# RFQ Field Validation and Stale Recovery Design

## Goal

Make the Heat-Treat RFQ workspace more trustworthy when inputs are incomplete or invalid. The UI should point estimators to the exact field or section that needs correction, while preserving the last valid quote result when a later edit temporarily breaks calculation.

## Context

The staged RFQ accordions reduced cognitive overload, but the RFQ result pane still falls back to broad panel-level messages when current input cannot produce a quote. The Impeccable critique identified this as the remaining P1 issue: field-local validation and recovery are too weak for a calculation tool.

This task is RFQ-only. It builds on the existing quote model validation and RFQ accordion structure. It does not change RFQ pricing formulas, project file shape, report serialization, rate preset storage, ADI/steel process models, or the validation checklist data model.

## Selected Approach

Use a UI validation layer over the existing quote model.

The RFQ UI will parse known `RangeError` messages from `recommendHeatTreatQuote` and the existing RFQ pricing-basis checks into field-level and section-level display state. The quote model remains the source of truth for validation rules. The UI layer only translates model failures into actionable guidance.

This keeps the implementation small and avoids turning this follow-up into a quote-model contract rewrite.

## Validation Surfaces

### Field Messages

Invalid fields should show inline messages under the existing field control.

Initial RFQ field-message coverage:
- `lot.quantity`: quantity must be greater than zero.
- `lot.pieceWeightKg`: piece weight must be greater than zero when supplied.
- `lot.totalWeightKg`: total weight must be greater than zero when supplied.
- `lot.loadCapacityKg`: load capacity must be greater than zero when supplied.
- `lot.laborHoursPerLoad`: labor/load must be non-negative when supplied.
- `lot.cycleCountOverride`: cycle override must be greater than zero when supplied.
- Fixed charge shop-rate fields: supplied rates must be non-negative.
- Hourly/equipment shop-rate fields: supplied rates must be non-negative.
- `shopRates.consumablesPerKg`: consumables must be non-negative.
- `shopRates.overheadPercent`: overhead must be at least 0 and less than 100.
- `shopRates.targetMarginPercent`: margin must be at least 0 and less than 100.
- `adjustments.complexityFactor`: complexity must be greater than zero.
- `adjustments.scrapReworkReservePercent`: scrap reserve must be non-negative.
- `adjustments.expediteMultiplier`: expedite multiplier must be greater than zero.
- Manual override hour fields: supplied hours must be non-negative.
- Manual billable cycle count: supplied cycles must be greater than zero.

Pricing-basis failures should attach to the most useful section rather than a single synthetic field:
- Missing weight/load/manual hours: Lot & Capacity section.
- Imported time assumptions without matching manual overrides: Overrides & Adjustments section.

Field messages should be plain text, not tooltip-only. They should use explicit language like `Enter a positive total weight or provide manual billable hours.`

### Accordion Status

RFQ accordion status labels should reflect validation state:
- Source & Assumptions keeps its current `Manual` or `Imported` status unless source import fails.
- Lot & Capacity can show `Needs input` when missing or invalid lot basis blocks pricing.
- Shop Rates can show `Check rates` when margin or rate fields are invalid.
- Overrides & Adjustments can show `Check overrides` when manual overrides or adjustments are invalid.
- Review & Export Readiness can show `Needs correction` when current inputs are invalid.

Existing informative statuses such as selected preset name, `Custom rates`, `Overrides active`, and `Ready` remain when the current state is valid.

### Result Pane Recovery

The RFQ result pane should keep the last valid recommendation in memory during the current session.

Behavior:
- When no valid RFQ recommendation has ever been calculated, invalid or incomplete inputs render an actionable empty/error state.
- After a valid recommendation exists, later invalid edits keep the last valid quote visible.
- The stale result must be visibly marked with copy such as `Showing last valid quote. Current inputs need correction.`
- Stale result report actions should not export the old quote as if it were current. Report open, print, and Markdown actions should be disabled or hidden while the displayed result is stale.
- When the user fixes the input, the stale state clears and the live recommendation replaces the previous result.

The stale result is UI-only state. It does not persist to project files.

## Error Copy

Use direct, non-alarmist language:
- `Enter lot weight and load capacity, or provide manual billable hours.`
- `Imported process times need cycle basis or manual overrides for each imported time bucket.`
- `Target margin must be at least 0 and less than 100%.`
- `Current RFQ inputs need correction before a new quote can be calculated.`
- `Showing last valid quote. Current inputs need correction.`

Avoid language that suggests a formal commercial quote has been validated.

## State Model

Add RFQ UI-only validation/recovery state in `src/ui/main.ts`.

Recommended shape:

```ts
interface QuoteValidationViewState {
  readonly fieldMessages: Readonly<Record<string, string>>;
  readonly sectionMessages: Partial<Record<QuoteAccordionSectionId, string>>;
  readonly resultStatus: "ready" | "incomplete" | "invalid" | "stale";
  readonly summaryMessage: string;
}
```

The last valid recommendation can be held in a module-level variable:

```ts
let lastValidQuoteRecommendation: HeatTreatQuoteRecommendation | null = null;
```

This state should be recalculated on RFQ input changes and when source assumptions refresh. It should not be saved in project files.

## Rendering Rules

- `quoteNumberField`, `quoteTextField`, and `quoteSelectField` can accept optional message text or read field messages from a render context.
- Invalid controls should set `aria-invalid="true"` and `aria-describedby` pointing to the inline message.
- Inline messages should use the existing restrained workbench style: small text, danger color, no side-stripe callouts.
- Accordion headers should keep their existing layout and update only the compact status label.
- Result pane stale banner should sit above the preserved summary header. It should be a flat bordered notice, not a modal or toast.
- Report action buttons should be unavailable when the visible result is stale.

## Non-Goals

- No RFQ pricing formula changes.
- No quote model public API redesign.
- No project schema changes.
- No persisted validation UI state.
- No app-wide validation framework.
- No native dialog work in this task.
- No confidence explainer work in this task.
- No mobile sticky recommendation control in this task.
- No palette-token cleanup in this task.

## Testing

Add focused RFQ workflow coverage for:
- Invalid target margin shows an inline field message and `Check rates` status.
- Missing quote basis shows a Lot & Capacity section message and actionable result-pane empty state.
- A valid quote remains visible as stale after an invalid edit.
- Stale result copy is visible and report actions are unavailable while stale.
- Fixing the invalid input clears stale state and restores live report actions.
- Validation messages clear when the field becomes valid.

Existing quote model, quote report, preset import/export, staged accordion, and project save/load tests should continue to pass unchanged.

## Follow-Up Order

After this task, continue with the already approved sequence:
1. App-native preset save/delete dialogs.
2. Confidence explainer.
3. Mobile result-access affordance.
4. Palette-token cleanup.
