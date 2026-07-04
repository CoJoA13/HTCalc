# Heat-Treat RFQ Pricing Model

HTCalc's Heat-Treat RFQ model estimates heat-treatment service pricing from shop-specific rates entered by the user. It is a deterministic estimating aid, not an accounting system or binding commercial quote.

## Scope

The RFQ model covers heat-treatment service pricing only. It excludes raw material, machining, tooling, outside services, coating, freight, tax, and contract terms unless the estimator enters them as manual adjustments.

## Recipe Imports

The RFQ mode can import process assumptions from:

- ADI
- Steel austempering
- Martempering

Imported recipes contribute process label, nominal time windows, confidence, warnings, and validation burden hints. The RFQ mode owns price, margin, overhead, manual overrides, and customer-facing quote values.

## Pricing Method

The model calculates shop cost first:

- setup/admin
- furnace hours
- bath or quench hours
- temper hours
- labor hours
- inspection
- consumables
- handling and packaging
- scrap or rework reserve

It then applies overhead, target margin, expedite multiplier, manual adder or discount, and minimum lot charge.

## Limitations

Quote quality depends on current shop rates, accurate lot weight, realistic load capacity, inspection scope, and process validation. Imported recipe confidence affects quote confidence but does not block commercial pricing.
