# Apply Progress — WU1 Authorization Subjects

## Status

- Change: `online-catalog-backoffice`
- Work unit: `wu1-authorization-subjects`
- Structured status consumed: `gentle-ai.sdd-status` v2, `applyState: ready`, `actionContext.mode: repo-local`; authorized workspace is the repository root.
- Scope guard: only WU1 authorization files and its three focused test files were changed. WU2+ surfaces, routes, navigation, catalog feature files, and unrelated untracked files were not touched.

## Superseded WU2 attempt

- The original `wu2-catalog-settings-transport` implementation produced 1128 source/test lines, exceeding the 400-line review budget.
- Its native settle covered only 128 tracked lines because the new catalog-settings files were excluded as untracked; it is not valid completion evidence for the full implementation.
- The user rejected a size exception and approved replacement by `WU2A -> WU2B -> WU2C`. Those units remain unchecked and require independent bounded evidence and review.
- The existing worktree files are retained only as implementation input for the split; this record does not claim WU2 completion.

## Completed task

- [x] WU1 authorization subject registration and regression coverage. Persisted checkbox updated in `tasks.md`.
- Added typed/runtime `TenantCatalogSettings` and `GlobalPriceList` subjects.
- Added neutral Spanish `TenantCatalogSettings` subject copy with only `read` and `update` curated actions; preserved existing `GlobalPriceList` copy and visibility.
- Added tests for typed subjects, valid grants, malformed-code rejection, revocation on omission, action boundaries, and cross-subject isolation.

## TDD Cycle Evidence

| Stage | Evidence |
|---|---|
| RED | Before implementation, the exact focused Vitest command failed: 3 files failed, 5 tests failed; subjects were absent from the typed/runtime registries and Spanish copy. |
| GREEN | Registered both subjects in `auth.types.ts` and `ability.ts`, added the catalog role copy, and the exact focused command passed: 3 files, 139 tests passed. |
| TRIANGULATE | Regression cases cover `tenant_catalog_settings:read`, extra segments, omitted `GlobalPriceList` revocation, read/update-only catalog grants, no cross-subject grant, and visible Spanish copy. Focused command passed again: 3 files, 139 tests passed. |
| REFACTOR | Kept `parsePermissionCode` pure, added a concise WU1 TDD comment, and corrected targeted formatting without broad restyling. |

## Verification

- Focused Vitest (exact task command): PASS — `pnpm test:unit --run src/features/auth/authorization/__tests__/ability.test.ts src/features/auth/interfaces/__tests__/auth.types.spec.ts src/features/admin/roles/i18n/__tests__/permissions.spec.ts` — 3 files / 139 tests passed.
- Build: PASS — `pnpm build` (`vue-tsc --build` and `vite build` succeeded).
- Runtime scenario: N/A — WU1 is a pure authorization registry change; runtime UI ships with WU3A.
- Attempt token acquired and retained: `sha256:ca9e1fb9d16c3803bff2182318db6a00cefb5776458eaf07e3ac14f1e6f4d5dc`.

## Files changed

- `src/features/auth/interfaces/auth.types.ts`
- `src/features/auth/authorization/ability.ts`
- `src/features/admin/roles/i18n/permissions.ts`
- `src/features/auth/authorization/__tests__/ability.test.ts`
- `src/features/auth/interfaces/__tests__/auth.types.spec.ts`
- `src/features/admin/roles/i18n/__tests__/permissions.spec.ts`
- `openspec/changes/online-catalog-backoffice/tasks.md`
- `openspec/changes/online-catalog-backoffice/apply-progress.md`

## Workload / boundary

- Authored WU1 source/test diff: 90 changed lines (85 additions, 5 deletions); OpenSpec progress/task bookkeeping is separate.
- WU1 remains below the 150-line slice maximum and 400-line review budget.
- Rollback boundary: revert the six WU1 source/test files and the WU1 task/progress bookkeeping; unrelated untracked files remain preserved.

## Remaining tasks

All later implementation tasks remain unchecked, including the exact WU2 line:
`- [ ] Implement and verify the behavior. <!-- sdd-owner: implementation -->`

## Deviations and warnings

- No design deviation.
- Prettier check reported pre-existing style differences in large legacy test files; no broad formatter rewrite was applied. The targeted additions are syntactically valid and build/test clean.
- No commit, merge, push, dependency, backend, route, navigation, view, query, or public-catalog changes performed.
