# Heat-Treat RFQ Pricing Design

## Goal

Add a Heat-Treat RFQ pricing mode that estimates heat-treatment service pricing only. The model should produce an auditable recommended lot price, unit price, and price per weight from shop-specific rates entered by the user.

The RFQ mode should import useful assumptions from the existing ADI, steel austempering, and martempering recipe tabs when possible. Recipes provide process effort and risk context; the RFQ mode owns commercial pricing.

## Non-Goals

- Full manufactured part pricing.
- Raw material, machining, tooling, coating, freight, tax, or outside-service pricing.
- Automatic market pricing or competitor pricing.
- Accounting-system integration.
- Certified production pricing without shop calibration.
- Customer relationship management, quote approval workflow, or quote revision history.

## Users And Workflow

The intended user is a heat-treatment estimator, process engineer, or shop owner reviewing an RFQ. The user first creates or reviews a process recommendation in ADI, steel austempering, or martempering, then opens Heat-Treat RFQ and imports the current recipe as the quote basis.

The user can also choose a manual quote source when no process recipe is ready.

## Process Mode

Add a fourth process mode:

- `heat-treat-rfq`
- Label: `Heat-Treat RFQ`
- Status: implemented when the feature ships
- Description: heat-treatment service quote estimate

The RFQ mode should be separate from metallurgy modes. It may read their current inputs and recommendations, but it should not mutate them.

## Architecture

Add a focused `src/quote` package:

- `src/quote/types.ts`: typed RFQ input, shop rates, imported assumptions, breakdown, warnings, and recommendation output.
- `src/quote/model.ts`: deterministic cost-plus pricing calculation.
- `src/quote/adapters.ts`: imports quote assumptions from ADI, steel austempering, and martempering recommendations.
- `src/quote/index.ts`: public exports.

The quote package should follow the existing model style:

- pure TypeScript functions
- explicit validation with deterministic `RangeError` messages
- no runtime dependencies
- immutable-ish returned structures
- warnings and confidence instead of silent assumptions

## Source Modes

The RFQ source is one of:

- `adi`
- `steel-austempering`
- `martempering`
- `manual`

Recipe imports should capture:

- source mode and process label
- estimated austenitize time in minutes
- estimated bath, quench, austemper, martemper, or equalization time in minutes
- estimated temper time and temper count when present
- process confidence
- process warnings relevant to quote risk
- validation or inspection burden hints

Imported assumptions must be displayed in the RFQ UI and must be overridable.

## RFQ Input Shape

The model input should include:

```ts
interface HeatTreatQuoteInput {
  sourceMode: "adi" | "steel-austempering" | "martempering" | "manual";
  processSummary: string;
  lot: HeatTreatQuoteLot;
  importedProcess: ImportedProcessAssumptions;
  shopRates: HeatTreatShopRates;
  adjustments: HeatTreatQuoteAdjustments;
}
```

Lot inputs:

- quantity
- piece weight in kg
- optional total weight in kg
- furnace or bath load capacity in kg
- optional manually overridden cycle count

Shop rates:

- minimum lot charge
- setup/admin charge
- labor rate per hour
- furnace rate per hour
- bath or quench rate per hour
- temper furnace rate per hour
- inspection base charge
- consumables per kg
- handling or packaging charge
- overhead percent
- target margin percent

Adjustments:

- complexity factor
- scrap or rework reserve percent
- expedite multiplier
- manual adder or discount

Manual billable overrides:

- billable furnace hours
- billable bath or quench hours
- billable temper hours
- billable labor hours
- billable cycle count

Overrides are optional. When present, they replace the corresponding imported or calculated value and should be labeled as manual in the output.

## Pricing Calculation

The quote model should calculate shop cost first, then sell price.

```txt
process cost =
  setup/admin
+ furnace cycle cost
+ bath/quench cycle cost
+ temper cycle cost
+ labor cost
+ inspection/testing cost
+ consumables
+ handling/packaging
+ scrap/rework reserve

burdened cost =
  process cost + overhead

sell price =
  burdened cost / (1 - target margin)

final lot price =
  max(sell price * expedite multiplier + manual adder/discount, minimum lot charge)
```

Furnace, bath, temper, and labor costs should use billable hours multiplied by the relevant shop rate. Billable hours come from manual overrides first, then imported nominal process time multiplied by cycle count.

Complexity factor should multiply the process-time-driven buckets: furnace, bath, temper, and labor. It should not multiply fixed setup, inspection, handling, or minimum-charge values.

Scrap or rework reserve should be calculated as a percent of subtotal cost before overhead. Overhead should be calculated as `process cost * overheadPercent`. Target margin should be treated as margin on sell price, not markup on cost.

Unit price is `final lot price / quantity`.

Price per kg is `final lot price / total weight kg` when total weight is available. The UI may also display price per lb through the existing unit display helpers.

## Cycle And Time Estimation

Cycle count:

- If the user enters an override, use it.
- Otherwise calculate `ceil(totalWeightKg / loadCapacityKg)`.
- If neither total weight nor load capacity is usable, allow quote only when manual billable cycle or labor assumptions are supplied.

Imported process time:

- ADI: use austenitize soak plus austemper hold. Include a transfer/risk burden when process warnings indicate transfer, bath uniformity, atmosphere, carbide, or section risk.
- Steel austempering: use austenitize soak plus austemper hold. Add final cool and handling burden as quote warnings or labor assumptions, not metallurgical time.
- Martempering: use austenitize soak, martemper/equalization time, temper hold, and temper count.

When a recommendation provides a time window, the RFQ model should default to nominal time for pricing and expose min/max as context. Users can override billable hours in the RFQ tab.

## Output Shape

The model output should include:

- final lot price
- unit price
- price per kg when available
- cycle count
- cost breakdown by bucket
- imported assumptions
- quote warnings
- confidence
- customer-safe summary lines
- internal estimator notes

Confidence should combine quote quality and process quality:

- `green`: complete commercial inputs and green/robust imported process.
- `yellow`: missing noncritical inputs, manual assumptions, narrow process window, or notable quote-risk warnings.
- `red`: invalid imported process, impossible pricing input, missing required commercial basis, or margin/rate values that prevent a reliable quote.

## UI Design

Add a Heat-Treat RFQ tab using the existing dense workbench style.

The RFQ screen should have four compact sections:

1. Lot
   - quantity
   - piece weight
   - total weight
   - load capacity
   - cycle count override

2. Shop Rates
   - minimum lot charge
   - setup/admin
   - labor hourly rate
   - furnace hourly rate
   - bath/quench hourly rate
   - temper hourly rate
   - inspection charge
   - consumables per kg
   - handling/packaging
   - overhead percent
   - margin percent

3. Adjustments
   - complexity factor
   - scrap or rework reserve percent
   - expedite multiplier
   - manual adder or discount

4. Quote Result
   - recommended lot price
   - unit price
   - price per lb or kg
   - cycle count
   - confidence
   - warnings
   - cost breakdown
   - imported process assumptions

The source selector should offer:

- use current ADI recipe
- use current steel austempering recipe
- use current martempering recipe
- manual quote

Imported assumptions should be visibly labeled and editable or overridable. The UI should avoid hiding the source of quote values.

## Project State

Increment the project-state version when implementation occurs.

Persist:

- active RFQ source mode
- RFQ lot inputs
- shop rates
- adjustments
- manual overrides
- latest imported assumptions
- validation checklist state for RFQ mode

Older project files should migrate with default RFQ input and no selected imported source.

## Reports

Add RFQ Markdown export.

The report should include:

- customer name and part name
- process source
- quantity and total weight
- lot price
- unit price
- price per weight
- quote assumptions
- pricing warnings
- process warnings that affect quote confidence

The report should support a customer-safe summary and an internal cost breakdown. If the current report system only supports one Markdown export initially, include the internal breakdown under a clearly labeled "Internal Cost Breakdown" section.

## Validation And Error Handling

Reject:

- negative quantities, weights, rates, or time values
- zero quantity
- load capacity less than or equal to zero when cycle count is being calculated
- target margin less than 0 or greater than or equal to 100 percent
- overhead less than 0
- expedite multiplier less than or equal to zero
- complexity factor less than or equal to zero

Allow with warning:

- manual quote source
- missing total weight when manual cycle and labor values are supplied
- red or invalid imported process recommendation
- missing inspection charge
- manual adder or discount

The minimum lot charge must always be enforced.

## Tests

Add focused tests for:

- cost bucket math
- minimum lot charge enforcement
- margin calculation
- overhead calculation
- expedite multiplier
- manual adder and discount
- cycle count from total weight and load capacity
- invalid input rejection
- ADI adapter assumptions
- steel austempering adapter assumptions
- martempering adapter assumptions
- project-state migration defaults
- report markdown output
- RFQ source switching and imported-assumption rendering helpers

## Acceptance Criteria

- A user can create a heat-treatment service quote from the current ADI, steel austempering, or martempering recommendation.
- A user can create a manual heat-treatment quote.
- The quote shows lot price, unit price, price per weight, cost breakdown, warnings, and confidence.
- Shop-specific rates are entered by the user and saved in project files.
- Imported assumptions are visible and overridable.
- Invalid commercial inputs produce deterministic validation errors.
- Existing ADI and steel process behavior remains unchanged.
- Automated tests cover model math, recipe adapters, project-state migration, and report serialization.
