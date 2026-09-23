# Frontend main consolidation

## Goal

Consolidate the intended public-catalog redesign, public price-context selector, catalog-settings UI work, and already integrated operational Dashboard into local `main`, then leave the canonical frontend worktree checked out on `main` without losing unrelated protected artifacts.

## Authorization and boundaries

- The user explicitly selected full local integration into `main` and wants this canonical worktree to end on `main`.
- No push, pull request, deployment, release, branch deletion, reset, clean, rebase, force operation, or backend mutation is authorized.
- Preserve the feature branch after integration.
- Exclude and do not touch these protected untracked artifacts:
  - `openspec/changes/online-catalog-publishing/.gentle-ai-instance`
  - `openspec/changes/public-catalog-branch-discovery/verify-report.md`
- Current catalog-settings/POS changes and `stockPresentationUi.ts` are intended delivery scope.
- The Dashboard already integrated on `main` is authoritative outside catalog conflicts.
- The redesigned catalog implementation on `feat/public-catalog-visual-redesign` is authoritative for catalog presentation while preserving the strict public price-context contract already verified on both histories.

## Starting state

- Canonical worktree: `feat/public-catalog-visual-redesign` at `f7b418d1f80c5ef3efc137943b0e94003a1be9ac`.
- Local `main`: `cacd750077614c4ca951acbf84ffbdf8fe0db059`.
- Merge base: `f44bbdaa434d854ed74cec5a4c4cdabb424cf007`.
- Divergence: 41 commits exclusive to `main`, 12 commits exclusive to the feature branch.
- Read-only `git merge-tree --write-tree HEAD main` predicts exactly nine conflicts:
  - `e2e/responsive/specs/public-catalog-product-detail.spec.ts`
  - `e2e/responsive/specs/public-catalog-products.spec.ts`
  - `odd/tasks/public-catalog-price-context-selector.md`
  - `src/features/catalog/components/CatalogHeader.vue`
  - `src/features/catalog/components/CatalogPriceContextSelector.vue`
  - `src/features/catalog/components/CatalogProductGrid.vue`
  - `src/features/catalog/components/__tests__/CatalogPriceContextSelector.spec.ts`
  - `src/features/catalog/views/CatalogView.vue`
  - `src/features/catalog/views/__tests__/CatalogView.spec.ts`

## Tasks

- [x] **FMC-1 — Commit the intended catalog-settings work.** Completed as `d136282b2517484ea394415be5550dfdd7ac0a7d` (`feat(catalog): refine catalog settings controls`) across exactly 18 intended settings/POS/tracker paths. Independent verification passed 9/9 files and 143/143 tests, type-check, production build, Prettier across all 19 candidate paths (including this consolidation record), and `git diff --check`. The two protected OpenSpec artifacts remained untracked and byte-untouched; authenticated desktop/mobile smoke remains pending.
- [ ] **FMC-2 — Merge local main into the catalog feature branch.** Perform a no-ff merge, resolve only the nine predicted catalog/price-context conflicts, preserve the redesigned catalog UI and strict context identity semantics, and retain the Dashboard/main side everywhere else.
- [ ] **FMC-3 — Verify the consolidated frontend.** Run focused catalog/settings/dashboard unit suites, serial full unit coverage, type-check, production build, formatting/diff checks, and the public-catalog plus Dashboard responsive browser matrices. Record every skipped or human-gated authenticated check.
- [ ] **FMC-4 — Advance main and switch the canonical worktree.** After green verification, fast-forward local `main` to the integrated feature head, preserve `feat/public-catalog-visual-redesign`, switch this clean canonical worktree to `main`, verify exact ancestry/status, and record local-only delivery evidence.

## Merge resolution policy

- Catalog visual structure and responsive behavior: feature branch version.
- Public price-context transport, identity, unavailable-state, URL, and authoritative-detail semantics: preserve the already verified contract; prefer the feature implementation where behavior is equivalent because it targets the redesigned UI.
- Operational Dashboard, navigation, authorization, landing behavior, and analytics: `main` version.
- Catalog settings inheritance, customer-facing labels, searchable price-list selection, switches, nullable clearing, literal zero behavior, and existing payload/test identifiers: preserve the current intended work exactly.
- Any unexpected conflict outside the nine predicted paths stops the merge for reassessment.

## Delivery status

Not yet integrated. All changes remain local. No remote delivery is authorized.
