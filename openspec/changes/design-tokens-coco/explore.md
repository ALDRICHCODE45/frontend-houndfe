# Explore: Design Tokens — Coco Foundation

> Date: 2026-07-24
> Change: design-tokens-coco
> Artifact: openspec

---

## Executive Summary

The project has **no design token system**. All theming happens through Nuxt UI 4's Vite plugin color mapping (`primary: amber, secondary: rose, neutral: zinc`), a single `--font-sans` declaration in CSS, and scattered hardcoded Tailwind utility classes across 100+ component locations. The Coco redesign requires building a token foundation from scratch — defining the primitives that all subsequent SDDs will consume.

---

## 1. Current Theme Architecture

### 1.1 Tailwind v4 (`@tailwindcss/vite` v4.2.2 + `tailwindcss` v4.2.2)

The project uses **pure Tailwind v4** — no `tailwind.config.*` file exists.

**main.css** (`src/assets/main.css`, 14 lines):
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
@import 'tailwindcss';
@import '@nuxt/ui';

@theme {
  --font-sans: 'Outfit', system-ui, sans-serif;
}

html, body, #app {
  height: 100%;
  margin: 0;
}
```

Key observations:
- **Line 2**: `@import 'tailwindcss'` (full import, NOT `tailwindcss/theme` or `tailwindcss/preflight`) — gives access to all utilities, preflight, and the default theme
- **Lines 5-7**: `@theme` block has exactly **one** token: `--font-sans`. No color tokens, no radius tokens, no spacing tokens, no shadow tokens, no z-index tokens.
- **NO `@layer`, `@utility`, `@custom-variant`, or `@variant`** directives
- **This is the ONLY CSS file in the entire `src/` directory** (glob confirmed)
- The `@theme` block in Tailwind v4 is additive — it merges into the default theme. Since only `--font-sans` is overridden, every other theme value (colors, spacing, radius, etc.) comes from Tailwind v4 defaults.

### 1.2 Nuxt UI 4 (`@nuxt/ui` v4.6.0)

Nuxt UI 4 is configured **exclusively** through the Vite plugin in `vite.config.ts` (lines 15-63). There is **no `app.config.ts`** file.

**vite.config.ts** — Nuxt UI plugin config (lines 15-63):
```typescript
ui({
  ui: {
    // Slot overrides for consistent icon sizing
    button: { slots: { leadingIcon: 'shrink-0 size-4', ... } },
    navigationMenu: { slots: { linkLeadingIcon: 'shrink-0 size-4' } },
    dropdownMenu: { slots: { itemLeadingIcon: 'shrink-0 size-4' } },
    dashboardSearchButton: { slots: { leadingIcon: 'shrink-0 size-4.5' } },
    card: {
      slots: {
        root: 'rounded-lg overflow-hidden shadow-sm dark:shadow-md dark:shadow-black/20 bg-white dark:bg-zinc-900',
      },
    },
    dashboardPanel: {
      slots: {
        body: 'flex flex-col gap-4 sm:gap-6 flex-1 overflow-y-auto p-4 sm:p-6 bg-zinc-50 dark:bg-zinc-950',
      },
    },
    // ─── THEME: The ONLY color mapping ───
    colors: {
      primary: 'amber',
      secondary: 'rose',
      neutral: 'zinc',
    },
  },
}),
```

Key observations:
- **No `colorMode` option configured** — Nuxt UI 4 falls back to its default behavior (reads `dark` class on `<html>`)
- **No `radius`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `spacing`, `shadow`, or `container`** token overrides
- Slot overrides only tweak sizing; card and dashboardPanel have hardcoded dark mode backgrounds
- The `colors` mapping tells Nuxt UI which Tailwind color palette to map to its `primary`, `secondary`, `neutral` semantic tokens
- **Missing `app.config.ts`** means no runtime theme customization (the project could use an `app.config.ts` to define Nuxt UI tokens that the Vite plugin merges with)

### 1.3 Theme Integration Flow

```
Nuxt UI Vite Plugin (colors: { primary: amber, ... })
         │
         ▼
@import '@nuxt/ui'    ← injects CSS custom properties (--ui-primary, --ui-radius, etc.)
         │              based on colors mapping + default Nuxt UI design tokens
         ▼
@import 'tailwindcss'  ← Tailwind v4 utilities + default theme values
         │
         ▼
@theme { ... }        ← only --font-sans overridden here
         │
         ▼
Components use:  bg-primary, text-muted, rounded-lg, etc.
               (Nuxt UI semantic + Tailwind utility classes)
```

---

## 2. main.css Analysis

**File**: `src/assets/main.css` (14 lines)

| Token | Value | Line | Notes |
|-------|-------|------|-------|
| `--font-sans` | `'Outfit', system-ui, sans-serif` | 6 | **Only custom token** |
| (all others) | Tailwind v4 defaults | — | Colors, spacing, radius, shadows, etc. |

| Import | Source | Line | Impact |
|--------|--------|------|--------|
| Google Fonts CDN | `fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap` | 1 | Loads ALL 9 weight variants (100-900) |
| `tailwindcss` | `@import 'tailwindcss'` | 2 | Full Tailwind v4 (preflight + utilities + theme) |
| `@nuxt/ui` | `@import '@nuxt/ui'` | 3 | Nuxt UI 4 component styles + CSS custom properties |

**What's MISSING from main.css**:
- No `@layer base` or `@layer components` for custom styles
- No `@custom-variant` for project-specific variants
- No `@utility` for custom utilities
- No design token declarations beyond `--font-sans`
- No CSS custom properties for colors, spacing, radii, or shadows

---

## 3. Nuxt UI Theme Configuration

### 3.1 `app.config.ts` — ABSENT

**Status**: Does not exist. Glob search for `**/app.config.{ts,json,js}` returned no results.

**Implication**: All Nuxt UI 4 theme customization happens through the Vite plugin's `ui()` config. An `app.config.ts` would allow defining theme values at runtime (colors, radius, typography) and would be the canonical place for Coco token definitions. Creating one is **essential** for the design-tokens-coco change.

### 3.2 Color Mode

The project does **NOT** use Nuxt UI's `useColorMode()`. Instead, it uses `@vueuse/core`'s `useColorMode()` which is imported at module level in three files:

| File | Line | Usage |
|------|------|-------|
| `src/app/composables/useSidebar.ts` | 19 | Module-level singleton. Provides Light/Dark menu items (lines 187-215) |
| `src/app/layouts/CatalogLayout.vue` | 5 | Sets `documentElement` and `body` background to hardcoded values |
| `src/features/catalog/components/CatalogHeader.vue` | 10 | Sun/moon toggle button |

**How dark mode works**:
1. `@vueuse/core`'s `useColorMode()` writes to `localStorage` (`vueuse-color-scheme` key) and toggles the `dark` class on `<html>`
2. Nuxt UI 4 reads the `dark` class for its component theming
3. Components individually handle dark mode via `dark:` Tailwind variants
4. No centralized dark mode policy — each component defines its own dark classes

**Dark mode default**: Not explicitly set. `@vueuse/core` default is `'auto'` (respects OS preference). First interaction persists choice to localStorage.

### 3.3 Nuxt UI Semantic Tokens in Use

The following Nuxt UI semantic tokens are used across components:

| Token | Usage Pattern | Example |
|-------|--------------|---------|
| `bg-default` | Default surface background | Cards, panels, inputs |
| `bg-elevated` | Elevated surface | Dropdowns, tooltips, highlighted items |
| `bg-elevated/{opacity}` | Semi-transparent elevated | `bg-elevated/40`, `bg-elevated/60`, `bg-elevated/80` |
| `text-default` | Primary text | Body copy |
| `text-dimmed` | Secondary/muted text | Placeholders, secondary info |
| `text-muted` | Tertiary text | Disabled states, hints |
| `text-highlighted` | Emphasized text | Active navigation, selected items |
| `text-primary` | Brand/accent text | Links, active states, action items |
| `text-error` / `text-error-500` | Error text | Validation messages |
| `text-warning` | Warning text | Cautionary messages |
| `border-default` | Default border | Cards, inputs, dividers |
| `border-accented` | Emphasized border | Focus states, selected items |
| `border-primary` | Brand border | Active states |
| `border-primary/70` | Semi-transparent brand border | Tenant card active state |
| `bg-primary` / `bg-primary/10` | Brand background | Primary button fill, subtle highlight |
| `ring-primary` | Focus ring | Input/styled element focus |
| `bg-success/10` / `bg-success/15` | Success background | Positive states |
| `bg-error/5` / `bg-error/10` | Error background | Error states |
| `bg-warning/10` | Warning background | Warning states |
| `--ui-border` | Raw CSS custom property | `PaymentEntryCard.vue:53` |
| `--reka-dropdown-menu-trigger-width` | Reka UI internal | `DashboardLayout.vue:60` |

---

## 4. Color Audit

### 4.1 Brand Color Inconsistency — CRITICAL

**Nuxt UI config declares**: `colors: { primary: 'amber', secondary: 'rose', neutral: 'zinc' }`
**Actual visual identity**: The catalog feature overwhelmingly uses **orange** classes, not Nuxt UI's `amber` primary.

| File | Orange Usage | Amber Usage |
|------|-------------|-------------|
| `CatalogHeader.vue:51` | `bg-orange-500 text-white` | — |
| `CatalogCategoryBar.vue:19` | `bg-orange-500 text-white shadow-sm shadow-orange-200` | — |
| `CatalogProductModal.vue:371` | `bg-orange-500 text-white hover:bg-orange-600` | — |
| `CatalogFooter.vue:11` | `bg-orange-500 text-white` | — |
| `CatalogCartDrawer.vue:64-65` | `bg-orange-50/50`, `text-orange-500` | — |
| `CatalogProductCard.vue:120` | `text-orange-500 hover:text-orange-600` | — |
| `CatalogProductGrid.vue:15` | `bg-orange-100` | — |
| `LoginForm.vue:88` | — | `bg-amber-500 hover:bg-amber-600` |
| `LoginHero.vue:42` | — | `text-amber-400` |

**Discovery**: The **login** feature uses `amber` (aligned with Nuxt UI's primary), while the **catalog** feature uses `orange` (visually distinct). Two different brand colors coexist. The Coco redesign must unify this.

### 4.2 Hardcoded Color Usage by Category

**Status Badges / Semantic Colors** (4 independent implementations — HIGH duplication):

| File | Lines | Colors Used |
|------|-------|-------------|
| `badge.utils.ts` | 39-46 | `emerald-500`, `amber-500`, `red-500`, `blue-500`, `violet-500`, `gray-400` |
| `StatusDotBadge.vue` | 51-60 | Same colors as above, matched 1:1 |
| `EmployeeProfileCard.vue` | 74-78 | `blue-200/50/700`, `orange-200/50/700`, `slate-200/100/700` (plus dark variants) |
| `DocumentosPanel.vue` | 202-210 | 9 document category colors — all different tailwind palettes |
| `EmployeesListView.vue` | 155-159 | Same as EmployeeProfileCard pattern (but WITHOUT dark variants) |

**Avatar Background Colors** (duplicated across 4 files):

| File | Lines | Colors |
|------|-------|--------|
| `EntityAvatar.vue` | 22-28 | `amber`, `pink`, `violet`, `red`, `cyan`, `emerald`, `blue` — all `*-500` |
| `PendingApprovalsView.vue` | 114-120 | **Exact same array** |
| `ResumenPanel.vue` | 43-49 | **Exact same array** |
| `EmployeeProfileCard.vue` | 55-61 | **Exact same array** |

**Custom Arbitrary Colors** (not mapped to any palette):

| File | Color Values | Context |
|------|-------------|---------|
| `ProductDetailView.vue:1643` | `bg-[#f7f7f5]`, `dark:bg-[#0a0a0b]` | Main container background |
| `ProductDetailView.vue:2430` | `bg-[repeating-linear-gradient(45deg,#f7f7f5_0,#f7f7f5_10px,#eeeeea_10px,#eeeeea_20px)]` | Image placeholder stripe |
| `ProductDetailView.vue:2502` | `bg-[#ebebe8]`, `dark:bg-[#1f1f24]` | Progress bar track |
| `ProductDetailView.vue:2515` | `bg-[#f3f3f1]`, `dark:bg-[#1f1f24]` | Check item background |
| `SalesView.vue:665` | `bg-[#fafafa]`, `dark:bg-[#09090b]` | Main POS background |
| `ActiveSalePanel.vue:266` | `bg-[#fafafa]`, `dark:bg-[#09090b]` | Sale panel background |
| `ProductSearchResults.vue:22` | `bg-[#fafafa]`, `dark:bg-[#09090b]` | Search results background |
| `CatalogLayout.vue:29` | `bg-[#FFF8F0]`, `dark:bg-zinc-900` | Catalog page background |

**Note**: `#fafafa` / `#09090b` appears in 3 files — an implicit convention that should be tokenized.

### 4.3 Direct Color Class Statistics

From grep across all `.vue` files:

| Pattern | Approx. Matches | Context |
|---------|-----------------|---------|
| `bg-{color}-{shade}` | 100+ | Backgrounds |
| `text-{color}-{shade}` | 100+ (truncated) | Text colors |
| `border-{color}-{shade}` | 90+ | Borders |
| `dark:` variants | 90+ | Dark mode overrides |

**Risk level**: **HIGH**. Color changes in design-tokens-coco would require touching 200+ locations across ~40+ files unless a systematic migration approach is used.

---

## 5. Radius Audit

### 5.1 Radius Value Distribution

| Radius Class | Frequency | Typical Usage |
|-------------|-----------|---------------|
| `rounded-full` | Very high | Avatars, badges, status dots, toggle pills |
| `rounded-xl` | High | Cards, buttons, product variant selectors, pill categories |
| `rounded-2xl` | High | Product cards, sale panels, main containers, modals |
| `rounded-lg` | High (most used) | Buttons, inputs, slideover panels, data table rows |
| `rounded-md` | Medium | Smaller UI controls, tabs, compact containers |
| `rounded` | Medium | Minimal radius for inline elements |
| `rounded-sm` | Low | Micro-radius labels, small status indicators |
| `rounded-[13px]` | 1 instance | `ProductDetailView.vue:2429` — custom radius for product detail card |
| `rounded-t-2xl` | 1 instance | `DataTableFilters.vue:24` — slideover top corners mobile |

**Current state**: All radius values come from Tailwind v4 defaults. Nuxt UI 4 applies its own radius tokens internally (rem-based). There is no unified radius scale.

### 5.2 Key Radius Patterns per Context

| Context | Radius Pattern | File Examples |
|---------|---------------|---------------|
| Product cards | `rounded-2xl` | `CatalogProductCard.vue:33`, `ProductSearchResultItem.vue:43` |
| Sale panels | `rounded-2xl` | `SalesView.vue:668,676`, `SaleDetailView.vue:415,422,433,437,441` |
| Sale items | `rounded-xl` | `SaleItemRow.vue:164` |
| Buttons (custom) | `rounded-xl` | `CatalogProductModal.vue:371` |
| Form sections | `rounded-lg` | `CreateEmployeeSlideover.vue:131,169,197`, `CustomerUpsertSlideover.vue:241,265` |
| Notification panels | `rounded-lg` | `NotificationConfigView.vue:77,87,105,135` |
| View toggle | `rounded-lg` | `ViewToggle.vue:54` |
| Category pills | `rounded-full` | `CatalogCategoryBar.vue:16` |
| Status badges | `rounded-full` | `StatusDotBadge.vue:66`, `DotBadge.vue:38` |
| Avatars | `rounded-full` | `EntityAvatar.vue:81`, `EmployeeProfileCard.vue:139` |
| Org chart nodes | `rounded-full` | `OrganigramaPanel.vue:136,158,220` |

---

## 6. Typography Audit

### 6.1 Font Loading — Outfit via Google Fonts CDN

**Current**: `src/assets/main.css`, line 1:
```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
```

**Issues**:
1. **Weight waste**: All 9 weights (100, 200, 300, 400, 500, 600, 700, 800, 900) are loaded, but only 4-5 are likely used
2. **Render-blocking**: The `@import` in CSS is a render-blocking request (no `media` attribute)
3. **No fallback strategy**: The `system-ui` fallback in `--font-sans` is standard but no `font-display` control
4. **Google Fonts dependency**: External CDN dependency adds latency and privacy concern

### 6.2 Migrating to Inter (Coco brand font)

**What changes**:
- Font family: Outfit → Inter
- Source: Google Fonts CDN → likely self-hosted or `@fontsource/inter`
- Weight range: `wght@100..900` → `wght@400..700` (Inter's useful range is narrower)
- The `--font-sans` token in `@theme` is the **only** place to change

### 6.3 Text Hierarchy Patterns

| Text Size | Usage Pattern | Typical Context |
|-----------|--------------|-----------------|
| `text-[10px]` | Micro labels | Badge text, featured labels |
| `text-[11px]` | Tiny labels | Category labels, stock status |
| `text-xs` | Extra small | Secondary metadata, timestamps |
| `text-sm` | Body text | Card content, descriptions, inputs |
| `text-base` | Default body | Standard content |
| `text-lg` | Subheading | Card titles, section headers |
| `text-xl` | Heading | Modal titles, page headers |
| `text-2xl` | Large heading | Login title, page titles |
| `text-3xl` | Display | Product pricing (modal) |

| Font Weight | Usage |
|-------------|-------|
| `font-normal` | Body text |
| `font-medium` | Interactive elements, secondary emphasis |
| `font-semibold` | Cards, buttons, labels (most used) |
| `font-bold` | Headings, prices, primary emphasis |

| Letter Spacing | Usage |
|---------------|-------|
| `tracking-tight` | Headings, titles |
| `tracking-wider` | Uppercase labels, category names |
| `tracking-widest` | Micro uppercase labels |

---

## 7. Gap Analysis — What's Missing

### 7.1 Design Token System (NONE exists)

| Token Category | Current State | What design-tokens-coco Must Add |
|---------------|---------------|----------------------------------|
| **Colors** | Nuxt UI `colors` mapping + hardcoded Tailwind classes | `--color-primary-*`, `--color-secondary-*`, `--color-neutral-*`, `--color-success-*`, `--color-warning-*`, `--color-error-*`, `--color-info-*` |
| **Typography** | Only `--font-sans` | `--font-sans`, `--font-mono`, `--text-*` scale, `--font-weight-*`, `--leading-*`, `--tracking-*` |
| **Radius** | Tailwind defaults + Nuxt UI internal | `--radius-*` scale (xs, sm, md, lg, xl, 2xl, full) |
| **Spacing** | Tailwind defaults | `--spacing` (if overriding 4px grid) |
| **Shadows** | Tailwind defaults + `dark:shadow-md dark:shadow-black/20` | `--shadow-*` scale (sm, md, lg, xl) with dark mode variants |
| **Z-index** | Tailwind defaults | `--z-*` scale if needed |
| **Animations** | Tailwind defaults | `--ease-*`, `--duration-*` if custom animations |

### 7.2 Component Rigidity

- **200+ hardcoded color classes** scattered across 40+ components
- 4 independent avatar color arrays (should be 1 shared constant)
- 5 independent status badge color implementations
- Each component handles dark mode independently

### 7.3 `app.config.ts` — Critical Missing File

Without `app.config.ts`, Nuxt UI 4 tokens cannot be customized at runtime. The Vite plugin config is compile-time only. For the Coco redesign:
- Nuxt UI's primary/secondary/neutral color tokens MUST be defined
- Radius tokens for Nuxt UI components MUST be defined
- Typography tokens for Nuxt UI consistent sizing MUST be defined

### 7.4 No CSS Custom Properties Layer

The project uses NO CSS custom properties aside from `--font-sans`. The Coco tokens should be exposed as CSS custom properties so:
- Components can consume tokens without hardcoding Tailwind classes
- Dark mode variants can use `@media (prefers-color-scheme: dark)` or `.dark` class overrides
- Tokens are discoverable in browser DevTools

---

## 8. Risks and Dependencies

### 8.1 Migration Risk: High

| Risk | Severity | Impact |
|------|----------|--------|
| **200+ hardcoded color locations** | HIGH | Every hardcoded `bg-{color}-{shade}` must be audited and migrated. Missed items will visually break. |
| **Brand color inconsistency** | HIGH | `orange` vs `amber` must be unified. Changing Nuxt UI `colors.primary` from `amber` to Coco's brand color will cascade through ALL Nuxt UI components. |
| **Avatar color arrays** (4 duplicates) | MEDIUM | Centralizing reduces risk of drift. |
| **Custom `#...` color values** | MEDIUM | 7+ distinct custom hex values in `ProductDetailView.vue` and POS views. Need to map to token palette. |
| **Dark mode breakage** | HIGH | If color tokens change without corresponding dark variants, dark mode UI will break silently. |
| **Nuxt UI component overrides** | LOW | Current slot overrides in Vite config should continue to work. |
| **Font swap flash** | LOW | Changing from Outfit to Inter may cause brief FOUT during first load. |

### 8.2 Dependency Chain

```
design-tokens-coco (THIS CHANGE)
    ↓ consumed by
design-tokens-coco-components (component-level token application)
    ↓ consumed by
design-tokens-coco-catalog (catalog-specific redesign)
design-tokens-coco-pos (POS-specific redesign)
design-tokens-coco-login (login page redesign)
design-tokens-coco-admin (admin feature redesign)
```

All downstream SDDs depend on the token foundation being correct and stable. **Breaking changes to token names after this change will cascade.**

### 8.3 Nuxt UI 4 Token Injection Mechanism

Nuxt UI 4 injects its tokens via `@import '@nuxt/ui'`. The tokens `--ui-primary`, `--ui-radius`, etc. are generated server-side based on the Vite plugin config + `app.config.ts`. Understanding the exact token resolution order is critical:

```
Tailwind v4 default theme
         │
    ← @theme { ... } overrides (main.css)
         │
    ← Nuxt UI Vite plugin `colors` mapping (vite.config.ts)
         │
    ← Nuxt UI `app.config.ts` theme overrides (MISSING — must be created)
         │
Final CSS output
```

---

## 9. Recommendations for Proposal

### 9.1 Token Definition Strategy

1. **Create `app.config.ts`** as the single source of truth for Nuxt UI 4 tokens:
   - `ui.colors.primary/secondary/neutral` → Coco brand palette
   - `ui.radius` → unified radius scale
   - `ui.container` → layout constraints

2. **Extend `@theme` in `main.css`** to define Tailwind v4 CSS-first tokens:
   - `--color-coco-*` custom color scale
   - `--font-sans` → Inter (replace Outfit)
   - `--radius-*` — map to Tailwind v4's `--radius-*` variables

3. **Define a semantic color layer**:
   - `--color-surface`, `--color-surface-elevated`, `--color-surface-dimmed`
   - `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`
   - Map semantic tokens to Nuxt UI equivalents where they overlap

### 9.2 Migration Approach

1. **Phase 1 (this change)**: Define tokens ONLY — no component changes
2. **Phase 2 (next SDD)**: Apply tokens to shared components (AppBadge, StatusDotBadge, EntityAvatar)
3. **Phase 3+**: Per-feature token application (catalog, POS, login, admin)

### 9.3 Color Strategy Decision

The key decision for the proposal is: **What replaces `orange` and `amber`?**

- Option A: Map Coco brand to a NEW Tailwind palette (e.g., a custom blue or green if Coco is in that direction)
- Option B: Use Nuxt UI's built-in palettes but normalize to ONE consistent palette
- Option C: Define custom CSS color scales in `@theme` for full control

The answer depends on the Coco brand identity — which the ORCHESTRATOR must provide (brand colors, typography, spacing preferences).

---

## 10. Affected Files Summary

| File | Lines | Impact | Migration Phase |
|------|-------|--------|-----------------|
| `src/assets/main.css` | 1-14 | Token definition surface | Phase 1 |
| `vite.config.ts` | 15-63 | Nuxt UI colors mapping, slot overrides | Phase 1 |
| (NEW) `app.config.ts` | — | Nuxt UI runtime token definition | Phase 1 |
| `src/core/shared/utils/badge.utils.ts` | 39-46 | DOT_CLASS_BY_COLOR hardcoded | Phase 2 |
| `src/core/shared/components/StatusDotBadge.vue` | 51-60 | Status pill colors hardcoded | Phase 2 |
| `src/core/shared/components/EntityAvatar.vue` | 22-28 | Avatar colors hardcoded | Phase 2 |
| `src/core/shared/components/DotBadge.vue` | 20, 38 | Default colors hardcoded | Phase 2 |
| `src/features/catalog/` (7+ files) | scattered | Heavy `orange-*` usage | Phase 3 |
| `src/features/auth/` (3+ files) | scattered | `amber-*` + `neutral-*` usage | Phase 3 |
| `src/features/POS/sales/` (7+ files) | scattered | Custom `#...` colors + hardcoded bg/text | Phase 3 |
| `src/features/POS/products/views/ProductDetailView.vue` | 1643-2515 | 15+ custom color values | Phase 3 |
| `src/features/admin/employees/` (5+ files) | scattered | Avatar colors + document colors | Phase 3 |
| `src/app/layouts/CatalogLayout.vue` | 7-8, 29 | Custom `#FFF8F0` bg | Phase 3 |
| `src/app/composables/useSidebar.ts` | 19, 187-222 | Dark mode controls | Phase 3 |

---

## Ready for Proposal

**Yes** — but the orchestrator needs to provide the **Coco brand specification** before the proposal can be written:
1. Coco brand colors (primary palette with shades)
2. Coco secondary/accent colors
3. Coco neutral palette preference
4. Typography: Inter weights to load, size scale preference
5. Radius scale preference (if different from Tailwind v4 default)
6. Spacing preference (if overriding 4px grid)
7. Any shadow elevation preferences
