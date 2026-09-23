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

- [x] **FMC-1 — Commit the intended catalog-settings work.** Completed as `d136282b2517484ea394415be5550dfdd7ac0a7d` (`feat(catalog): refine catalog settings controls`) across exactly 18 intended settings/POS/tracker paths. Independent verification passed 9/9 files and 143/143 tests, type-check, production build, Prettier across all 19 candidate paths (including this consolidation record), and `git diff --check`. The two protected OpenSpec artifacts remained untracked and byte-untouched; the user subsequently completed and approved the authenticated desktop/mobile smoke.
- [x] **FMC-2 — Merge local main into the catalog feature branch.** Completed as two-parent merge `8b324c1d1eadc031edc7df9f4b10fc2f9beb6c2d` (`merge: consolidate catalog and dashboard`) with parents `fd624845d3c4308e959a279f646e60b1dbdce1be` and `cacd750077614c4ca951acbf84ffbdf8fe0db059`, and tree `085c62564e26b0f83a4d844aea131042e65406ba`. Exactly the nine predicted conflicts occurred and were resolved to byte-identical feature catalog implementations; Dashboard/main content auto-merged everywhere else. Integration corrections replaced an unsafe test global cast, strengthened exact-call matchers, preserved Chromium focus evidence with a typed option, and explicitly released two mounted Dashboard test trees after a full-suite timeout exposed retained wrappers.
- [x] **FMC-3 — Verify the consolidated frontend.** Independent evidence passed settings/POS 143/143, public price-context 190/190, Dashboard 572/572, the full serial suite at 426 files and 7,097/7,097 tests, authoritative vue-tsc type-check, production build, responsive type-check, scoped ESLint, Prettier across 127/127 supported changed paths (generated `pnpm-lock.yaml` intentionally excluded), and both Git diff checks. One serialized no-retry combined browser run passed 48/48 catalog plus Dashboard cases; the typed-focus delta then passed the Dashboard browser matrix again at 11/11. Protected OpenSpec hashes remained exact. The user completed and approved the authenticated visual smoke across the requested global/product/variant settings, public catalog, Dashboard, responsive, persistence, and light/dark checklist; the existing >500 kB build warning remains non-blocking.
- [x] **FMC-4 — Advance main and switch the canonical worktree.** After green verification, the canonical worktree switched to local `main` and fast-forwarded from `cacd750077614c4ca951acbf84ffbdf8fe0db059` to verified integration evidence head `243ed049726e3a8466cbd5a49f806e53fdb0d65b`. Branch `feat/public-catalog-visual-redesign` remains preserved at the same head. The worktree now runs the combined Dashboard, catalog redesign, public price contexts, and catalog-settings implementation directly from `main`; both protected OpenSpec artifacts retained their exact hashes and remain untracked.

## Merge resolution policy

- Catalog visual structure and responsive behavior: feature branch version.
- Public price-context transport, identity, unavailable-state, URL, and authoritative-detail semantics: preserve the already verified contract; prefer the feature implementation where behavior is equivalent because it targets the redesigned UI.
- Operational Dashboard, navigation, authorization, landing behavior, and analytics: `main` version.
- Catalog settings inheritance, customer-facing labels, searchable price-list selection, switches, nullable clearing, literal zero behavior, and existing payload/test identifiers: preserve the current intended work exactly.
- Any unexpected conflict outside the nine predicted paths stops the merge for reassessment.

## Delivery status

Local consolidation is complete. `main` contains the two-parent integration merge `8b324c1d1eadc031edc7df9f4b10fc2f9beb6c2d` and evidence commit `243ed049726e3a8466cbd5a49f806e53fdb0d65b`; the canonical worktree is checked out on `main`. Delivery remains local-only. No push, pull request, deployment, release, or branch deletion occurred or is authorized.
