# Delta for Design Tokens

## ADDED Requirements

| ID | Requirement | Scenarios |
|----|------------|-----------|
| DT-REQ-001 | **Coco Brand Palette.** The system MUST define 11 Coco brand colors in two layers: `@theme` block of `src/assets/main.css` as `--color-coco-*` custom properties AND `app.config.ts` as named Nuxt UI 4 color entries. Colors: `#000000` (black), `#2c2434` (deep), `#493f54` (mid), `#173968` (navy), `#2442f6` (blue), `#5eeaf1` (cyan), `#443218` (brown), `#ebd5d0` (peach), `#f6bb13` (gold), `#ffffff` (white), `#ef4444` (red). | 2 |
| DT-REQ-002 | **Semantic Role Tokens.** The system MUST define semantic role tokens mapping palette colors to design roles in BOTH `@theme` and `app.config.ts`: `primary`→`#2442f6`, `primary-soft`→`#173968`, `action`→`#f6bb13`, `accent`→`#5eeaf1`, `warning`→`#443218`+`#ebd5d0`, `danger`→`#ef4444`. Surface tokens (`base`, `raised`, `elevated`, `input`), border tokens (`subtle`, `card`), and text tokens (`primary`, `secondary`, `muted`) with dark-mode-first defaults (white text, dark surfaces). | 3 |
| DT-REQ-003 | **Radius Scale.** The system MUST define 6 CSS custom properties: `--radius-xs` (4px), `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (18px), `--radius-xl` (28px), `--radius-full` (9999px) in `@theme`, mirrored in `app.config.ts` `ui.radius`. | 1 |
| DT-REQ-004 | **Inter Typography.** The system MUST load Inter from Google Fonts (weights 400, 500, 600, 700) with font features `cv11`, `ss01`, `tnum` enabled. MUST set `--font-sans` to `'Inter', system-ui, sans-serif`. Outfit font import SHALL be removed from `main.css`. | 2 |
| DT-REQ-005 | **Light Mode Variants.** The system MUST define light mode equivalents for all surface, text, and border semantic tokens using Tailwind v4's `@media (prefers-color-scheme: light)` or equivalent mechanism. Tokens default to dark; light variants are defined but not consumed by components until follow-up SDDs. | 1 |
| DT-REQ-006 | **Hex Value Absorption.** The system MUST document a mapping from the 7+ scattered hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) to their closest semantic tokens. Each hex value in source files SHALL be replaced with the corresponding token class during the apply phase. | 1 |
| DT-REQ-007 | **Avatar Color Unification.** The system MUST provide a single shared `AVATAR_PALETTE` constant in `src/core/shared/utils/avatar-palette.ts` with 7 Coco-branded background colors and a `avatarColor(key)` hash function. The 4 duplicate inline arrays in `EntityAvatar.vue`, `EmployeeProfileCard.vue`, `PendingApprovalsView.vue`, and `ResumenPanel.vue` MUST be replaced by imports from this shared source. | 2 |
| DT-REQ-008 | **Build & Test Integrity.** The system MUST pass all existing unit tests (`pnpm test:unit`, 2911+ tests). `pnpm build` MUST succeed with zero type-check errors. Dark mode rendering MUST be visually equivalent to pre-change baseline. | 2 |
| DT-REQ-009 | **Migration Integrity.** After apply phase, no hardcoded brand hex values SHALL remain in any file touched by this SDD. Zero occurrences of obsolete hex values (`#fafafa`, `#09090b`, `#FFF8F0`, `#f7f7f5`, `#0a0a0b`, `#ebebe8`, `#1f1f24`, `#f3f3f1`) persist in source. All `dark:` Tailwind variants SHALL resolve to correct colors through the new token system. | 2 |

### DT-REQ-001: Coco Brand Palette

The system MUST expose all 11 Coco brand colors as `--color-coco-*` CSS custom properties in `@theme` AND as Nuxt UI 4 color definitions in `app.config.ts`.

#### Scenario: CSS custom properties resolve at runtime

- **Given**: `main.css` `@theme` block defines `--color-coco-blue: #2442f6`
- **When**: a component uses `class="bg-coco-blue"`
- **Then**: the element background is `#2442f6`
- **Verification**: inspect computed styles in browser dev tools

#### Scenario: Nuxt UI components consume palette

- **Given**: `app.config.ts` defines `ui.colors.primary: 'coco'`
- **When**: an `UButton` renders with default variant
- **Then**: `UButton` background resolves to `--color-coco-blue` (`#2442f6`)
- **Verification**: render a test page, inspect `UButton` computed `background-color`

### DT-REQ-002: Semantic Role Tokens

The system MUST map palette colors to semantic roles (`primary`, `action`, `accent`, `warning`, `danger`, surface/text/border tokens) in both layers, with dark-first defaults.

#### Scenario: Primary interactive elements use coco-blue

- **Given**: semantic role `primary` mapped to `coco-blue` (`#2442f6`)
- **When**: any component uses `bg-primary` or `text-primary`
- **Then**: the resolved color is `#2442f6`
- **Verification**: inspect element computed styles

#### Scenario: Surface tokens provide layered depth

- **Given**: `--color-surface-base: var(--color-coco-black)`, `--color-surface-raised: var(--color-coco-deep)`, `--color-surface-elevated: var(--color-coco-mid)`
- **When**: a page renders with `bg-surface-base` cards inside a `bg-surface-raised` layout
- **Then**: cards have darker background than layout, creating depth
- **Verification**: compare computed `background-color` values; they SHALL differ

#### Scenario: Text tokens provide readable contrast

- **Given**: `--color-text-primary: var(--color-coco-white)` (dark mode default)
- **When**: any component uses `text-text-primary`
- **Then**: text renders white with sufficient contrast against dark surfaces
- **Verification**: Lighthouse contrast audit passes at AA level

### DT-REQ-003: Radius Scale

The system MUST define a 6-step radius scale as CSS custom properties in `@theme` and in `app.config.ts` `ui.radius`.

#### Scenario: Radius tokens applied consistently

- **Given**: `--radius-coco-md: 12px`
- **When**: a component uses `rounded-coco-md`
- **Then**: the element has 12px border radius
- **Verification**: inspect computed `border-radius` in dev tools; it SHALL be exactly 12px

### DT-REQ-004: Inter Typography

The system MUST load Inter with 4 weights and feature settings, and SHALL replace Outfit entirely.

#### Scenario: Inter font loads correctly

- **Given**: `main.css` imports Inter from Google Fonts with weights 400, 500, 600, 700
- **When**: the application renders
- **Then**: all text uses Inter font family
- **Verification**: inspect Network tab — Inter woff2 files loaded, Outfit SHALL NOT be requested

#### Scenario: Outfit font is absent

- **Given**: Outfit `@import` removed from `main.css`
- **When**: `grep -r "Outfit" src/assets/main.css` is executed
- **Then**: zero matches returned
- **Verification**: `grep -r "Outfit" src/assets/main.css` exits with non-zero (no matches)

### DT-REQ-005: Light Mode Variants

The system MUST define light mode equivalents for all surface, text, and border semantic tokens.

#### Scenario: Light variants defined but not active

- **Given**: light mode token block defined in `@theme` (e.g., `--color-surface-base: #ffffff` under `@media (prefers-color-scheme: light)`)
- **When**: application loads in a browser set to light mode
- **Then**: tokens are declared and resolve correctly when components adopt them; no visual change until follow-up SDDs consume them
- **Verification**: `grep "prefers-color-scheme: light" src/assets/main.css` returns non-empty

### DT-REQ-006: Hex Value Absorption

The system MUST document every scattered hex value in source and map it to a semantic token.

#### Scenario: All 8 hex values have documented mappings

- **Given**: the hex→token translation table in the proposal
- **When**: `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` is executed
- **Then**: every occurrence is documented with its target semantic token in the migration strategy
- **Verification**: each grep hit SHALL have a corresponding row in the translation table

### DT-REQ-007: Avatar Color Unification

The system MUST provide a single source of truth for the 7-color avatar palette and eliminate the 4 duplicate arrays.

#### Scenario: Shared avatar palette exists

- **Given**: `src/core/shared/utils/avatar-palette.ts` created
- **When**: import `AVATAR_PALETTE` in any component
- **Then**: a 7-element readonly array of Coco-branded color classes is available
- **Verification**: `grep "AVATAR_PALETTE" src/core/shared/utils/avatar-palette.ts` returns the export

#### Scenario: Duplicate arrays removed

- **Given**: 4 components previously had inline avatar color arrays
- **When**: `grep -rn "bg-orange\|bg-amber" src/core/shared/components/EntityAvatar.vue src/features/admin/views/PendingApprovalsView.vue src/features/admin/views/ResumenPanel.vue src/features/admin/employees/components/EmployeeProfileCard.vue` is executed
- **Then**: zero matches in those 4 files for inline arrays; all import `avatarColor` or `AVATAR_PALETTE`
- **Verification**: grep returns empty; `grep "import.*avatar-palette"` in each file returns non-empty

### DT-REQ-008: Build & Test Integrity

The system MUST maintain full build and test integrity through the token migration.

#### Scenario: Unit tests pass

- **Given**: all tokens defined, `app.config.ts` created, `vite.config.ts` modified
- **When**: `pnpm test:unit` is executed
- **Then**: all 2911+ tests pass with zero failures
- **Verification**: exit code 0, test summary shows no failures

#### Scenario: Production build succeeds

- **Given**: all changes applied
- **When**: `pnpm build` is executed
- **Then**: build exits with code 0, zero type-check errors, zero CSS warnings
- **Verification**: build output contains "✓ built in" with no error lines

### DT-REQ-009: Migration Integrity

After apply phase, the system SHALL have no residual hardcoded brand colors in touched files.

#### Scenario: Zero obsolete hex values remain

- **Given**: apply phase completed
- **When**: `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` is executed
- **Then**: zero matches in source files (documentation exclusions allowed)
- **Verification**: grep returns empty or only `DESIGN.md` references

#### Scenario: Dark mode variants resolve correctly

- **Given**: all components migrated to Coco tokens
- **When**: application renders in dark mode
- **Then**: all `dark:` Tailwind variants produce colors matching pre-migration baseline
- **Verification**: visual smoke test comparing screenshots of 5 key views (catalog, POS, login, admin, employee)

## REMOVED Requirements

| ID | Requirement | Reason | Migration |
|----|------------|--------|-----------|
| DT-REQ-R01 | Outfit font dependency | Replaced by Inter (DT-REQ-004) with 4 weights, ~55% smaller woff2 payload | Remove `@import` line, change `--font-sans`; `grep -r "Outfit" src/assets/main.css` SHALL return zero |
| DT-REQ-R02 | Amber/orange as Nuxt UI primary color | `vite.config.ts` `colors: { primary: 'amber', secondary: 'rose', neutral: 'zinc' }` replaced by `app.config.ts` Coco mapping | Remove `colors` block from `vite.config.ts`; Nuxt UI components resolve through `app.config.ts` |
| DT-REQ-R03 | Duplicate avatar color arrays | 4 inline arrays in 4 components replaced by single `AVATAR_PALETTE` in `src/core/shared/utils/avatar-palette.ts` | Delete inline arrays; add `import { AVATAR_PALETTE, avatarColor } from '@/core/shared/utils/avatar-palette'` |
| DT-REQ-R04 | Scattered hex values in source | All 8 custom hex values mapped to semantic tokens (DT-REQ-006) | Replace `bg-[#fafafa]` → `bg-surface-base`, `bg-[#FFF8F0]` → `bg-coco-peach/20`, etc. per translation table |
