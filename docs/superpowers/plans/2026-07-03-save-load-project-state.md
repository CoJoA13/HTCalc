# Save Load Project State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSON file save/load for HTCalc calculator state.

**Architecture:** Add a pure `src/ui/project-state.ts` module for serialization and validation. Wire `src/ui/main.ts` header buttons to browser Blob download and hidden file input import.

**Tech Stack:** TypeScript, Vite, vanilla DOM UI, Vitest.

---

### Task 1: Project State Module

**Files:**
- Create: `src/ui/project-state.ts`
- Create: `test/project-state.test.ts`

- [ ] **Step 1: Write failing serialization tests**

Test that exported project JSON includes version, active mode, unit system, ADI input, calibration, and timestamp.

- [ ] **Step 2: Run failing test**

Run `npm test -- test/project-state.test.ts`. Expected failure: module does not exist.

- [ ] **Step 3: Implement serializer/parser**

Export `createProjectState`, `serializeProjectState`, and `parseProjectState`.

- [ ] **Step 4: Verify targeted test**

Run `npm test -- test/project-state.test.ts`. Expected result: pass.

### Task 2: Header Button Wiring

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add button IDs and hidden file input**

Assign stable IDs to Load and Save buttons and add a hidden file input accepting `.json,.htcalc.json`.

- [ ] **Step 2: Wire save**

Build current project state and trigger a JSON Blob download named with `htcalc-project`.

- [ ] **Step 3: Wire load**

Read the selected file, parse project state, restore active mode/unit/calibration/ADI input, and re-render.

- [ ] **Step 4: Add status message**

Show concise saved/loaded/error status text near header actions.

### Task 3: Verification And Commit

**Files:**
- Modify: implementation and test files

- [ ] **Step 1: Run verification**

Run `npm test`, `npm run typecheck`, and `npm run build`; all must pass.

- [ ] **Step 2: Check local dev server**

Use `curl -I http://127.0.0.1:5173/`; expected `HTTP/1.1 200 OK`.

- [ ] **Step 3: Commit**

Commit with message `feat: add project save load`.
