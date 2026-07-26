# Design: Dashboard Shell Coco (SDD-9 — FINAL)

## 1. Overview

SDD-9 replaces the last remaining default Nuxt UI primary-blue tokens on the dashboard shell with Coco-brand tokens, closing the SDD-1→9 chain. Pure class-level substitution across 2 SFCs (`DashboardLayout.vue`, `DashboardHomeView.vue`) and 1 composable (`useSidebar.ts` — optional `class` field only). No new tokens, no `app.config.ts` rewrites, no behavior changes. 19 spec requirements (DSC-REQ-001..019). Strict TDD: RED → GREEN → REFACTOR.

## 2. Coco Token Reference

| Token | Tailwind class | Dark variant | Use case (this SDD only) |
|-------|---------------|-------------|--------------------------|
| `--color-coco-gold-500` (`#f6bb13`) | `text-coco-gold-500` | none needed | Navbar title+icon, dashboard icon, active nav icon, collapse button, search focus ring, user checkicon |
| `--color-coco-gold-500/10` | `bg-coco-gold-500/10` | — | Active nav highlight, search-button hover, search active-item |
| `--color-coco-gold-700` (`#aa7e0d`) | `text-coco-gold-700` | `dark:text-coco-gold-400` | Search group heading (light-mode AA) |
| `--color-coco-neutral-50` (`#f5f4f6`) | `bg-coco-neutral-50` | `dark:bg-coco-neutral-950` | Sidebar shell, dashboard card body |
| `--brand-action` (`#f6bb13`) | `!bg-(--brand-action) !text-black` | — | Future dashboard CTAs (none today; pattern documented) |

All values confirmed from `src/assets/main.css` L47-57 (gold), L21-31 (neutral), L90 (brand-action).

## 3. Per-File Implementation

### 3.1 `DashboardHomeView.vue` (DSC-REQ-001)

**Line 7 — icon swap:**
```html
<!-- BEFORE -->
<UIcon name="i-lucide-layout-dashboard" class="size-5 text-primary" />
<!-- AFTER -->
<UIcon name="i-lucide-layout-dashboard" class="size-5 text-coco-gold-500" />
```

**UCard surface:**
```html
<!-- BEFORE -->
<UCard>
<!-- AFTER -->
<UCard :ui="{ body: 'bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
```

### 3.2 `DashboardLayout.vue` — Component-by-Component

**UDashboardNavbar (L137)** — adds `:ui`:
```html
<UDashboardNavbar title="Coco" icon="i-lucide-layout-dashboard"
  :ui="{ title: 'text-coco-gold-500', leading: 'text-coco-gold-500' }">
```
DSC-REQ-002. Title string "Coco" unchanged.

**UDashboardSidebar (L41)** — extends existing `:ui`:
```ts
// BEFORE L49-52
:ui="{
  root: 'transition-[width] duration-200 ease-out',
  body: 'py-2',
}"
// AFTER
:ui="{
  root: 'transition-[width] duration-200 ease-out',
  body: 'py-2 bg-coco-neutral-50 dark:bg-coco-neutral-950',
}"
```
DSC-REQ-003. Sidebar surface.

**UDashboardSidebarCollapse (L112 footer, L139 navbar leading)** — adds `:ui`:
```html
<UDashboardSidebarCollapse variant="ghost" :ui="{ leadingIcon: 'text-coco-gold-500' }" class="mr-auto" />
```
DSC-REQ-003. Collapse-button gold icon.

**UNavigationMenu (L99)** — extends existing `:ui`:
```ts
// AFTER
:ui="{
  link: 'p-1.5 overflow-hidden',
  linkLeadingIcon: 'size-4',
  linkLabel: 'text-dimmed group-data-[active=true]:text-coco-gold-500',
  linkActive: 'bg-coco-gold-500/10',
  linkLeadingIconActive: 'text-coco-gold-500',
}"
```
DSC-REQ-004. Active-state gold, inactive `text-dimmed`.

**UDashboardSearchButton (L95)** — adds `:ui`:
```html
<UDashboardSearchButton :collapsed="collapsed"
  :ui="{ base: 'hover:bg-coco-gold-500/10' }" />
```
DSC-REQ-005.

**UDropdownMenu — user (L114)** — extends existing `:ui`:
```ts
// BEFORE
:ui="{ itemLeadingIcon: 'size-4', content: 'min-w-48' }"
// AFTER
:ui="{ itemLeadingIcon: 'size-4 group-data-[checked=true]:text-coco-gold-500', content: 'min-w-48' }"
```
DSC-REQ-010. Checkicon gold on active theme. Tenant dropdown: NO change (DSC-REQ-009).

**UDashboardSearch (L167)** — adds `:ui` for INTERNAL elements only:
```html
<UDashboardSearch
  v-model:open="isSearchOpen"
  :groups="searchGroups"
  placeholder="Buscar páginas, acciones..."
  :ui="{
    input: 'focus-visible:ring-coco-gold-500',
    groupLabel: 'text-coco-gold-700 dark:text-coco-gold-400',
    itemActive: 'bg-coco-gold-500/10',
  }"
/>
```
DSC-REQ-006 + DSC-REQ-007. Shell (header/body/footer) receives NO Coco dark bg. Exact `:ui` slot names subject to Nuxt UI 4 verification — tokens are the invariant.

### 3.3 `useSidebar.ts` — Optional `class` Field (DSC-REQ-011)

Add `class` to the Dashboard entry in `topLevelExtras` (L128):
```ts
{ label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/', exact: true }
// →
{ label: 'Dashboard', icon: 'i-lucide-layout-dashboard', to: '/', exact: true, class: 'text-coco-gold-500' }
```
`stripMeta()` drops only `permission` + `requiresSuperAdmin` from `AccessMeta` (confirmed: `navigation.access.ts` L37-39). `class` is NOT part of `AccessMeta` — it passes through `...rest` intact. No behavior change. No new permission/logic path.

## 4. UDashboardSearch — Pattern Hard Rule

From `patterns/umodal-coco-styling` (Engram #3427, SDD-8 three-iteration fix):

```html
<!-- WRONG (FORBIDDEN): forces dark bg on modal shell — breaks light mode -->
<UDashboardSearch :ui="{ header: 'bg-coco-neutral-900', body: 'bg-coco-neutral-900' }" />

<!-- RIGHT (ALLOWED): no shell bg override; only accent internal elements -->
<UDashboardSearch :ui="{ input: 'focus-visible:ring-coco-gold-500', groupLabel: 'text-coco-gold-700 dark:text-coco-gold-400', itemActive: 'bg-coco-gold-500/10' }" />
```

**Rule**: `UDashboardSearch` is UModal-derived. NEVER set `bg-coco-neutral-*` or `dark:bg-coco-neutral-*` on `:ui.header`, `:ui.body`, or `:ui.footer`. Nuxt UI 4 handles shell bg natively (theme-adaptive). Only style INTERNAL elements (input, group, item). DSC-REQ-006.

## 5. Test Architecture

### 5.1 `src/features/dashboard/home/__tests__/DashboardHomeView.test.ts`

| Aspect | Detail |
|--------|--------|
| Mount | `mountWithUApp(DashboardHomeView)` |
| Icon assertion | `.find('.size-5').classes()` contains `text-coco-gold-500` |
| UCard surface | wrapper `.html()` or UCard `.classes()` contains `bg-coco-neutral-50` |
| Absence | icon `.classes()` does NOT contain `text-primary` |
| DSC-REQ-012 | Pins gold icon + neutral card |

### 5.2 `src/app/layouts/__tests__/DashboardLayout.test.ts`

| Aspect | Detail |
|--------|--------|
| Mount | `mountWithUApp(DashboardLayout)` with mocked `useSidebar` + `useDashboard` (stub nav items, tenants=[], user stub, sidebar open=false, search open=false) |
| Sidebar surface | Find `UDashboardSidebar` body — classes contain `bg-coco-neutral-50 dark:bg-coco-neutral-950` |
| Navbar gold | Find `UDashboardNavbar` — rendered DOM or props include `text-coco-gold-500` |
| UModal rule | Mount with `isSearchOpen: true` → find teleported search modal → assert NO `bg-coco-neutral-900`, `bg-coco-neutral-950`, or `dark:bg-coco-neutral-*` on modal shell elements |
| DSC-REQ-013 | Regression anchor for Nuxt UI upgrades |

Mock pattern: use `vi.mock('@/app/composables/useSidebar')` + `vi.mock('@/app/composables/useDashboard')`. Mocks return minimal stubs matching the destructured shape in DashboardLayout.

## 6. TDD Execution Plan

Strict TDD: **RED first → commit → GREEN → commit**.

| Step | Action | Command |
|------|--------|---------|
| RED | Write `DashboardHomeView.test.ts` (DSC-REQ-012) | `pnpm test:unit -- --run src/features/dashboard/home/__tests__/DashboardHomeView.test.ts` → FAIL |
| GREEN | Make `DashboardHomeView.vue` src changes | Same command → PASS |
| RED | Write `DashboardLayout.test.ts` (DSC-REQ-013) | `pnpm test:unit -- --run src/app/layouts/__tests__/DashboardLayout.test.ts` → FAIL |
| GREEN | Make `DashboardLayout.vue` + `useSidebar.ts` src changes | Both test files + existing 2926+ tests → ALL PASS |

No tests exist for the dashboard today — no existing assertions to break.

## 7. Work-Unit Commit Plan

4 commits, each independently buildable:

1. `test(dashboard): RED — DashboardHomeView coco token assertions` — test only, confirms failure
2. `feat(dashboard): GREEN — coco-ize DashboardHomeView icon + card` — src + test pass
3. `test(dashboard): RED — DashboardLayout shell + modal rule assertions` — test only
4. `feat(dashboard): GREEN — coco-ize DashboardLayout sidebar/navbar/search/nav/dropdown` — src + test pass; 2926+ existing tests green

## 8. Open Questions Resolved

| # | Question | Resolution | Rationale |
|---|----------|-----------|-----------|
| Q1 | UNavigationMenu active-state: slot vs theme | **Slot-only** (`:ui` on UNavigationMenu) | This-SDD-scoped; no `app.config.ts` blast radius. DSC-REQ-004. |
| Q2 | Sidebar shell bg depth | **`bg-coco-neutral-50 dark:bg-coco-neutral-950`** | Matches cards (DSC-REQ-001, SDD-6 SaleCard) — visual cohesion across POS surfaces. |
| Q3 | Search input focus ring | **`focus-visible:ring-coco-gold-500`** | Matches Cobrar precedent (SDD-1/2). DSC-REQ-007. |
| Q4 | Collapse-button icon | **`text-coco-gold-500`** | Persistent shell control gets brand gold; ties to active-nav gold. DSC-REQ-003. |
| Q5 | Empty-state copy | **Leave Spanish placeholder** | Styling-only SDD; no copy changes. |

## 9. Risks & Mitigations

| Risk (Proposal) | Severity | Mitigation |
|----------------|----------|------------|
| Navigation regression on shared shell | HIGH | `DashboardLayout.test.ts` pins sidebar bg + navbar gold. Visual walkthrough on 3+ routes during verify. |
| UDashboardSearch light-mode bug | HIGH | Design §4 forbids shell dark bg. Test pins absence. Visual review in light mode NON-NEGOTIABLE. |
| No existing test coverage | MED | 2 new test files add 100% coverage on dashboard shell classes. Behavior gated by `pnpm build`. |
| UNavigationMenu cascade override may lose | MED | `linkLabel` uses `group-data-[active=true]` selector; `linkActive` + `linkLeadingIconActive` are direct slot overrides. If cascade loses, document as carry-over (NOT fixed in this SDD). |
| UDropdownMenu tenant scroll | LOW | No change to tenant dropdown. Visual review covers. |
| Placeholder copy | LOW | No action (Q5). |
| Chain-closing test | LOW | DSC-REQ-016 visual smoke across all 9 SDD touchpoints in verify. |

## 10. Verification Strategy

sdd-verify executes in order:

1. `pnpm test:unit --run` — all 2926+ existing + 2 new tests = green (DSC-REQ-014)
2. `pnpm build` — clean (DSC-REQ-017)
3. `pnpm lint` — clean
4. `git diff` — confirms zero changes to `main.css`, `app.config.ts`, out-of-scope files (DSC-REQ-018, DSC-REQ-019)
5. Visual evidence — 8 states (DashboardHomeView empty+hydrated, sidebar expanded+collapsed, search open+closed, light+dark) (DSC-REQ-015)
6. Chain-closing visual smoke — SDD-1→9 touchpoints all read Coco (DSC-REQ-016)

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Pure class-level Vue SFC edits.

## Migration / Rollout

No migration. Single-branch merge to main. Rollback = `git revert`.
