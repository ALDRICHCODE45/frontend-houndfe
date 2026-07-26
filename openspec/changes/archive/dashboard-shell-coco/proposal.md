# Proposal: Dashboard Shell Coco

## Why

The POS arc — sale workspace (SDD-1), Cobrar/Confirmar/Cerrar (SDD-2), payment modals (SDD-5), sale history/detail (SDD-6), products catalog (SDD-7), customers/promotions/orders + assign slideovers (SDD-8) — is fully Coco-ized. The dashboard shell is the only remaining surface leaking default Nuxt UI primary blue: `DashboardHomeView` renders the dashboard icon as `text-primary`, and `DashboardLayout` is the only place that renders the navigation chrome the cashier looks at between every action. After this change, the **entire Houndfe POS is on the Coco brand** and the SDD-1→9 chain is closed.

## What Changes

Coco-ize the dashboard shell. The sidebar and navbar are NOT separate components in this project — they live inline in `DashboardLayout.vue` as Nuxt UI Pro primitives (`UDashboardSidebar`, `UDashboardNavbar`, `UNavigationMenu`, `UDashboardSearchButton`, `UDashboardSearch`, `UDashboardSidebarCollapse`, `UColorModeButton`). All nav/permission/collapse logic stays in `useSidebar.ts` + `useDashboard.ts` (behavior, unchanged).

| # | File | Swap |
|---|------|------|
| 1 | `src/features/dashboard/home/views/DashboardHomeView.vue` (line 7) | `text-primary` on `<UIcon name="i-lucide-layout-dashboard"` → `text-coco-gold-500`. `<UCard>` body + header background → Coco-neutral via `:ui="{ body: 'bg-coco-neutral-50 dark:bg-coco-neutral-950' }"`. |
| 2 | `src/app/layouts/DashboardLayout.vue` — `UDashboardNavbar` (line 137) | Override default primary on navbar `icon` + `title` text: `:ui="{ root: '...', title: 'text-coco-gold-500', leading: 'text-coco-gold-500' }"`. Keep `title="Coco"` as brand string. |
| 3 | `DashboardLayout.vue` — `UDashboardSidebar` (line 41) | `:ui` slot additions: `body` already `py-2`; add `bg-coco-neutral-50 dark:bg-coco-neutral-950` for the sidebar shell surface; collapse button gets `text-coco-gold-500` via existing trailingIcon override. |
| 4 | `DashboardLayout.vue` — `UNavigationMenu` (line 99) | Active-state accent → Coco gold: `:ui="{ link: 'p-1.5 overflow-hidden', linkLeadingIcon: 'size-4', linkLabel: 'text-dimmed group-data-[active=true]:text-coco-gold-500', linkActive: 'bg-coco-gold-500/10' }"` (or equivalent token that wins Nuxt UI's cascade). |
| 5 | `DashboardLayout.vue` — `UDashboardSearch` (line 167) | This is a UModal-derived surface. **Apply `patterns/umodal-coco-styling`**: do NOT force `bg-coco-neutral-900` on `:ui` header/body/footer. Let Nuxt UI 4 handle shell bg natively. Only Coco-ize internal elements: input focus ring → `focus-visible:ring-coco-gold-500`, active item highlight → `coco-gold-*`, group heading → `coco-gold-700`. |
| 6 | `DashboardLayout.vue` — `UDashboardSearchButton` (line 95) | Search trigger gets the gold tint when collapsed: `:collapsed` already handled, but pass `:ui="{ base: 'hover:bg-coco-gold-500/10' }"` to align with sidebar active item. |
| 7 | `DashboardLayout.vue` — `UDropdownMenu` (tenant + user) | Tenant labels: leave `color="neutral"` (intentional — neutral is correct here, these are not CTAs). User-menu "Appearance/Light/Dark" checkicons → `text-coco-gold-500` via `:ui="{ itemLeadingIcon: 'size-4 group-data-[checked=true]:text-coco-gold-500' }"` on the user dropdown. |
| 8 | `src/app/composables/useSidebar.ts` | **No behavior change.** Items returned from `getNavigationItems()` are already label-only; add optional `class` field per item for sidebar text/icon tint so `UNavigationMenu` resolves brand color. |
| 9 | New: `src/features/dashboard/home/__tests__/DashboardHomeView.test.ts` | Pin Coco-gold token on the icon + neutral surface on the card. **Strict TDD RED-GREEN-REFACTOR** — write failing test first, then source change. |
| 10 | New: `src/app/layouts/__tests__/DashboardLayout.test.ts` | Pin sidebar/navbar `:ui` slot additions so any future Nuxt UI upgrade that resets them trips the test. Pin `UDashboardSearch` has NO forced-dark-bg slot. |

## Non-Goals

`src/features/catalog/` (customer-facing storefront, light-first by design); `ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal` (separate SDDs if ever needed); auth, login, tenant selection; tenant admin (`AdminTenantsView`); `App.vue` layout switcher; `useSidebar.ts` permission/navigation logic; `useDashboard.ts` search groups; `UDashboardSearch` placeholder/quick-jump `group.items` content; no `primary` removal in semantic badges (success/error/warning stay). **No new Coco tokens, no `main.css` changes, no `app.config.ts` `ui.colors` rewrites, no business-logic / prop / emit / validation / API changes, no new components, no new routes, no responsive-collapse behavior changes.**

## Approach

Reuse the Cobrar precedent from SDD-1/2: keep `color="primary"` as the semantic prop on no CTA exists; for any future dashboard CTA (none today), use `class="!bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"`. Use `coco-gold` scale for accents: `text-coco-gold-500` for active nav icon, `bg-coco-gold-500/10` for hover/active backgrounds, `text-coco-gold-700` (light) / `text-coco-gold-400` (dark) for secondary text. Use `bg-coco-neutral-50 dark:bg-coco-neutral-950` for the sidebar surface and dashboard card body; `border-coco-neutral-200 dark:border-coco-neutral-800` for separators. **Hard rule** (from SDD-8 pattern memory): `UDashboardSearch` is a UModal-derived surface — **never** force `bg-coco-neutral-900` on its `:ui` header/body/footer; only style internal elements (input focus, active item, group heading). **Preserve all semantic colors**: success/error/warning badges, status pills (`StatusDotBadge.vue` tone map), notification toasts — none touched. Strict TDD: no existing tests on the dashboard, so we write the new tests FIRST (RED), make the source change (GREEN), then refactor. Visual review checkpoint after each file (smaller blast radius than SDD-3/5/6/8 because the file count is small but the navigation regression risk is the highest of any SDD in the chain). Light-mode + dark-mode both verified.

## Affected Specs

None. No requirement in `openspec/specs/design-tokens/spec.md` covers per-page dashboard theming, and there is no dashboard spec yet (the dashboard was a stub view). New: None. Modified: None.

## Risks

- **Navigation regression on a shared shell surface (HIGH)** — sidebar/navbar/collapse behavior is rendered on every authenticated route. Any change to `:ui` slots must NOT break: (a) permission-gated nav item visibility (gated via `canAccess()` in `useSidebar`), (b) responsive collapse (sidebar collapse/resize thresholds), (c) tenant-switcher dropdown, (d) global theme toggle button, (e) `UDashboardSearch` open/close + navigation jump. **Mitigation**: write `DashboardLayout.test.ts` covering all five before any source change; visual + manual navigation walkthrough on at least three routes during verify.
- **`UDashboardSearch` light-mode bug risk (HIGH)** — applying the SDD-8 lesson: forcing `bg-coco-neutral-900` on the modal shell looks fine in dark mode but breaks light mode. The proposal already forbids this, but the implementer must NOT repeat the three-iteration SDD-8 fix cycle.
- **No existing test coverage on the dashboard (Med)** — both a relief (no `border-primary` selectors to break) and a risk (zero behavior coverage if a refactor breaks nav). All new tests added by this SDD MUST pin behavior, not just classes.
- **`UNavigationMenu` active-state override may not win Nuxt UI's cascade (Med)** — `:ui` slot specificity vs Nuxt UI 4 internal defaults is brittle. Fallback: theme-level change via `app.config.ts` `ui.colors.primary` alias to a Coco token — but that is OUT OF SCOPE for this SDD; if the override loses, document as carry-over to a future token-cascade SDD.
- **Sidebar `UDropdownMenu` (tenant switcher) rendering as a NEW scroll container (Low)** — sidebar collapse affecting `teamsItems` height; visual review covers.
- **`DashboardHomeView` placeholder copy "Bienvenido a Hound. Selecciona una sección en el sidebar." (Low)** — text remains Spanish, unchanged.
- **Chain-closing test (Low)** — successful verify closes the SDD-1→9 chain; proposal commits to a final visual smoke check across all nine SDD touchpoints in verify (catalog, product-create, sale-workspace, payment modals, sale-history, sale-detail, customers, promotions, dashboard).

## Rollback Plan

`git revert` the merge commit. Pure styling token substitution; undoing restores default Nuxt UI primary blue + default sidebar/navbar theming with zero API, data-shape, behavior, or routing changes.

## Dependencies

None. Nuxt UI 4 + Tailwind v4 + Coco tokens from `src/assets/main.css` (SDD-1) + cobrar gold `--brand-action` from SDD-1/2 + UModal pattern memory from SDD-8.

## Success Criteria

- [ ] No `text-primary`, `bg-primary`, `border-primary/*`, or unoverridden `color="primary"` CTA on the dashboard icon (`DashboardHomeView`), the navbar (`UDashboardNavbar`), the sidebar (`UDashboardSidebar` + `UNavigationMenu`), `UDashboardSearchButton`, or the user dropdown checkicons.
- [ ] `UDashboardSearch` does NOT have any `bg-coco-neutral-900` (or any Coco dark bg) on its `:ui` header/body/footer — only internal elements carry Coco tokens.
- [ ] All new `__tests__` files (DashboardHomeView, DashboardLayout) pass; `pnpm test:unit --run` reports 100% green.
- [ ] Sidebar active-state, navbar icon, navbar title, dashboard icon all read Coco gold in both light and dark mode at the established WCAG AA contrast (gold-700 on neutral-50 in light; gold-400 on neutral-950 in dark).
- [ ] Permission-gated nav items still hide/show on auth changes; sidebar collapse (`o` shortcut + button) still works; theme toggle still works; tenant switcher still works.
- [ ] `UDashboardSearch` opens, accepts input, jumps on enter, and closes on `Esc` — full modal lifecycle preserved.
- [ ] Visual evidence captured for: `DashboardHomeView` (empty + hydrated), dashboard with sidebar expanded + collapsed, navbar with `UDashboardSearch` open + closed, all in light + dark mode. **Final chain-closing visual smoke** across SDD-1→9 touchpoints (catalog grid, product create, sale workspace, payment modal, sale history, sale detail, customers, promotions, dashboard) — all read Coco.
- [ ] `pnpm build` clean; no new Coco tokens introduced; `src/features/catalog/`, `ProductDetailModal`, `VariantPickerModal`, `GlobalDiscountModal`, auth, tenant admin unchanged.

## Open Questions

1. **`UNavigationMenu` active-state token override** — `:ui` slot (`linkLabel` + `linkActive`) or theme-level `app.config.ts` `ui.colors.primary` alias? Slot-only is this-SDD-scoped; theme alias is a bigger blast but cleaner. **Defaulting to slot-only** unless verify proves the cascade loses.
2. **Sidebar `UDashboardSidebar` shell bg** — `bg-coco-neutral-50 dark:bg-coco-neutral-950` (matches cards) or `bg-coco-neutral-100 dark:bg-coco-neutral-900` (one step deeper, traditional "shell" depth)?
3. **`UDashboardSearch` input focus ring** — `focus-visible:ring-coco-gold-500` (matches Cobrar precedent) or `focus-visible:ring-coco-gold-400` (lighter, less aggressive in light mode)?
4. **Collapse-button icon color** — inherit `text-coco-gold-500` from sidebar active state, or stay `text-dimmed` (neutral control, not a brand mark)?
5. **Empty-state copy on `DashboardHomeView`** — leave Spanish placeholder, or add a short "Próximamente: vista de métricas" hint that sales-management read later? Styling-only SDD says leave it.
