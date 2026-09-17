# Online catalog surfaces — UI/UX redesign

## Outcome and authority

Redesign `/system/catalog-settings` and the `Catálogo online` section inside product edit as coherent operational surfaces that match the established backoffice. Preserve existing catalog and product contracts while replacing visually disconnected containers and weak/manual controls with the project's large-card pattern and first-class Nuxt UI components.

This is ODD, not SDD. The user explicitly authorized implementation on local `main`. After reviewing the first visual smoke, the user expanded the redesign to both catalog settings and product edit, and explicitly selected **no RDD for both surfaces**. That exception is scope-local: do not change the repository-wide review switch and do not reopen historical review lineages.

No commit, push, destructive Git operation, OpenSpec mutation, or PR is authorized. Keep `stash@{0}`, the two historical untracked OpenSpec files, and prior `/tmp` evidence unchanged.

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
- this task document

## Tasks

- [x] **U1 — Audit the current screen and established backoffice patterns.** Compare the catalog settings implementation with strong existing settings/detail/form pages and confirm the Nuxt UI APIs available in the installed version.
- [x] **U2 — Define and implement the information architecture.** Added a page header, constrained content column, publication/status summary, three grouped settings cards, contextual list actions, and a sticky action area without changing domain behavior.
- [x] **U3 — Use first-class Nuxt UI controls throughout.** Replaced manual/native-looking controls with the project's `UFormField`, `USelectMenu`, `USwitch`, `UInput`, `UButton`, `UCard`, and `UBadge` components; 49 focused tests pass.
- [x] **U4 — Verify the first settings redesign.** Independent automated verification passed (67/67 focused tests, typecheck, build, diff check), and visual smoke confirmed a large improvement while exposing detached header/footer surfaces.
- [x] **U5 — Unify catalog settings inside the established large-card shell.** Header, loading/error/form/read body, and the single responsive save/read-only area now live inside one `UCard`; detached/sticky page bars were removed. Independent focused verification passed with 29/29 view tests and scoped diff check.
- [x] **U6 — Redesign product catalog configuration.** The section remains one sibling `UCard` with internal hierarchy/dividers; manual/native controls were replaced with `USwitch`, `UCheckbox`, labeled `USelectMenu`, `UInput`, and `UFormField`. Permission gates, nullable stock clearing, literal `0`, changed-only payloads, and parent integration are preserved. Independent focused verification passed (11 section tests, 12 parent tests, typecheck, scoped diff check).
- [ ] **U7 — Verify both catalog surfaces.** Final combined automated verification is PASS: 8/8 focused files and 108/108 tests, `pnpm type-check`, `pnpm build`, and `git diff --check`; build reports only the existing chunk-size warning. Independent verification found no production, behavior, accessibility, responsive, or test-interaction defects. Human authenticated desktop/mobile smoke remains pending. No RDD for either surface by explicit user selection.

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
