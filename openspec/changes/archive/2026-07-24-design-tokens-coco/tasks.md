# Tasks: Design Tokens — Coco Foundation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~140 (add ~150, del ~10) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR (work-unit commits to main per delivery strategy) |
| Delivery strategy | single-pr-default |
| Chain strategy | size-exception (not needed — under budget) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Token foundation (config files) | PR 1 | `pnpm build` + dev tools: `UButton` bg == `#2442f6` | `pnpm dev` → open `/` → inspect primary button color | revert `vite.config.ts` + `src/assets/main.css` |
| 2 | Avatar palette unification | PR 2 (or commit in PR 1) | `pnpm test:unit` + `grep "AVATAR_PALETTE" src/core/shared/utils/avatar-palette.ts` | `pnpm dev` → admin views render avatars with Coco colors | delete `avatar-palette.ts`; 4 inline arrays revert by reverting files |
| 3 | Hex value absorption | PR 3 (or commit in PR 1) | `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` empty | `pnpm dev` → POS/catalog views render with semantic tokens | revert touched files; hex values reappear |

## Batch 1: Token Foundation (config files)

### T-01 Define Coco shade scales in `@theme static`
- **Description**: Add full 50–950 shade scales (`--color-coco-{50..950}`, `--color-coco-navy-{50..950}`, `--color-coco-neutral-{50..950}`) under `@theme static { ... }` in `src/assets/main.css`. Anchors: `coco-500`=#2442f6, `coco-navy-500`=#173968, `coco-neutral-500`=#493f54 / `-700`=#2c2434.
- **Files**: `src/assets/main.css` (MODIFY, ~+33 lines)
- **Dependencies**: none
- **Verification**: `grep -c 'color-coco-' src/assets/main.css` ≥ 30; dev tools: `UButton` bg == `#2442f6`.
- **Lines**: ~+33
- **Spec**: DT-REQ-001, DT-REQ-002
- **Commit**: `feat(tokens): add Coco shade scales backing Nuxt UI aliases`

### T-02 Define 11 Coco brand swatches in `@theme`
- **Description**: Add `--color-coco-{black,deep,mid,blue,cyan,brown,peach,gold,white,red,navy-brand}` swatches in `@theme { ... }` (use `navy-brand` to avoid clash with `coco-navy` scale per OQ-3).
- **Files**: `src/assets/main.css` (MODIFY, ~+12 lines)
- **Dependencies**: T-01
- **Verification**: `grep -c '\-\-color-coco-' src/assets/main.css` = 11 swatches + 33 scales; dev tools: `bg-coco-gold` element background == `#f6bb13`.
- **Lines**: ~+12
- **Spec**: DT-REQ-001
- **Commit**: `feat(tokens): add 11 Coco brand color swatches`

### T-03 Define semantic surface/text/border tokens
- **Description**: Add `--color-surface-{base,raised,elevated,input}`, `--color-border-{subtle,card}`, `--color-text-{primary,secondary,muted}` in `@theme { ... }` with dark-first defaults.
- **Files**: `src/assets/main.css` (MODIFY, ~+10 lines)
- **Dependencies**: T-02
- **Verification**: dev tools: element with `bg-surface-base` shows `#000000`; `bg-surface-raised` differs from `bg-surface-base`.
- **Lines**: ~+10
- **Spec**: DT-REQ-002
- **Commit**: `feat(tokens): add semantic surface/text/border tokens`

### T-04 Define radius scale + override `--ui-radius`
- **Description**: Add `--radius-coco-{xs,sm,md,lg,xl,full}` (4/8/12/18/28/9999px) and `--ui-radius: 0.75rem` in `@theme { ... }`. No `ui.radius` Vite option exists (OQ-2).
- **Files**: `src/assets/main.css` (MODIFY, ~+8 lines)
- **Dependencies**: T-03
- **Verification**: dev tools: `rounded-coco-md` element border-radius == 12px.
- **Lines**: ~+8
- **Spec**: DT-REQ-003
- **Commit**: `feat(tokens): add radius scale and override ui-radius`

### T-05 Configure `vite.config.ts` `ui.colors` Coco mapping
- **Description**: Replace `colors: { primary: 'amber', secondary: 'rose', neutral: 'zinc' }` with `colors: { primary: 'coco', secondary: 'coco-navy', neutral: 'coco-neutral', error: 'red', warning: 'amber', success: 'emerald', info: 'blue' }` in `vite.config.ts`. Keep all slot overrides intact.
- **Files**: `vite.config.ts` (MODIFY, ~+5/-3 lines)
- **Dependencies**: T-01
- **Verification**: dev tools: any `UButton` default variant bg == `#2442f6`; `UButton color="error"` bg == Tailwind `red-500`.
- **Lines**: ~+5/-3
- **Spec**: DT-REQ-001, DT-REQ-002, DT-REQ-R02
- **Commit**: `feat(tokens): map Nuxt UI colors to Coco palette aliases`

### T-06 Replace Outfit with Inter (4 weights + features)
- **Description**: In `src/assets/main.css`, swap Outfit `@import` for Inter wght@400;500;600;700 and update `--font-sans` to `'Inter', system-ui, sans-serif` with `--font-sans--font-feature-settings: 'cv11', 'ss01', 'tnum'`.
- **Files**: `src/assets/main.css` (MODIFY, ~+3/-2 lines)
- **Dependencies**: T-04
- **Verification**: `grep -c "Outfit" src/assets/main.css` == 0; Network tab: Inter woff2 only with weights 400/500/600/700.
- **Lines**: ~+3/-2
- **Spec**: DT-REQ-004, DT-REQ-R01
- **Commit**: `feat(typography): replace Outfit with Inter 4 weights`

### T-07 Define `.light` token variants (inert)
- **Description**: Add `.light { ... }` override block in `src/assets/main.css` re-declaring surface/text/border tokens with light values (#fff / #f7f7f5 / #ebebe8 / #09090b). Inert until future SDDs adopt.
- **Files**: `src/assets/main.css` (MODIFY, ~+11 lines)
- **Dependencies**: T-03
- **Verification**: `grep 'prefers-color-scheme\|\.light {' src/assets/main.css` non-empty; toggling `.light` on `<html>` swaps tokens.
- **Lines**: ~+11
- **Spec**: DT-REQ-005
- **Commit**: `feat(tokens): add inert light-mode token variants`

## Batch 2: Avatar Unification

### T-08 Create shared `avatar-palette.ts` util
- **Description**: Create `src/core/shared/utils/avatar-palette.ts` exporting `AVATAR_PALETTE` (7 `bg-coco-* text-*` paired entries — preserves text contrast) and `avatarColor(seed)` hash function (char-code sum, unchanged).
- **Files**: `src/core/shared/utils/avatar-palette.ts` (CREATE, ~+22 lines)
- **Dependencies**: T-02
- **Verification**: `grep "AVATAR_PALETTE" src/core/shared/utils/avatar-palette.ts` non-empty; `pnpm test:unit` exit 0.
- **Lines**: ~+22
- **Spec**: DT-REQ-007
- **Commit**: `feat(avatars): add shared AVATAR_PALETTE constant`

### T-09 Replace inline avatar arrays in 4 components
- **Description**: Delete inline `AVATAR_PALETTES` arrays and replace usage with `avatarColor()` import in `EntityAvatar.vue`, `PendingApprovalsView.vue`, `ResumenPanel.vue`, `EmployeeProfileCard.vue`.
- **Files**: 4 files (MODIFY, ~+4/-7 per file = ~+16/-28 lines)
- **Dependencies**: T-08
- **Verification**: `grep "AVATAR_PALETTES" <4 files>` empty; `grep "avatar-palette" <4 files>` non-empty; `pnpm test:unit` exit 0.
- **Lines**: ~+16/-28
- **Spec**: DT-REQ-007, DT-REQ-R03
- **Commit**: `refactor(avatars): consume shared palette in 4 components`

## Batch 3: Hex Value Absorption

### T-10 Replace scattered hex values with semantic tokens
- **Description**: Per §8 design map: `bg-[#fafafa]`/`dark:bg-[#09090b]` → `bg-surface-base` (SalesView.vue:665, ActiveSalePanel.vue:266, ProductSearchResults.vue:22); `bg-[#FFF8F0]` → `bg-coco-peach/20` (CatalogLayout.vue:29); `bg-[#f7f7f5]`/`dark:bg-[#0a0a0b]` → `bg-surface-raised` (ProductDetailView.vue:1643); `bg-[#ebebe8]`/`dark:bg-[#1f1f24]` → `bg-surface-input` (ProductDetailView.vue:2502); `bg-[#f3f3f1]` → `bg-surface-elevated` (ProductDetailView.vue:2515).
- **Files**: 4 files (MODIFY, ~+8/-8 lines)
- **Dependencies**: T-03, T-07
- **Verification**: `grep -rn '#fafafa\|#09090b\|#FFF8F0\|#f7f7f5\|#0a0a0b\|#ebebe8\|#1f1f24\|#f3f3f1' src/` empty (docs excluded); visual smoke: POS + catalog + product detail.
- **Lines**: ~+8/-8
- **Spec**: DT-REQ-006, DT-REQ-009, DT-REQ-R04
- **Commit**: `refactor(tokens): absorb scattered hex values into semantic tokens`

### T-11 Update `DESIGN.md` with Coco palette + Inter + token sources
- **Description**: Document Coco palette, Inter typography, token source of truth (`vite.config.ts` `ui.colors` + `@theme`), and hex→token translation table.
- **Files**: `DESIGN.md` (MODIFY, ~+15/-5 lines)
- **Dependencies**: T-07, T-10
- **Verification**: `grep -i "coco\|inter" DESIGN.md` non-empty; section "Token Sources" exists.
- **Lines**: ~+15/-5
- **Spec**: DT-REQ-006
- **Commit**: `docs(tokens): document Coco palette and token sources`

## Phase 4: Final Verification

- [x] 4.1 `pnpm build` exits 0 (DT-REQ-008). ✅ Verified by `verify-report.md` (exit 0, zero type errors).
- [x] 4.2 `pnpm test:unit` exits 0 (DT-REQ-008). ✅ Verified by `verify-report.md` (2907/2907 PASS).
- [x] 4.3 `pnpm dev` renders dark mode default; Coco tokens resolve. ✅ Verified by `verify-report.md` (zero dark mode regressions).
- [x] 4.4 Visual smoke: catalog, POS, login, admin, employee views — dark mode baseline preserved. ✅ Verified by `verify-report.md`.

**Note**: Phase 4 checkboxes reconciled by `sdd-archive` with proof from `verify-report.md`. T-10/T-11 remain unchecked (explicitly deferred to SDD-3+ by design decision).