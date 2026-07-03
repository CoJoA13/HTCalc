# Steel Austempering and Martempering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement steel austempering and martempering workflows with deterministic advisory models, UI integration, project persistence, and engineering-review reports.

**Architecture:** Add a focused `src/steel` model package with shared steel calculations and separate austempering/martempering recommenders. Extend existing UI wiring and project-state validation without adding dependencies or replacing the ADI workflow. Persist project state as version 3 with migration from versions 1 and 2.

**Tech Stack:** TypeScript, Vite, Vitest, existing browser DOM UI, existing Phosphor icon bundle.

---

## File Map

- Create `src/steel/types.ts`: steel input/output types and enum-like unions.
- Create `src/steel/core.ts`: shared validation, critical-temperature estimates, hardenability, hardness, tempering, and formatting-independent window helpers.
- Create `src/steel/austempering.ts`: `recommendSteelAustemperingProcess`.
- Create `src/steel/martempering.ts`: `recommendMartemperingProcess`.
- Create `src/steel/index.ts`: public exports.
- Create `src/ui/steel-report.ts`: steel report view models, Markdown serialization, and filename helpers.
- Create `src/ui/steel-state.ts`: default steel inputs and pure UI state update helpers.
- Modify `src/ui/process-modes.ts`: mark steel modes as implemented.
- Modify `src/ui/units.ts`: own the structural `TemperatureWindow` type instead of importing it from ADI.
- Modify `src/ui/project-state.ts`: version 3 state, migrations, steel defaults, steel validation, and per-mode checklists.
- Modify `src/ui/main.ts`: steel states, steel workspaces, input binding, reports, checklist reconciliation, save/load.
- Modify `tsconfig.build.json`: include `src/steel/**/*.ts` in library build.
- Add tests:
  - `test/steel-core.test.ts`
  - `test/steel-austempering.test.ts`
  - `test/martempering.test.ts`
  - `test/steel-report.test.ts`
  - `test/steel-state.test.ts`
  - update `test/process-modes.test.ts`
  - update `test/project-state.test.ts`

## Task 1: Process Mode Contract

**Files:**
- Modify: `test/process-modes.test.ts`
- Modify: `src/ui/process-modes.ts`

- [ ] **Step 1: Write the failing test**

Change the status expectations so both steel modes are implemented:

```ts
it("marks all current process families as implemented", () => {
  expect(getProcessMode("adi").status).toBe("implemented");
  expect(getProcessMode("steel-austempering").status).toBe("implemented");
  expect(getProcessMode("martempering").status).toBe("implemented");
});

it("exposes all implemented process modes", () => {
  expect(implementedProcessModes().map((mode) => mode.id)).toEqual([
    "adi",
    "steel-austempering",
    "martempering",
  ]);
  expect(plannedProcessModes()).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/process-modes.test.ts`

Expected: FAIL because steel modes are still `planned`.

- [ ] **Step 3: Implement minimal metadata change**

Set `status: "implemented"` for `steel-austempering` and `martempering` and remove planned badge expectations from the tests.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/process-modes.test.ts`

- [ ] **Step 5: Commit**

Run:

```bash
git add test/process-modes.test.ts src/ui/process-modes.ts
git commit -m "feat: enable steel process modes"
```

## Task 2: Shared Steel Core

**Files:**
- Create: `test/steel-core.test.ts`
- Create: `src/steel/types.ts`
- Create: `src/steel/core.ts`
- Create: `src/steel/index.ts`
- Modify: `src/ui/units.ts`
- Modify: `tsconfig.build.json`

- [ ] **Step 1: Write failing critical-temperature and validation tests**

Add tests covering these real behaviors:

```ts
import { describe, expect, it } from "vitest";
import {
  estimateSteelTransformation,
  estimateAsQuenchedHardness,
  recommendTempering,
  validateSteelInput,
  type SteelBaseInput,
} from "../src/steel/index.js";

const baseSteel: SteelBaseInput = {
  composition: { C: 0.4, Mn: 0.8, Si: 0.25, Ni: 0.2, Cr: 0.9, Mo: 0.2, V: 0.02, Cu: 0.15, B: 0.0005 },
  geometry: { maxSectionMm: 38, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 18 },
  startingCondition: "normalized",
  target: { priority: "toughness", targetHardnessHrc: 45 },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
};

describe("shared steel core", () => {
  it("estimates transformation temperatures from composition", () => {
    const result = estimateSteelTransformation(baseSteel);
    expect(result.ac1C).toBeGreaterThan(690);
    expect(result.ac3C).toBeGreaterThan(result.ac1C);
    expect(result.msC).toBeGreaterThan(300);
    expect(result.bainiteStartC).toBeGreaterThan(result.msC);
  });

  it("rejects non-finite and impossible steel inputs", () => {
    expect(() => validateSteelInput({
      ...baseSteel,
      composition: { ...baseSteel.composition, C: Number.NaN },
    })).toThrow(/composition\.C/);
    expect(() => validateSteelInput({
      ...baseSteel,
      geometry: { ...baseSteel.geometry, criticalSectionMm: 0 },
    })).toThrow(/geometry\.criticalSectionMm/);
  });

  it("estimates as-quenched hardness lower when hardenability is insufficient", () => {
    const good = estimateAsQuenchedHardness(baseSteel);
    const weak = estimateAsQuenchedHardness({
      ...baseSteel,
      composition: { ...baseSteel.composition, Mn: 0.3, Cr: 0.05, Mo: 0, Ni: 0, B: 0 },
      geometry: { ...baseSteel.geometry, criticalSectionMm: 90 },
      equipment: { ...baseSteel.equipment, quenchMedium: "air", agitation: "poor", transferTimeSec: 30 },
    });
    expect(good.nominalHrc).toBeGreaterThan(weak.nominalHrc);
    expect(weak.warnings.length).toBeGreaterThan(0);
  });

  it("recommends tempering below as-quenched hardness for a target HRC", () => {
    const asQuenched = estimateAsQuenchedHardness(baseSteel);
    const temper = recommendTempering(baseSteel, asQuenched);
    expect(temper.temperature.nominalC).toBeGreaterThanOrEqual(150);
    expect(temper.targetHardnessHrc).toBe(45);
    expect(temper.hold.nominalMin).toBeGreaterThanOrEqual(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/steel-core.test.ts`

Expected: FAIL with missing `src/steel/index.js`.

- [ ] **Step 3: Implement core types and helpers**

Create the steel package with:

- `SteelComposition`, `SteelGeometry`, `SteelTarget`, `SteelEquipment`, `SteelBaseInput`.
- `TemperatureWindow`, `TimeWindow`, `HardnessRange`, `SteelTransformationEstimate`.
- `validateSteelInput`.
- `estimateSteelTransformation`.
- `estimateHardenabilityScore`.
- `estimateAsQuenchedHardness`.
- `recommendTempering`.

Use finite-number validation, visible clamps, and deterministic warnings. Export all public helpers from `src/steel/index.ts`.

- [ ] **Step 4: Move `TemperatureWindow` ownership**

In `src/ui/units.ts`, replace the ADI import with a local structural interface:

```ts
export interface TemperatureWindow {
  readonly minC: number;
  readonly nominalC: number;
  readonly maxC: number;
  readonly minF: number;
  readonly nominalF: number;
  readonly maxF: number;
}
```

- [ ] **Step 5: Include steel in library build**

Change `tsconfig.build.json` include to:

```json
"include": ["src/adi/**/*.ts", "src/steel/**/*.ts"]
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- test/steel-core.test.ts`

- [ ] **Step 7: Commit**

Run:

```bash
git add test/steel-core.test.ts src/steel src/ui/units.ts tsconfig.build.json
git commit -m "feat: add shared steel model core"
```

## Task 3: Steel Austempering Model

**Files:**
- Create: `test/steel-austempering.test.ts`
- Create: `src/steel/austempering.ts`
- Modify: `src/steel/index.ts`

- [ ] **Step 1: Write failing austempering tests**

Cover bainite target selection, hold windows, low-hardenability warnings, and validation checks:

```ts
import { describe, expect, it } from "vitest";
import {
  recommendSteelAustemperingProcess,
  type SteelAustemperingInput,
} from "../src/steel/index.js";

const input: SteelAustemperingInput = {
  composition: { C: 0.42, Mn: 0.85, Si: 1.5, Ni: 0.2, Cr: 0.8, Mo: 0.25, V: 0.02, Cu: 0.15, B: 0.0007 },
  geometry: { maxSectionMm: 45, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 22 },
  startingCondition: "normalized",
  target: { priority: "toughness", targetHardnessHrc: 42 },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 7,
    bathUniformityC: 5,
  },
  austemper: {
    bainiteTarget: "lower",
    bathMedium: "salt",
  },
};

describe("steel austempering recommendation", () => {
  it("recommends a bath above Ms and below bainite start", () => {
    const result = recommendSteelAustemperingProcess(input);
    expect(result.austemper.temperature.nominalC).toBeGreaterThan(result.transformation.msC);
    expect(result.austemper.temperature.nominalC).toBeLessThan(result.transformation.bainiteStartC);
    expect(result.expectedStructure).toContain("bainite");
  });

  it("uses lower temperatures and higher hardness for lower bainite than upper bainite", () => {
    const lower = recommendSteelAustemperingProcess(input);
    const upper = recommendSteelAustemperingProcess({
      ...input,
      austemper: { ...input.austemper, bainiteTarget: "upper" },
    });
    expect(lower.austemper.temperature.nominalC).toBeLessThan(upper.austemper.temperature.nominalC);
    expect(lower.expectedHardness.nominalHrc).toBeGreaterThan(upper.expectedHardness.nominalHrc);
  });

  it("marks the window invalid when requested bath is below Ms", () => {
    const result = recommendSteelAustemperingProcess({
      ...input,
      austemper: { ...input.austemper, bathTemperatureC: 250 },
    });
    expect(result.processingWindowStatus).toBe("invalid");
    expect(result.confidence).toBe("red");
    expect(result.warnings.join(" ")).toMatch(/below estimated Ms/);
  });

  it("generates validation checks for trial qualification", () => {
    const result = recommendSteelAustemperingProcess(input);
    expect(result.validationChecks).toContain("Validate hardenability with Jominy, CCT/TTT data, or representative quench trials.");
    expect(result.validationChecks.some((check) => check.includes("microstructure"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/steel-austempering.test.ts`

Expected: FAIL with missing export.

- [ ] **Step 3: Implement austempering recommender**

Implement `recommendSteelAustemperingProcess(input)` using shared core estimates, an Ms-relative bath window, hold time scaled by bath temperature and section, hardness range, warnings, confidence, and validation checks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/steel-austempering.test.ts test/steel-core.test.ts`

- [ ] **Step 5: Commit**

Run:

```bash
git add test/steel-austempering.test.ts src/steel/austempering.ts src/steel/index.ts
git commit -m "feat: add steel austempering model"
```

## Task 4: Martempering Model

**Files:**
- Create: `test/martempering.test.ts`
- Create: `src/steel/martempering.ts`
- Modify: `src/steel/index.ts`

- [ ] **Step 1: Write failing martempering tests**

Cover Ms-relative bath windows, equalization, as-quenched hardness, target tempering, and retained-austenite warnings:

```ts
import { describe, expect, it } from "vitest";
import {
  recommendMartemperingProcess,
  type MartemperingInput,
} from "../src/steel/index.js";

const input: MartemperingInput = {
  composition: { C: 0.45, Mn: 0.8, Si: 0.25, Ni: 0.2, Cr: 0.9, Mo: 0.2, V: 0.02, Cu: 0.15, B: 0.0005 },
  geometry: { maxSectionMm: 38, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 18 },
  startingCondition: "normalized",
  target: { priority: "distortion", targetHardnessHrc: 44 },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
  martemper: {
    bathMedium: "salt",
    equalizationStrategy: "section-equalized",
    temperHoldMin: 120,
    temperCount: 1,
  },
};

describe("martempering recommendation", () => {
  it("places the interrupted quench bath above Ms", () => {
    const result = recommendMartemperingProcess(input);
    expect(result.martemper.temperature.nominalC).toBeGreaterThan(result.transformation.msC);
    expect(result.equalize.nominalMin).toBeGreaterThan(0);
    expect(result.finalCoolGuidance).toMatch(/cool through martensite/);
  });

  it("estimates as-quenched hardness and recommends tempering toward target HRC", () => {
    const result = recommendMartemperingProcess(input);
    expect(result.asQuenchedHardness.nominalHrc).toBeGreaterThan(result.temper.targetHardnessHrc);
    expect(result.temper.temperature.nominalC).toBeGreaterThanOrEqual(150);
    expect(result.temper.hold.nominalMin).toBe(120);
  });

  it("flags bath temperatures at or below Ms as invalid", () => {
    const result = recommendMartemperingProcess({
      ...input,
      martemper: { ...input.martemper, bathTemperatureC: 250 },
    });
    expect(result.processingWindowStatus).toBe("invalid");
    expect(result.confidence).toBe("red");
    expect(result.warnings.join(" ")).toMatch(/above estimated Ms/);
  });

  it("warns for high-carbon retained austenite risk", () => {
    const result = recommendMartemperingProcess({
      ...input,
      composition: { ...input.composition, C: 0.95 },
    });
    expect(result.warnings.join(" ")).toMatch(/retained austenite/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/martempering.test.ts`

Expected: FAIL with missing export.

- [ ] **Step 3: Implement martempering recommender**

Implement `recommendMartemperingProcess(input)` using shared transformation, hardness, and tempering helpers. Make tempering part of the default recommendation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/martempering.test.ts test/steel-core.test.ts`

- [ ] **Step 5: Commit**

Run:

```bash
git add test/martempering.test.ts src/steel/martempering.ts src/steel/index.ts
git commit -m "feat: add martempering model"
```

## Task 5: Steel Reports

**Files:**
- Create: `test/steel-report.test.ts`
- Create: `src/ui/steel-report.ts`

- [ ] **Step 1: Write failing report tests**

Test Markdown content and mode-specific fallback filenames:

```ts
import { describe, expect, it } from "vitest";
import { recommendMartemperingProcess, recommendSteelAustemperingProcess } from "../src/steel/index.js";
import {
  createSteelReportViewModel,
  steelReportMarkdownFilename,
  serializeSteelReportMarkdown,
} from "../src/ui/steel-report.js";

const austemperingInput = {
  composition: { C: 0.42, Mn: 0.85, Si: 1.5, Ni: 0.2, Cr: 0.8, Mo: 0.25, V: 0.02, Cu: 0.15, B: 0.0007 },
  geometry: { maxSectionMm: 45, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 22 },
  startingCondition: "normalized",
  target: { priority: "toughness", targetHardnessHrc: 42 },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 7,
    bathUniformityC: 5,
  },
  austemper: { bainiteTarget: "lower", bathMedium: "salt" },
} as const;

const martemperingInput = {
  composition: { C: 0.45, Mn: 0.8, Si: 0.25, Ni: 0.2, Cr: 0.9, Mo: 0.2, V: 0.02, Cu: 0.15, B: 0.0005 },
  geometry: { maxSectionMm: 38, minSectionMm: 12, criticalSectionMm: 32, estimatedMassKg: 18 },
  startingCondition: "normalized",
  target: { priority: "distortion", targetHardnessHrc: 44 },
  equipment: {
    furnaceType: "controlled-atmosphere",
    atmosphereType: "endothermic-neutral",
    carbonProtection: true,
    quenchMedium: "salt",
    agitation: "good",
    transferTimeSec: 6,
    bathUniformityC: 5,
  },
  martemper: { bathMedium: "salt", equalizationStrategy: "section-equalized", temperHoldMin: 120, temperCount: 1 },
} as const;

describe("steel report helpers", () => {
  it("serializes austempering reports with metadata, windows, hardness, warnings, and checklist", () => {
    const recommendation = recommendSteelAustemperingProcess(austemperingInput);
    const markdown = serializeSteelReportMarkdown(createSteelReportViewModel({
      activeModeLabel: "Steel Austempering",
      exportedAt: "2026-07-03T00:00:00.000Z",
      unitSystem: "imperial",
      metadata: { customerName: "ACME", partName: "Shaft", notes: "Trial load." },
      input: austemperingInput,
      recommendation,
      validationChecklist: { items: [{ id: "microstructure", label: "Verify final microstructure.", checked: true, notes: "Cut test coupon." }] },
    }));
    expect(markdown).toContain("Customer: ACME");
    expect(markdown).toContain("Process: Steel Austempering");
    expect(markdown).toContain("Expected structure:");
    expect(markdown).toContain("Expected hardness:");
    expect(markdown).toContain("- [x] Verify final microstructure.");
  });

  it("serializes martempering reports with as-quenched and tempering recommendations", () => {
    const recommendation = recommendMartemperingProcess(martemperingInput);
    const markdown = serializeSteelReportMarkdown(createSteelReportViewModel({
      activeModeLabel: "Martempering",
      exportedAt: "2026-07-03T00:00:00.000Z",
      unitSystem: "metric",
      metadata: { customerName: "", partName: "", notes: "" },
      input: martemperingInput,
      recommendation,
      validationChecklist: { items: [] },
    }));
    expect(markdown).toContain("Process: Martempering");
    expect(markdown).toContain("As-quenched hardness:");
    expect(markdown).toContain("Temper:");
  });

  it("uses a safe mode-specific fallback filename", () => {
    expect(steelReportMarkdownFilename("martempering", { customerName: "", partName: "", notes: "" }, "2026-07-03T00:00:00.000Z"))
      .toBe("htcalc-martempering-report-2026-07-03.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/steel-report.test.ts`

Expected: FAIL with missing helper module.

- [ ] **Step 3: Implement report helpers**

Create a steel report view model that accepts either steel recommendation union and serializes:

- Metadata and notes.
- Mode label.
- Composition and critical section.
- Transformation estimates.
- Process windows.
- Hardness and tempering fields.
- Warnings.
- Validation checklist.
- Model limitations.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/steel-report.test.ts test/steel-austempering.test.ts test/martempering.test.ts`

- [ ] **Step 5: Commit**

Run:

```bash
git add test/steel-report.test.ts src/ui/steel-report.ts
git commit -m "feat: add steel report serialization"
```

## Task 6: Project State Version 3

**Files:**
- Modify: `test/project-state.test.ts`
- Modify: `src/ui/project-state.ts`

- [ ] **Step 1: Write failing project-state tests**

Add tests for:

- `createProjectState` returns `htcalcProjectVersion: 3`.
- Version 1 migrates to version 3 with default steel inputs and per-mode checklists.
- Version 2 migrates to version 3 preserving existing ADI metadata/checklist/baseline.
- Version 3 round-trips steel austempering and martempering inputs.
- Invalid steel enum values, non-finite steel numerics, malformed per-mode checklist objects, and malformed steel objects throw before state restore.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/project-state.test.ts`

Expected: FAIL because project version is still 2 and steel fields are missing.

- [ ] **Step 3: Implement version 3 project state**

Update `HtcalcProjectState` and `CreateProjectStateInput` with:

```ts
readonly steelAustempering: { readonly input: SteelAustemperingInput };
readonly martempering: { readonly input: MartemperingInput };
readonly validationChecklists: Readonly<Record<ProcessModeId, ValidationChecklistState>>;
```

Keep `pinnedComparisonBaseline` as the ADI baseline for this branch.

- [ ] **Step 4: Add strict steel parsers**

Implement steel composition, geometry, target, equipment, austempering, and martempering parsers using the same finite-number and enum-member helpers already used for ADI.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- test/project-state.test.ts`

- [ ] **Step 6: Commit**

Run:

```bash
git add test/project-state.test.ts src/ui/project-state.ts
git commit -m "feat: persist steel project state"
```

## Task 7: UI Wiring

**Files:**
- Create: `test/steel-state.test.ts`
- Create: `src/ui/steel-state.ts`
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Write failing steel UI state tests**

Create `test/steel-state.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  defaultMartemperingInput,
  defaultSteelAustemperingInput,
  setMartemperingInputValue,
  setSteelAustemperingInputValue,
} from "../src/ui/steel-state.js";

describe("steel UI state helpers", () => {
  it("creates independent default steel inputs", () => {
    const first = defaultSteelAustemperingInput();
    const second = defaultSteelAustemperingInput();
    first.composition.C = 0.5;
    expect(second.composition.C).not.toBe(0.5);
  });

  it("updates steel austempering numeric and enum paths", () => {
    const input = defaultSteelAustemperingInput();
    setSteelAustemperingInputValue(input, "composition.C", 0.45);
    setSteelAustemperingInputValue(input, "austemper.bainiteTarget", "upper");
    expect(input.composition.C).toBe(0.45);
    expect(input.austemper.bainiteTarget).toBe("upper");
  });

  it("updates martempering target and tempering paths", () => {
    const input = defaultMartemperingInput();
    setMartemperingInputValue(input, "target.targetHardnessHrc", 43);
    setMartemperingInputValue(input, "martemper.temperCount", 2);
    expect(input.target.targetHardnessHrc).toBe(43);
    expect(input.martemper.temperCount).toBe(2);
  });
});
```

Run: `npm test -- test/steel-state.test.ts`

Expected: FAIL with missing `src/ui/steel-state.js`.

- [ ] **Step 2: Add steel UI state and defaults**

Create `src/ui/steel-state.ts` with default steel austempering and martempering input factories plus pure path update helpers. Use those factories from `main.ts` and `project-state.ts`.

- [ ] **Step 3: Render steel workspaces**

Replace `plannedWorkspace` rendering for steel modes with:

- Shared project details.
- Steel chemistry grid.
- Geometry grid.
- Target/equipment sections.
- Mode-specific austempering or martempering section.
- Result pane.

- [ ] **Step 4: Bind steel inputs**

Add path-specific setters for steel inputs. Keep ADI setters untouched except for shared project metadata and checklist state.

- [ ] **Step 5: Render steel recommendations**

For steel austempering call `recommendSteelAustemperingProcess`. For martempering call `recommendMartemperingProcess`. Render summary, process windows, score metrics, warnings, validation checklist, and report actions.

- [ ] **Step 6: Save and restore version 3 state**

Pass steel inputs and per-mode checklists into `createProjectState`, and restore them in `restoreProject`.

- [ ] **Step 7: Wire steel reports**

Use `createSteelReportViewModel`, `serializeSteelReportMarkdown`, and `steelReportMarkdownFilename` for steel modes. Keep ADI report behavior unchanged.

- [ ] **Step 8: Run focused checks**

Run:

```bash
npm test -- test/process-modes.test.ts test/project-state.test.ts test/steel-report.test.ts test/steel-state.test.ts
npm run typecheck
```

- [ ] **Step 9: Commit**

Run:

```bash
git add test/steel-state.test.ts src/ui/steel-state.ts src/ui/main.ts src/ui/styles.css
git commit -m "feat: wire steel process UI"
```

## Task 8: Verification and Smoke Check

**Files:**
- No planned source changes unless verification reveals a bug.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

- [ ] **Step 2: Start local dev server**

Run: `npm run dev -- --port 5173`

Expected: Vite serves the app on `http://127.0.0.1:5173/`, or choose another free port if occupied.

- [ ] **Step 3: Smoke check manually**

Verify:

- ADI still renders and reports.
- Steel Austempering tab accepts chemistry changes, updates process windows, and downloads Markdown.
- Martempering tab updates Ms-relative bath and tempering recommendation when target HRC changes.
- Saving and loading a `.htcalc.json` preserves active steel mode and steel inputs.

- [ ] **Step 4: Stop dev server**

Stop the Vite process before final response.

- [ ] **Step 5: Final branch status**

Run:

```bash
git status -sb
git log --oneline -5
```

Report verification results and any remaining limitations.
