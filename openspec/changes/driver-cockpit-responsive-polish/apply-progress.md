# Apply progress — `driver-cockpit-responsive-polish`

Per-slice evidence for the SDD `apply` phase. Each slice is one commit; earlier evidence is preserved when later slices land.

## S1 — App-shell mobile sidebar trigger (ASNT-REQ-001 / 002 / 003)

**Branch:** `feat/driver-cockpit-responsive-polish-b1-shell-overlay`
**Capability:** `app-shell-mobile-nav-trigger`
**Spec:** `openspec/changes/driver-cockpit-responsive-polish/specs/app-shell-mobile-nav-trigger/spec.md`

### Source change

- `src/app/layouts/DashboardLayout.vue` (+9/-1): removed `:toggle="false"` on `<UDashboardNavbar>` and added an ASNT-REQ-001 intent comment. Existing `UDashboardSidebarCollapse` in the `#left` slot preserved unchanged as the separate desktop collapse control. No router, API, permission, or shell-style change.
- `src/app/layouts/__tests__/DashboardLayout.test.ts` (+114): added `describe('DashboardLayout — mobile sidebar trigger (ASNT-REQ-001/002/003)')` with RED → GREEN → TRIANGULATE coverage. Pre-existing `DSC-REQ-*` assertions still pass.

### Strict-TDD evidence

| Step | Verification | Result |
|------|--------------|--------|
| RED | New `describe` with source-level pin "UDashboardNavbar MUST NOT carry `:toggle="false"`". Gate reported **2 failures** in the new `describe`. | RED confirmed |
| GREEN | Removed `:toggle="false"` from `DashboardLayout.vue`. Gate: **14/14 pass** including new `ASNT-REQ-001/002/003` describe and pre-existing `DSC-REQ-013` suite. | GREEN confirmed |
| TRIANGULATE | Added desktop-collapse preservation pin (collapse in `#left` slot), `:ui`/right-slot scope pin, and a mount seam verifying the rendered leading `<button aria-label="Open sidebar">` precedes the breadcrumb and co-exists with desktop `<button aria-label="Collapse sidebar">`. All pins green. | TRIANGULATE confirmed |
| REFACTOR | Dropped a transient stub-component map (Nuxt UI resolves through the Vite plugin, not `global.components`); reused the existing `mountLayout()` helper. Focused gate re-run: 14/14 green. Full suite `pnpm test:unit --run`: 5751/5751 green across 363 files. | REFACTOR confirmed |

### Focused test command / output summary

```bash
pnpm test:unit --run src/app/layouts/__tests__/DashboardLayout.test.ts
```
```
 Test Files  1 passed (1)
      Tests  14 passed (14)
```
New `ASNT-REQ-001/002/003` tests: source pin (REQ-001), desktop-collapse preservation (REQ-002), `:ui`/right-slot scope (REQ-003), mount seam for the installed native `UDashboardSidebarToggle` (REQ-001).

### Runtime boundary / rollback / outstanding

**Runtime:** Open any view at <1024px, tap the navbar trigger — sidebar opens. The mount seam verifies the rendered DOM exposes a leading `<button aria-label="Open sidebar">` (installed `UDashboardSidebarToggle`) before the breadcrumb, with desktop `<button aria-label="Collapse sidebar">` as a separate control. Open/close + scroll lock + focus trap come from the installed Nuxt UI primitives and are not reimplemented.

**Rollback:** Revert one commit touching only `DashboardLayout.vue` and `DashboardLayout.test.ts`. Shell returns to pre-change state (`:toggle="false"` restored). No other file affected; no cockpit coupling.

**Outstanding:** S2, S3, S4 still unchecked in `tasks.md`. Final full gates (`pnpm test:unit --run`, `pnpm build`, `pnpm lint`) deferred to after all four slices land per the task plan.
