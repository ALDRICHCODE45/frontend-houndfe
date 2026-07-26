# Tasks: Dashboard Shell Coco

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~130 |
| Estimated files | 5 (2 src + 1 composable + 2 tests) |
| Estimated commits | 4 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single feature branch + manual `--no-ff` merge |
| Delivery strategy | single-pr (no PRs) |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Work Units

| Unit | Goal | Commit | Test cmd | Runtime | Rollback |
|------|------|--------|----------|---------|----------|
| 1 | HomeView RED | c1 | `pnpm test:unit --run -- src/features/dashboard/home/__tests__/DashboardHomeView.test.ts` | dev `/` | test only |
| 2 | HomeView GREEN | c2 | same | same | `DashboardHomeView.vue` |
| 3 | Layout RED | c3 | `pnpm test:unit --run -- src/app/layouts/__tests__/DashboardLayout.test.ts` | dev dashboard | test only |
| 4 | Layout GREEN | c4 | `pnpm test:unit --run` + `pnpm build` | dev full dashboard | `DashboardLayout.vue` + `useSidebar.ts` |

## Phase 1: RED — DashboardHomeView (commit 1)

- [x] 1.1 Create `src/features/dashboard/home/__tests__/DashboardHomeView.test.ts` with `mountWithUApp` asserting gold icon + neutral card + no `text-primary` (design §5.1). Run → FAIL. DSC-REQ-012.

## Phase 2: GREEN — DashboardHomeView (commit 2)

- [x] 2.1 `DashboardHomeView.vue` L7: swap UIcon class `text-primary` → `text-coco-gold-500`. Test still FAIL.
- [x] 2.2 `DashboardHomeView.vue` L4: add `:ui="{ body: 'bg-coco-neutral-50 dark:bg-coco-neutral-950' }"` to UCard. Test → PASS. DSC-REQ-001.

## Phase 3: RED — DashboardLayout (commit 3)

- [x] 3.1 Create `src/app/layouts/__tests__/DashboardLayout.test.ts` with `vi.mock` for `useSidebar` + `useDashboard` and `mountWithUApp`. Assert all 10 surfaces from design §5.2. Run → FAIL. DSC-REQ-013.

## Phase 4: GREEN — DashboardLayout + useSidebar (commit 4)

- [x] 4.1 `DashboardLayout.vue` L137 Navbar: add `:ui="{ title: 'text-coco-gold-500', leading: 'text-coco-gold-500' }"`. DSC-REQ-002.
- [x] 4.2 `DashboardLayout.vue` L51 Sidebar body: append `bg-coco-neutral-50 dark:bg-coco-neutral-950` to `py-2`. DSC-REQ-003.
- [x] 4.3 `DashboardLayout.vue` L112 + L139 Collapse: add `:ui="{ leadingIcon: 'text-coco-gold-500' }"`. DSC-REQ-003.
- [x] 4.4 `DashboardLayout.vue` L103-106 NavMenu: add `linkLabel`, `linkActive`, `linkLeadingIconActive` gold slots. DSC-REQ-004.
- [x] 4.5 `DashboardLayout.vue` L95 SearchButton: add `:ui="{ base: 'hover:bg-coco-gold-500/10' }"`. DSC-REQ-005.
- [x] 4.6 `DashboardLayout.vue` L167-171 Search: add `:ui="{ input, groupLabel, itemActive }"` gold tokens. NO `header`/`body`/`footer` bg (DSC-REQ-006 hard rule). DSC-REQ-006, 007, 008.
- [x] 4.7 `DashboardLayout.vue` L117 User Dropdown: append `group-data-[checked=true]:text-coco-gold-500` to `itemLeadingIcon`. Tenant dropdown untouched. DSC-REQ-009, 010.
- [x] 4.8 `useSidebar.ts` L128 Dashboard entry: add `class: 'text-coco-gold-500'`. Verify `stripMeta()` passes `class` through `...rest`. DSC-REQ-011.

## Phase 5: Verification (commit 4 wrap-up)

- [x] 5.1 `pnpm test:unit --run` — 2926+ existing + 2 new tests green. DSC-REQ-014. **Result: 2938/2938 pass.**
- [x] 5.2 `pnpm build` — clean. DSC-REQ-017. **Result: ✓ built in 9.63s, no TS errors.**
- [x] 5.3 `pnpm lint` — clean for my files. **Result: 0 new errors from DashboardLayout.vue / DashboardHomeView.vue / useSidebar.ts / __tests__/. 145 pre-existing baseline unchanged.**
- [x] 5.4 `git diff main -- src/assets/main.css app.config.ts src/features/catalog/ src/features/POS/sales/components/ProductDetailModal.vue src/features/POS/sales/components/VariantPickerModal.vue src/features/POS/sales/components/GlobalDiscountModal.vue src/features/auth/ src/features/admin/tenants/ src/app/App.vue` — every diff empty. DSC-REQ-018, 019. **Result: 0 lines of diff.**

4.1–4.8 each touch a single `:ui` attribute on a distinct component at a distinct line range in `DashboardLayout.vue` + one line in `useSidebar.ts` — no cross-splice.
