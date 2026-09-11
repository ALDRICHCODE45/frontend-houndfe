# P0 catalog demo deactivation — proposed, implementation not authorized

> **Planning-only maintenance.** P0 is one proposed preparatory runtime unit, not anonymous D1 and not permission to apply, test, commit, or deploy. It is credible only if this planning package is first accepted and delivered as its own baseline.

## Accepted boundary

- Keep the real five-SFC composition: `CatalogView`, `CatalogHeader`, `CatalogCategoryBar`, `CatalogProductGrid`, and `CatalogFooter`; retain the existing catalog layout and functional theme toggle.
- Keep branch, search, category, sort, and cart affordances visible but disabled. The main region says **“La selección de sucursal todavía no está disponible”**; it makes no product, merchant, or availability claim.
- Unmount the product modal and cart drawer. No mock card, product detail, cart, WhatsApp, telephone, or contact action is reachable by pointer or keyboard.
- Do not edit `src/app/router/index.ts`, `src/main.ts`, auth, layout ownership, API transport, mocks, dependencies, test infrastructure, or D2–D14. P0 does not assert anonymous access; final D1 retains discovery, explicit selection/history, route synchronization, invalid-slug preservation, and null-address omission.

## Proposed implementation checklist — do not execute

- [ ] RED: add `src/features/catalog/views/__tests__/CatalogView.spec.ts`, mounting the five real catalog SFCs with Nuxt UI primitive stubs only; observe the current demo initialization/reachable overlay behavior before P0 changes it.
- [ ] GREEN: adapt only the five SFCs so the static disabled entry shell has no catalog store/cart initialization or product-card/modal/drawer runtime path; verify the theme toggle changes the observed color-mode value.
- [ ] TRIANGULATE: assert every retained branch/search/category/sort/cart control is disabled and named, the neutral message is present, no Coco/mock product/price/cart/contact content is rendered, and static mock data is not mistaken for HTTP evidence.
- [ ] RED/GREEN responsive: add `e2e/responsive/specs/catalog-entry-disabled.spec.ts`; at 375×667 and 1280×800 attach screenshots, check document overflow and keyboard focus/activation for the theme control, and verify disabled controls cannot activate product/contact behavior.
- [ ] REFACTOR: keep the view as composition only; do not introduce a replacement inline shell, a new composable, or new test/evidence infrastructure.

## Evidence and forecast

| Future file | Evidence from current source | Forecast A/D | Assumption |
| --- | --- | ---: | --- |
| `src/features/catalog/views/CatalogView.vue` | 42 lines; imports and mounts store/cart/modal/drawer | 0/17 | Removes initialization and two overlays while retaining five-SFC composition. |
| `components/CatalogHeader.vue` | 134 lines; store/cart/search/branch handlers and theme toggle | 10–14/34–42 | Only theme state remains live; retained branch/search/cart controls are disabled. |
| `components/CatalogCategoryBar.vue` | 75 lines; mock-backed chips and sort handler | 10–16/38–45 | Replaces mock-derived controls with neutral disabled affordances. |
| `components/CatalogProductGrid.vue` | 38 lines; imports product card and reads mock store | 14–15/22–28 | Becomes the neutral branch-selection-unavailable landing. |
| `components/CatalogFooter.vue` | 21 lines; mock store, Coco and branch-count claim | 2–3/5–8 | Preserves footer boundary with neutral catalog text. |
| `views/__tests__/CatalogView.spec.ts` | No catalog test exists; `mountWithUApp` and Vitest/jsdom exist | 60–65/0 | Real five-SFC mount; primitive stubs, import/init spies, disabled and theme assertions fit without helper changes. |
| `e2e/responsive/specs/catalog-entry-disabled.spec.ts` | Playwright config supports the real Vite app and `/__e2e-api`; 1280 is outside its evidence manifest | 55–60/0 | Use Playwright attachments and direct browser assertions, not the fixed 320–1024 evidence manifest or a new target registry. |

**Future runtime subtotal:** 151–173 additions + 116–140 deletions = **267–313 changed lines**.

**Future execution documentation allowance:** `openspec/changes/online-catalog-publishing/tasks.md` is 12A/5D (five checklist replacements plus command/evidence results); `openspec/changes/online-catalog-publishing/delivery-map.md` is 1A/1D (P0 status plus final count). `.gentle-ai-instance` is preserved orchestration metadata, 0A/0D, and is not part of the P0 delivery.

**All-in future unit:** runtime 267–313 + execution documentation 19 = **286–332 changed lines**. The 330 planning target is not a guaranteed stop: its upper estimate exceeds it by 2 lines. The hard 400 stop admits no exception and leaves 68 lines at the upper estimate; no code compression, omitted evidence, or uncounted documentation may create headroom.

## Future commands — audited from `package.json`, not run

- `pnpm test:unit --run src/features/catalog/views/__tests__/CatalogView.spec.ts`
- `pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/catalog-entry-disabled.spec.ts`

The first command uses the existing `test:unit` Vitest script. The second is the existing Playwright runner invoked with a new focused spec; neither command has been run in this documentation-only task.

## Rollback if P0 is later delivered

**Local forward-fix first:** restore the same five-SFC disabled boundary, keeping modal/drawer unmounted and the neutral landing, then correct only the defective presentation or disabled-control wiring. Preconditions: the P0 tests can reproduce the defect and the five-SFC boundary remains intact. This preserves the no-demo safety objective and does not need a flag.

**Operational withdrawal:** if the catalog route itself must be unavailable, a separately authorized router/deployment decision is required. This repository evidence establishes neither an edge control nor a deployment flag, so P0 cannot claim one. Reverting to the current demo is explicitly not a safe rollback.

## Key Learnings

1. The existing view mounts mock initialization and both overlays directly.
2. Static mocks create no HTTP requests, so DOM and import assertions are necessary.
3. The responsive evidence manifest does not accept a 1280-pixel record today.
4. P0 can preserve the component boundary without pretending branch discovery exists.
