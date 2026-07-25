# Design Tokens Specification

Domain: `design-tokens` · Coco design token foundation — canonical palette, semantic role mapping, surface/text/border scales, radius scale, and typography presets consumed by every subsequent SDD.

## Purpose

Establish the project-wide design token system that unifies theming across Nuxt UI components and custom Vue components. The token foundation is the primitive layer that downstream SDDs (catalog, POS, login, admin, branding) consume. Two coordinated surfaces expose the same contract:

- **Nuxt UI 4 via `app.config.ts`** — runtime theme definition for `UButton`, `UBadge`, `UCard`, `UTabs`, etc.
- **Tailwind v4 `@theme` in `src/assets/main.css`** — CSS custom properties for custom Vue components and arbitrary classes.

The two layers are bridged by name: Nuxt UI's `ui.colors.primary: 'coco'` resolves through `--color-coco-*` in the `@theme` block. Light mode variants are declared but inert until future SDDs adopt them.

## Requirements

### REQ-1 Coco Brand Palette

The system MUST expose all 11 Coco brand colors as `--color-coco-*` CSS custom properties in the `@theme` block of `src/assets/main.css` AND as Nuxt UI 4 color definitions in `app.config.ts`. The 11 colors are: `#000000` (black), `#2c2434` (deep), `#493f54` (mid), `#173968` (navy), `#2442f6` (blue), `#5eeaf1` (cyan), `#443218` (brown), `#ebd5d0` (peach), `#f6bb13` (gold), `#ffffff` (white), `#ef4444` (red).

The system MUST also define three full shade scales (`--color-coco-{50..950}`, `--color-coco-neutral-{50..950}`, `--color-coco-navy-{50..950}`) anchored at `coco-500`=#2442f6, `coco-navy-500`=#173968, and `coco-neutral-500`=#493f54 / `-700`=#2c2434.

#### Scenario: CSS custom properties resolve at runtime

- GIVEN `main.css` `@theme` block defines `--color-coco-blue: #2442f6`
- WHEN a component uses `class="bg-coco-blue"`
- THEN the element background is `#2442f6`
- AND inspection in browser dev tools confirms the computed style

#### Scenario: Nuxt UI components consume palette

- GIVEN `app.config.ts` defines `ui.colors.primary: 'coco'`
- WHEN an `UButton` renders with default variant
- THEN `UButton` background resolves to `--color-coco-blue` (`#2442f6`)
- AND rendering a test page shows the expected computed `background-color`

### REQ-2 Semantic Role Tokens

The system MUST define semantic role tokens mapping palette colors to design roles in BOTH `@theme` and `app.config.ts`: `primary`→`#2442f6`, `primary-soft`→`#173968`, `action`→`#f6bb13`, `accent`→`#5eeaf1`, `warning`→`#443218`+`#ebd5d0`, `danger`→`#ef4444`. Surface tokens (`base`, `raised`, `elevated`, `input`), border tokens (`subtle`, `card`), and text tokens (`primary`, `secondary`, `muted`) MUST be defined with dark-mode-first defaults (white text, dark surfaces).

Token naming convention: `--surface-*` (not `--color-surface-*`) and `--radius-*` (not `--radius-coco-*`) for ergonomic use in Tailwind arbitrary values. The semantic meaning is preserved.

#### Scenario: Primary interactive elements use coco-blue

- GIVEN semantic role `primary` mapped to `coco-blue` (`#2442f6`)
- WHEN any component uses `bg-primary` or `text-primary`
- THEN the resolved color is `#2442f6`
- AND inspection confirms the computed style

#### Scenario: Surface tokens provide layered depth

- GIVEN `--surface-page` (alias for surface-base), `--surface-card` (alias for surface-raised), `--surface-hover` (alias for surface-elevated)
- WHEN a page renders cards inside a layout
- THEN cards have darker background than layout, creating depth
- AND computed `background-color` values differ between layers

#### Scenario: Text tokens provide readable contrast

- GIVEN `--text-primary: var(--color-coco-white)` (dark mode default)
- WHEN any component uses `text-text-primary`
- THEN text renders white with sufficient contrast against dark surfaces
- AND a Lighthouse contrast audit passes at AA level

### REQ-3 Radius Scale

The system MUST define 6 CSS custom properties: `--radius-xs` (4px), `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (18px), `--radius-xl` (28px), `--radius-full` (9999px) in `@theme`, mirrored in `app.config.ts` `ui.radius`.

Naming convention: `--radius-*` (not `--radius-coco-*`). The prefix is redundant within the project's single design system.

#### Scenario: Radius tokens applied consistently

- GIVEN `--radius-md: 12px`
- WHEN a component uses `rounded-md`
- THEN the element has 12px border radius
- AND computed `border-radius` is exactly 12px

### REQ-4 Inter Typography

The system MUST load Inter from Google Fonts (weights 400, 500, 600, 700) with font features `cv11`, `ss01`, `tnum` enabled. The system MUST set `--font-sans` to `'Inter', system-ui, sans-serif`. Outfit font import SHALL be removed from `main.css`.

#### Scenario: Inter font loads correctly

- GIVEN `main.css` imports Inter from Google Fonts with weights 400, 500, 600, 700
- WHEN the application renders
- THEN all text uses Inter font family
- AND the Network tab shows Inter woff2 files loaded
- AND Outfit SHALL NOT be requested

#### Scenario: Outfit font is absent

- GIVEN Outfit `@import` removed from `main.css`
- WHEN `grep -r "Outfit" src/assets/main.css` is executed
- THEN zero matches are returned
- AND the command exits with non-zero (no matches)

### REQ-5 Light Mode Variants

The system MUST define light mode equivalents for all surface, text, and border semantic tokens. Tokens default to dark; light variants are defined but not consumed by components until follow-up SDDs.

Implementation note: Light tokens are defined as static `@theme` properties plus a `.light` selector override block. Tailwind v4's `@theme static` layer does not support media queries directly. Light mode activation will be handled by component SDDs using Tailwind's `light:` variant or a class-based toggle.

#### Scenario: Light variants defined but not active

- GIVEN light mode token block defined (e.g., `--light-surface-*`, `--light-border-*`, `--light-text-*`)
- WHEN application loads in a browser set to dark mode
- THEN dark tokens are active and render correctly
- AND `grep "prefers-color-scheme\|\\.light {" src/assets/main.css` returns non-empty

### REQ-6 Hex Value Absorption

The system MUST document a mapping from the 8 scattered hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) to their closest semantic tokens. Each hex value in source files SHALL be replaced with the corresponding token class during component redesign phases.

#### Scenario: All 8 hex values have documented mappings

- GIVEN the hex→token translation table in the proposal
- WHEN `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` is executed
- THEN every occurrence is documented with its target semantic token in the migration strategy
- AND each grep hit has a corresponding row in the translation table

### REQ-7 Avatar Color Unification

The system MUST provide a single shared `AVATAR_PALETTE` constant in `src/app/constants/avatarPalette.ts` with 7 color entries and a `avatarColor(key)` hash function. The system MUST eliminate the 4 duplicate inline arrays in `EntityAvatar.vue`, `EmployeeProfileCard.vue`, `PendingApprovalsView.vue`, and `ResumenPanel.vue` by replacing them with imports from the shared source.

#### Scenario: Shared avatar palette exists

- GIVEN `src/app/constants/avatarPalette.ts` created
- WHEN import `AVATAR_PALETTE` in any component
- THEN a 7-element readonly array of color classes is available
- AND `grep "AVATAR_PALETTE" src/app/constants/avatarPalette.ts` returns the export

#### Scenario: Duplicate arrays removed

- GIVEN 4 components previously had inline avatar color arrays
- WHEN grep checks those 4 files for inline arrays
- THEN zero matches for inline arrays remain
- AND all files import `avatarColor` or `AVATAR_PALETTE` from the shared source

### REQ-8 Build & Test Integrity

The system MUST pass all existing unit tests (`pnpm test:unit`) and `pnpm build` MUST succeed with zero type-check errors. Dark mode rendering MUST be visually equivalent to pre-change baseline.

#### Scenario: Unit tests pass

- GIVEN all tokens defined, `app.config.ts` created, `vite.config.ts` modified
- WHEN `pnpm test:unit` is executed
- THEN all tests pass with zero failures
- AND exit code is 0

#### Scenario: Production build succeeds

- GIVEN all changes applied
- WHEN `pnpm build` is executed
- THEN build exits with code 0
- AND zero type-check errors
- AND zero CSS warnings

### REQ-9 Migration Integrity

After apply phase, no hardcoded brand hex values SHALL remain in any file touched by this SDD. Zero occurrences of obsolete hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) persist in source. All `dark:` Tailwind variants SHALL resolve to correct colors through the new token system.

#### Scenario: Dark mode variants resolve correctly

- GIVEN all components migrated to Coco tokens
- WHEN application renders in dark mode
- THEN all `dark:` Tailwind variants produce colors matching pre-migration baseline
- AND a visual smoke test comparing screenshots of 5 key views (catalog, POS, login, admin, employee) shows no regressions

## Token Sources

| Layer | File | Purpose |
|---|---|---|
| Nuxt UI 4 runtime | `app.config.ts` | `ui.colors.primary/secondary/neutral/error`, `ui.radius` |
| Tailwind v4 CSS | `src/assets/main.css` `@theme` block | `--color-coco-*`, `--surface-*`, `--text-*`, `--radius-*`, `--font-sans` |
| Nuxt UI build | `vite.config.ts` | Coco color aliases for Nuxt UI component resolution |

## Avatar Palette (informational)

The shared `AVATAR_PALETTE` constant provides 7 Coco-branded background colors for user avatars. Avatar colors use standard Tailwind built-in colors (`bg-amber-500`, `bg-pink-500`, etc.) intentionally — avatar colors are decorative and independent of the brand palette. Standard Tailwind colors work correctly alongside Coco tokens.

## Out of Scope (Deferred)

- **Hex value absorption in components** — deferred to component redesign SDDs (SDD-3: sales-view-coco-redesign and later). Rationale: the 8 hex values are embedded in component templates with specific visual intent. Blind replacement with tokens would break layouts without corresponding component redesign. Each will be absorbed when its owning component is redesigned.
- **Brand rename "HoundFe" → "Coco"** → `branding-coco` SDD.
- **Component visual redesign** (cards, buttons, modals, layouts) → `design-tokens-coco-components` SDD.
- **Feature-specific token application** (sales, catalog, login, admin) → per-feature SDDs.
- **Dark mode toggle behavior changes** — `@vueuse/core` `useColorMode` integration is unchanged.
