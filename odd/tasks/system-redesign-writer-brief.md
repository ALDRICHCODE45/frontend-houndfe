# Writer brief: T3 screen migration (system redesign)

Spec: odd/tasks/system-redesign.md, T3 (S1, S2, S3, S4, S5, S10). Read the WHOLE feature document until `## Log`, then the Log. Then read docs/design-system.md in full, from "## Patrones" through "UX principles (research)". That covers these sections:

- Text diet, Balanced color and Typography.
- Page header and Toolbar.
- Table row, Status badge and Row actions menu.
- Money and dates, Detail header, Mobile cards and Danger color.
- List screens.
- Empty, no-match and error states, including the EmptyState and AppDataTable API (`emptyState`, `filtered`, `noMatchTitle`, the `empty-action` event, the skeleton) and "How to test (S10)".
- Forms and overlays, Record avatars, and the Legacy to pattern map.

Reference implementation: `src/features/procurement/**`, mainly `PurchaseOrderList.vue`, `SupplierList.vue`, `SupplierView.vue` and `PurchaseOrderView.vue`.

Shared pieces:

- `src/core/shared/components/StatusBadge.vue`, `RowActionsMenu.vue`, `EmptyState.vue` and `EntityAvatar.vue`. EntityAvatar is now neutral; use it for people.
- `DataTable/AppDataTable.vue`, with `row-open`, and `mobile-render="cards"` plus `#mobile-card`.
- `composables/useClickableRow.ts`.
- `formatShortDateTime` and `formatDecimalMoney`, in `src/core/shared/utils/`.

## Working rules

- **Repository and branch:** /home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe, branch `feat/system-redesign`. Do not switch branches.
- **Committing alongside other writers:** several writers work in parallel on disjoint folders.
  - Stage and commit ONLY the files inside your Allowed edit surfaces, with explicit paths. Never use `git add -A` or `.`.
  - Never commit `auto-imports.d.ts` or `components.d.ts`.
  - Never run `git checkout`, `reset`, `stash` or `rm` on other people's files.
  - If `.git/index.lock` is busy, wait a few seconds and retry.
- **Crash recovery:** a previous run crashed, so your surfaces may hold partial UNCOMMITTED work. Start with `git status --short -- <your surfaces>` and `git diff -- <your surfaces>`. Keep what is correct and continue from it. Do not throw it away.
- **Commit early and often:** make a reviewable Conventional Commit, about 400 changed lines with its tests, every time a screen is green. A crash must lose at most one screen. Example: `feat(ui): migrate <feature> lists to the shared table pattern`.
- **Scope:** "Visual + estructura" means style, hierarchy, layouts, tables and forms with the new patterns. Do NOT change any business flow, field, API, permission or calculation.

## What to migrate

Migrate EVERY screen, list, detail, form, modal and card in your surfaces.

**Lists.** Use one layout: an AppDataTable table on desktop and mobile cards (`mobile-render="cards"` plus `#mobile-card`).

- Order columns by job: name or identifier first, status second, then the fields that decide the next action. Use 8 columns at most.
- Money is right-aligned with tabular figures, and dates are short.
- The ⋮ `RowActionsMenu` is last. Whole-row `:row-open` applies when a row opens something.
- Remove the card grid, the ViewToggle and the feature's `use*ViewMode`, plus their now-dead components and specs. Delete the files nothing imports anymore with `git rm` inside your surfaces; if it is blocked, list them in the report.

**Badges and row actions.**

- StatusDotBadge, DotBadge and AppBadge status pills become `StatusBadge` with a mapped tone.
- Inline row buttons and old dropdown menus become `RowActionsMenu`: destructive actions last after a separator, `…` on items that need confirmation, and an `aria-label` that names the row.

**Color, type and text.**

- `text-red-*`, palette or hex literals, `coco-*` classes, and `--brand-*` or `--light-*` become `--hf-*` roles. Nuxt `color="error"` and `text-error` already resolve to `--hf-danger`, so keep them only where the meaning is destructive or error.
- `font-bold` on names, titles and money becomes `font-semibold`.
- Apply the Text diet and keep one primary action per view. The page header is the title plus at most one short subtitle.
- Never show ids to humans.

**Four states (S10).**

- Every list uses AppDataTable with these states:
  - empty: `emptyState` "Nada todavía", with the create action only when the user has permission.
  - filtered: no-match with Limpiar filtros.
  - error: EmptyState kind error with Reintentar.
  - loading: a skeleton.
- Non-table pages (details, dashboards, forms) get the same four states, with EmptyState and skeletons shaped like their content.

**Per-feature CSS.** Delete the rules the migration made dead. Keep only what the feature still needs, on `--hf` tokens.

## Tests (S10, mandatory)

- Work test-first where behavior or structure changes: RED, then GREEN.
- Every routed view and list needs a spec for its four states:
  - empty: the EmptyState kind empty title.
  - loading: `table-skeleton`, `mobile-card-skeleton` or the page skeleton.
  - data: rows with StatusBadge and ⋮.
  - error: `table-error-state` with Reintentar, or the page error state.
- Update the specs that pinned legacy visuals to the new pattern. Do not delete their coverage.

## Checks before reporting

- `pnpm type-check` returns 0. If it fails ONLY in files outside your surfaces because another writer is mid-change, rerun once later and say so.
- `pnpm exec vitest run --dir src <your feature dirs>` is all green. Always pass `--dir src`.
- `git diff --check` is clean.
- Do NOT run the full suite or the build. Do not start dev servers or browsers.
- Use pnpm 10 (`~/.nvm/versions/node/v24.14.1/bin/pnpm`) if the default pnpm refuses `node_modules`.

## Report (at most 400 words)

- The commits.
- The screens migrated.
- The files deleted.
- RED/GREEN evidence.
- The feature test totals.
- Anything outside your surfaces that needs a change, with the exact `file:line` and the change.
- Open design questions.
