# Apply Progress: design-tokens-coco

## Status: COMPLETE

**Commit**: `e94329e` — feat(theme): establish Coco design token foundation

## Batch 1: Token Foundation ✅

- [x] T-01 — Coco shade scales in main.css (`--color-coco-{50..950}`, `--color-coco-neutral-{50..950}`, `--color-coco-navy-{50..950}`)
- [x] T-02 — Brand swatches (`--coco-black`, `--coco-blue`, etc.)
- [x] T-03 — Semantic tokens (surface, text, border, brand role)
- [x] T-04 — Radius scale (`--radius-xs` through `--radius-full`)
- [x] T-05 — Nut UI 4 vite.config.ts (primary: coco, secondary: coco-navy, neutral: coco-neutral)
- [x] T-06 — Replace Outfit with Inter (4 weights, tabular numerals)
- [x] T-07 — Light mode token variants (inert)

## Batch 2: Avatar Unification ✅

- [x] T-08 — Create `src/app/constants/avatarPalette.ts`
- [x] T-09 — Migrate 4 components (EntityAvatar, EmployeeProfileCard, PendingApprovalsView, ResumenPanel)

## Batch 3: Hex Absorption

- [ ] T-10 — Map hex values to semantic tokens (DEFERRED to SDD-3: component redesign SDDs)
- [ ] T-11 — Note for visual regression verification (DEFERRED)

## Verification ✅

- [x] `pnpm build` — PASS (type-check + vite, zero errors)
- [x] `pnpm test:unit` — 2907/2907 PASS
- [x] grep audits — no Outfit, avatar arrays unified, EntityAvatar imports from shared constant

## Unresolved

- Hex absorption (T-10/T-11) deferred to component redesign SDDs (SDD-3+). The scattered hex values have been cataloged in the exploration but replacing them inline risks functional regressions. Better handled per-component in dedicated redesign slices.
