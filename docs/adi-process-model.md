# ADI Process Model

HTCalc's ADI model recommends conservative starting windows for austempered ductile iron heat treatment. It is a deterministic heuristic model for process planning, not a certification recipe.

## Inputs

The model requires:

- ASTM A897 target grade.
- Composition in weight percent: C, Si, Mn, Cu, Ni, Mo, Cr, Mg, P, and S.
- Casting section geometry, especially the critical section thickness.
- Starting microstructure, carbide presence, nodularity, and nodule count when known.
- Furnace, atmosphere, transfer, austemper bath, agitation, and bath-uniformity data.
- Process priority: strength, ductility, impact, wear, fatigue, or machinability.

## Outputs

The model returns:

- Austenitizing temperature range and nominal set point.
- Soak time after the critical-section core reaches temperature.
- Carbon-potential guidance for neutral furnace control.
- Transfer-time comparison.
- Austempering temperature range and nominal set point.
- Austempering minimum, nominal, and maximum hold after the core reaches bath temperature.
- Austemperability, carbide/segregation, atmosphere, and section scores.
- Warnings, validation checks, confidence level, and processing-window status.

## Formula Summary

The section factor uses 25 mm as a reference:

```txt
SectionFactor = sqrt(criticalSectionMm / 25)
```

Austemperability estimates whether the casting can avoid pearlite during transfer and quench:

```txt
AI = 1.0
  + 0.35*Ni
  + 0.25*Cu
  + 0.90*Mo
  + 0.45*Mn
  + 0.60*Cr
  - 0.04*criticalSectionMm
  - 0.02*transferTimeSec
  - agitationPenalty
```

The agitation penalty is 0.4 for poor agitation, 0.2 for fair agitation, and 0 for good agitation.

Required austemperability for the section is:

```txt
RequiredAI = 0.25 + 0.015*criticalSectionMm
```

Carbide and segregation risk penalizes Mn, Mo, Cr, their interactions, section size, and phosphorus:

```txt
CSR = 1.0*Mo
  + 0.8*Mn
  + 1.2*Cr
  + 2.0*Mo*Mn
  + 2.0*Mo*Cr
  + 1.5*Mn*Cr
  + 0.01*criticalSectionMm
  + 2.0*P
```

Austenitizing starts from grade:

```txt
T_gamma_base_C = 925 - 12*(gradeIndex - 1)
```

The model adjusts that base by adding 10 C for each percent Si above 2.5, adding 5 C per unit of section factor above 1, adding 10 C for a ferritic starting matrix, adding 15 C when carbides are present, and subtracting 10 C when dimensional growth is sensitive. The result is clamped to 840-950 C.

Austenitizing soak starts at 60 minutes after the critical-section core reaches temperature. The model adds 20 minutes per unit of section factor above 1, 20 minutes for a ferritic starting matrix, 15 minutes when Si is above 3.0%, 15 minutes when Ni + Cu + Mo + Mn is above 2.0%, and 30 minutes when carbides are present. The result is clamped to 45-180 minutes.

Austempering starts from grade base temperatures:

```txt
110-70-11: 385 C
130-90-09: 370 C
150-110-07: 350 C
175-125-04: 325 C
200-155-02: 300 C
230-185-01: 275 C
```

The model adds 10 C for ductility or impact priority, subtracts 10 C for wear or strength priority, adds 10 C when carbide/segregation risk is high, and adds 5 C for high-strength heavy sections. The result is clamped to 250-400 C.

Minimum austempering hold is:

```txt
tA_base_min = 60 * exp((385 - T_austemper_C) / 95)
tA_min = tA_base_min
  * (1 + 0.25*max(0, max(1, SectionFactor) - 1))
  * (1 + 0.15*Mn + 0.20*Mo + 0.05*Ni + 0.05*Cu)
```

Maximum hold is `1.8*tA_min`, reduced to `1.3*tA_min` when carbide/segregation risk is high.

## Carbon Potential

The model does not calculate ductile-iron matrix carbon from total carbon. Graphite nodules buffer carbon internally, and furnace carbon potential depends on gas chemistry, oxygen-probe calibration, dew point, furnace design, and plant practice.

HTCalc returns a neutral furnace-control starting category:

- Below 870 C: 0.80-0.90%C equivalent.
- 870-910 C: 0.85-0.95%C equivalent.
- Above 910 C: 0.90-1.05%C equivalent.

These are control starting points only. Validate with ductile-iron coupons, surface microstructure, and surface hardness traverse when needed.

## Confidence Levels

- `green`: no warning rules apply and the processing window is robust.
- `yellow`: at least one caution applies, such as transfer delay, high carbide/segregation risk, starting carbides, atmosphere validation, thin-section surface risk, heavy-section risk, chromium caution, or bath-control risk.
- `red`: a high-risk condition applies, such as insufficient austemperability for the section, extreme carbide/segregation risk with an invalid window, poor graphite quality, air atmosphere, elevated residuals, or another red confidence gate.

## Required Validation

Any new recipe requires:

- Tensile test to ASTM A897.
- Brinell hardness test.
- Metallography for nodularity, nodule count, ausferrite, pearlite, martensite, carbides, and surface decarburization.
- Surface hardness or microhardness traverse when atmosphere risk or fatigue priority exists.
- Impact testing when impact priority or service requirements demand it.
- Dimensional growth measurement on representative parts or coupons for machined or tolerance-sensitive parts.
- Instrumented trial coupon or core-temperature verification for heavy critical sections.

## Limitations

This model is a first-pass rule set. It does not simulate heat transfer, diffusion, local segregation, furnace gas chemistry, or true CCT/TTT behavior. It does not certify that a casting meets ASTM A897 or any customer specification. Calibrate the coefficients and thresholds with plant trials, tensile bars, hardness data, metallography, and dimensional measurements before treating recommendations as production-capable.
