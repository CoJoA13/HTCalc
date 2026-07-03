# Contributing

HTCalc is a heat-treatment planning tool. Changes should be conservative, testable, and explicit about model limits.

## Local Setup

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm test
npm run typecheck
npm run build
```

## Branches

Use short, descriptive branches:

```txt
feature/<topic>
fix/<topic>
docs/<topic>
```

Keep unrelated work on separate branches.

## Pull Requests

Every PR should include:

- What changed.
- Why it changed.
- Which process modes are affected.
- Validation commands that were run.
- Screenshots or manual smoke notes for UI-facing changes.
- Model assumptions or limitations for calculation changes.

## Model Changes

For ADI or steel model changes:

- Add or update focused Vitest coverage.
- Document formula or confidence-rule changes in the relevant `docs/*-process-model.md` file.
- Avoid silent changes to confidence levels, warning thresholds, or process windows.
- Treat public JavaScript callers as untrusted and validate enum-like and numeric inputs.

## UI Changes

For UI changes:

- Preserve existing process-mode behavior unless the PR intentionally changes it.
- Keep text concise and engineering-review oriented.
- Make sure steel modes do not accidentally render ADI recommendations, and ADI-specific comparison features stay scoped to ADI unless explicitly expanded.

## Documentation

Documentation should be factual and clear about limitations. HTCalc recommendations are starting points for engineering review and trial planning, not production certification.
