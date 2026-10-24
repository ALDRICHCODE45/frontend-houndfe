# Public catalog: Vue adaptation

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
