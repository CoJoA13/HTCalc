# Repository Public Polish Design

## Goal

Make HTCalc understandable, maintainable, and presentable as a public GitHub repository after the ADI and steel process workflow work has landed.

## Scope

This pass adds repository-facing documentation, contributor guidance, GitHub templates, dependency update configuration, and basic public-project metadata. It does not change the calculation models or UI behavior.

## Documentation

- Add a top-level `README.md` that explains what HTCalc does, which process modes are implemented, how to run the project locally, how to validate changes, how saved project/report export works, and what the model limitations are.
- Add `docs/index.md` as a documentation map for public readers.
- Add `docs/steel-process-model.md` with public-facing notes for steel austempering and martempering, including inputs, outputs, validation expectations, and limitations.
- Add `CHANGELOG.md` with the current project history through the merged steel workflow.
- Add an MIT `LICENSE`.

## Contribution Workflow

- Add `CONTRIBUTING.md` with branch, test, pull request, review, and model-change expectations.
- Add `.github/PULL_REQUEST_TEMPLATE.md`.
- Add `.github/ISSUE_TEMPLATE/bug_report.yml` and `.github/ISSUE_TEMPLATE/feature_request.yml`.
- Add `.github/dependabot.yml` for weekly npm and GitHub Actions update PRs.

## GitHub Setup

After the documentation branch is pushed, update low-risk GitHub metadata where supported by the available tools:

- Repository description should describe HTCalc as a heat-treatment process recommendation workbench.
- Topics should include heat-treatment, austempering, martempering, adi, steel, typescript, and vite.
- Recommend or apply branch protection for `main` so CI must pass before merging. If branch protection cannot be safely applied through available authenticated tools, document the exact recommended setting instead of guessing.
- Clean up merged feature branches only when the branch is already merged and not needed by an open PR.

## Validation

Run `npm test`, `npm run typecheck`, and `npm run build`. Documentation and repository configuration should not require new runtime dependencies.
