# ADI Calculation Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested TypeScript calculation core that recommends conservative austempered ductile iron process windows from composition, geometry, target grade, microstructure, and equipment inputs.

**Architecture:** The package exposes one public function, `recommendAdiProcess(input)`, from `src/adi/index.ts`. Static ASTM grade data lives in `data.ts`, public contracts live in `types.ts`, calculation math lives in `model.ts`, and warning/confidence rules live in `validation.ts`.

**Tech Stack:** TypeScript, Vitest, Node package scripts, strict `tsconfig`.

---

## File Map

- `package.json`: package metadata and scripts for `build`, `typecheck`, and `test`.
- `tsconfig.json`: strict TypeScript compiler settings.
- `vitest.config.ts`: Vitest configuration.
- `src/adi/types.ts`: shared enums, input types, output types, and helper types.
- `src/adi/data.ts`: ASTM grade metadata, baseline temperature windows, and threshold constants.
- `src/adi/model.ts`: deterministic ADI recommendation calculations.
- `src/adi/validation.ts`: warning rules, processing-window status, validation checks, and confidence classification.
- `src/adi/index.ts`: public exports.
- `test/adi-model.test.ts`: behavioral tests for grade trends, section effects, alloy risk, atmosphere risk, nodularity, and output ranges.
- `docs/adi-process-model.md`: concise user-facing model documentation.

---

### Task 1: Package Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/adi/index.ts`
- Create: `test/adi-model.test.ts`

- [ ] **Step 1: Add a failing smoke test**

Create `test/adi-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recommendAdiProcess } from "../src/adi/index.js";

describe("recommendAdiProcess", () => {
  it("returns the selected ASTM grade in the recommendation", () => {
    const result = recommendAdiProcess({
      composition: {
        C: 3.6,
        Si: 2.5,
        Mn: 0.25,
        Cu: 0.7,
        Ni: 0.6,
        Mo: 0.15,
        Cr: 0.03,
        Mg: 0.04,
        P: 0.02,
        S: 0.01,
      },
      geometry: {
        maxSectionMm: 30,
        minSectionMm: 8,
        criticalSectionMm: 25,
      },
      microstructure: {
        startingMatrix: "ferritic-pearlitic",
        carbidesPresent: false,
        noduleCountPerMm2: 120,
        nodularityPercent: 90,
      },
      target: {
        grade: "150-110-07",
        priority: "strength",
      },
      equipment: {
        furnaceType: "controlled-atmosphere",
        atmosphereType: "endothermic-neutral",
        carbonPotentialControl: true,
        quenchTransferTimeSec: 8,
        austemperBathType: "salt",
        bathAgitation: "good",
        bathUniformityC: 5,
      },
    });

    expect(result.expectedGrade).toBe("150-110-07");
  });
});
```

- [ ] **Step 2: Add package configuration**

Create `package.json`:

```json
{
  "name": "htcalc",
  "version": "0.1.0",
  "description": "Heat treatment calculation utilities, starting with austempered ductile iron process windows.",
  "type": "module",
  "main": "dist/adi/index.js",
  "types": "dist/adi/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "typescript": "^5.5.0",
    "vitest": "^1.6.0"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
  "exclude": ["dist", "node_modules"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add a temporary public API stub**

Create `src/adi/index.ts`:

```ts
export function recommendAdiProcess(input: { target: { grade: string } }) {
  return {
    expectedGrade: input.target.grade,
  };
}
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` is created and npm reports no fatal errors.

- [ ] **Step 5: Run the smoke test**

Run: `npm test`

Expected: PASS for `returns the selected ASTM grade in the recommendation`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts src/adi/index.ts test/adi-model.test.ts
git commit -m "chore: initialize TypeScript package"
```

---

### Task 2: Types and ASTM Data

**Files:**
- Create: `src/adi/types.ts`
- Create: `src/adi/data.ts`
- Modify: `src/adi/index.ts`
- Modify: `test/adi-model.test.ts`

- [ ] **Step 1: Replace the smoke test with grade metadata tests**

Replace `test/adi-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ASTM_A897_GRADES, getGradeData, recommendAdiProcess } from "../src/adi/index.js";

const baseInput = {
  composition: {
    C: 3.6,
    Si: 2.5,
    Mn: 0.25,
    Cu: 0.7,
    Ni: 0.6,
    Mo: 0.15,
    Cr: 0.03,
    Mg: 0.04,
    P: 0.02,
    S: 0.01,
  },
  geometry: {
    maxSectionMm: 30,
    minSectionMm: 8,
    criticalSectionMm: 25,
  },
  microstructure: {
    startingMatrix: "ferritic-pearlitic",
    carbidesPresent: false,
    noduleCountPerMm2: 120,
    nodularityPercent: 90,
  },
  target: {
    grade: "150-110-07",
    priority: "strength",
  },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonPotentialControl: true,
    quenchTransferTimeSec: 8,
    austemperBathType: "salt",
    bathAgitation: "good",
    bathUniformityC: 5,
  },
} as const;

describe("ASTM A897 grade data", () => {
  it("orders grades from ductile to high-strength behavior", () => {
    expect(ASTM_A897_GRADES.map((grade) => grade.grade)).toEqual([
      "110-70-11",
      "130-90-09",
      "150-110-07",
      "175-125-04",
      "200-155-02",
      "230-185-01",
    ]);
  });

  it("returns grade metadata by grade id", () => {
    expect(getGradeData("200-155-02")).toMatchObject({
      grade: "200-155-02",
      gradeIndex: 5,
      tensileStrengthKsi: 200,
      yieldStrengthKsi: 155,
      elongationPercent: 2,
    });
  });
});

describe("recommendAdiProcess", () => {
  it("returns the selected ASTM grade in the recommendation", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.expectedGrade).toBe("150-110-07");
  });
});
```

- [ ] **Step 2: Run test to verify missing exports fail**

Run: `npm test`

Expected: FAIL with missing exports for `ASTM_A897_GRADES` and `getGradeData`.

- [ ] **Step 3: Add public types**

Create `src/adi/types.ts`:

```ts
export type AstmA897Grade =
  | "110-70-11"
  | "130-90-09"
  | "150-110-07"
  | "175-125-04"
  | "200-155-02"
  | "230-185-01";

export type ProcessPriority =
  | "strength"
  | "ductility"
  | "impact"
  | "wear"
  | "fatigue"
  | "machinability";

export type StartingMatrix = "ferritic" | "pearlitic" | "ferritic-pearlitic";

export type FurnaceType =
  | "controlled-atmosphere"
  | "air"
  | "vacuum"
  | "inert"
  | "salt";

export type AtmosphereType =
  | "endothermic-neutral"
  | "nitrogen-methanol"
  | "nitrogen-hydrocarbon"
  | "vacuum"
  | "inert"
  | "air"
  | "salt"
  | "unknown";

export type BathAgitation = "poor" | "fair" | "good";
export type AustemperBathType = "salt" | "fluidized-bed" | "other";
export type ConfidenceLevel = "green" | "yellow" | "red";
export type ProcessingWindowStatus = "robust" | "narrow" | "invalid";

export interface Composition {
  C: number;
  Si: number;
  Mn: number;
  Cu: number;
  Ni: number;
  Mo: number;
  Cr: number;
  Mg: number;
  P: number;
  S: number;
}

export interface CastingGeometry {
  maxSectionMm: number;
  minSectionMm: number;
  criticalSectionMm: number;
  estimatedMassKg?: number;
  surfaceAreaToVolumeRatio?: number;
}

export interface StartingMicrostructure {
  startingMatrix: StartingMatrix;
  carbidesPresent: boolean;
  noduleCountPerMm2?: number;
  nodularityPercent?: number;
  segregationRiskKnown?: boolean;
  chillTendencyKnown?: boolean;
}

export interface ProcessTarget {
  grade: AstmA897Grade;
  priority: ProcessPriority;
  dimensionalGrowthSensitive?: boolean;
}

export interface EquipmentProfile {
  furnaceType: FurnaceType;
  atmosphereType: AtmosphereType;
  carbonPotentialControl: boolean;
  quenchTransferTimeSec: number;
  austemperBathType: AustemperBathType;
  bathAgitation: BathAgitation;
  bathUniformityC: number;
}

export interface AdiProcessInput {
  composition: Composition;
  geometry: CastingGeometry;
  microstructure: StartingMicrostructure;
  target: ProcessTarget;
  equipment: EquipmentProfile;
}

export interface AstmGradeData {
  grade: AstmA897Grade;
  gradeIndex: 1 | 2 | 3 | 4 | 5 | 6;
  tensileStrengthKsi: number;
  yieldStrengthKsi: number;
  elongationPercent: number;
  typicalHardnessHbw: string;
  processDirection: string;
  austenitizeRangeC: [number, number];
  austemperRangeC: [number, number];
  soakRangeMin: [number, number];
  holdRangeMin: [number, number];
}

export interface TemperatureWindow {
  minC: number;
  nominalC: number;
  maxC: number;
  minF: number;
  nominalF: number;
  maxF: number;
}

export interface TimeWindow {
  minMin: number;
  nominalMin: number;
  maxMin: number;
}

export interface CarbonPotentialRecommendation {
  category: "low" | "medium" | "high" | "equipment-calibrated";
  rangeCarbonEquivalentPercent?: [number, number];
  guidance: string;
}

export interface AdiScores {
  sectionFactor: number;
  austemperabilityIndex: number;
  requiredAustemperabilityIndex: number;
  carbideSegregationRisk: number;
  atmosphereRisk: 0 | 1 | 2 | 3;
}

export interface AdiProcessRecommendation {
  expectedGrade: AstmA897Grade;
  austenitize: {
    temperature: TemperatureWindow;
    soakAfterCoreAtTemp: TimeWindow;
    totalFurnaceTimeNote: string;
    carbonPotential: CarbonPotentialRecommendation;
  };
  transfer: {
    maxRecommendedTransferTimeSec: number;
    actualTransferTimeSec: number;
  };
  austemper: {
    temperature: TemperatureWindow;
    holdAfterCoreAtTemp: TimeWindow;
    processingWindowStatus: ProcessingWindowStatus;
  };
  scores: AdiScores;
  confidence: ConfidenceLevel;
  warnings: string[];
  validationChecks: string[];
}
```

- [ ] **Step 4: Add ASTM grade data**

Create `src/adi/data.ts`:

```ts
import type { AstmA897Grade, AstmGradeData } from "./types.js";

export const ASTM_A897_GRADES: AstmGradeData[] = [
  {
    grade: "110-70-11",
    gradeIndex: 1,
    tensileStrengthKsi: 110,
    yieldStrengthKsi: 70,
    elongationPercent: 11,
    typicalHardnessHbw: "lower",
    processDirection: "Highest ductility, upper austemper range",
    austenitizeRangeC: [900, 930],
    austemperRangeC: [370, 400],
    soakRangeMin: [60, 120],
    holdRangeMin: [60, 120],
  },
  {
    grade: "130-90-09",
    gradeIndex: 2,
    tensileStrengthKsi: 130,
    yieldStrengthKsi: 90,
    elongationPercent: 9,
    typicalHardnessHbw: "269-341",
    processDirection: "Ductile structural ADI",
    austenitizeRangeC: [890, 920],
    austemperRangeC: [350, 385],
    soakRangeMin: [60, 120],
    holdRangeMin: [60, 135],
  },
  {
    grade: "150-110-07",
    gradeIndex: 3,
    tensileStrengthKsi: 150,
    yieldStrengthKsi: 110,
    elongationPercent: 7,
    typicalHardnessHbw: "302-375",
    processDirection: "Balanced strength and ductility",
    austenitizeRangeC: [870, 910],
    austemperRangeC: [330, 370],
    soakRangeMin: [60, 135],
    holdRangeMin: [75, 150],
  },
  {
    grade: "175-125-04",
    gradeIndex: 4,
    tensileStrengthKsi: 175,
    yieldStrengthKsi: 125,
    elongationPercent: 4,
    typicalHardnessHbw: "341-444",
    processDirection: "High strength",
    austenitizeRangeC: [860, 900],
    austemperRangeC: [300, 345],
    soakRangeMin: [75, 150],
    holdRangeMin: [90, 180],
  },
  {
    grade: "200-155-02",
    gradeIndex: 5,
    tensileStrengthKsi: 200,
    yieldStrengthKsi: 155,
    elongationPercent: 2,
    typicalHardnessHbw: "388-477",
    processDirection: "Very high strength and hardness",
    austenitizeRangeC: [850, 890],
    austemperRangeC: [275, 320],
    soakRangeMin: [90, 165],
    holdRangeMin: [120, 240],
  },
  {
    grade: "230-185-01",
    gradeIndex: 6,
    tensileStrengthKsi: 230,
    yieldStrengthKsi: 185,
    elongationPercent: 1,
    typicalHardnessHbw: "highest",
    processDirection: "Specialty high-hardness and low-ductility grade",
    austenitizeRangeC: [840, 880],
    austemperRangeC: [250, 290],
    soakRangeMin: [90, 180],
    holdRangeMin: [150, 300],
  },
];

export const THRESHOLDS = {
  highCarbideSegregationRisk: 1.2,
  extremeCarbideSegregationRisk: 1.8,
  heavySectionMm: 50,
  veryHeavySectionMm: 75,
  thinSectionMm: 12,
  poorNodularityPercent: 80,
  lowNoduleCountPerMm2: 80,
  maxPreferredTransferTimeSec: 10,
  poorBathUniformityC: 10,
} as const;

export function getGradeData(grade: AstmA897Grade): AstmGradeData {
  const data = ASTM_A897_GRADES.find((entry) => entry.grade === grade);
  if (!data) {
    throw new Error(`Unsupported ASTM A897 grade: ${grade}`);
  }

  return data;
}
```

- [ ] **Step 5: Export types and data**

Replace `src/adi/index.ts`:

```ts
export { ASTM_A897_GRADES, getGradeData } from "./data.js";
export type * from "./types.js";

import type { AdiProcessInput } from "./types.js";

export function recommendAdiProcess(input: AdiProcessInput) {
  return {
    expectedGrade: input.target.grade,
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS for grade metadata tests and smoke recommendation test.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/adi/types.ts src/adi/data.ts src/adi/index.ts test/adi-model.test.ts
git commit -m "feat: add ADI types and grade data"
```

---

### Task 3: Core Recommendation Model

**Files:**
- Create: `src/adi/model.ts`
- Modify: `src/adi/index.ts`
- Modify: `test/adi-model.test.ts`

- [ ] **Step 1: Add behavior tests for grade trends and valid ranges**

Append these tests to `test/adi-model.test.ts`:

```ts
describe("ADI recommendation model", () => {
  it("uses higher austempering temperatures for ductile grades than high-strength grades", () => {
    const ductile = recommendAdiProcess({
      ...baseInput,
      target: { grade: "110-70-11", priority: "ductility" },
    });
    const highStrength = recommendAdiProcess({
      ...baseInput,
      target: { grade: "200-155-02", priority: "strength" },
    });

    expect(ductile.austemper.temperature.nominalC).toBeGreaterThan(
      highStrength.austemper.temperature.nominalC,
    );
    expect(highStrength.austemper.holdAfterCoreAtTemp.nominalMin).toBeGreaterThan(
      ductile.austemper.holdAfterCoreAtTemp.nominalMin,
    );
  });

  it("keeps nominal temperatures inside their recommended ranges", () => {
    const result = recommendAdiProcess(baseInput);

    expect(result.austenitize.temperature.nominalC).toBeGreaterThanOrEqual(
      result.austenitize.temperature.minC,
    );
    expect(result.austenitize.temperature.nominalC).toBeLessThanOrEqual(
      result.austenitize.temperature.maxC,
    );
    expect(result.austemper.temperature.nominalC).toBeGreaterThanOrEqual(
      result.austemper.temperature.minC,
    );
    expect(result.austemper.temperature.nominalC).toBeLessThanOrEqual(
      result.austemper.temperature.maxC,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify model fields fail**

Run: `npm test`

Expected: FAIL because the stub does not return `austemper` or `austenitize` fields.

- [ ] **Step 3: Implement model calculations**

Create `src/adi/model.ts`:

```ts
import { getGradeData, THRESHOLDS } from "./data.js";
import type {
  AdiProcessInput,
  AdiProcessRecommendation,
  CarbonPotentialRecommendation,
  TemperatureWindow,
  TimeWindow,
} from "./types.js";
import { buildWarningsAndConfidence } from "./validation.js";

const AUSTEMPER_BASE_C = {
  1: 385,
  2: 370,
  3: 350,
  4: 325,
  5: 300,
  6: 275,
} as const;

export function recommendAdiProcess(
  input: AdiProcessInput,
): AdiProcessRecommendation {
  const grade = getGradeData(input.target.grade);
  const sectionFactor = Math.sqrt(input.geometry.criticalSectionMm / 25);
  const austemperabilityIndex = calculateAustemperabilityIndex(input);
  const requiredAustemperabilityIndex = requiredAiForSection(
    input.geometry.criticalSectionMm,
  );
  const carbideSegregationRisk = calculateCarbideSegregationRisk(input);
  const atmosphereRisk = calculateAtmosphereRisk(input);

  const austenitizeNominalC = calculateAustenitizeTemperatureC(input, sectionFactor);
  const austenitizeTemperature = makeTemperatureWindow(
    austenitizeNominalC,
    grade.austenitizeRangeC,
    15,
    840,
    950,
  );
  const austenitizeSoak = makeTimeWindow(
    calculateAustenitizeSoakMin(input, sectionFactor),
    grade.soakRangeMin,
    20,
    45,
    180,
  );

  const austemperNominalC = calculateAustemperTemperatureC(
    input,
    carbideSegregationRisk,
  );
  const austemperTemperature = makeTemperatureWindow(
    austemperNominalC,
    grade.austemperRangeC,
    15,
    250,
    400,
  );
  const austemperMinHold = calculateAustemperHoldMin(
    input,
    austemperTemperature.nominalC,
    sectionFactor,
  );
  const austemperMaxHold =
    carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk
      ? austemperMinHold * 1.3
      : austemperMinHold * 1.8;

  const scores = {
    sectionFactor: round(sectionFactor, 2),
    austemperabilityIndex: round(austemperabilityIndex, 2),
    requiredAustemperabilityIndex: round(requiredAustemperabilityIndex, 2),
    carbideSegregationRisk: round(carbideSegregationRisk, 2),
    atmosphereRisk,
  };

  const assessment = buildWarningsAndConfidence(input, scores, {
    austemperHoldMin: austemperMinHold,
    austemperHoldMax: austemperMaxHold,
  });

  return {
    expectedGrade: input.target.grade,
    austenitize: {
      temperature: austenitizeTemperature,
      soakAfterCoreAtTemp: austenitizeSoak,
      totalFurnaceTimeNote:
        "Total furnace time must add heat-up time until the critical section core reaches the selected austenitizing temperature.",
      carbonPotential: recommendCarbonPotential(austenitizeTemperature.nominalC),
    },
    transfer: {
      maxRecommendedTransferTimeSec: THRESHOLDS.maxPreferredTransferTimeSec,
      actualTransferTimeSec: input.equipment.quenchTransferTimeSec,
    },
    austemper: {
      temperature: austemperTemperature,
      holdAfterCoreAtTemp: {
        minMin: Math.round(austemperMinHold),
        nominalMin: Math.round((austemperMinHold + austemperMaxHold) / 2),
        maxMin: Math.round(austemperMaxHold),
      },
      processingWindowStatus: assessment.processingWindowStatus,
    },
    scores,
    confidence: assessment.confidence,
    warnings: assessment.warnings,
    validationChecks: assessment.validationChecks,
  };
}

function calculateAustemperabilityIndex(input: AdiProcessInput): number {
  const { composition: c, geometry: g, equipment: e } = input;
  const agitationPenalty = e.bathAgitation === "poor" ? 0.4 : e.bathAgitation === "fair" ? 0.2 : 0;

  return (
    1.0 +
    0.35 * c.Ni +
    0.25 * c.Cu +
    0.9 * c.Mo +
    0.45 * c.Mn +
    0.6 * c.Cr -
    0.04 * g.criticalSectionMm -
    0.02 * e.quenchTransferTimeSec -
    agitationPenalty
  );
}

function requiredAiForSection(sectionMm: number): number {
  return 0.25 + 0.015 * sectionMm;
}

function calculateCarbideSegregationRisk(input: AdiProcessInput): number {
  const { composition: c, geometry: g } = input;

  return (
    1.0 * c.Mo +
    0.8 * c.Mn +
    1.2 * c.Cr +
    2.0 * c.Mo * c.Mn +
    2.0 * c.Mo * c.Cr +
    1.5 * c.Mn * c.Cr +
    0.01 * g.criticalSectionMm +
    2.0 * c.P
  );
}

function calculateAtmosphereRisk(input: AdiProcessInput): 0 | 1 | 2 | 3 {
  const { furnaceType, atmosphereType, carbonPotentialControl } = input.equipment;

  if (furnaceType === "air" || atmosphereType === "air") {
    return 3;
  }

  if (
    furnaceType === "controlled-atmosphere" &&
    carbonPotentialControl &&
    (atmosphereType === "endothermic-neutral" ||
      atmosphereType === "nitrogen-methanol" ||
      atmosphereType === "nitrogen-hydrocarbon" ||
      atmosphereType === "salt" ||
      atmosphereType === "vacuum")
  ) {
    return 0;
  }

  if (carbonPotentialControl) {
    return 1;
  }

  if (furnaceType === "inert" || furnaceType === "vacuum") {
    return 2;
  }

  return 2;
}

function calculateAustenitizeTemperatureC(
  input: AdiProcessInput,
  sectionFactor: number,
): number {
  const grade = getGradeData(input.target.grade);
  let temperature = 925 - 12 * (grade.gradeIndex - 1);

  temperature += 10 * Math.max(0, input.composition.Si - 2.5);
  temperature += 5 * Math.max(0, sectionFactor - 1);

  if (input.microstructure.startingMatrix === "ferritic") {
    temperature += 10;
  }

  if (input.microstructure.carbidesPresent) {
    temperature += 15;
  }

  if (input.target.dimensionalGrowthSensitive) {
    temperature -= 10;
  }

  return clamp(temperature, 840, 950);
}

function calculateAustenitizeSoakMin(
  input: AdiProcessInput,
  sectionFactor: number,
): number {
  const alloyTotal =
    input.composition.Ni +
    input.composition.Cu +
    input.composition.Mo +
    input.composition.Mn;
  let soak = 60 + 20 * Math.max(0, sectionFactor - 1);

  if (input.microstructure.startingMatrix === "ferritic") {
    soak += 20;
  }

  if (input.composition.Si > 3.0) {
    soak += 15;
  }

  if (alloyTotal > 2.0) {
    soak += 15;
  }

  if (input.microstructure.carbidesPresent) {
    soak += 30;
  }

  return clamp(soak, 45, 180);
}

function calculateAustemperTemperatureC(
  input: AdiProcessInput,
  carbideSegregationRisk: number,
): number {
  const grade = getGradeData(input.target.grade);
  let temperature = AUSTEMPER_BASE_C[grade.gradeIndex];

  if (input.target.priority === "ductility" || input.target.priority === "impact") {
    temperature += 10;
  }

  if (input.target.priority === "wear" || input.target.priority === "strength") {
    temperature -= 10;
  }

  if (carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk) {
    temperature += 10;
  }

  if (
    input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm &&
    grade.gradeIndex >= 4
  ) {
    temperature += 5;
  }

  return clamp(temperature, 250, 400);
}

function calculateAustemperHoldMin(
  input: AdiProcessInput,
  austemperTemperatureC: number,
  sectionFactor: number,
): number {
  const base = 60 * Math.exp((385 - austemperTemperatureC) / 95);
  const sectionMultiplier = 1 + 0.25 * Math.max(0, sectionFactor - 1);
  const alloyMultiplier =
    1 +
    0.15 * input.composition.Mn +
    0.2 * input.composition.Mo +
    0.05 * input.composition.Ni +
    0.05 * input.composition.Cu;

  return base * sectionMultiplier * alloyMultiplier;
}

function recommendCarbonPotential(
  austenitizeTemperatureC: number,
): CarbonPotentialRecommendation {
  if (austenitizeTemperatureC < 870) {
    return {
      category: "low",
      rangeCarbonEquivalentPercent: [0.8, 0.9],
      guidance:
        "Use a neutral furnace-control starting point and validate with ductile-iron coupons; this is not the ductile-iron matrix carbon level.",
    };
  }

  if (austenitizeTemperatureC <= 910) {
    return {
      category: "medium",
      rangeCarbonEquivalentPercent: [0.85, 0.95],
      guidance:
        "Use a neutral furnace-control starting point and verify no decarburized ferrite layer or carburized surface forms.",
    };
  }

  return {
    category: "high",
    rangeCarbonEquivalentPercent: [0.9, 1.05],
    guidance:
      "Use a neutral to slightly protective furnace-control starting point; calibrate with coupons and surface microhardness.",
  };
}

function makeTemperatureWindow(
  nominalC: number,
  baselineRangeC: [number, number],
  spreadC: number,
  lowerClampC: number,
  upperClampC: number,
): TemperatureWindow {
  const minC = clamp(Math.min(nominalC - spreadC, baselineRangeC[0]), lowerClampC, upperClampC);
  const maxC = clamp(Math.max(nominalC + spreadC, baselineRangeC[1]), lowerClampC, upperClampC);
  const clampedNominalC = clamp(nominalC, minC, maxC);

  return {
    minC: Math.round(minC),
    nominalC: Math.round(clampedNominalC),
    maxC: Math.round(maxC),
    minF: cToF(minC),
    nominalF: cToF(clampedNominalC),
    maxF: cToF(maxC),
  };
}

function makeTimeWindow(
  nominalMin: number,
  baselineRangeMin: [number, number],
  spreadMin: number,
  lowerClampMin: number,
  upperClampMin: number,
): TimeWindow {
  const minMin = clamp(
    Math.min(nominalMin - spreadMin, baselineRangeMin[0]),
    lowerClampMin,
    upperClampMin,
  );
  const maxMin = clamp(
    Math.max(nominalMin + spreadMin, baselineRangeMin[1]),
    lowerClampMin,
    upperClampMin,
  );
  const clampedNominalMin = clamp(nominalMin, minMin, maxMin);

  return {
    minMin: Math.round(minMin),
    nominalMin: Math.round(clampedNominalMin),
    maxMin: Math.round(maxMin),
  };
}

function cToF(valueC: number): number {
  return Math.round((valueC * 9) / 5 + 32);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
```

- [ ] **Step 4: Add temporary validation implementation**

Create `src/adi/validation.ts`:

```ts
import type {
  AdiProcessInput,
  AdiScores,
  ConfidenceLevel,
  ProcessingWindowStatus,
} from "./types.js";

export interface WindowInputs {
  austemperHoldMin: number;
  austemperHoldMax: number;
}

export interface Assessment {
  warnings: string[];
  validationChecks: string[];
  confidence: ConfidenceLevel;
  processingWindowStatus: ProcessingWindowStatus;
}

export function buildWarningsAndConfidence(
  _input: AdiProcessInput,
  _scores: AdiScores,
  window: WindowInputs,
): Assessment {
  return {
    warnings: [],
    validationChecks: [
      "Tensile test to ASTM A897.",
      "Brinell hardness test.",
      "Metallography for ausferrite, pearlite, martensite, carbides, nodularity, nodule count, and surface decarburization.",
    ],
    confidence: "yellow",
    processingWindowStatus:
      window.austemperHoldMax / window.austemperHoldMin < 1.4 ? "narrow" : "robust",
  };
}
```

- [ ] **Step 5: Export model function**

Replace `src/adi/index.ts`:

```ts
export { ASTM_A897_GRADES, getGradeData } from "./data.js";
export { recommendAdiProcess } from "./model.js";
export type * from "./types.js";
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/adi/model.ts src/adi/validation.ts src/adi/index.ts test/adi-model.test.ts
git commit -m "feat: calculate ADI process windows"
```

---

### Task 4: Warning and Confidence Rules

**Files:**
- Modify: `src/adi/validation.ts`
- Modify: `test/adi-model.test.ts`

- [ ] **Step 1: Add risk behavior tests**

Append these tests to `test/adi-model.test.ts`:

```ts
describe("ADI warning and confidence rules", () => {
  it("warns when a heavy section lacks enough austemperability", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      composition: {
        ...baseInput.composition,
        Cu: 0.1,
        Ni: 0.1,
        Mo: 0.02,
        Mn: 0.15,
      },
      geometry: {
        maxSectionMm: 90,
        minSectionMm: 20,
        criticalSectionMm: 80,
      },
      equipment: {
        ...baseInput.equipment,
        quenchTransferTimeSec: 18,
        bathAgitation: "fair",
      },
    });

    expect(result.warnings).toContain(
      "Pearlite risk: austemperability is low for the selected critical section and transfer conditions.",
    );
    expect(result.confidence).toBe("red");
  });

  it("warns when Mn, Mo, and Cr create high carbide segregation risk", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      composition: {
        ...baseInput.composition,
        Mn: 0.65,
        Mo: 0.35,
        Cr: 0.2,
      },
    });

    expect(result.warnings).toContain(
      "High carbide/segregation risk: Mn, Mo, Cr, and section effects may produce cell-boundary carbides or martensite.",
    );
    expect(result.austemper.processingWindowStatus).toBe("narrow");
  });

  it("warns for air furnaces and uncontrolled atmosphere", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      equipment: {
        ...baseInput.equipment,
        furnaceType: "air",
        atmosphereType: "air",
        carbonPotentialControl: false,
      },
    });

    expect(result.warnings).toContain(
      "Atmosphere risk: air or uncontrolled atmosphere can scale or decarburize the surface.",
    );
    expect(result.confidence).toBe("red");
  });

  it("degrades confidence for poor nodularity", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      microstructure: {
        ...baseInput.microstructure,
        noduleCountPerMm2: 50,
        nodularityPercent: 72,
      },
    });

    expect(result.warnings).toContain(
      "Graphite quality risk: low nodule count or poor nodularity can make the recommendation unreliable.",
    );
    expect(result.confidence).toBe("red");
  });
});
```

- [ ] **Step 2: Run tests to verify warnings fail**

Run: `npm test`

Expected: FAIL because the temporary validation implementation does not emit these warnings.

- [ ] **Step 3: Implement validation rules**

Replace `src/adi/validation.ts`:

```ts
import { getGradeData, THRESHOLDS } from "./data.js";
import type {
  AdiProcessInput,
  AdiScores,
  ConfidenceLevel,
  ProcessingWindowStatus,
} from "./types.js";

export interface WindowInputs {
  austemperHoldMin: number;
  austemperHoldMax: number;
}

export interface Assessment {
  warnings: string[];
  validationChecks: string[];
  confidence: ConfidenceLevel;
  processingWindowStatus: ProcessingWindowStatus;
}

export function buildWarningsAndConfidence(
  input: AdiProcessInput,
  scores: AdiScores,
  window: WindowInputs,
): Assessment {
  const warnings: string[] = [];
  let redFlag = false;
  let yellowFlag = true;

  if (scores.austemperabilityIndex < scores.requiredAustemperabilityIndex) {
    warnings.push(
      "Pearlite risk: austemperability is low for the selected critical section and transfer conditions.",
    );
    redFlag = true;
  }

  if (input.equipment.quenchTransferTimeSec > THRESHOLDS.maxPreferredTransferTimeSec) {
    warnings.push(
      "Transfer risk: quench transfer time is longer than the preferred ADI transfer window.",
    );
    yellowFlag = true;
  }

  if (scores.carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk) {
    warnings.push(
      "High carbide/segregation risk: Mn, Mo, Cr, and section effects may produce cell-boundary carbides or martensite.",
    );
    yellowFlag = true;
  }

  if (scores.carbideSegregationRisk > THRESHOLDS.extremeCarbideSegregationRisk) {
    redFlag = true;
  }

  if (input.microstructure.carbidesPresent) {
    warnings.push(
      "Starting carbide risk: existing carbides may not be fully corrected by heat treatment and require metallographic validation.",
    );
    yellowFlag = true;
  }

  const noduleCount = input.microstructure.noduleCountPerMm2;
  const nodularity = input.microstructure.nodularityPercent;
  if (
    (typeof noduleCount === "number" && noduleCount < THRESHOLDS.lowNoduleCountPerMm2) ||
    (typeof nodularity === "number" && nodularity < THRESHOLDS.poorNodularityPercent)
  ) {
    warnings.push(
      "Graphite quality risk: low nodule count or poor nodularity can make the recommendation unreliable.",
    );
    redFlag = true;
  }

  if (scores.atmosphereRisk >= 2) {
    warnings.push(
      "Atmosphere risk: air or uncontrolled atmosphere can scale or decarburize the surface.",
    );
    if (scores.atmosphereRisk === 3) {
      redFlag = true;
    }
  } else if (scores.atmosphereRisk === 1) {
    warnings.push(
      "Atmosphere validation required: carbon potential is controlled but not proven neutral for this ductile iron.",
    );
    yellowFlag = true;
  }

  if (
    input.geometry.minSectionMm < THRESHOLDS.thinSectionMm &&
    (input.target.priority === "fatigue" || scores.atmosphereRisk > 0)
  ) {
    warnings.push(
      "Thin-section surface risk: decarburization or carburization is a larger fraction of the section.",
    );
    yellowFlag = true;
  }

  const grade = getGradeData(input.target.grade);
  if (
    grade.gradeIndex >= 5 &&
    input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm
  ) {
    warnings.push(
      "High-strength heavy-section risk: grades 200-155-02 and 230-185-01 can have a narrow processing window in heavy sections.",
    );
    yellowFlag = true;
  }

  if (input.geometry.criticalSectionMm > THRESHOLDS.veryHeavySectionMm) {
    warnings.push(
      "Very heavy section: heat-transfer simulation or instrumented trial coupons are recommended.",
    );
    yellowFlag = true;
  }

  if (input.composition.Cr > 0.1 && input.target.priority !== "wear") {
    warnings.push(
      "Chromium caution: Cr increases carbide risk in conventional ADI unless a carbidic ADI wear target is intentional.",
    );
    yellowFlag = true;
  }

  if (input.composition.P > 0.05 || input.composition.S > 0.02) {
    warnings.push(
      "Residual element risk: elevated P or S cannot be fully corrected by the ADI heat treatment.",
    );
    redFlag = true;
  }

  if (
    input.equipment.bathAgitation === "poor" ||
    input.equipment.bathUniformityC > THRESHOLDS.poorBathUniformityC
  ) {
    warnings.push(
      "Bath control risk: poor agitation or wide bath uniformity can delay core cooling and transformation.",
    );
    yellowFlag = true;
  }

  const processingWindowStatus = classifyProcessingWindow(scores, window);
  if (processingWindowStatus === "invalid") {
    redFlag = true;
  }

  const confidence: ConfidenceLevel = redFlag ? "red" : yellowFlag ? "yellow" : "green";

  return {
    warnings,
    validationChecks: buildValidationChecks(input, scores),
    confidence,
    processingWindowStatus,
  };
}

function classifyProcessingWindow(
  scores: AdiScores,
  window: WindowInputs,
): ProcessingWindowStatus {
  const widthRatio = window.austemperHoldMax / window.austemperHoldMin;

  if (
    scores.carbideSegregationRisk > THRESHOLDS.extremeCarbideSegregationRisk &&
    widthRatio < 1.35
  ) {
    return "invalid";
  }

  if (
    scores.carbideSegregationRisk > THRESHOLDS.highCarbideSegregationRisk ||
    widthRatio < 1.5
  ) {
    return "narrow";
  }

  return "robust";
}

function buildValidationChecks(
  input: AdiProcessInput,
  scores: AdiScores,
): string[] {
  const checks = [
    "Tensile test to ASTM A897.",
    "Brinell hardness test.",
    "Metallography for nodularity, nodule count, ausferrite, pearlite, martensite, carbides, and surface decarburization.",
  ];

  if (scores.atmosphereRisk > 0 || input.target.priority === "fatigue") {
    checks.push(
      "Surface hardness or microhardness traverse to verify no decarburized or carburized layer.",
    );
  }

  if (input.target.priority === "impact") {
    checks.push("Impact testing for the intended service temperature.");
  }

  if (input.target.dimensionalGrowthSensitive) {
    checks.push("Dimensional growth measurement on representative parts or coupons.");
  }

  if (input.geometry.criticalSectionMm > THRESHOLDS.heavySectionMm) {
    checks.push("Instrumented trial coupon or core-temperature verification for the critical section.");
  }

  return checks;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/adi/validation.ts test/adi-model.test.ts
git commit -m "feat: add ADI risk warnings"
```

---

### Task 5: Model Documentation

**Files:**
- Create: `docs/adi-process-model.md`
- Modify: `test/adi-model.test.ts`

- [ ] **Step 1: Add validation-check behavior tests**

Append these tests to `test/adi-model.test.ts`:

```ts
describe("ADI validation checks", () => {
  it("requires surface traverse for fatigue-critical thin sections", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      geometry: {
        maxSectionMm: 14,
        minSectionMm: 5,
        criticalSectionMm: 10,
      },
      target: {
        grade: "130-90-09",
        priority: "fatigue",
      },
    });

    expect(result.validationChecks).toContain(
      "Surface hardness or microhardness traverse to verify no decarburized or carburized layer.",
    );
  });

  it("requires dimensional growth checks when dimensional growth is sensitive", () => {
    const result = recommendAdiProcess({
      ...baseInput,
      target: {
        grade: "150-110-07",
        priority: "machinability",
        dimensionalGrowthSensitive: true,
      },
    });

    expect(result.validationChecks).toContain(
      "Dimensional growth measurement on representative parts or coupons.",
    );
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: PASS because Task 4 added these validation-check rules.

- [ ] **Step 3: Write model documentation**

Create `docs/adi-process-model.md`:

```md
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

The model adjusts for Si, section factor, ferritic starting matrix, carbide presence, and dimensional-growth sensitivity, then clamps to 840-950 C.

Austempering starts from grade base temperatures:

```txt
110-70-11: 385 C
130-90-09: 370 C
150-110-07: 350 C
175-125-04: 325 C
200-155-02: 300 C
230-185-01: 275 C
```

The model adjusts for priority, carbide/segregation risk, and heavy high-strength sections, then clamps to 250-400 C.

Minimum austempering hold is:

```txt
tA_base_min = 60 * exp((385 - T_austemper_C) / 95)
tA_min = tA_base_min
  * (1 + 0.25*max(0, SectionFactor - 1))
  * (1 + 0.15*Mn + 0.20*Mo + 0.05*Ni + 0.05*Cu)
```

Maximum hold is `1.8*tA_min`, reduced to `1.3*tA_min` when carbide/segregation risk is high.

## Carbon Potential

The model does not calculate ductile-iron matrix carbon from total carbon. Graphite nodules buffer carbon internally, and furnace carbon potential depends on gas chemistry, oxygen-probe calibration, dew point, furnace design, and plant practice.

HTCalc returns a neutral furnace-control starting category:

- 840-870 C: 0.80-0.90%C equivalent.
- 870-910 C: 0.85-0.95%C equivalent.
- 910-950 C: 0.90-1.05%C equivalent.

These are control starting points only. Validate with ductile-iron coupons, surface microstructure, and surface hardness traverse when needed.

## Confidence Levels

- `green`: no major risk warnings. Future versions should reserve this for internally validated plant data.
- `yellow`: plausible starting window, but coupon validation is required before production.
- `red`: composition, section, graphite quality, equipment, or target grade makes the recommendation unreliable without process change or validation.

## Required Validation

Any new recipe requires:

- Tensile testing to ASTM A897.
- Brinell hardness testing.
- Metallography for nodularity, nodule count, ausferrite, pearlite, martensite, carbides, and surface decarburization.
- Surface hardness or microhardness traverse when atmosphere risk or fatigue sensitivity exists.
- Impact testing when service requirements demand it.
- Dimensional growth checks for machined or tolerance-sensitive parts.
- Instrumented critical-section trials for heavy sections.

## Limitations

This model is a first-pass rule set. It does not simulate heat transfer, diffusion, local segregation, furnace gas chemistry, or true CCT/TTT behavior. Calibrate the coefficients and thresholds with plant trials, tensile bars, hardness data, metallography, and dimensional measurements before treating recommendations as production-capable.
```

- [ ] **Step 4: Run tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/adi-process-model.md test/adi-model.test.ts
git commit -m "docs: document ADI process model"
```

---

### Task 6: Final Verification

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`

Expected: TypeScript reports no errors.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: `dist/` is created with compiled JS and declarations.

- [ ] **Step 4: Inspect git status**

Run: `git status --short`

Expected: only expected generated `dist/` files may be untracked if build output is not ignored.

- [ ] **Step 5: Add build ignore if needed**

If `dist/` is untracked, create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
```

Run:

```bash
git add .gitignore
git commit -m "chore: ignore generated files"
```

- [ ] **Step 6: Final status**

Run: `git status --short --branch`

Expected: clean working tree on `main`.

