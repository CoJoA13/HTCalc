# Process Mode Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable process-mode UI shell with ADI active and steel austempering/martempering planned placeholders.

**Architecture:** Add a pure `src/ui/process-modes.ts` metadata module and tests. Update `src/ui/main.ts` to render tabs from metadata, track the active mode, and switch the workspace between the ADI calculator and planned-mode placeholder.

**Tech Stack:** TypeScript, Vite, vanilla DOM UI, Vitest.

---

### Task 1: Process Mode Metadata

**Files:**
- Create: `src/ui/process-modes.ts`
- Create: `test/process-modes.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Create tests that expect three modes, ADI implemented, steel austempering planned, martempering planned, and planned modes to expose future input bullets.

- [ ] **Step 2: Run failing test**

Run `npm test -- test/process-modes.test.ts`. Expected failure: module does not exist.

- [ ] **Step 3: Implement metadata module**

Export `PROCESS_MODES`, `getProcessMode`, `implementedProcessModes`, and `plannedProcessModes`.

- [ ] **Step 4: Run metadata test**

Run `npm test -- test/process-modes.test.ts`. Expected result: pass.

### Task 2: Mode Shell UI

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Render tabs from metadata**

Replace hard-coded process tab buttons with mapped metadata. ADI starts selected.

- [ ] **Step 2: Add mode switching**

Track `activeModeId`. Clicking ADI renders existing calculator. Clicking planned modes renders a planned-mode placeholder.

- [ ] **Step 3: Style planned placeholder**

Add clear empty-state styles that match the existing workbench density.

- [ ] **Step 4: Clarify settings copy**

Rename the calibration settings area to ADI model calibration while keeping Units shared.

### Task 3: Verification And Commit

**Files:**
- Modify: implementation and test files

- [ ] **Step 1: Run verification**

Run `npm test`, `npm run typecheck`, and `npm run build`; all must pass.

- [ ] **Step 2: Check local dev server**

Use `curl -I http://127.0.0.1:5173/`; expected `HTTP/1.1 200 OK`.

- [ ] **Step 3: Commit**

Commit with message `feat: add process mode shell`.
