# Live catalog smoke — findings, corrections and verification

## Final outcome

The rebuilt local preview is usable at **http://localhost:4173/catalogo/centro** with the explicitly fictional product and variant described in the mutation ledger. Real Playwright verification covered 320/390/768/1024/1440/2680 widths, public requests, images, dialogs and keyboard focus; screenshots were read for visual judgment. The parent independently confirmed **362 unit tests** and responsive type-check, and inspected final mobile listing/desktop detail captures. Project type-check, build and real browser smoke passed in the writer run.

The source corrections below clarify empty states, unavailable tools and price scopes without introducing commerce or changing prices. Preview/backend were not stopped; only frontend build output was refreshed. Local screenshots/scripts remain in the ignored `artifacts/live-catalog-smoke/` directory; this report is the tracked evidence index, not a claim those binaries are committed.

Limits: mocked E2E were not run because their fixed port is occupied by the user's preview; native assessment still rejects undeclared untracked scope (no native verdict); build CSS-token/chunk warnings remain; live coverage is one product/context with a null-image variant, not all stock/hidden-price/grid states or a comprehensive accessibility audit. Setup created two synthetic images in externally configured CDN storage; no deletion or further upload was performed. Original medication records were untouched. No transactions, external messages, publishing of code or merges occurred.

Historical phases below retain original observations and intermediate limitations; the T2 section records subsequent corrections.

## Status and prerequisite

**Completed — T1 bounded live diagnostic, including populated listing/detail/image preview.** No technical blocker remains for this pass. Findings below are recommendations for parent-owned T2, not implemented fixes. This worker made no application source changes, database mutations, uploads/deletions, transactions, auth bypasses, builds, service restarts, dependency changes or tracking-file edits. Parent's publication, fictional product/variant and external-storage image effects are recorded in the current populated section. Earlier empty-state sections are retained as historical evidence, not current blocker claims.

Current populated branch: **http://localhost:4173/catalogo/centro**. It loads Sucursal Centro, PUBLICO and **one fictional test bowl**. Its card shows $149.00; detail shows product $129.00 and variant $149.00 independently. Original entry **http://localhost:4173/catalogo** previously had no selectable published branch; original screenshots are preserved. Selecting a published branch is the visitor prerequisite. Parent resolved publication and prepared a fictional eligible product; no additional setup is needed for this bounded pass.

Admin entry **http://localhost:4173/system/catalog-settings** redirects to **http://localhost:4173/login?redirect=/system/catalog-settings**. The observed localhost login has email/password inputs and an Ingresar button. Source confirms this is a tenant-scoped settings route guarded by `read:TenantCatalogSettings`; no guard was bypassed. Tenant, branch, product and price-list identities/settings remain unverified.

The earlier worker-local credential-input blocker is **resolved**: parent used its available MCP browser on the observed localhost login, selected Sucursal Centro and published the catalog. This does not imply MCP browser tools are globally unavailable. Resumed checks use only independent anonymous Chromium; this worker did not connect to parent's admin browser, log in, export authentication state or perform any database write.

## Historical phase 1 — no published branch

Only real network requests; no mocked specs or routes. Separate anonymous/admin browser contexts, no authentication-state export. Each owned browser was closed; no shared browser was opened or closed.

| Viewport | Screenshots captured and visually inspected | Result |
| --- | --- | --- |
| 320 × 720 | `entry-320.png`, `chooser-320.png` | Header stacks to three rows; category/sort add two rows; title wraps cleanly. Full-page capture extends beyond the viewport, so fixed modal overlay ends at viewport bottom, not document bottom. |
| 390 × 844 | `entry-390.png`, `chooser-390.png` | Branch action remains beside wordmark/cart; legible two-line central title and description; chooser copy fits. |
| 768 × 1024 | `entry-768.png`, `chooser-768.png` | Single header row, large empty content field, compact centered chooser. |
| 1024 × 900 | `entry-1024.png`, `chooser-1024.png` | Clear navy heading, readable muted copy, aligned shell edges. |
| 1440 × 1000 | `entry-1440.png`, `chooser-1440.png` | Bounded header/footer container, conspicuous empty expanse, small branch action far from central instruction. |
| 2680 × 1260 | `entry-2680.png`, `chooser-2680.png` | Wide desktop approximation at half the supplied screenshot's pixel dimensions; same aspect ratio, not an exact DPR reproduction. Bounded shell and very sparse central field. |

All images are under `artifacts/live-catalog-smoke/`. Readback included all twelve screenshots and existing `.playwright-review/home-390.png` / `home-1440.png` references. Later rerun used identical code/application state except added console counters.

At all six widths: no document horizontal overflow; Escape closes chooser after transition and restores exact branch-trigger focus. First immediate post-Escape measurement incorrectly counted the still-exiting dialog; waiting 300 ms resolves this without application changes. No runtime page errors; zero console error/warning events in the final anonymous run. Console message strings were deliberately not captured. Actual Iconify requests return 200 and map-pin/search/store/chevron/sort/retry glyphs are visible in screenshots; computed `mask-image: none` alone is not an icon failure (rendering uses another mechanism). Local assets return 200/304. Google font stylesheets return 200. No product images were available to request or inspect; no invented/downloaded photos were introduced.

## Observed UX and minimum T2 recommendations

1. **Entry state gives an unavailable instruction.** Even after successful branch discovery establishes no published branches, the main page still tells the visitor to select one. Only opening the distant header action reveals why they cannot proceed. Minimum correction: propagate the known branch-empty state into the main entry presentation and say no branches are published, without inventing products or bypassing discovery. Inspect `src/features/catalog/views/CatalogView.vue` and `src/features/catalog/components/CatalogProductGrid.vue`; change only the existing branch-gate message/state path with focused tests. This is the strongest source-level finding, distinct from the underlying database publication prerequisite.
2. **Disabled affordances remain visually ambiguous.** Search explicitly says unavailable, but outlined Carrito and Ordenar resemble enabled buttons, and Todas las categorías resembles ordinary navigation. Their unavailable appearance lacks the clarity of the search field. Minimum review surfaces: `src/features/catalog/components/CatalogHeader.vue`, `CatalogCategoryBar.vue`, and existing catalog CSS; retain disabled semantics and do not implement commerce/filter/sort behavior. A subtle consistent unavailable treatment is preferable to making new features or adding a large notice.
3. **No demonstrated layout/icon regression.** Navy/white hierarchy, generous spacing and readable text remain coherent with the reference palette. Mobile wrapping is intact. The approved reference is content-rich, while this live state is almost entirely blank; missing published content is the main difference, not justification for fabricating its hero/categories/products. Wide-screen blankness is substantial, but do not widen everything or add filler before inspecting a populated branch.

Recommendations are bounded follow-up candidates, not implemented fixes. Product-card/detail/image proportions, variant thumbnails, nested image preview Escape/focus, price-context selection, missing/hidden-price states, product truncation, and populated scrolling **remain untested**. Do not infer success from previous mocked evidence or manufacture additional fixes before those live states are reachable. No comprehensive contrast measurement, screen-reader audit, physical-device check or offline-icon guarantee is claimed.

## Setup mutation ledger

**Parent-reported authorized mutation:** selected Sucursal Centro, opened Catálogo online, observed No publicado with PUBLICO already selected/default and detailed stock. Changed only publication **false → true** using **Guardar → Confirmar**; reloaded and verified Publicado true. Branch ID: `ced6cc10-a037-4f41-92af-ee69bbb51c8b`; slug: `centro`. Parent observed anonymous branch discovery return 200 with that branch. This worker independently verifies its discoverability and working public branch route. No product, price, inventory or order changes were made by parent; this worker made no DB writes. No sales, payments or messages were created.

## Commands and limits

- `git rev-parse --show-toplevel` / `git status --short`: verified project and existing untracked research; preserved all pre-existing files.
- `codegraph query "public catalog routes"`: no results; `codegraph query Catalog`: located catalog/header/view and settings route references before scoped source reads. Existing `.codegraph/` was present.
- `node artifacts/live-catalog-smoke/probe.cjs`: initial anonymous request succeeded; first chooser attempt timed out because visible text was used instead of the trigger's actual accessible name. Diagnosed once from `CatalogHeader.vue`, corrected to `Explorar sucursales`, and the same probe succeeded. Not an application timeout defect.
- `node artifacts/live-catalog-smoke/anonymous-smoke.cjs > artifacts/live-catalog-smoke/anonymous-run.log`: exit 0; six real-browser viewports, chooser/Escape/focus, response status ledger, zero console error/warning events and localhost login redirect. Results: `anonymous-results.json`; no response headers/bodies, tokens or credential/session values captured.
- `git diff --stat`: empty tracked diff; feature source unchanged. Evidence directory is Git-ignored; parent must explicitly decide evidence retention rather than assume screenshots are tracked.
- RED/GREEN: not applicable to read-only diagnostic/browser setup; no application implementation or T2 regression was attempted. The prior statement describing TDD as an activation toggle was incorrect. Browser observations are verification evidence, not an implementation RED/GREEN cycle.

Named risks: **Product eligibility/setup** remains unresolved; **Populated catalog** remains unverified; **External icon dependency** worked online but is not proven offline. **Publication setup/credential input** is resolved by parent. No build/mock E2E/lint suite was run, as required.

## Historical phase 2 — published branch, zero eligible products

New evidence is separate under `artifacts/live-catalog-smoke/after-publication/`; original no-branches screenshots/results were not overwritten.

**Actual public responses:** branch discovery, `/public/catalog/centro/price-contexts` and `/public/catalog/centro/products` all return HTTP 200. Context discovery contains one option, `PUBLICO`, ID `dae52cee-79b8-44e8-b5b2-8d2502f8f7e3`, default true. Product response has `items.length: 0`, `meta.total: 0`, `totalPages: 0`, no category facets and **`excludedCount: 2`**. The public response does not explain the two exclusions; neither missing prices nor unpublished products can be asserted as their cause. The public UI displays “0 productos” and “Esta sucursal todavía no tiene productos publicados”, with Actualizar. That publication-specific explanation is not proven by this response.

Clicking Actualizar issues another real product request returning 200 and the same empty result. Selecting the existing PUBLICO option generates the explicit URL **http://localhost:4173/catalogo/centro?priceListId=dae52cee-79b8-44e8-b5b2-8d2502f8f7e3**, still empty. There is no alternate context available for switching. Product cards, detail triggers, media, variants, image previews, hidden/missing prices and populated scrolling are therefore unreachable, not passing. No detail requests or product image requests were invented.

### Screenshots read and responsive behavior

At **320×720, 390×844, 768×1024, 1024×900, 1440×1000 and 2680×1260**, captured and READ `list-{width}.png` and `context-{width}.png` (12 screenshots). Also captured and READ `chooser-390.png` and `chooser-1440.png`. Selector and branch chooser were exercised at all six sizes. No document horizontal overflow; both overlays close on Escape and return focus to their exact trigger at every size. No console errors/warnings or runtime page errors. Actual icons render. Narrow 320 full-page captures include below-viewport footer content; this does not imply the modal overlay is shorter than the viewport.

Visual findings:

- **320:** four header rows plus category/count/sort rows consume almost half the viewport before empty content. They fit cleanly, but unavailable search/cart/category/sort dominate a browse-only experience. Empty heading wraps coherently; no clipping.
- **390:** full-width PUBLICO row and clear two-line empty heading. Price dropdown fits, but the closed field gives only the business name, with no visible indication it changes the price list.
- **768:** search and PUBLICO stack in the middle header group while wordmark, branch and cart are vertically centered beside it. This looks less balanced than desktop, but is not a demonstrated overflow/functional defect. No speculative layout rewrite recommended before populated review.
- **1024/1440:** clean single-row header; navy type, white panels and muted copy retain reference palette and hierarchy. Empty content occupies most of the screen; not evidence for adding artificial products or decorative heroes.
- **2680:** bounded header/footer remain readable at actual CSS size; the vast empty field is more prominent. This is content absence, not a proven need to expand the 1360px content cap.
- **Branch chooser:** selected Centro row is clear, check icon visible and address truthfully says Dirección no publicada. At desktop a single branch occupies half the two-column grid, leaving unused space; minor polish only, not a blocker.
- **Price selector:** dropdown has a working-looking search field even with only PUBLICO; no alternate price rules can be tested. Existing accessible name is Lista de precios, but sighted users see only PUBLICO. Do not confuse this local context search with disabled catalog search.

### Prioritized T2 candidates and narrow regression surfaces

1. **Accurate empty-state explanation (highest confidence):** keep excluded records/prices private, but replace the assertion that the branch has no published products with neutral public-facing availability copy unless publication absence is authoritative. Also preserve the pre-publication finding that successful empty branch discovery should not continue asking visitors to choose a branch. Minimum surfaces: `src/features/catalog/components/CatalogProductGrid.vue`, `src/features/catalog/views/CatalogView.vue`, their existing `__tests__` counterparts; extend the existing branch/products browser specs only during an isolated mocked-test run, never on the user's running preview. Retain branch/context request guards and retry behavior.
2. **Unavailable-control clarity:** retain disabled semantics but distinguish Carrito/Ordenar/category visually as unavailable, as search already does. Source: `CatalogHeader.vue`, `CatalogCategoryBar.vue`, existing catalog CSS; tests in corresponding component suites and `e2e/responsive/specs/catalog-entry-disabled.spec.ts`. This is visual clarity, not a mandate to implement commerce.
3. **Visible price-context meaning (lower priority):** give the existing PUBLICO selector a concise visible label such as Lista de precios without inventing pricing rules or alternate contexts. Source: `CatalogPriceContextSelector.vue` and its existing unit suite; verify mobile header space before adding another row. Accessible naming already exists; this is a sighted-user discoverability issue, not a missing accessible-name claim.

No product-card/detail/media defect is established. Complete setup/live populated inspection before authorizing those source surfaces.

### Minimal next setup and command evidence

Parent/admin follow-up should inspect the two excluded candidates' catalog publication/variant settings and valid PUBLICO pricing through the existing app UI. Product existence and exact exclusion causes are not established by an exclusion count alone. Prefer making one existing disposable test candidate eligible with a truthful valid price over creating/reseeding inventory. Frontend source exposes variant modes INHERIT/ON/OFF and a default-context-no-valid-prices warning, but neither condition was observed in admin by this worker. Exact necessary mutation cannot be determined anonymously, and **no DB writes are authorized for this resumed pass**. Do not use an auth bypass, fabricate prices/images or make orders to populate the UI.

- `node artifacts/live-catalog-smoke/published-probe.cjs`: exit 0, actual branch/context/product 200 responses, empty UI, one PUBLICO option.
- `codegraph query catalogPublishMode`: located existing variant-publication UI/types; scoped reads only, no backend reads.
- `node artifacts/live-catalog-smoke/published-smoke.cjs > artifacts/live-catalog-smoke/after-publication/run.log`: exit 0, all six viewports, 14 inspected screenshots, real retry and explicit-context selection. Public response summaries and status-only ledger in `after-publication/results.json`; no auth/session/credential content.

## Current phase 3 — populated live diagnostic completed

### Parent setup ledger (nonsecret; worker did not mutate data)

- Publication false→true for Sucursal Centro is recorded above. Existing PUBLICO/default and stock presentation were retained.
- Parent inspected the original two candidates and found medications displaying zero price; left them untouched. This observation does **not** establish the exact public exclusion cause. The current public response still reports `excludedCount: 2`.
- Parent created product **Comedero de prueba visual — no comercial**, ID `05733bb4-f5c5-4cfc-b081-1ccd8475549c`, SKU `SMOKE-CATALOG-BOWL-20261024`, PUBLICO **129 MXN**, stock **0**, POS off, taxes off. Its description explicitly identifies a fictional local visual test. These are new entities, so there are no previous product values.
- Parent created variant **Azul de prueba**, Color, ID `af4017bd-75ea-465d-82f5-b793fc1c10cf`, SKU `SMOKE-CATALOG-BOWL-BLUE-20261024`, price **149 MXN**, stock **0**, image null. No real sales/orders/payments/messages were made.
- Parent generated a clearly labeled synthetic bowl illustration, not a real product photo: `artifacts/live-catalog-smoke/smoke-bowl-blue.png`. App UI upload uses configured **external DigitalOcean CDN storage**, not local-only files. Two image records now exist: `3dcf0c21-efda-47b4-b757-30acffe5ea61` and `fa257a13-1134-42a4-b284-4d82c63a7c43`, both `isMain: false`. Parent reports initial MCP chooser appeared to return without success but apparently applied its buffer, followed by a successful explicit upload: duplicate/external-storage effect is disclosed, not hidden or cleaned up. This worker performed no upload, deletion or storage mutation. No secrets/personal data were used in the generated image.

### Real response and image evidence

All branch/context/list/detail calls return **200**. PUBLICO remains the only/default context. Listing returns **one item**, `price: { fromPriceCents: 14900, priceCents: 12900, hidden: false }`; detail returns product `priceCents: 12900` and variant `14900`, both out_of_stock. No endpoint/status suggests a product-fetch error.

Card uses its actual published image URL. Detail has no `isMain: true` image and selects the **first** response image, matching card and preview. The selected CDN object `/Product/05733bb4-f5c5-4cfc-b081-1ccd8475549c/d178fbad-73f9-448e-b788-e1d9536036e2.png` returns **200**, decoded at **640×640**, and visibly renders in card/detail/enlargement. The second duplicate image is in the public detail response but is not selected/requested by this UI; no success claim for its independent render or a gallery. Missing main flag does not break this existing first-image fallback.

Variant image is **null**. Its written/labelled absent-media fallback glyph displays; **zero variant image-preview triggers** exist. This is correct unavailable-thumbnail behavior, not a failed remote image and not proof of variant-image loading/enlargement. No photo, URL or response was fabricated.

### Six-width screenshot readback and functional evidence

New evidence: `artifacts/live-catalog-smoke/populated/`, preserving both prior phases. Captured and **READ all 24 screenshots**: `list-{width}.png`, `detail-{width}.png`, `variant-{width}.png`, `preview-{width}.png` for **320/390/768/1024/1440/2680**. Variant captures intentionally repeat the desktop detail when everything already fits; mobile captures show lower scrolled content that initial detail captures cannot show.

| Viewport | Actual visual judgment |
| --- | --- |
| 320×720 | Header consumes substantial vertical space, but card title wraps without clipping. Product image is contained; price/detail cue remain clear after scroll. Detail title precedes media; price/context/description and variant are reachable in internal scroll. Sticky close stays visible. Preview fits without crop and is only slightly larger than the detail image because screen width is limited. |
| 390×844 | Generous square image dominates one-column card, consistent with approved adaptation. Long title wraps to two lines. Detail identity, image, price and description remain legible; variant requires a short scroll. No truncation or overlap. |
| 768×1024 | Single card occupies one of three columns, leaving honest empty space. Detail splits contained media left and identity/price/description/variant right; some blank space below media, but panel remains balanced and entirely readable. |
| 1024×900 | Three-column listing sizing, not a stretched one-item banner. Detail has a comfortable 896px split with clear hierarchy and independent variant price. Preview fits tall viewport. |
| 1440×1000 | Four-column grid slot, long title wraps cleanly. Centered detail uses navy type, quiet borders, white panels and readable metadata; enlarged illustration is contained, with clearly visible focused close. |
| 2680×1260 | Same bounded grid/detail composition; single product leaves substantial unused background, expected with one record. No reason to fabricate density or stretch image/card full-width. Preview remains centered with sensible cap. |

At every width, keyboard Enter opens detail from the focused card. Description is exactly “Registro ficticio para verificar el catálogo local. Comedero de ejemplo, sin uso comercial.” Price context reads “Lista de precios: PUBLICO”. The Azul de prueba row retains its own name, Color value, $149.00 and Agotado rather than copying product $129.00. Status includes text, not color alone. Title, image proportions, alignment, wrapping and focus treatment are visually sound in this sample; no unjustified detail redesign recommended.

At every width, keyboard Enter opens image preview. The enlarged image decodes successfully; application background is inert/aria-hidden while it owns the surface. **First Escape closes only preview**, leaves detail open and restores exact image-trigger focus. Preview close button also restores exact trigger focus. **Second Escape closes detail** and returns focus to the exact card; detail close button independently does the same. Five initial cases report immediate detail removal after the fixed 350ms delay; the 2680 initial ledger reports `detailEscapeClosed:false` while exact card focus already returned. Diagnosed once with `node artifacts/live-catalog-smoke/populated/check-wide-dismissal.cjs`: waiting for actual dialog detachment (3-second bound), rather than a fixed transition sleep, confirms wide detail closes and card focus returns. That command exits 0; `populated/wide-dismissal.json` records the result. Initial false measurement is retained, not rewritten or presented as a source regression. No document or detail-panel horizontal overflow. Mobile internal scrolling exposes the variant and returns to the image trigger without dismissal. No console errors/warnings or page errors (counts only; no raw console strings captured). Existing online icons render.

PUBLICO dropdown was opened after closing detail at every width and has one option. Prior phase proves Escape/focus and explicit-context selection. There is no alternate price list to switch to. This is not coverage of multiple contexts, alternate branches, large grids/pagination, available/low stock, hidden/null prices, actual variant images, image failures, dark mode, physical devices or comprehensive accessibility/contrast compliance. No live broken-state mocks were introduced to manufacture those states.

### Prioritized bounded T2 fixes — final recommendation

1. **Price meaning differs between card and detail (highest priority).** All six screenshots show a bare **$149.00** on the named product card and **$129.00** as its primary detail price. API sends both `fromPriceCents:14900` and `priceCents:12900`; `CatalogProductCard.vue` explicitly prefers the first, while detail uses the second. This is not incorrect cents formatting or evidence for changing variant prices. Minimum fix should make the amount's scope explicit and keep the product/variant relationship consistent: use the authoritative product price consistently where the UI labels it as the product, or explicitly label the variant-derived amount if that is the established contract. Do not silently select the numerically smaller value, rewrite backend prices, or invent an undisclosed business rule. Narrow surfaces: `src/features/catalog/components/CatalogProductCard.vue`, `components/__tests__/CatalogProductCard.spec.ts`; add a behavior regression for **both non-null amounts differing**, plus null/hidden alternates. Only if the chosen presentation requires a detail label should `CatalogProductDetailModal.vue` and its unit suite change. A live card/detail regression belongs in the existing products/detail browser suites **run isolated from preview4173**, followed by live verification. Parent owns resolution of contract wording, not this diagnostic worker.
2. **Retain original empty-state correction:** main entry should not invite impossible branch selection after successful empty discovery; product-empty explanation should not assert a publication cause absent authoritative evidence. Minimum `CatalogView.vue`, `CatalogProductGrid.vue`, existing unit suites and branch/product browser cases. Earlier screenshots remain valid reproductions even though setup now populates Centro.
3. **Retain disabled-affordance polish:** Cart/Ordenar/category look similar to enabled controls while unavailable. Use consistent visible unavailable treatment without weakening disabled semantics or implementing commerce. Minimum `CatalogHeader.vue`, `CatalogCategoryBar.vue`, existing catalog CSS and corresponding tests/disabled-entry browser spec.
4. **Optional visible price-list label:** PUBLICO alone does not explain the selector to sighted visitors; accessible naming is already present. Keep this a small `CatalogPriceContextSelector.vue`/unit-test improvement, verifying mobile header density. Not a functional blocker.

No new detail/media/variant behavior fix is warranted by observed evidence. Do not build a gallery merely because duplicate synthetic image records exist, and do not treat the absent variant image as a UI bug. Overall visual hierarchy remains coherent with approved navy/white references; real content is deliberately synthetic and sparse rather than a recreation of prototype commerce.

### Commands, preservation and risks

- `node artifacts/live-catalog-smoke/populated-probe.cjs`: exit 0; real list/detail status and visible price/media discrepancy reproduced.
- Initial redirect to `populated/run.log` failed before execution because the new directory did not exist. Created scoped evidence README/directory and reran; no application/tooling failure was concealed.
- `node artifacts/live-catalog-smoke/populated-smoke.cjs > artifacts/live-catalog-smoke/populated/run.log`: exit 0; six-width real browser run, 24 screenshots, nested keyboard/close/focus checks and status-only network ledger. `populated/results.json` contains only public product metadata, synthetic-image URLs and geometry, not auth/session/header data.
- `git diff --stat`: no tracked changes; report is pre-existing untracked, evidence Git-ignored. All feature source remains unchanged. Parent owns tracking/commits. No build, mocked suite, source test, service restart or configuration mutation ran.
- RED/GREEN: not applicable to read-only diagnostics/browser verification; no implementation failure/pass lifecycle claimed.
- **Risk — Price scope:** concrete bare-price discrepancy requires bounded T2 treatment or explicit contract clarification.
- **Risk — External storage:** two synthetic objects/records exist in configured external CDN storage; no cleanup authorized or performed.
- **Risk — Coverage:** one product/one null-image variant/one context cannot prove large-grid, alternate-context, hidden-price or actual variant-image behavior.
- **Blockers:** none for bounded T1. Original auth/publication/product-availability blockers are resolved. Remaining recommendations belong to T2.

## Key Learnings

1. The populated Centro route works anonymously with real list/detail requests and a successfully loaded external CDN illustration.
2. The card prioritizes a 14900-cent variant-derived amount while detail displays the separate 12900-cent product price without clarifying the difference.
3. Nested image/detail dismissal and exact trigger focus restoration work at all six tested widths.
4. A null variant image correctly yields an unavailable thumbnail, not a loaded variant photo.
5. Test setup created two synthetic image records in external storage, and neither was removed or hidden from the ledger.

## T2 — bounded clarity implementation and rebuilt-preview verification

**T2 implementation completed for S1, S4 and S5; parent owns task tracking, review and commits. T3 is not marked complete by this handoff.** Earlier diagnostic sections and evidence are preserved above. No database/image mutations, admin session, new fetch, backend/auth/dependency changes, or user-service stop/restart occurred in T2.

### Changes and boundaries

- **S1:** `CatalogView.vue` passes the existing authoritative `branchesState` to `CatalogProductGrid.vue`. Successful empty discovery says “No hay sucursales publicadas”, not an impossible selection instruction. Loading/retry and network/server/rate-limit states retain their own meanings; the main retry reuses `retryBranches`. Published branches still require explicit visitor selection.
- **S1/S4:** Product-empty copy is now “No hay productos disponibles en este momento”. Unit coverage pins the observed successful `items: []` / `excludedCount: 2` response without showing exclusions or inventing their cause. Existing retry/request guards remain intact.
- **S4:** Header/cart/category/sort keep disabled semantics and exact accessible names. Written “No disponible”, quiet dashed boundaries and muted backgrounds distinguish unavailable buttons from working branch/context/detail controls. Search retains its explicit unavailable placeholder. No fake actions were added.
- **S4:** Card amount selection remains **exactly `fromPriceCents ?? priceCents`**, including integer validation, hidden/null fallback and `formatCentsMXN`. When variants and a formatted price exist, “Precio de referencia” and “Consulta los precios por presentación en el detalle.” explain its scope. Detail separately labels its existing amount “Precio del producto”. Actual amounts remain card **149**, product **129**, variant **149**. No Desde/minimum/discount or representative-price policy was chosen.
- **S4:** Existing controlled price selector now has a 12px visible “Lista de precios” label. Model, accessible label and URL proposal semantics are unchanged. It adds a short label, not an extra control or fetch.
- **S5:** Continued autonomously through tests, build, actual anonymous Chromium verification and screenshot readback. Parent task document was not edited.

### Test-first and validation evidence

- RED: `pnpm test:unit --run src/features/catalog/views/__tests__/CatalogView.spec.ts src/features/catalog/components/__tests__/CatalogProductGrid.spec.ts src/features/catalog/components/__tests__/CatalogProductCard.spec.ts src/features/catalog/components/__tests__/CatalogProductDetailModal.spec.ts src/features/catalog/components/__tests__/CatalogPriceContextSelector.spec.ts --exclude '.worktrees/**'` — **11 intended failures / 150 passes**, captured before implementation in `artifacts/live-catalog-smoke/t2-red.log`. Failures cover authoritative empty/pending/error branches, neutral empty products, disabled-control class/written state, reference/detail scope and visible selector label.
- GREEN: `pnpm test:unit --run src/features/catalog src/app/layouts/__tests__/CatalogLayout.spec.ts --exclude '.worktrees/**'` — **362 tests / 15 files pass**, final rerun in `t2-green.log`.
- Triangulation covers hidden/null/nonvariant card labels, null reference fallback, differing 149/129 prices, independent detail/variant prices, all nonauthoritative branch states, empty-branch retry isolation and the observed exclusion-count case. Existing stale-result, branch/context isolation, media, disabled and focus regressions pass.
- `pnpm type-check` and `pnpm type-check:responsive` — pass. Editor-local LSP reported unresolved `.vue` module declarations in tests; authoritative `vue-tsc --build` and responsive TypeScript both pass, so no import workarounds were introduced.
- Scoped `pnpm exec prettier --check` for all 16 changed application/test/style files — pass; `git diff --check` — pass.
- `pnpm build` — pass, rebuilt preview assets. Warnings: generated `padding-bottom: env(...)` optimizer token and bundle chunks over 500kB; neither was repaired outside this task.
- `node artifacts/live-catalog-smoke/final/smoke.cjs > artifacts/live-catalog-smoke/final/run.log 2>&1` — pass twice, including final cosmetic correction. Real public GETs only, no stubs/auth/cookies; `/catalogo/centro` and `/catalogo` exercised with independent Chromium. `final/results.json` records six-width assertions and public path/query ledger only.
- Mocked responsive E2E **not run**: existing config and fixture origin hardcode 4173 with `reuseExistingServer: false`; no isolated override exists. Did not reuse, replace or stop the user's preview. Stale empty-copy assertions were updated in the existing branch/products specs; disabled-entry spec now also checks written unavailable treatment. Parent decides whether/how to run the mocked harness later.

### Screenshot readback and self-review

Evidence under `artifacts/live-catalog-smoke/final/`: `list-{320,390,768,1024,1440,2680}.png`, `detail-{320,390,768,1024,1440,2680}.png`, plus `entry-390.png`, `context-390.png`, `variant-390.png` and `preview-390.png`. All 16 screenshot surfaces were READ, not judged solely by geometry; original `populated/list-390.png` and `populated/detail-390.png` were READ for comparison.

- Card reference label now directly precedes $149.00; per-presentation note is legible, with clean wrapping at narrow and tablet widths. Detail's $129.00 is clearly product-scoped, and the separate $149.00 variant remains unchanged. Illustration proportions, navy/white palette and existing bounded grid/detail remain intact.
- Initial readback caught the new cart note exceeding the old 64px column. **One cosmetic correction:** 76px cart column and 4px inline padding; final rebuild/readback confirms the text stays inside its dashed boundary. A native browser content-width assertion now protects this. At 390 the existing branch-name truncation occurs earlier; the branch remains identifiable and full text is available in its working chooser. No second redesign was attempted.
- 320 retains existing stacked header/toolbar; 390 keeps a compact single branch/cart row with search and labeled price selector below. 768 retains its existing wrapped controls. 1024/1440/2680 remain bounded, readable and honest about sparse data. Visible label is retained: it fits without clipping or a new control row beyond the existing selector surface.
- All six widths pass no document/dialog horizontal overflow, decoded real images, explicit branch selection and explicit PUBLICO URL selection, disabled-control state, nested image Escape/close and exact trigger focus restoration, then detail Escape/close and exact card focus restoration. No console errors/warnings or page errors. Dropdown screenshot waits for its transition; the initial mid-transition capture was corrected as measurement timing, not an application bug.
- Self-review against S1/S4/S5 and L5: no price-policy/API/composable changes, invented data, commerce, variant selection or gallery; original medication candidates, sample bowl, stock and duplicate image records untouched. Pre-existing untracked reports/screenshots preserved. No staging/commit/branch operation.

### Remaining limits and rollback scope

**Named risks:** mocked E2E remains unexecuted because 4173 is user-owned; live coverage remains one branch/context/product/null-image variant. Empty discovery/products are unit-pinned from observed historical evidence, not recreated by mutating the DB. No native/physical-device, screen-reader or comprehensive contrast audit is claimed. Existing external-storage duplicate images and unresolved representative-price policy remain parent-owned, unchanged concerns. Evidence remains Git-ignored; retention/staging is explicitly parent-owned.

Rollback scope: only the 16 changed application/test/style files, this appended T2 section and T2 evidence under `artifacts/live-catalog-smoke/`; rebuild original source to roll preview assets back. Preserve all original T1 evidence/report text and all unrelated files. No data or process rollback is needed for T2.

### T2 Key Learnings

1. Explicit scope labels resolve the observed 149/129 ambiguity without choosing a representative-price policy.
2. Empty branch data is authoritative only after successful discovery; empty public products do not reveal an exclusion/publication cause.
3. Screenshot readback caught a local text-fit defect that page-overflow checks alone missed; the corrected cart now has a direct content-width assertion.
