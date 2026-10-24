# Public catalog: Vue adaptation

## Final integrated verification

- Parent independently reproduced **349 current-worktree unit tests**; the four catalog browser suites passed **55 tests** in the T3 run.
- Project type-check passed. Parent responsive type-check initially failed because the branch-discovery viewport helper inferred a literal union excluding its retained 375 × 667 retry case. Its parameter now accepts numeric dimensions; no cases or assertions were removed. `pnpm type-check:responsive` subsequently passed.
- `pnpm build` passed. Vite warns about chunks larger than 500 kB; no bundle-size optimization or configuration changes were included.
- Scoped formatting and `git diff --check` passed. Parent inspected mobile and desktop detail captures; workers inspected all five requested widths.
- Native assessment was unavailable because pre-existing untracked research requires a scope declaration, including for committed-only assessment. No native review approval is claimed. LSP Vue-import findings/inconclusive probes remain separate from the successful project compiler check.
- The earlier unscoped unit command failed in three untouched sibling worktree copies; current-worktree isolation is explicitly recorded, not a claim that the unscoped command passes.
- Browser fixtures deliberately block external icons; production media/icon availability, physical devices and a comprehensive accessibility audit were not verified.
- Delivery covers the existing browse-only catalog, cards and detail. Search, cart, checkout, buyer identity and commercial integrations were not implemented or simulated. Commits remain local; nothing was pushed or merged.


## T3 — read-only detail (S1, S2, S3)

### Composition and preservation

S1: adapt the latest `detail-responsive-390.png` / `detail-responsive-1440.png`
reference, not its simulated commerce. Identity (brand, category, product title)
precedes media in DOM/mobile reading order. At 768 px the same identity sits beside
contained media, above price and content. White panels, 12 px corners, navy balanced
titles, 14 px metadata and the existing local/system font reuse T1 tokens. The
published price-context name is shown without inferring price rules or currency
conversion. Existing `formatCentsMXN` remains the formatter.

Component map stays unchanged: `CatalogProductDetailModal` presents typed
`open/detail/state` props and emits `close/retry`; its two existing Nuxt UI dialogs
own detail and image presentation. No new component or orchestration boundary is
needed for this scoped template/CSS adaptation. The view and composable retain
request gating and stale-result isolation. The entire component script is unchanged.

S2/F1: general plain-text description has its own labelled information region;
each variant retains only its own name, option/value, image, price, custom quantity
and selected-branch availability. The DTO has no structured technical attributes,
so no specifications table, measurements, materials or inferred shared attributes
are synthesized. Variant rows explicitly describe read-only information, not a
purchase selection. Existing thumbnail enlargement suffices; no zoom/selection or
commerce control was added. F2/F3/F4 flows remain absent and out of scope.

All existing populated, loading, retry-pending, not-found, rate-limit, network,
server, sparse-detail, hidden/null-price, hidden-stock and media-failure behavior
remains. Main/variant/preview URL-keyed failure state, identity teardown, application
isolation, Nuxt UI dismissal and exact trigger focus restoration are unchanged.
No DTO, API, adapter, helper, composable, credentials or dependency changes.

### Test-first and validation

- RED: `pnpm test:unit --run src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts --exclude '.worktrees/**'`
  exited 1: 58 passed, one intended failure (missing identity region).
- Browser RED: `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts`
  exited 1: 10 passed, five intended failures (mobile title after media at 320/390;
  missing price-context at 768/1024/1440).
- GREEN: those exact focused commands exited 0 with 59 units and 15 browser cases.
  Added a passing triangulation test for distinct sibling option/value data and a
  hidden-price/hidden-stock sibling; it proves no copying into that row. Cosmetics
  use screenshot readback, not invented RED evidence. A single cosmetic readback
  pass tightened panel corners and balanced titles; no failing validation remained.
- Final `pnpm test:unit --run src/features/catalog src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '.worktrees/**'`:
  exit 0, **349/349**, 15 files. Existing loading/failures, context retry, media
  isolation, keyboard/close and sibling-data assertions pass.
- `pnpm type-check`: exit 0. Known test Vue-import LSP diagnostic persists; project
  `vue-tsc --build` is authoritative. No configuration workaround.
- Final `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts`:
  exit 0, **55/55**, including 21 detail cases. Target widths 320/390/768/1024/1440
  plus original 375×667 and 1280×800 coverage; 320 retains its original 568 px
  height. Strict anonymous request ledger, exact control inventories, 72 px variant
  frames, preview geometry, nested Escape, outside dismissal, exact invoker/media
  focus return and concurrent context-preserving retry assertions remain intact.
- Scoped Prettier check on the five T3 authored files and `git diff --check`: exit 0.

### Screenshot readback and limits

Inspected `artifacts/responsive/local-run/detail-{320,390,768,1024,1440}.png`.
320/390 show identity above contained media, then price/context and general
information; variants continue in the scrollable body. 768 uses a narrower split;
1024/1440 show both variant rows alongside media with readable independent prices
and statuses. No document/panel horizontal overflow at any tested width. A local
SVG thermos illustration replaces the old blank data URI only in the browser
fixture, not production media. Icons remain deliberately blocked by the fixture;
the dev toolbar overlays capture bottoms. No icon/configuration repair, physical
device, screen reader or comprehensive WCAG audit is claimed.

S3: one uncommitted detail work unit for parent review. No branch, stage or commit
operations; pre-existing task/research/review files remain untouched. Rollback only
the T3 changes in the detail component/test, catalog detail CSS, detail browser spec,
this section and generated `artifacts/responsive/local-run/**` evidence. Risk: none
identified; no technical blocker. T4 final integration/build and independent review
remain parent-owned and are not claimed complete.

## T2 — listing and cards (S1, S2, S3)

### Visual decisions and preservation

- Reuse T1's 1360 px container and 16/24/32 px gutters. One mobile column
  prioritizes legible names/prices over copying the prototype's cramped two-column
  mobile cards; two columns start at 640 px, three at 768 px, four at 1280 px.
- White, square media regions contain the published image with 24 px inset rather
  than cropping packaging. Honest absent/failed-media fallback remains unchanged.
  Cards have 12 px corners, quiet borders, no lifting/shadow animation and visible
  keyboard outlines. Existing catalog palette and local/system font remain.
- Sentence-case 14 px brand/category metadata, 16 px product names, 24 px tabular
  prices and 14 px quantities. Cards stretch within each row; names are not clamped.
  Long prices and custom quantities wrap; the visible `Ver detalles` cue is text
  inside the existing single button, not a second control or purchase action.
- No script, DTO, adapter, composable, request, price/stock helper, header or detail
  changes. `formatCentsMXN`, existing availability labels, hidden/null-price copy,
  actual `image.url`, failed-image recovery and exact emitted ID/invoker remain.
  No `Desde`, presentation counts, fabricated product metadata, per-card detail
  fetching, cart, filters or presentation selection. S2/F1 cannot be recreated by
  these cards because no variant specifications are copied or synthesized;
  prototype-only F2/F3/F4 flows remain absent. Detail adaptation remains T3.

### Test-first and validation evidence

- RED: root-only unit command below exited 1: 345 passed, 2 intended failures
  (contained image / visible detail cue, shell container / tablet density).
- Browser fixture setup initially failed all five new viewport cases because the
  fixtures' top-level availability did not match stock presentation. Corrected
  only fixtures, not the adapter. This was not an intended behavior RED.
- Meaningful browser RED after fixture correction: 24 passed / 5 failed, exit 1:
  absent visible detail cue at 320/390, wrong column counts at 768/1024, unequal
  card heights at 1440. Then implementation passed all 29 tests, exit 0.
- GREEN: `pnpm test:unit --run src/features/catalog src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '.worktrees/**'`:
  exit 0, **347/347** tests, 15 files. New negative checks cover null and hidden
  prices plus no invented presentation controls; existing media, zero quantity,
  context gate, retry and exact event contracts pass unchanged.
- `pnpm type-check`: exit 0 (`vue-tsc --build`). Tool-side Vue import diagnostics
  remain non-authoritative; the required project type-check passes.
- `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts`:
  exit 0, **29/29** (20 products, 9 detail). Preserves strict request ledger,
  enabled-control inventory, price, stock, keyboard activation and exact invoker
  focus-return assertions. Adds populated 320/390/768/1024/1440 checks for rendered
  density, equal row heights, gutters, containment, typography, focus outline,
  long values, fallback and unsupported-control absence.
- Scoped `pnpm exec prettier --write` and `pnpm exec prettier --check` on the
  seven T2 source/test/document paths: exit 0. `git diff --check`: exit 0.
- Colors, corner radius and other cosmetics have no meaningful behavior RED;
  evidence is browser readback, not invented test-first lifecycle claims.

### Populated screenshot readback

Inspected these full-page captures in `artifacts/responsive/local-run/html/data/`:

| Width | Screenshot                                     | Observed composition                                                         |
| ----- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| 320   | `9a4de53f4fb5c9455dddf7bd308623c0ff571d32.png` | One column, extra shell rows, long quantity wraps below price.               |
| 390   | `a7119a37843bc31df695959b3a85a52ffd0c186c.png` | One column, readable price/name, contained media.                            |
| 768   | `057f6659362548123751248a181a2d15ad1d1e0e.png` | Three columns, long title wraps, quantity takes another line, actions align. |
| 1024  | `3174f690c9b9a3cdb0207d4e439a1d615ac01d3f.png` | Three columns, 32 px gutters, roomy price/quantity row.                      |
| 1440  | `8ce4cfe676759868d1d83ac6a0592c868a708daf.png` | Four columns, grid aligns to intro/header container; equal-height row.       |

All five have no document or card horizontal overflow. Focused first-card outlines
are visible. The bowl illustration and long-value scenarios are isolated browser
fixtures only, not production fallback media or catalog additions. The existing
Vue dev toolbar overlays portions of captures; external icon requests are still
blocked by the strict fixture, so the no-image glyph is absent but its written
state remains visible. No icon/dependency/configuration repair was attempted.
No physical-device, screen-reader or comprehensive WCAG audit is claimed.

### S1–S3 self-review and rollback boundary

S1: listing follows the accepted light product-first hierarchy, not prototype
commerce. S2: truthful published price/stock/media and read-only semantics remain;
no unsupported prototype notices or variant metadata. S3: this is one uncommitted
listing work unit for parent review; no staging/branch/commit operations performed.
Rollback scope is the two card/grid components, their two unit tests, listing-only
CSS additions, new products browser cases and this T2 section. Preserve T1 and all
pre-existing research, task edits and screenshots. No technical blocker remains;
T3 detail and T4 integrated verification are still pending.

## T1 — shell only (S1, S3)

The accepted reference is `v0-public-catalog-prompt.md` and the latest
`.playwright-review/home-390.png` / `home-1440.png`, not the initial blank captures.
The implementation retains Vue, Nuxt UI and the current anonymous browse contract.
This is not completion of the listing, detail or commerce journey.

### Visual decisions

- Page `#F5F6F8`, white surfaces, navy `#173968`, body `#24313D`, secondary
  `#576574`, cobalt `#2442F6`, restrained gold wordmark punctuation `#F6BB13`.
- Provisional typographic HoundFe wordmark; no invented logo artwork or pet imagery.
- Compact white header with search on the second mobile row, real branch and price
  selectors, a flat category band, and a quiet footer. At 320 px the branch trigger
  gets its own row and result metadata wraps below categories to avoid collisions.
- Shell container caps at 1360 px with 16/24/32 px gutters. Existing grid/card
  sizing remains unchanged for T2; shell/grid gutter alignment is therefore pending.
- No local Manrope asset was found under `public` or `src/assets`. Catalog CSS uses
  `local('Manrope')` through a catalog-only family, otherwise
  `ui-sans-serif, system-ui, sans-serif`. No new remote font import/download.

### Ownership and preservation

`CatalogLayout` temporarily marks body with `data-catalog-theme="light"`, covering
Nuxt UI portals as well as the shell. It restores the previous attribute and
inline html/body backgrounds on unmount, without overwriting a newer background
owner. Neither the global dark class nor persisted theme preference is changed.
Catalog styles are inert outside this boundary. Light compatibility rules cover
legacy card/detail color utilities until their separate adaptation units.

The header still owns only branch-dialog visibility and emits selection intent.
The view retains all route/query, authoritative price-context and request gating
logic unchanged. Branch/context composables, DTOs, adapters, currency and stock
logic are untouched. Nuxt UI continues to own dialog focus trapping, Escape and
outside dismissal; exact trigger focus return remains tested. Search, category
filters, ordering and cart remain disabled, not fake links. There are no account,
checkout, policy or contact links without an implemented destination. Category
names/counts and result totals still come exclusively from the response.

S2 preservation context: no prototype scenarios/cart notices/commercial restriction
flows were introduced. Variant metadata correction F1 remains a T3 concern; T1
makes no variant-data changes.

### Verification evidence

- Layout RED: missing catalog body boundary; view RED: missing populated-list
  heading and labelled navigation landmark. Both passed after implementation.
- Browser RED/readback caught a 320 px wordmark collision, then a selected-state
  category/total collision. Responsive wrapping fixes passed the final 11-test run.
- Cosmetics have no meaningful pre-implementation behavior failure. Theme-toggle
  removal was asserted after its implementation, not an observed test-first RED.
- `pnpm test:unit --run src/features/catalog`: exit 1, 1362 passed / 3 failed.
  All final failures are in pre-existing `.worktrees/caja-visual-second-pass/`,
  `.worktrees/delivery-routes-main-integration/`, and `.worktrees/houndfe-caja-pilot/`
  copies of `CatalogView.spec.ts` (unresolved-price-context detail test). Those
  checkouts were not edited. This unchanged command is **not passing**.
- `pnpm test:unit --run src/features/catalog --exclude '.worktrees/**'`: exit 0,
  342 tests. This is current-worktree isolation, not an old/new differential.
- `pnpm test:unit --run src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '.worktrees/**'`:
  exit 0, 2 tests, including previous host-state restoration and newer-owner safety.
- `pnpm type-check`: exit 0. Pi-lens reported unresolved Vue SFC imports in test
  files; requested `vue-tsc --build` is the authoritative successful check.
- `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts`:
  exit 0, 11 tests; isolated fixture browser, no production mutation or shared session.
  Strict network and exact enabled-control inventories remain enforced. Checks
  cover 320/390/768/1024/1440 px, selected/unselected shell, light teleported branch
  dialog under a dark browser scheme, 44 px selector targets, no document overflow,
  Escape/outside dismissal, focus return and server-error retry.

- Final `pnpm exec prettier --check` with all eleven changed paths explicitly
  supplied: exit 0. Two scoped files were formatted with parent authorization.
- Final `git diff --check`: exit 0.

### Visual readback and remaining limits

Initial-pass generated screenshots were viewed under
`artifacts/responsive/local-run/html/data/`; subsequent runs replace that generated
report directory. The following hashes record historical readback, not retained files.
Viewed selected shells: `4028ca6669f1b2ea873f9b76d1125aef9271e690.png` (320),
`562f21f064b63192fbc3e345fed7127607e6daa1.png` (390),
`00fd9a539a355a33cfcfb77be351921317b8572f.png` (768).
Viewed closed shells: `01c98dbfcf225cbd470c865f35f16f5442af1037.png` (390),
`02f7af89995e915202ad972dd57d45503c4e9874.png` (1024),
`05f93f7cda8df539260be5febd7febbd21fd5e9b.png` (1440).
Viewed selected branch dialog: `07d650b1c6134a8c196931d03aa91935b4d50584.png` (320).

320 uses extra rows without overlapping labels; 390 retains the compact header;
768 wraps search and price selector within the middle header column; 1024/1440
use the wide search row and understated footer. Dialogs stay within viewport.
These shell fixtures have empty product results; populated card/grid visual
acceptance belongs to T2. Existing icons did not render in the isolated captures;
visible cart/order/close labels do not depend on them. Existing development toolbar
appears in screenshots and can cover content; no toolbar configuration was changed.
No full accessibility audit, screen reader, physical-device or cross-browser claim.

### Bounded T1 compatibility correction

- Initial RED command:
  `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts`.
  Exit 1, all nine tests failed at the exact shell inventory because it still
  expected `Cambiar tema`. Removed only that deliberately retired control from
  `SHELL_CONTROL_NAMES`; all other inventory, network, price, media geometry and
  focus assertions remain unchanged.
- The first four-suite run passed 35/38 tests. Three products-suite failures were
  shell-caused: the category band added a full-width bottom border, violating the
  existing borderless/inset contract. Corrected catalog CSS only: removed that
  border and made the toolbar strictly inset at the existing responsive gutters.
  The products suite was not edited or weakened; no cards/grid/detail redesign.
- Final browser command:
  `pnpm exec playwright test --config playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts e2e/responsive/specs/public-catalog-branch-discovery.spec.ts e2e/responsive/specs/public-catalog-products.spec.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts`.
  Exit 0, **38/38 passed**, including the nine detail tests and all strict
  inventories, media/focus/geometry, price and network checks.
- `pnpm test:unit --run src/features/catalog src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '.worktrees/**'`:
  exit 0, **344/344 passed**, independently matching the parent's spot check.
- `pnpm type-check`: exit 0 after the CSS correction. The earlier unchanged unit
  suite's three sibling-worktree failures remain recorded above; no claim that
  the unchanged suite passed, and no sibling/configuration changes.
- Icon investigation: `e2e/responsive/fixtures/network.ts` explicitly lists
  Iconify, UniSVG and SimpleSVG Lucide endpoints in
  `EXPECTED_BLOCKED_STARTUP_EXTERNALS`, and aborts matching requests. This
  establishes a harness limitation for the isolated screenshots, not evidence of
  a production icon failure. Production/offline icon availability was not tested.
- Latest populated-shell readback under `artifacts/responsive/local-run/html/data/`:
  `85ee0d64f3b5748dcb0b4915a5e058ce701ff6c9.png` (320),
  `21b752e7b2d7ee659bff605e4c4d30782dd3f6f4.png` (375), and
  `09d1c275b5acd33557f26e69974468a18b55a3eb.png` (1280). Category content is
  inset and borderless; result text and ordering controls do not collide. These
  supplement earlier five-viewport shell readback, not T2 card visual acceptance.
- Parent's native assessment remains unassessable due to pre-existing untracked
  scope; that assessment is not resolved or represented as passing here.
