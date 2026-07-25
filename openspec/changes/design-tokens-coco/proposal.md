# Proposal: Design Tokens — Coco Foundation

## Intent

The project has **no design token system**. Theming is an accident: a single `--font-sans` in `src/assets/main.css`, Nuxt UI 4's `colors: { primary: 'amber', secondary: 'rose', neutral: 'zinc' }` hardcoded in `vite.config.ts`, and 200+ hardcoded Tailwind color classes scattered across 40+ components. The catalog uses `orange-*`, the login uses `amber-*`, and eight custom hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, etc.) leak through arbitrary-value classes.

This change establishes the **Coco design token foundation** — the primitive layer that every subsequent SDD (`sales-view`, `catalog-redesign`, `login-redesign`, `branding-coco`) will consume. Nothing in this change is visual: it is pure infrastructure. It defines the brand palette, semantic role mapping, surface tokens, radius scale, typography, and light/dark variants in **two coordinated layers** so that Nuxt UI components (via `app.config.ts`) and non-Nuxt UI components (via Tailwind v4 `@theme` CSS custom properties) speak the same language.

Without this foundation, every downstream SDD will re-litigate the same color decisions, and the brand will never unify.

## Scope

### In Scope

- **`app.config.ts` (NEW)** — runtime Nuxt UI 4 theme definition: `ui.colors.primary/secondary/neutral/error`, `ui.radius`, plus the Coco brand mapping.
- **`src/assets/main.css` (MODIFIED)** — extend `@theme` block with Coco CSS custom properties (`--color-coco-*`, `--color-surface-*`, `--color-text-*`, `--radius-coco-*`), replace Outfit `@import` with Inter (4 weights + `cv11/ss01/tnum` font features).
- **`vite.config.ts` (MODIFIED)** — remove the brittle `colors: { primary: 'amber', secondary: 'rose', neutral: 'zinc' }` mapping (delegated to `app.config.ts`); keep slot overrides that are sizing-only.
- **Token contract** — define all 11 Coco palette colors, the surface/text/border semantic layer, the radius scale, and the typography stack in both layers. Light mode variants declared for every token (dark-first default).
- **Hidden hex absorption** — map the 7+ scattered hex values (`#fafafa → var(--color-surface-base)`, `#09090b → dark surface-base`, `#FFF8F0 → catalog surface-soft`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) to semantic tokens.
- **Avatar array unification** — collapse the 4 duplicate 7-color avatar arrays (`EntityAvatar.vue`, `PendingApprovalsView.vue`, `ResumenPanel.vue`, `EmployeeProfileCard.vue`) into one shared `AVATAR_PALETTE` constant in `src/core/shared/utils/`.
- **Brand palette reconciliation** — `orange-*` (catalog) and `amber-*` (login) become the same Coco token; the unified brand color is the Coco `primary` (`#2442f6`) for interactive elements and `action` (`#f6bb13` gold) for CTAs.
- **Migration strategy document** — a tactical plan for the 200+ hardcoded classes, sequenced so the `apply` phase can execute it without re-deciding per file.

### Out of Scope

- **Brand rename "HoundFe" → "Coco"** → `branding-coco` SDD.
- **Component visual redesign** (cards, buttons, modals, layouts) → `design-tokens-coco-components` SDD.
- **Feature-specific token application** (sales, catalog, login, admin) → per-feature SDDs.
- **Responsive behavior changes** — this SDD only defines static tokens.
- **Dark mode toggle behavior changes** — `@vueuse/core` `useColorMode` integration is unchanged.
- **Component API changes** — no props, emits, or slot contracts change.
- **Removing hardcoded classes from components** — only the strategy is defined here; application happens in follow-up SDDs.
- **Adding new components or features**.

## Capabilities

### New Capabilities

- `design-tokens`: The Coco design token system. Defines the canonical palette, semantic role mapping, surface/text/border scales, radius scale, and typography presets. Exposes tokens through two complementary surfaces: Nuxt UI 4's `app.config.ts` (for U-prefixed components) and Tailwind v4's `@theme` CSS custom properties (for non-Nuxt UI markup). Includes light/dark variants for every color token. This becomes `openspec/specs/design-tokens/spec.md`.

### Modified Capabilities

- None. The existing `notification-config`, `promotions`, and `sales` specs are unchanged at the requirement level — they continue to use the same Nuxt UI semantic tokens (`bg-primary`, `text-error`, etc.), just backed by different raw values.

## Approach

### Two-Layer Token Strategy

**Layer 1 — Nuxt UI 4 via `app.config.ts`** (the canonical source for `UButton`, `UBadge`, `UCard`, `UTabs`, etc.):

```ts
// app.config.ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'coco',       // → cyan-ish blue #2442f6
      secondary: 'coco-soft',// → navy #173968
      neutral: 'coco-neutral', // → purple-grey #2c2434 / #493f54
      error: 'red',          // → #ef4444 (danger only)
    },
    radius: {
      xs: '4px',
      sm: '8px',
      md: '12px',
      lg: '18px',
      xl: '28px',
    },
  },
})
```

Nuxt UI 4 reads this at build time and generates `--ui-primary`, `--ui-radius`, etc. By choosing `coco` as the color name, we tell Nuxt UI to look up `--color-coco-*` in the Tailwind v4 theme. The two layers are bridged by name.

**Layer 2 — Tailwind v4 `@theme` in `main.css`** (for custom Vue components, layouts, and arbitrary classes):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import 'tailwindcss';
@import '@nuxt/ui';

@theme {
  --color-coco-black: #000000;
  --color-coco-deep: #2c2434;
  --color-coco-mid: #493f54;
  --color-coco-navy: #173968;
  --color-coco-blue: #2442f6;
  --color-coco-cyan: #5eeaf1;
  --color-coco-brown: #443218;
  --color-coco-peach: #ebd5d0;
  --color-coco-gold: #f6bb13;
  --color-coco-white: #ffffff;
  --color-coco-red: #ef4444;       /* danger exception */

  --color-surface-base: var(--color-coco-black);
  --color-surface-raised: var(--color-coco-deep);
  --color-surface-elevated: var(--color-coco-mid);
  --color-surface-input: var(--color-coco-deep);

  --color-border-subtle: rgb(255 255 255 / 0.08);
  --color-border-card: rgb(255 255 255 / 0.12);

  --color-text-primary: var(--color-coco-white);
  --color-text-secondary: rgb(255 255 255 / 0.60);
  --color-text-muted: rgb(255 255 255 / 0.38);

  --radius-coco-xs: 4px;
  --radius-coco-sm: 8px;
  --radius-coco-md: 12px;
  --radius-coco-lg: 18px;
  --radius-coco-xl: 28px;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-sans--font-feature-settings: 'cv11', 'ss01', 'tnum';
}
```

Light mode variants are declared in a parallel block under `@custom-variant` (or `.light` selector override) but **not yet consumed by components** — the tokens are defined for future SDD adoption.

### Token-to-Component Translation Table

The `apply` phase will use this mapping. It is the bridge between the locked design decisions and the 200+ hardcoded classes.

| Current Class Pattern | Coco Token | Notes |
|---|---|---|
| `bg-orange-500`, `bg-orange-600`, `bg-orange-50/50` | `bg-primary` / `bg-coco-blue` | Catalog interactive elements |
| `bg-amber-500`, `bg-amber-600`, `text-amber-400` | `bg-coco-gold` / `text-coco-gold` | Login CTA |
| `bg-zinc-900`, `bg-zinc-950`, `bg-white` | `bg-surface-base` / `bg-surface-raised` | Card backgrounds |
| `bg-[#fafafa]`, `dark:bg-[#09090b]` | `bg-surface-base` (light/dark auto) | POS backgrounds |
| `bg-[#FFF8F0]` | `bg-coco-peach/20` | Catalog page surface |
| `bg-[#f7f7f5]`, `dark:bg-[#0a0a0b]` | `bg-surface-raised` | Product detail container |
| `bg-[#ebebe8]`, `dark:bg-[#1f1f24]` | `bg-surface-input` | Progress tracks |
| `bg-elevated/40`, `bg-elevated/60` | `bg-surface-elevated/40` | Dropdowns, modals |
| `text-white`, `text-zinc-100` | `text-text-primary` | Primary text |
| `text-zinc-400`, `text-zinc-500` | `text-text-secondary` | Secondary text |
| `text-zinc-600`, `text-zinc-700` | `text-text-muted` | Muted text |
| `border-zinc-200`, `dark:border-zinc-800` | `border-border-subtle` | Borders |
| `rounded-full` | `rounded-full` (unchanged) | Pills, avatars |
| `rounded-2xl` | `rounded-coco-lg` (18px) | Cards, panels |
| `rounded-xl` | `rounded-coco-md` (12px) | Buttons, items |
| `rounded-lg` | `rounded-coco-sm` (8px) | Form sections |
| `rounded` | `rounded-coco-xs` (4px) | Micro radius |
| `font-Outfit` (implicit) | `font-sans` | Inter inherits |

### Avatar Array Unification

Create `src/core/shared/utils/avatar-palette.ts`:

```ts
export const AVATAR_PALETTE = [
  'bg-coco-blue',
  'bg-coco-cyan',
  'bg-coco-gold',
  'bg-coco-peach',
  'bg-coco-mid',
  'bg-coco-navy',
  'bg-coco-brown',
] as const

export const avatarColor = (key: string): string => {
  const hash = [...key].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!
}
```

Then delete the 4 inline arrays in `EntityAvatar.vue`, `PendingApprovalsView.vue`, `ResumenPanel.vue`, and `EmployeeProfileCard.vue` and import from this single source.

### Migration Strategy for 200+ Locations

The `apply` phase will execute this in a deterministic order — **not ad-hoc per file**:

1. **Tokens first** — establish `app.config.ts` + `@theme` BEFORE touching any component. This means the first PR/CI run may temporarily show visual regressions (the new tokens are loaded but no component yet references them); the rolled-back state is "old colors via old classes" until component migration lands.
2. **Shapes-first migration** — replace the 8 arbitrary hex values (`bg-[#fafafa]`, etc.) with token classes. This removes the most fragile layer.
3. **Avatar unification** — single PR, trivial diff, high signal value.
4. **Catalog batch** — `orange-*` → `coco-*` across all 7 catalog files, alphabetically grouped by import.
5. **POS batch** — `#fafafa/#09090b` → `bg-surface-base` across the 3 POS files.
6. **Auth/Login batch** — `amber-*` → `coco-gold` across `LoginForm.vue`, `LoginHero.vue`.
7. **Per-feature batch** — remaining `bg-{color}-{shade}` and `text-{color}-{shade}` classes are replaced by `bg-surface-*` / `text-text-*` per the translation table.
8. **Dark mode verification** — every `dark:` variant is re-validated against the new token light/dark split.

The apply phase forecasts this as **multi-chain PRs** (the 400-line review budget is insufficient for 200+ locations in one slice).

### Inter Font Migration

| Aspect | Before | After |
|---|---|---|
| Family | Outfit | Inter |
| Weights loaded | 100, 200, 300, 400, 500, 600, 700, 800, 900 (9) | 400, 500, 600, 700 (4) |
| Source | Google Fonts CDN | Google Fonts CDN (same pattern) |
| Feature settings | default | `cv11`, `ss01`, `tnum` |
| Storage savings | ~90KB woff2 | ~40KB woff2 (~55% reduction) |
| `--font-sans` | `'Outfit', system-ui, sans-serif` | `'Inter', system-ui, sans-serif` |

The `--font-sans` token is the single change surface. No component references `Outfit` directly.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `app.config.ts` (NEW) | New | Nuxt UI 4 runtime theme definition file |
| `src/assets/main.css` | Modified | `@theme` block extended with Coco tokens; Outfit → Inter |
| `vite.config.ts` | Modified | Remove `colors` mapping from `ui()` config (move to `app.config.ts`); preserve slot overrides |
| `src/core/shared/utils/avatar-palette.ts` (NEW) | New | Single source for 7-color avatar array |
| `src/core/shared/components/EntityAvatar.vue` | Modified | Delete inline array, import from shared util |
| `src/features/admin/views/PendingApprovalsView.vue` | Modified | Delete inline array, import from shared util |
| `src/features/admin/views/ResumenPanel.vue` | Modified | Delete inline array, import from shared util |
| `src/features/admin/employees/components/EmployeeProfileCard.vue` | Modified | Delete inline array, import from shared util |
| (Strategy only — applied in follow-up SDDs) |  |  |
| `src/features/catalog/**` (7 files) | Modified (later) | `orange-*` → Coco tokens |
| `src/features/auth/**` (3 files) | Modified (later) | `amber-*` → Coco gold |
| `src/features/POS/**` (10 files) | Modified (later) | Hex values → surface tokens |
| `src/features/POS/products/views/ProductDetailView.vue` | Modified (later) | 15+ custom hex values |
| `src/app/layouts/CatalogLayout.vue` | Modified (later) | `#FFF8F0` → Coco peach |
| `DESIGN.md` | Modified | Documentation update (palette, typography, token sources) |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **200+ location migration** — visual regressions if a file is missed | High | Strict translation table; batched apply per feature; visual smoke test in each PR |
| **Dark mode regression** — new tokens break existing `dark:` overrides | High | Light/dark variants defined for every color BEFORE any component migration; dark mode is the default, light tokens are inert until future SDD |
| **Brand color unification** — `orange` and `amber` semantics must merge cleanly | High | Semantic role mapping (`primary`, `action`, `accent`) is the contract; tokens map to roles, not raw colors |
| **Token name stability** — downstream SDDs depend on stable names | Medium | Names are locked in this SDD; any future rename triggers a deprecation cycle, not silent breakage |
| **Nuxt UI 4 + `app.config.ts` integration** — Vite plugin might not honor runtime config | Medium | Verify in `apply` phase with a smoke test that `bg-primary` resolves to `--color-coco-blue` before any component migration |
| **Font swap flash (FOUT)** — Outfit → Inter causes brief visual shift | Low | `font-display: swap` is the default; card layout reflows are minimal at this scale |
| **`@theme` token naming collision** with Tailwind v4 defaults | Low | Coco prefix (`--color-coco-*`, `--radius-coco-*`) prevents collision with `--color-blue-*` defaults |
| **Avatar array unification** — hash function may produce different colors than current alphabetical assignment | Medium | Document the change in commit message; visual diff in PR; revert if any component relies on positional stability |

## Rollback Plan

1. **Atomic rollback** — the token foundation lives in exactly 3 files: `app.config.ts` (new), `src/assets/main.css` (modified), `vite.config.ts` (modified). Reverting these 3 files via `git revert` restores the pre-change state with zero orphan references.
2. **Avatar unification** — the `avatar-palette.ts` file is additive; the 4 components that consume it will gracefully fall back to their inline arrays if the import path is removed (the import is the only coupling).
3. **No database migrations, no API changes, no component contract changes** — the change is purely additive at the configuration layer.
4. **Verification on rollback** — `pnpm build` succeeds, `pnpm test:unit` passes, dev server renders identically to the pre-change baseline.

## Dependencies

- **Nuxt UI 4.6.0** — already installed. `app.config.ts` is supported in v4 via the Vite plugin's runtime config merge.
- **Tailwind CSS 4.2.2** — already installed. `@theme` directive is the canonical CSS-first token surface.
- **Inter font** — Google Fonts CDN (same dependency surface as current Outfit). No new external service.
- **Follow-up SDDs** — this change is a hard prerequisite for `design-tokens-coco-components`, `design-tokens-coco-catalog`, `design-tokens-coco-pos`, `design-tokens-coco-login`, `design-tokens-coco-admin`, and `branding-coco`. Token names defined here are the contract those SDDs consume.

## Success Criteria

- [ ] `app.config.ts` exists at project root and defines `ui.colors.primary/secondary/neutral/error` and `ui.radius` mapped to Coco tokens.
- [ ] `src/assets/main.css` `@theme` block declares all 11 Coco palette colors (`--color-coco-*`), surface/text/border semantic tokens, and the 5-step radius scale.
- [ ] Outfit is removed from `main.css`; Inter is loaded with exactly 4 weights (400, 500, 600, 700) and `cv11/ss01/tnum` font features.
- [ ] Light mode token variants are defined for every color token (deferred activation — components do not consume them yet).
- [ ] All 7+ scattered hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) are documented in the translation table with their target semantic tokens.
- [ ] `src/core/shared/utils/avatar-palette.ts` exists as the single source of truth for the 7-color avatar palette.
- [ ] The 4 duplicate avatar arrays (`EntityAvatar.vue`, `PendingApprovalsView.vue`, `ResumenPanel.vue`, `EmployeeProfileCard.vue`) are deleted and replaced by imports from the shared util.
- [ ] `vite.config.ts` `ui()` config no longer contains the `colors` mapping (delegated to `app.config.ts`).
- [ ] `pnpm build` succeeds (type-check + Vite build pass).
- [ ] `pnpm test:unit` passes — all 2911+ unit tests green.
- [ ] `pnpm dev` renders a working application with dark mode as the default and Coco tokens resolving correctly.
- [ ] `DESIGN.md` is updated to reflect Coco palette, Inter typography, and the token source of truth (`app.config.ts` + `@theme`).
- [ ] The 200+ hardcoded color locations are **catalogued** in the migration strategy (not yet migrated — that is the apply phase work for follow-up SDDs).

## Open Questions

None. All five proposal questions were resolved:

1. ✅ Outfit → Inter migration confirmed for this SDD.
2. ✅ Coco palette applies to entire system (catalog included).
3. ✅ Hidden hex values absorbed and avatar arrays unified in this SDD.
4. ✅ Light mode tokens defined now (deferred component adoption).
5. ✅ Both layers (`app.config.ts` + `@theme`) are in scope.
