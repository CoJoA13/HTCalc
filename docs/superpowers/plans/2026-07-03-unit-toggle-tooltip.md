# Unit Toggle And Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Imperial/Metric UI unit switching with Imperial default and restrict help popovers to the `?` icons.

**Architecture:** Keep `AdiProcessInput` metric internally and add UI-only conversion helpers in `src/ui/main.ts`. Settings owns the unit preference; field rendering, input parsing, and result display use that preference.

**Tech Stack:** TypeScript, Vite, vanilla DOM UI, Vitest.

---

### Task 1: Unit Preference And Conversion Helpers

**Files:**
- Modify: `src/ui/main.ts`
- Test: `test/ui-units.test.ts`

- [ ] **Step 1: Add tests for conversion helpers**

Create `test/ui-units.test.ts` with assertions for `mm <-> in`, `kg <-> lb`, and temperature-delta `deg C <-> deg F`.

- [ ] **Step 2: Export narrow helpers for tests**

In `src/ui/main.ts`, export pure helper functions for display conversion and input conversion. They must not touch DOM state.

- [ ] **Step 3: Run tests**

Run `npm test`; expected result is all tests passing.

### Task 2: Settings Unit Toggle

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add unit state**

Add `type UnitSystem = "imperial" | "metric"` and initialize `let unitSystem: UnitSystem = "imperial"`.

- [ ] **Step 2: Add segmented settings control**

Render `Imperial` and `Metric` radio buttons in Settings. Bind change events so switching units updates displayed inputs and re-renders the recommendation.

- [ ] **Step 3: Style the segmented control**

Add compact Settings styles that match the existing control density.

### Task 3: Unit-Aware Fields And Results

**Files:**
- Modify: `src/ui/main.ts`

- [ ] **Step 1: Render unit-sensitive input values**

Geometry section fields display inches in Imperial and millimeters in Metric. Estimated mass displays pounds in Imperial and kilograms in Metric. Bath uniformity displays `deg F` in Imperial and `deg C` in Metric.

- [ ] **Step 2: Parse unit-sensitive input values**

When users edit those fields, convert Imperial values back to metric before assigning to `state`.

- [ ] **Step 3: Render recommendation temperatures by unit**

Use existing `TemperatureWindow` Fahrenheit values in Imperial and Celsius values in Metric.

### Task 4: Tooltip Trigger Scope

**Files:**
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Keep popover CSS on `.help-button` only**

Ensure only `.help-button:hover::after` and `.help-button:focus-visible::after` display tooltips.

- [ ] **Step 2: Avoid field-level tooltip selectors**

Confirm no `.field:hover` or label hover selector shows tooltip content.

### Task 5: Verification And Commit

**Files:**
- Modify: relevant implementation and test files

- [ ] **Step 1: Run verification**

Run `npm test`, `npm run typecheck`, and `npm run build`; all must pass.

- [ ] **Step 2: Check local server**

Use `curl -I http://127.0.0.1:5173/`; expected `HTTP/1.1 200 OK`.

- [ ] **Step 3: Commit**

Commit with message `feat: add UI unit preference`.
