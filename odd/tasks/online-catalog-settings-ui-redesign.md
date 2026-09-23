# Online catalog surfaces — UI/UX redesign

## Outcome and authority

Redesign `/system/catalog-settings` and the `Catálogo online` section inside product edit as coherent operational surfaces that match the established backoffice. Preserve existing catalog and product contracts while replacing visually disconnected containers and weak/manual controls with the project's large-card pattern and first-class Nuxt UI components.

This is ODD, not SDD. The user explicitly authorized implementation on local `main`. After reviewing the first visual smoke, the user expanded the redesign to both catalog settings and product edit, and explicitly selected **no RDD for both surfaces**. That exception is scope-local: do not change the repository-wide review switch and do not reopen historical review lineages.

No commit, push, destructive Git operation, OpenSpec mutation, or PR is authorized. Keep `stash@{0}`, the two historical untracked OpenSpec files, and prior `/tmp` evidence unchanged.

### Semantic controls follow-up

The user approved a follow-up refinement after the public catalog redesign was closed. This slice replaces backend-oriented stock labels with customer-facing language and explanatory previews, compacts the sparse global settings layout, replaces the global price-list chip/button workflow with the established Nuxt UI select pattern, changes catalog-related checkbox booleans to switches, and makes product/variant inheritance copy contextual. It must remain UI-only: enum values, inheritance semantics, permissions, emits, changed-only payloads, and API contracts stay unchanged.

## Product and design constraints

- Use the project's existing backoffice language, spacing, surfaces, and interaction patterns.
- Use established Nuxt UI components for selects, buttons, switches/checkboxes, form fields, cards, status, and feedback.
- Follow the established list-page card shell: one large rounded `UCard`, native header divider, compact responsive body padding, and actions inside the card rather than detached page-wide rectangles.
- Provide a clear title and purpose, logical sections, explicit publication status/impact, and save feedback connected to dirty/loading/success/error state.
- Keep the product catalog block as one card sibling of Inventario and Variantes; do not introduce nested-card clutter.
- Make destructive or reversible actions contextual and unmistakable; do not render them as ambiguous text links.
- Preserve responsive and accessible behavior, including real labels, keyboard focus, adequate targets, mobile stacking, and overflow safety.
- Preserve API payloads, changed-only updates, validation, state ownership, permissions, accepted-response hydration, and existing catalog behavior.

## Allowed implementation surfaces

- `src/features/system/catalog-settings/views/TenantCatalogSettingsView.vue`
- `src/features/system/catalog-settings/components/CatalogSettingsForm.vue`
- `src/features/system/catalog-settings/components/CatalogSettingsReadView.vue`
- `src/features/system/catalog-settings/components/CatalogPriceContextsField.vue`
- `src/features/system/catalog-settings/components/CatalogStockPresentationField.vue`
- `src/features/system/catalog-settings/views/__tests__/TenantCatalogSettingsView.spec.ts`
- directly related catalog-settings component specs only when required to preserve or verify the UI contract
- `src/features/POS/products/components/ProductCatalogSettingsSection.vue`
- `src/features/POS/products/components/OnlineStockOverrideFields.vue`
- `src/features/POS/products/components/__tests__/ProductCatalogSettingsSection.spec.ts`
- `src/features/POS/products/views/__tests__/ProductDetailView.test.ts` only if parent-composition assertions require adjustment
- `src/features/POS/products/components/VariantDetailModal.vue`
- `src/features/POS/products/components/__tests__/VariantDetailModal.catalog.spec.ts`
- `src/features/POS/products/components/ProductUpsertSlideover.vue`
- directly related `ProductUpsertSlideover` specs only when required by the checkbox-to-switch migration
- one catalog-settings-local shared UI copy module and its directly related tests, if extraction prevents duplicated labels/descriptions
- this task document

## Tasks

- [x] **U1 — Audit the current screen and established backoffice patterns.** Compare the catalog settings implementation with strong existing settings/detail/form pages and confirm the Nuxt UI APIs available in the installed version.
- [x] **U2 — Define and implement the information architecture.** Added a page header, constrained content column, publication/status summary, three grouped settings cards, contextual list actions, and a sticky action area without changing domain behavior.
- [x] **U3 — Use first-class Nuxt UI controls throughout.** Replaced manual/native-looking controls with the project's `UFormField`, `USelectMenu`, `USwitch`, `UInput`, `UButton`, `UCard`, and `UBadge` components; 49 focused tests pass.
- [x] **U4 — Verify the first settings redesign.** Independent automated verification passed (67/67 focused tests, typecheck, build, diff check), and visual smoke confirmed a large improvement while exposing detached header/footer surfaces.
- [x] **U5 — Unify catalog settings inside the established large-card shell.** Header, loading/error/form/read body, and the single responsive save/read-only area now live inside one `UCard`; detached/sticky page bars were removed. Independent focused verification passed with 29/29 view tests and scoped diff check.
- [x] **U6 — Redesign product catalog configuration.** The section remains one sibling `UCard` with internal hierarchy/dividers; manual/native controls were replaced with `USwitch`, `UCheckbox`, labeled `USelectMenu`, `UInput`, and `UFormField`. Permission gates, nullable stock clearing, literal `0`, changed-only payloads, and parent integration are preserved. Independent focused verification passed (11 section tests, 12 parent tests, typecheck, scoped diff check).
- [x] **U7 — Verify both catalog surfaces.** Final combined automated verification is PASS: 8/8 focused files and 108/108 tests, `pnpm type-check`, `pnpm build`, and `git diff --check`; build reports only the existing chunk-size warning. Independent verification found no production, behavior, accessibility, responsive, or test-interaction defects. The user completed and approved the authenticated visual smoke for global, product, variant, public-catalog, and Dashboard surfaces across the requested desktop/mobile, responsive, persistence, and light/dark checklist. No RDD for either surface by explicit user selection.
- [x] **U8 — Clarify stock presentation and inheritance.** Centralized the four customer-facing labels, honest explanations, and selected-mode previews in `stockPresentationUi.ts`; product null now reads “Usar configuración global” and variant null reads “Usar configuración del producto”. Enum values, literal `0`, nullable clearing, emits, permissions, and storefront behavior remain unchanged. Writer and independent verifier both passed 5 focused files / 73 tests, `pnpm type-check`, and `git diff --check`; static responsive/accessibility inspection found no blocker. The new utility is intentionally untracked until ordinary delivery because commits/staging are not authorized.
- [x] **U9 — Modernize catalog price-list and publication controls.** Replaced the tenant chip/button workflow with a searchable multi `USelectMenu` plus a clearable principal-list selector; product contexts and the quick-editor catalog opt-in now use `USwitch`; persisted variants use a contextual `USelectMenu`. Permissions, stale accepted ids, deterministic granular emits, form state, changed-only payloads, and empty/loading/error states remain intact. Writer and independent verifier both passed 4 focused files / 60 tests, `pnpm type-check`, and `git diff --check`; no behavioral blocker was found.
- [x] **U10 — Rebalance and verify the refined surfaces.** The global editable form now uses a compact publication surface and a responsive one-column/mobile, two-column/large-screen contexts-plus-stock grid inside the single established outer card. Final independent evidence: exact 11-file candidate suite **159/159**, isolated `SaleDetailView` **28/28**, serial full suite **404/404 files and 6,624/6,624 tests**, type-check PASS, production build PASS, scoped Prettier PASS across all 18 changed/new paths, and `git diff --check` PASS. The ordinary parallel full-suite attempt timed out after 300 seconds with cross-file failures, while every implicated candidate-related file passed focused and the exact serial full suite passed; this supports parallel interference or resource pressure but does not identify which. Build retains the existing >500 kB chunk warning. Authenticated browser smoke remains unavailable without credentials and is still represented by U7's human smoke gate.

## Verification contract

Minimum automated checks after implementation:

```sh
pnpm test:unit --run <focused catalog-settings and product catalog specs>
pnpm type-check
pnpm build
git diff --check
```

Visual-functional smoke must cover published and unpublished settings, dirty/save behavior, price-list selection/default/removal, product hide-price/context toggles, stock defaults/overrides including literal `0`, loading/error/permission states, keyboard interaction, and desktop plus 375px/320px viewports.

Final combined automated evidence: 8 focused spec files / 108 tests passed; authoritative Vue typecheck passed; production build passed with only the existing chunk-size warning; `git diff --check` passed. Independent verification found no actionable code or test defects. U7 remains open only for human authenticated desktop/mobile smoke. Browser automation is not invented because existing responsive Playwright fixtures do not target these authenticated routes.

## Review workload guard

Keep this redesign inside catalog settings and the existing product catalog section. Do not change shared layout primitives, product payload builders, API mappers, permissions, queries, router, or unrelated product sections. Stop and ask before expanding beyond the listed surfaces.
