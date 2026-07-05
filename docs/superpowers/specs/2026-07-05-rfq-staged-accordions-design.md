# RFQ Staged Accordions Design

## Goal

Reduce cognitive overload in the Heat-Treat RFQ workspace without removing estimating capability. The RFQ input pane should read as a staged quoting workbench instead of a dense pricing spreadsheet, while preserving the live recommendation pane and all existing RFQ pricing behavior.

## Context

The Impeccable critique scored the current UI at 24/40 and identified RFQ cognitive overload as the first priority. The current RFQ workspace exposes source selection, lot details, rate preset controls, 11 shop-rate fields, 5 manual override fields, 4 adjustment fields, report actions, warnings, and cost output at once. That is defensible for expert use, but it makes the quote path harder to scan and weakens traceability for estimators.

`PRODUCT.md` frames HTCalc as a technical, restrained, trustworthy product workbench. `DESIGN.md` names the visual system "The Calibrated Workbench": compact, bordered, operational, and traceable. The staged RFQ design should follow that system and avoid wizard-style theatricality.

## Selected Approach

Use **Staged Accordions** inside the existing RFQ input pane.

Accordions should allow **multiple sections open at once**. This keeps expert workflows fast: estimators can keep Source, Lot, and Rates visible together, while optional adjustments can stay collapsed. It reduces clutter without forcing a single-step wizard.

## RFQ Sections

### Source & Assumptions

Open by default.

Contains:
- Source selector.
- Process summary field.
- Compact imported-assumptions summary when the source is ADI, steel austempering, or martempering.

Header status examples:
- `Imported` for recipe-backed quotes.
- `Manual` for manual quotes.
- `Needs source` only if future validation introduces a missing-source state.

### Lot & Capacity

Open by default.

Contains:
- Quantity.
- Piece weight.
- Total weight.
- Load capacity.
- Labor/load.
- Cycle override.

Header status examples:
- `6 fields`.
- `Cycle override` when an override is present.

### Shop Rates

Open by default.

Contains:
- Existing rate preset controls.
- Grouped shop-rate fields.

Rate field groups:
- Fixed charges: minimum lot, setup/admin, inspection, handling/packaging.
- Hourly/equipment: labor rate, furnace rate, bath/quench rate, temper rate.
- Consumables: consumables per kg.
- Margin policy: overhead, margin.

Header status examples:
- Selected preset name when available.
- `No preset` when no preset is selected.
- `11 rates`.

### Overrides & Adjustments

Collapsed by default.

Contains:
- Manual billable furnace hours.
- Manual billable bath/quench hours.
- Manual billable temper hours.
- Manual billable labor hours.
- Manual billable cycle count.
- Complexity factor.
- Scrap reserve.
- Expedite multiplier.
- Manual adder/discount.

Header status examples:
- `Optional` when no override/adjustment is active.
- `Overrides active` when any manual override or non-default adjustment is set.

### Review & Export Readiness

Visible as a lightweight final section. It can be open by default if it stays compact.

Contains read-only summary information only:
- Source mode and imported process label.
- Selected rate preset or `Custom rates`.
- Warning count.
- Validation checklist open count.
- Report/export boundary copy: heat-treatment service pricing only; excludes material, machining, outside services, freight, tax, and contract terms unless manually adjusted.

This section should not duplicate the full result pane. It exists to make quote readiness and export consequences visible before the user opens or downloads a report.

Header status examples:
- `Ready`.
- `Warnings`.
- `2 checks`.

## Interaction Rules

- Multiple accordion sections can be open at the same time.
- Source & Assumptions, Lot & Capacity, and Shop Rates start open.
- Overrides & Adjustments starts collapsed.
- Review & Export Readiness starts visible and compact.
- Toggling a section must not reset inputs, selected presets, imported assumptions, or recommendation state.
- Accordions must use real buttons for headers and expose `aria-expanded`.
- Collapsed headers must show enough status that the user does not need to remember what is inside.
- Existing field controls should remain inline in the same input pane; do not move pricing edits into modal dialogs.
- The result pane remains live and keeps the current recommendation/report actions.

## Visual Treatment

Follow `DESIGN.md`:
- Flat workbench surfaces.
- Steel borders.
- 6-8px radii.
- Calibration Teal only for active/focus/primary emphasis.
- Compact title typography.

Each accordion header should be a single predictable row:
- Left: icon and section title.
- Middle or right: compact status label.
- Far right: chevron indicator.

Do not use nested cards inside the accordion body. Use section spacing, subheadings, and field grids instead.

## State Model

Accordion open/closed state can be UI-only state in `src/ui/main.ts`. It does not need to persist in project files.

Recommended defaults:

```ts
{
  source: true,
  lot: true,
  rates: true,
  adjustments: false,
  review: true,
}
```

Open state should survive ordinary workspace re-renders in the current session. It may reset on full page reload.

## Non-Goals

- No RFQ pricing formula changes.
- No project schema changes.
- No rate preset storage changes.
- No new validation model.
- No single-open wizard behavior.
- No app-native dialog rewrite in this task.
- No mobile-specific sticky recommendation control in this task; that remains a follow-up from the critique.

## Testing

Add focused UI workflow coverage that proves:
- RFQ renders staged accordion sections.
- Source & Assumptions, Lot & Capacity, Shop Rates, and Review & Export Readiness are initially open.
- Overrides & Adjustments is initially collapsed.
- Expanding/collapsing Overrides & Adjustments reveals and hides existing override fields.
- Toggling sections does not lose entered values.
- Existing rate preset save/apply/import/export/delete workflow still works after staging.

Existing quote model, quote report, and preset helper tests should continue to pass unchanged.

## Open Follow-Ups

- Field-local validation and stale-result recovery.
- App-native preset save/delete dialogs.
- Confidence explainer.
- Mobile result-access affordance.
- Palette-token cleanup for detector advisory colors.
