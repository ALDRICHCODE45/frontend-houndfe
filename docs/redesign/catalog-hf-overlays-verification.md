# Catalog-owned overlay presentation — A8

## Scope and source evidence

Bounded implementation for `odd/tasks/hf-ui-complete-audit.md` A8:
S1 (owned-surface inspection), S2 (modal/control presentation), S3 (legacy paint removal),
S5 (always-light catalog under either host theme), S6 (frontend presentation correction).
These are partial contributions, not closure of those application-wide specifications.

`CatalogLayout.vue` imports catalog CSS and owns `body[data-catalog-theme='light']`.
That boundary already fixes light HF-equivalent roles, including teleported content,
without removing `html.dark`. Before this change, the preview declared a Coco dark
background/ring while catalog CSS already repainted its dialog white and its
`.text-white` fallback label as catalog heading ink. Thus this is removal of competing
legacy declarations, NOT a reproduced contrast failure. The fallback icon and close
control also carried literal Coco/dark utilities; branch/detail scrims used Coco paint.

## Implementation and preserved contracts

- Catalog-owned scrims use existing heading ink at their previous 45%/70% opacity.
- Preview content uses the existing light dialog rule; fallback, close, retry,
  media/fallback/loading paint and focus use catalog or mapped Nuxt semantic roles.
- Retry pairs catalog action with explicit white on-action ink; close/retry use 6px controls.
- Removed only the preview-specific `.text-white` compensation after replacing its
  sole owned consumer. Listing/status/general compatibility rules remain untouched.
- No script, DTO, query, route or request changes. Existing preview transition gate,
  failure URL/identity tracking, isolation observer and focus ownership are unchanged.
- Existing status palettes, image dimensions, modal widths, z-index hierarchy,
  loading/error copy, reduced motion and read-only variant semantics remain intact.

## Checks

- RED: two host-theme preview cases failed on missing owned detail overlay hook.
- RED: CSS declaration test failed on absent catalog scrims after switching to a real
  filesystem read. Initial `?inline`/`?raw` CSS imports returned empty in this test setup;
  those harness failures are not presentation-defect evidence.
- RED: populated/loading/server cases failed on residual Coco classes before their migration.
- GREEN: 72 tests / three suites pass (64 existing cases retained; eight added).
  The existing skeleton paint assertion now names its semantic replacement.
- Existing regressions cover image failure identity, preview serialization, isolation
  observer/attribute restoration, stale leave callbacks, focus restoration and guarded retry.
- Added real Nuxt portal checks cover branch selection and preview fallback in both
  `html.dark` states. CSS assertions prove declarations only, not computed browser styles.

Commands:
```sh
pnpm exec vitest run src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts src/features/catalog/components/__tests__/CatalogHeader.spec.ts src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '**/.worktrees/**' --maxWorkers 1 --no-file-parallelism
pnpm exec vue-tsc --noEmit -p tsconfig.app.json
git diff --check
```

## Limits and parent verification

No build, server, browser, session, Git delivery or backend mutations were performed.
Parent still owns full build and settled browser checks at narrow/desktop widths,
light/dark hosts, real/failing/missing product and variant images, preview Escape/close,
focus visibility, actual computed cascade, contrast and transition appearance.
This unit does not establish all catalog controls/states/routes or global audit acceptance.
Pi-lens reports Vue-import resolution diagnostics in the test files; focused Vitest
and the application compiler pass. No imports were weakened to suppress those reports.

## Key Learnings

CatalogLayout owns the always-light token boundary on body, so Nuxt portals inherit it without changing html.dark.
The preview's old white-label utility was already compensated by catalog CSS, so its presence alone did not prove a contrast defect.
The detail preview's leave callback owns isolation release and focus restoration; presentation migration does not require changing that lifecycle.

## Parent integrated evidence

Job 29 passed the focused catalog suites, full build and whitespace checks. Twelve settled actual-browser cases on `/catalogo/centro` covered branch chooser, missing-image product detail and a real main-image preview at 390/1440px under both `html.dark` states. The host class was controlled explicitly to test coexistence, not a catalog theme-toggle UX. Every dialog retained its white catalog background and light body boundary, respected viewport bounds and closed successfully. Widths: mobile 358px; desktop branch 448px/detail 1152px/preview 768px. Captures: `odd/evidence/hf-ui-complete-audit/catalog-{branch|detail|preview}-{390|1440}-{light|dark}.png`; preview-mobile-dark inspected. Error/variant-specific states, measured contrast and complete keyboard coverage remain part of the wider audit, not proven by these twelve checks. Build chunk warnings remain.
