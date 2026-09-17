# Catalog delivery and repository worktree cleanup

## Objective and authority

Deliver the completed catalog work as reviewable local commits, integrate it into local `main` without a pull request, and remove only frontend-repository worktrees that are demonstrably unused.

The user explicitly authorized commits, merge to `main`, and cleanup of unused worktrees. This supersedes the earlier no-commit restrictions only for delivery of the already completed catalog work. No push, PR, backend operation, stash mutation, unrelated source cleanup, force removal, history rewrite, or destructive reset is authorized.

## Current repository state

- Delivery started from local `main` at `970e1a6`, already 24 commits ahead of `origin/main`.
- The delivered scope contains three completed catalog areas: catalog-settings UI redesign, product-editor catalog-section redesign, and anonymous public catalog browse/detail.
- `stash@{0}` must remain untouched.
- `openspec/changes/online-catalog-publishing/.gentle-ai-instance` and `openspec/changes/public-catalog-branch-discovery/verify-report.md` are historical/native artifacts outside this delivery and must remain untracked and unchanged.
- The public browse/detail UI overlaps `CatalogView`, card, grid, and their tests, so browse and detail UI ship together. Their transport/query boundaries remain clean independent work units.
- No PR will be created. No push is authorized.

## Delivery strategy

Use a temporary local delivery branch from the current `main`, path-scoped staging only, and fast-forward merge back into `main` after verification. Never use `git add -A` or force-remove a worktree.

Planned work-unit commits:

1. `refactor(catalog-settings): unify catalog settings surfaces`
2. `refactor(products): redesign online catalog settings section`
3. `feat(catalog): add anonymous product listing boundary`
4. `feat(catalog): add anonymous product detail boundary`
5. `test(catalog): harden product listing invariants`
6. `feat(catalog): wire public browse and product detail`
7. `test(products): align variant stock override interactions`
8. `chore(repo): record catalog delivery and worktree cleanup`

The UI work units exceed the advisory 400-line heuristic because each is the smallest coherent behavior-plus-tests boundary. No PR slicing is applicable by explicit user instruction.

## Tasks

- [x] **L1 — Freeze delivery scope and create a local delivery branch.** Reconfirmed the exact dirty set, preserved `stash@{0}` at `0a121804`, recorded excluded-artifact hashes, and created `delivery/catalog-completion` from local `main` at `970e1a6` without changing working-tree bytes.
- [x] **L2 — Commit the two backoffice redesign work units.** Committed system catalog-settings surfaces as `350763c` after 160/160 focused tests and Prettier, then product-editor catalog settings plus its ODD document as `52aa685` after 31/31 focused tests and Prettier. Authoritative `pnpm type-check` passed; a plain-TypeScript LSP `.vue` import diagnostic was recorded as a false positive because the Vue-aware checker and runtime tests resolve it.
- [x] **L3 — Commit the public catalog boundary work units.** Committed listing boundary `010638c`, detail boundary `2cf3d91`, and verifier-driven listing test hardening `c9c7795`. The final independent combined verification passed 119/119 focused tests, typecheck, Prettier, whitespace checks, static contract review, and byte-for-byte worktree integrity.
- [x] **L4 — Commit public catalog UI and browser evidence.** Committed the 15-path shared UI/E2E/ODD unit as `0985077`. Native assessment was unavailable, so an independent verifier ran the high-risk plan: 179/179 catalog tests, both typechecks, Prettier, and whitespace checks passed. An initial 21/26 browser run was interrupted by empty-app loads including `ERR_NETWORK_CHANGED`; all five failed cases passed on immediate isolated rerun, then the independent full rerun passed 26/26 with unchanged repository status.
- [x] **L5 — Run the final verification matrix.** Passed 51 files / 584 tests, application typecheck, production build, responsive typecheck, all 26 strict-network Playwright cases, Prettier across every delivered path, range and working-tree whitespace checks, and unchanged porcelain status.
- [x] **L6 — Clean only demonstrably unused worktrees.** Removed the clean, unlocked, session-free, already-main-merged `customer-sales-history-tdd-rebuild` worktree without force; pruned only the dry-run-confirmed missing `/tmp/head-type-verify` entry; and removed the two clean temporary assessment worktrees created during delivery. Preserved all 14 Gentle AI candidate views. Stash and excluded-artifact hashes remain unchanged.
- [x] **L7 — Merge locally and close delivery.** Confirmed the delivery branch was exactly seven commits ahead and zero behind local `main`, fast-forwarded `main` from `970e1a6` to verified feature head `3df755c`, deleted the merged delivery branch, and committed this completed record on `main`. Only the two excluded artifacts remain untracked. No push or PR.

## Verification contract

Per-boundary checks:

```sh
pnpm test:unit --run src/features/system/catalog-settings
pnpm test:unit --run src/features/POS/products/components/__tests__/OnlineStockOverrideFields.spec.ts src/features/POS/products/components/__tests__/ProductCatalogSettingsSection.spec.ts src/features/POS/products/views/__tests__/ProductDetailView.test.ts
pnpm test:unit --run src/features/catalog/api/__tests__/catalog-products.api.spec.ts src/features/catalog/composables/__tests__/useCatalogProducts.spec.ts
pnpm test:unit --run src/features/catalog/api/__tests__/catalog-product-detail.api.spec.ts src/features/catalog/composables/__tests__/useCatalogProductDetail.spec.ts
pnpm test:unit --run src/features/catalog
pnpm type-check
```

Final matrix:

```sh
pnpm test:unit --run src/features/catalog src/features/system/catalog-settings src/features/POS/products
pnpm type-check
pnpm build
pnpm type-check:responsive
pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
pnpm exec prettier --check <all delivered files>
git diff --check
```

Runtime evidence is the strict-network responsive Playwright matrix for the public surface. The authenticated backoffice redesign has no repository E2E login harness; its runtime boundary remains the completed component/view integration suite plus production build, with the previously recorded human smoke still pending in its source task document.

## Worktree safety contract

Before removal, repeat `git worktree list --porcelain`, worktree-local `git status --porcelain`, and branch ancestry checks. Use `git worktree remove` without `--force`. Candidate views are native-review-managed and are not unused merely because they are detached or duplicated.

## Verification evidence

L1 preserved the exact pre-branch dirty set. Excluded hashes are `9fa0954a…` for `.gentle-ai-instance` and `9f66230d…` for the historical failed branch-discovery verify report. `stash@{0}` remains `0a121804…`. The delivery branch starts at the same `970e1a6` commit as local `main`.

L2 system settings commit `350763c` contains exactly ten catalog-settings runtime/test paths and passed 11 files / 160 tests plus Prettier. Product-editor commit `52aa685` contains exactly five runtime/test paths plus `odd/tasks/online-catalog-settings-ui-redesign.md` and passed 3 files / 31 tests plus Prettier. `pnpm type-check` passed after the first commit.

L3 created listing-boundary commit `010638c` after 59/59 focused tests, typecheck, Prettier, and staged whitespace checks, then detail-boundary commit `2cf3d91` after 59/59 focused tests, typecheck, Prettier, and staged whitespace checks. Native assessment was unavailable for both and required independent verification. The list verifier identified two test-only mutation gaps: invalid custom quantities used `SYSTEM_STATUS` instead of `CUSTOM_QUANTITY`, and query-key assertions did not protect the `apiBase` segment. Commit `c9c7795` corrected only those two listing specs and passed 60/60 focused tests. A final independent verifier in the main worktree passed all 119 listing/detail boundary tests, typecheck, Prettier, scoped whitespace checks, and static contract inspection; its before/after status remained byte-for-byte identical. No boundary findings remain.

L4 committed the 15 shared public UI, browser-evidence, and ODD paths as `0985077`. The high-risk independent verifier passed 179/179 catalog unit tests, application and responsive typechecks, Prettier, whitespace, and static behavior review. Its first browser run suffered five empty-app boot failures, including explicit `ERR_NETWORK_CHANGED`; the exact five passed immediately with a fresh server, and the verifier's fresh full rerun passed 26/26. Repository porcelain status remained identical throughout and no source defect remained.

L5's first integrated unit run exposed one omitted compatibility spec: 581/584 tests passed, while three `VariantDetailModal.catalog.spec.ts` cases still called `setValue()` on the redesigned `USelectMenu` button for stock overrides. Commit `3df755c` replaced only those obsolete interactions with the real popup-option path and normalized the touched spec's pre-existing Prettier drift. Independent verification passed the exact 14/14 spec, all 245/245 POS product tests, typecheck, Prettier, whitespace, static interaction review, and unchanged repository status. The restarted final matrix then passed 51 files / 584 tests, application typecheck, production build, responsive typecheck, 26/26 Playwright cases, Prettier over the full `970e1a6..3df755c` delivered range, both whitespace checks, and unchanged porcelain status.

L6 repeated every safety check immediately before mutation. The customer-sales-history worktree was clean, unlocked, at `34a8192`, already ancestral to local `main`, and had no active Pi session; it was removed without force while its branch was retained. The only dry-run-prunable record was missing `/tmp/head-type-verify`, which was pruned. The two delivery-created assessment worktrees had already been restored clean and removed. All 14 native-review candidate views remain. `stash@{0}` is still `0a121804…`, and excluded hashes remain `9fa0954a…` and `9f66230d…`.

L7 confirmed `main...delivery/catalog-completion` was `0 7`, switched to `main`, fast-forwarded `970e1a6..3df755c`, and deleted the now-merged delivery branch with ordinary `git branch -d`. Before this final record commit, repository status contained only this intended document plus the two preserved excluded artifacts; the feature head was 31 commits ahead of `origin/main`. No push or pull request occurred.

## Progress and next step

L1–L7 are complete. This document is the final local-main delivery record; after its path-scoped commit, only the two explicitly excluded OpenSpec/native artifacts remain untracked.
