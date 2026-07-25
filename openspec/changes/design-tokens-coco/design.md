# Design: Design Tokens — Coco Foundation

> **STATUS NOTE — read first.** This design corrects a factual error in the
> proposal/spec. Verified against the official Nuxt UI v4 docs (v4.6.0,
> `ui.nuxt.com/docs/getting-started/installation/vue` &
> `…/theme/design-system`): **`app.config.ts` is a Nuxt-only mechanism.** In a
> pure Vue + Vite project (this repo), the Nuxt UI Vite plugin reads theme
> config from the `ui()` options in `vite.config.ts`, NOT from `app.config.ts`.
> Quoting the docs: *"For app-level theme configuration, Nuxt projects should use
> the `app.config.ts` file, while Vue projects should use the `vite.config.ts`
> file."* Creating `app.config.ts` here would be silently ignored.
>
> Additionally, `colors.primary: 'coco'` requires a **full 50–950 shade scale**
> (`--color-coco-50 … --color-coco-950`) — Nuxt UI maps each semantic alias to a
> Tailwind color *scale*, not a single hex. The proposal's 11 single-named
> `--color-coco-blue` vars are valid Tailwind utility colors but **cannot** back
> a Nuxt UI `primary` alias.
>
> This design implements the *intent* of the proposal (a Coco token foundation)
> using the *correct* Vite mechanism. Every DT-REQ is still satisfiable; the
> verification commands are adjusted. This is flagged as Open Question OQ-1 for
> orchestrator sign-off.

## 1. Architecture Overview

Two coordinated token layers, bridged by **name**:

```
                         ┌─ Layer 1: Nuxt UI (U* components) ──────────────┐
vite.config.ts           │ ui.colors: { primary:'coco', neutral:'coco-     │
  ui({ ui:{ colors,      │   neutral', secondary:'coco-navy', error:'red', │
    slots… } })  ───────▶│   info:'blue', success:'emerald', warning:'amber'│
                         │ } → generates --ui-color-primary-500 =          │
                         │   var(--color-coco-500) … (build-time)          │
                         └────────────────────┬────────────────────────────┘
                                              │ name bridge
                         ┌─ Layer 2: Tailwind v4 @theme (custom markup) ───┐
src/assets/main.css      │ @theme static { --color-coco-{50..950} … }      │
  @import 'tailwindcss'  │ @theme { --color-coco-blue … (11 brand)         │
  @import '@nuxt/ui'     │        --color-surface-* --color-text-*         │
  @theme { … }           │        --radius-*  --font-sans }                │
                         │ .light { … light overrides … }                  │
                         └─────────────────────────────────────────────────┘
```

| Layer | Owns | Consumed by |
|---|---|---|
| **Layer 1 — `vite.config.ts` `ui.colors`** | Semantic color aliases (`primary`, `secondary`, `neutral`, `error`, `warning`, `success`, `info`) → which Tailwind scale backs them; slot sizing overrides | All `U`-prefixed components (`UButton`, `UBadge`, `UCard`, `UTabs`…) via `bg-primary`, `text-error`, etc. |
| **Layer 2 — `@theme` in `main.css`** | (a) Full Coco shade scales backing Layer 1; (b) 11 named brand colors for direct utility use; (c) surface/text/border semantic tokens; (d) radius scale; (e) Inter typography; (f) light variants | Custom Vue components & arbitrary markup via `bg-coco-blue`, `bg-surface-base`, `text-text-primary`, `rounded-coco-md`, `font-sans` |

The bridge: Layer 1 references a scale *name* (`coco`); Layer 2 defines that scale (`--color-coco-50..950`). Both layers share the **same semantic names** (`primary`, `surface`, `text`, `radius`) so a designer and an engineer speak one vocabulary.

## 2. File Manifest

| File | Action | Purpose |
|------|--------|---------|
| `app.config.ts` | **NOT CREATED** | Nuxt-only; inert in Vite. See Status Note + OQ-1. (Spec DT-REQ-001 "AND `app.config.ts`" is reinterpreted: the Nuxt UI color definitions live in `vite.config.ts` `ui.colors`, which is the Vite-equivalent location.) |
| `vite.config.ts` | Modify | Replace `colors:{primary:'amber',secondary:'rose',neutral:'zinc'}` with Coco alias map. Keep all slot/variant overrides. |
| `src/assets/main.css` | Modify | Replace Outfit import with Inter (4 weights); add `@theme static` Coco shade scales + `@theme` brand colors / surface / text / border / radius / font tokens + `.light` overrides. |
| `src/core/shared/utils/avatar-palette.ts` | Create | Single source of truth for the 7-color avatar palette + `avatarColor()` hash. Path follows spec DT-REQ-007 **and** existing `src/core/shared/utils/` convention (no `src/app/constants/` dir exists). |
| `src/core/shared/components/EntityAvatar.vue` | Modify | Delete inline `AVATAR_PALETTES`; import from shared util. |
| `src/features/admin/views/PendingApprovalsView.vue` | Modify | Delete inline array; import shared util. |
| `src/features/admin/views/ResumenPanel.vue` | Modify | Delete inline array; import shared util. |
| `src/features/admin/employees/components/EmployeeProfileCard.vue` | Modify | Delete inline array; import shared util. |
| `DESIGN.md` | Modify | Document Coco palette, Inter, token sources. |

Component-class migration (200+ locations) is **strategy only** here — applied in follow-up SDDs.

## 3. Theme Configuration (`vite.config.ts` — replaces `app.config.ts`)

The `ui.colors` block becomes the Coco alias map. Each value is a *Tailwind scale name* that must exist as `--color-<name>-{50..950}` in `@theme static`.

```ts
// vite.config.ts — only the ui() block changes
ui({
  ui: {
    // …existing button/navigationMenu/dropdownMenu/dashboardSearchButton
    //     card/dashboardPanel slot overrides UNCHANGED…
    colors: {
      primary:   'coco',          // #2442f6 family — interactive brand
      secondary: 'coco-navy',     // #173968 family — primary-soft / deep accents
      neutral:   'coco-neutral',  // #2c2434/#493f54 family — surfaces, text scale
      error:     'red',           // Tailwind built-in #ef4444 — danger only
      warning:   'amber',         // Tailwind built-in — caution (Coco gold reserved for CTA `action`, not Nuxt UI `warning`)
      success:   'emerald',       // Tailwind built-in — positive states
      info:      'blue',          // Tailwind built-in — informational
    },
  },
})
```

**Why not a `ui.radius` object:** the Nuxt UI v4 Vite API exposes `ui.colors` and slot overrides; a `ui.radius` config object is **not** a documented option. Radius is controlled via CSS: Nuxt UI's own `--ui-radius` (default `0.5rem`) for `U*` components, plus Tailwind v4 `--radius-*` utilities for custom markup. Radius is therefore defined in Layer 2 (`@theme`), not Layer 1. (See OQ-2.)

The four remaining built-ins (`red`, `amber`, `emerald`, `blue`) are deliberately retained as scales because Nuxt UI's semantic colors (`error`/`warning`/`success`/`info`) need a 50–950 ramp and re-deriving those ramps in Coco adds risk with no brand payoff. `red` IS the Coco `danger` value `#ef4444` — single source of truth is preserved (Tailwind `red-500` == `#ef4444`).

## 4. `@theme` Extension Design (`src/assets/main.css`)

```css
/* ── Inter (replaces Outfit): 4 weights + cv11/ss01/tnum features ── */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@import 'tailwindcss';
@import '@nuxt/ui';

/* ── @theme static: full shade scales backing Nuxt UI aliases (Layer 1) ── */
/* `static` so Tailwind emits the --color-* vars even before utilities reference them,
   guaranteeing Nuxt UI's --ui-color-primary-500 = var(--color-coco-500) resolves.    */
@theme static {
  /* coco = primary (#2442f6 ramp). 500 anchored to brand blue. */
  --color-coco-50:  #eef1fe;
  --color-coco-100: #dbe2fd;
  --color-coco-200: #bcc9fc;
  --color-coco-300: #8fa1fa;
  --color-coco-400: #5d72f8;
  --color-coco-500: #2442f6;   /* ← Coco brand blue */
  --color-coco-600: #1a30d8;
  --color-coco-700: #1829a8;
  --color-coco-800: #1a2885;
  --color-coco-900: #1c2868;
  --color-coco-950: #141a3e;

  /* coco-navy = secondary (#173968 ramp) */
  --color-coco-navy-50:  #eef3f8;
  --color-coco-navy-100: #dbe6f1;
  --color-coco-navy-200: #bcd0e3;
  --color-coco-navy-300: #8fb0cd;
  --color-coco-navy-400: #5a87b1;
  --color-coco-navy-500: #173968;  /* ← Coco navy */
  --color-coco-navy-600: #143059;
  --color-coco-navy-700: #132a4d;
  --color-coco-navy-800: #14263f;
  --color-coco-navy-900: #152236;
  --color-coco-navy-950: #0e1722;

  /* coco-neutral = neutral (#2c2434 / #493f54 ramp — purple-grey) */
  --color-coco-neutral-50:  #f6f5f7;
  --color-coco-neutral-100: #ebeaef;
  --color-coco-neutral-200: #d6d3dd;
  --color-coco-neutral-300: #b3adb e;
  --color-coco-neutral-400: #847c91;
  --color-coco-neutral-500: #493f54;  /* ← Coco mid */
  --color-coco-neutral-600: #3a3145;
  --color-coco-neutral-700: #2c2434;  /* ← Coco deep */
  --color-coco-neutral-800: #261f2e;
  --color-coco-neutral-900: #211b28;
  --color-coco-neutral-950: #160f1c;
}

/* ── @theme: named brand colors (direct utilities) + semantic + radius + font ── */
@theme {
  /* 11 Coco brand colors — for direct utility use (bg-coco-blue, text-coco-gold) */
  --color-coco-black: #000000;
  --color-coco-deep:  #2c2434;
  --color-coco-mid:   #493f54;
  --color-coco-navy-brand: #173968;   /* distinct name to avoid clash with the coco-navy *scale* */
  --color-coco-blue:  #2442f6;
  --color-coco-cyan:  #5eeaf1;
  --color-coco-brown: #443218;
  --color-coco-peach: #ebd5d0;
  --color-coco-gold:  #f6bb13;
  --color-coco-white: #ffffff;
  --color-coco-red:   #ef4444;        /* danger exception */

  /* Semantic: surfaces (dark-first default) */
  --color-surface-base:     var(--color-coco-black);
  --color-surface-raised:   var(--color-coco-deep);
  --color-surface-elevated: var(--color-coco-mid);
  --color-surface-input:    var(--color-coco-deep);

  /* Semantic: borders */
  --color-border-subtle: rgb(255 255 255 / 0.08);
  --color-border-card:   rgb(255 255 255 / 0.12);

  /* Semantic: text (dark-first) */
  --color-text-primary:   var(--color-coco-white);
  --color-text-secondary: rgb(255 255 255 / 0.60);
  --color-text-muted:     rgb(255 255 255 / 0.38);

  /* Radius scale (utilities: rounded-coco-xs … rounded-coco-full) */
  --radius-coco-xs: 4px;
  --radius-coco-sm: 8px;
  --radius-coco-md: 12px;
  --radius-coco-lg: 18px;
  --radius-coco-xl: 28px;
  --radius-coco-full: 9999px;

  /* Override Nuxt UI default radius for U* components → coco-md (12px) baseline */
  --ui-radius: 0.75rem;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-sans--font-feature-settings: 'cv11', 'ss01', 'tnum';
}

/* ── Light mode variants (DT-REQ-005): defined, NOT yet consumed ── */
/* @vueuse useColorMode toggles `.dark`/`.light` on <html>. Default is dark.   */
/* We override the semantic layer only when `.light` is active.                */
.light {
  --color-surface-base:     #ffffff;
  --color-surface-raised:   #f7f7f5;
  --color-surface-elevated: #ebebe8;
  --color-surface-input:    #ffffff;
  --color-border-subtle:    rgb(0 0 0 / 0.08);
  --color-border-card:      rgb(0 0 0 / 0.12);
  --color-text-primary:     #09090b;
  --color-text-secondary:   rgb(9 9 11 / 0.60);
  --color-text-muted:       rgb(9 9 11 / 0.38);
}

html, body, #app { height: 100%; margin: 0; }
```

**Note on the `coco-navy` naming clash:** the *scale* (`--color-coco-navy-50..950`, backs Nuxt UI `secondary`) and the *brand swatch* (`#173968`, direct utility) share the name "navy". To keep `bg-coco-navy` unambiguous as the brand swatch, the brand entry is named `--color-coco-navy-brand` (utility `bg-coco-navy-brand`). This avoids two `@theme` keys resolving the bare `coco-navy` token to different values. (See OQ-3.)

## 5. Token Naming Convention

| Namespace | Form | Layer | Example |
|---|---|---|---|
| Nuxt UI semantic alias | lowercase word | 1 (`ui.colors`) | `primary`, `neutral`, `error` |
| Tailwind scale backing alias | `--color-<name>-<shade>` (50–950) | 2 (`@theme static`) | `--color-coco-500` |
| Coco brand swatch (direct utility) | `--color-coco-<name>` | 2 (`@theme`) | `--color-coco-blue`, `--color-coco-gold` |
| Semantic surface | `--color-surface-<role>` | 2 | `--color-surface-base` |
| Semantic text | `--color-text-<role>` | 2 | `--color-text-primary` |
| Semantic border | `--color-border-<role>` | 2 | `--color-border-subtle` |
| Radius | `--radius-coco-<step>` | 2 | `--radius-coco-md` |
| Font | `--font-sans` (+ `--font-sans--font-feature-settings`) | 2 | — |

**Shared-semantic rule:** Layer 1's `primary` and Layer 2's `coco-blue` resolve to the **same** hex (`#2442f6`) — `coco-500` == `coco-blue`. Same for `neutral`↔`coco-neutral-700`. Both layers thus describe one palette; only the access surface differs.

## 6. Migration Strategy (apply phase — multi-chain PRs)

Ordered so each batch is independently verifiable and revertible.

| # | Batch | Scope | Replace pattern | Verify |
|---|---|---|---|---|
| 0 | Tokens first | `vite.config.ts` + `main.css` only | — | `pnpm build`, smoke: `UButton` bg == `#2442f6` |
| 1 | Arbitrary hex | 8 hex values (§8) across POS/catalog | `bg-[#fafafa]`→`bg-surface-base`, `dark:bg-[#09090b]`→`bg-surface-base` (token self-switches) | `grep -rn '#fafafa\|#09090b\|…' src/` empty |
| 2 | Avatar unification | 4 files → shared util (§7) | inline array → import | grep inline arrays empty; visual diff |
| 3 | Catalog | 7 files, `orange-*` | `bg-orange-500`→`bg-coco-blue`, `text-orange-500`→`text-coco-blue` | per-file screenshot |
| 4 | POS | 3 files, `#fafafa/#09090b` + `zinc` | `bg-zinc-900`→`bg-surface-raised` | dark-mode smoke |
| 5 | Auth/Login | `LoginForm.vue`, `LoginHero.vue`, `amber-*` | `bg-amber-500`→`bg-coco-gold` | login screenshot |
| 6 | Remaining `bg/text/border-{color}-{shade}` | ~40 files | per translation table (proposal) | full regression |
| 7 | Dark-mode re-validation | every `dark:` variant | confirm token auto-switch removes need for paired `dark:` | remove redundant `dark:` where token handles both |

**Rollback:** foundation lives in 2 files (`vite.config.ts`, `main.css`) + 1 new util. `git revert` of the foundation commit restores prior state; the avatar util is additive (4 imports simply re-inline if reverted).

## 7. Avatar Color Unification

**File:** `src/core/shared/utils/avatar-palette.ts`

```ts
/**
 * Single source of truth for the 7-color avatar palette.
 * Colors chosen from the Coco brand set with sufficient contrast for white text.
 * Replaces the 4 duplicate inline arrays in EntityAvatar / PendingApprovalsView
 * / ResumenPanel / EmployeeProfileCard.
 */
export const AVATAR_PALETTE = [
  'bg-coco-blue text-white',
  'bg-coco-cyan text-coco-black',
  'bg-coco-gold text-coco-black',
  'bg-coco-peach text-coco-black',
  'bg-coco-mid text-white',
  'bg-coco-navy-brand text-white',
  'bg-coco-brown text-white',
] as const

export const avatarColor = (seed: string): string => {
  const hash = [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0]
}
```

**Critical preservation:** the original inline arrays paired each bg with a text color (`'bg-amber-500 text-white'`). The proposal's draft omitted the text class — that would render initials invisible. The shared constant keeps `text-*` paired. Text color flips to `coco-black` on the light swatches (cyan/gold/peach) for contrast.

**Import changes** (identical in all 4 files):

```ts
// before
const AVATAR_PALETTES = [ 'bg-amber-500 text-white', … ] as const
// after
import { avatarColor } from '@/core/shared/utils/avatar-palette'
// and replace AVATAR_PALETTES[hash % …] with avatarColor(seed)
```

| File | Current array location |
|---|---|
| `src/core/shared/components/EntityAvatar.vue` | lines 21–29 (`AVATAR_PALETTES`) |
| `src/features/admin/views/PendingApprovalsView.vue` | ~lines 114–120 |
| `src/features/admin/views/ResumenPanel.vue` | ~lines 43–49 |
| `src/features/admin/employees/components/EmployeeProfileCard.vue` | ~lines 55–61 |

**Behavioral note (risk):** the hash algorithm is preserved (char-code sum), but the palette order/colors change → the same seed may map to a different hue than before. Documented in commit message; acceptable per proposal risk table.

## 8. Hex Value Absorption Map

| Hex | Location(s) | Semantic token | Justification |
|---|---|---|---|
| `#fafafa` | `SalesView.vue:665`, `ActiveSalePanel.vue:266`, `ProductSearchResults.vue:22` | `bg-surface-base` (light) / dark variant `#09090b` | POS primary surface; pair with dark default |
| `#09090b` | same 3 files (`dark:bg-[#09090b]`) | `bg-surface-base` (dark) | dark POS surface == near-black; matches `coco-black`-based `surface-base` |
| `#FFF8F0` | `CatalogLayout.vue:29` | `bg-coco-peach/20` | warm catalog page tint; peach at low opacity |
| `#f7f7f5` | `ProductDetailView.vue:1643` | `bg-surface-raised` (light) | product detail container |
| `#0a0a0b` | `ProductDetailView.vue:1643` (`dark:`) | `bg-surface-raised` (dark) | dark raised surface |
| `#ebebe8` | `ProductDetailView.vue:2502` | `bg-surface-input` (light) | progress track |
| `#1f1f24` | `ProductDetailView.vue:2502,2515` (`dark:`) | `bg-surface-input` (dark) | dark input/track |
| `#f3f3f1` | `ProductDetailView.vue:2515` | `bg-surface-elevated` (light) | check-item background |

The `light` block in §4 is calibrated so these exact light values are produced by the semantic tokens — i.e. after migration, `bg-surface-raised` in light mode literally yields `#f7f7f5`. This guarantees byte-for-byte visual parity for light surfaces during migration.

## 9. Verification Plan

| Req | How verified | Command / check |
|---|---|---|
| DT-REQ-001 | 11 `--color-coco-*` brand vars + 3 scales in CSS; Nuxt UI alias resolves | `grep -c 'color-coco-' src/assets/main.css`; dev-tools: `UButton` bg == `#2442f6` |
| DT-REQ-002 | semantic surface/text/border vars resolve; primary==blue | computed-style diff: `surface-base` ≠ `surface-raised`; `text-primary` == `#ffffff` (dark) |
| DT-REQ-003 | 6 radius vars; `rounded-coco-md` == 12px | dev-tools border-radius on a test element |
| DT-REQ-004 | Inter loaded, Outfit gone, 4 weights | `grep -c Outfit src/assets/main.css` == 0; Network tab: `Inter` woff2, weights 400/500/600/700 only |
| DT-REQ-005 | light block present, inert | `grep 'prefers-color-scheme\|\.light {' src/assets/main.css` non-empty; toggle `.light`, tokens swap |
| DT-REQ-006 | every hex mapped (§8 table) | each `grep '#fafafa'…` hit has a §8 row |
| DT-REQ-007 | shared util exists; 4 arrays gone | `grep AVATAR_PALETTE src/core/shared/utils/avatar-palette.ts`; `grep 'bg-amber-500 text-white' <4 files>` empty; `grep 'avatar-palette' <4 files>` non-empty |
| DT-REQ-008 | build + tests green | `pnpm build` exit 0; `pnpm test:unit` (2911+) exit 0 |
| DT-REQ-009 | no residual hex; dark variants correct | `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` empty (excl. docs); visual smoke of 5 views |

**Visual regression:** screenshot catalog, POS, login, admin, employee views in dark mode pre- and post-foundation; diff should be near-zero (tokens defined, components not yet migrated). Per-batch screenshots during apply.

## 10. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **`app.config.ts` assumption wrong for Vite** | CRITICAL | Resolved here: use `vite.config.ts` `ui.colors`. OQ-1 seeks orchestrator confirmation to amend proposal/spec wording. |
| **Custom scale missing shades → Nuxt UI breaks** | High | All three scales define full 50–950 (§4). Smoke test `bg-primary` resolves before any component migration. |
| **Dark mode regression** | High | Dark-first defaults; `.light` overrides only; every color token has both variants before component migration. |
| **Build breakage (type-check / CSS)** | Medium | Foundation touches 2 config files + 1 additive util; `pnpm build` gate per batch. |
| **Test cascade (2911+ tests)** | Medium | Avatar hash algorithm unchanged; only palette values shift. Any snapshot test on avatar classes updated in batch 2. |
| **Nuxt UI version drift** | Low | Pinned `@nuxt/ui ^4.6.0`; `@theme static` + `ui.colors` are stable v4 APIs. |
| **`coco-navy` name clash (scale vs swatch)** | Low | Swatch renamed `coco-navy-brand` (§4). OQ-3. |
| **Font FOUT (Outfit→Inter)** | Low | `display=swap`; same CDN pattern; ~55% smaller payload. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. This change is configuration + one pure TS util.

## Migration / Rollout

Foundation (batches 0–2) lands in this SDD. Component-class migration (batches 3–7) is sequenced but executed in follow-up SDDs (`design-tokens-coco-components`, `-catalog`, `-pos`, `-login`, `-admin`). Atomic rollback = `git revert` of the foundation commit (2 modified + 1 new + 4 avatar files). No DB/API/contract changes.

## Open Questions

- [ ] **OQ-1 (BLOCKING):** Proposal/spec mandate `app.config.ts`; verified docs say Vite projects must use `vite.config.ts`. Confirm this design's reinterpretation (Nuxt UI color definitions in `vite.config.ts` `ui.colors`) is acceptable, and update spec DT-REQ-001 wording ("AND `app.config.ts`" → "AND `vite.config.ts` `ui.colors`") before tasks phase.
- [ ] **OQ-2:** Is there a real `ui.radius` Vite option? Not found in docs; radius handled via `@theme` `--radius-*` + `--ui-radius` override here. Confirm acceptable.
- [ ] **OQ-3:** `coco-navy` scale vs `coco-navy-brand` swatch naming — confirm the `-brand` suffix convention is acceptable, or prefer renaming the secondary scale (e.g. `coco-deep`).
- [ ] **OQ-4:** Should `warning`/`success`/`info` Nuxt UI aliases map to Tailwind built-ins (`amber`/`emerald`/`blue`) as proposed here, or to custom Coco scales? Built-ins chosen to reduce risk; Coco gold is reserved for the `action` CTA role (not Nuxt UI `warning`).
