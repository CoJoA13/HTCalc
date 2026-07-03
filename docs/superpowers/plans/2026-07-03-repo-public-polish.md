# Repository Public Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public repository documentation, contribution templates, license, changelog, dependency update configuration, and safe GitHub metadata setup.

**Architecture:** Keep all changes in repository metadata and Markdown/YAML docs. No application source behavior changes are required. GitHub repository settings are handled after the branch is pushed so file changes remain reviewable through a PR.

**Tech Stack:** Markdown, GitHub issue forms, GitHub Actions, Dependabot, npm, TypeScript, Vite, Vitest.

---

### Task 1: Public Documentation

**Files:**
- Create: `README.md`
- Create: `docs/index.md`
- Create: `docs/steel-process-model.md`
- Create: `CHANGELOG.md`
- Create: `LICENSE`

- [ ] **Step 1: Add top-level project documentation**

Create `README.md` with project purpose, process modes, safety disclaimer, local commands, project/report workflows, validation commands, and documentation links.

- [ ] **Step 2: Add documentation index**

Create `docs/index.md` linking to ADI model notes, steel model notes, superpowers specs, and superpowers plans.

- [ ] **Step 3: Add steel model documentation**

Create `docs/steel-process-model.md` covering steel austempering and martempering inputs, outputs, confidence rules, required validation, and model limitations.

- [ ] **Step 4: Add release history and license**

Create `CHANGELOG.md` with current project milestones and add MIT license text in `LICENSE` for `CoJoA13`.

### Task 2: GitHub Contribution Workflow

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `.github/PULL_REQUEST_TEMPLATE.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/dependabot.yml`

- [ ] **Step 1: Add contributor guidance**

Create `CONTRIBUTING.md` documenting branch naming, local setup, validation commands, model-change expectations, and PR review expectations.

- [ ] **Step 2: Add pull request template**

Create `.github/PULL_REQUEST_TEMPLATE.md` with summary, validation, model impact, UI impact, and checklist sections.

- [ ] **Step 3: Add issue templates**

Create bug and feature request issue forms with fields for process mode, inputs, expected behavior, actual behavior, validation impact, and proposed outcome.

- [ ] **Step 4: Add Dependabot configuration**

Create `.github/dependabot.yml` for weekly npm and GitHub Actions updates.

### Task 3: Verification, Commit, Push, and GitHub Setup

**Files:**
- Modify only files from Tasks 1 and 2 unless GitHub setup reveals a required repository file change.

- [ ] **Step 1: Verify repository checks**

Run `npm test`, `npm run typecheck`, and `npm run build`.

- [ ] **Step 2: Commit and push**

Commit the documentation/configuration changes and push `feature/repo-public-polish`.

- [ ] **Step 3: Open a draft PR**

Open a draft PR against `main` summarizing documentation, repo templates, license, and validation.

- [ ] **Step 4: Apply or document GitHub settings**

Use available authenticated GitHub tools to update repository description/topics and apply safe settings if supported. If branch protection cannot be applied safely, leave a clear final recommendation with exact desired `main` protection settings.

## Self-Review

- The plan covers each approved scope item.
- The plan does not include application source changes.
- The plan includes validation and GitHub setup follow-through.
- No placeholders remain.
