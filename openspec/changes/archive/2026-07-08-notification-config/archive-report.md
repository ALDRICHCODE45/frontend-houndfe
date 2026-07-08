# Archive Report — notification-config

- **Change**: `notification-config`
- **Branch**: `feat/notification-config`
- **Merge-base**: `main` @ `d2d4a92`
- **Artifact store mode**: `hybrid` (Engram + filesystem)
- **Archive date (ISO)**: 2026-07-08
- **Verdict**: **PASS — intentional-with-warnings** (verify-report PASS with no CRITICAL; 2 manual click-through QA items intentionally preserved as `[ ]` in archived tasks.md)
- **Archive outcome**: Source of truth updated; change folder moved to `archive/`; branch ready for the user's manual merge to `main` after click-through QA.

---

## Executive summary

The `notification-config` change shipped all 13 implementation work-units (WU-1..WU-13) across 6 phases plus 3 apply-time bugfixes, 2 post-verify quality refactors, and 3 docs tasks-marking commits — **22 commits on `feat/notification-config` since `main`**. `pnpm build` is GREEN. All 186 notification-config tests pass deterministically in isolation across 15 files. The full unit suite shows 18 pre-existing failures across 5 unrelated files; this non-determinism is also present on `main` and is explicitly out of scope for this change.

The change is feature-complete, spec-compliant, and verified. It is **intentionally archived with 2 unchecked manual click-through QA steps** preserved on the audited tasks.md — these require a human user, are documented in the verify-report's manual-QA checklist (13 steps), and serve as the user's pre-merge gate. The user/orchestrator explicitly endorsed this approach ("solo dev merges manually — do NOT push, do NOT merge").

---

## Artifacts index

### Engram topic keys (project: `frontend-houndfe`, scope: `project`)
| Artifact | Topic key | Observation # |
|---|---|---|
| Explore | `sdd/notification-config/explore` | #2564 |
| Proposal | `sdd/notification-config/proposal` | #2565 |
| Spec | `sdd/notification-config/spec` | #2566 |
| Design | `sdd/notification-config/design` | #2567 |
| Tasks | `sdd/notification-config/tasks` | #2568 |
| Apply progress | `sdd/notification-config/apply-progress` | #2569 |
| Bugfix 1+2 (error field + form hydration) | `sdd/notification-config/bugfix-error-field+hydration` | #2572 |
| Bugfix 3 (double-map) | `notifications/config-form-hydration` | #2576 |
| Verify report | `sdd/notification-config/verify-report` | #2577 |
| **Archive report (this)** | `sdd/notification-config/archive-report` | (assigned on save) |

### Openspec files
| Phase | Path |
|---|---|
| Proposal | `openspec/changes/archive/2026-07-08-notification-config/proposal.md` |
| Spec (delta, preserved) | `openspec/changes/archive/2026-07-08-notification-config/specs/notification-config/spec.md` |
| **Spec (main — promoted)** | `openspec/specs/notification-config/spec.md` *(NEW domain)* |
| Design | `openspec/changes/archive/2026-07-08-notification-config/design.md` |
| Tasks | `openspec/changes/archive/2026-07-08-notification-config/tasks.md` |
| Verify | `openspec/changes/archive/2026-07-08-notification-config/verify-report.md` |
| **Archive report** | `openspec/changes/archive/2026-07-08-notification-config/archive-report.md` *(this)* |

---

## Specs synced

| Domain | Action | Details |
|---|---|---|
| `notification-config` | **Created (NEW capability)** | Copied full delta spec verbatim to `openspec/specs/notification-config/spec.md`. 10 REQs (REQ-1..REQ-10), 2 scenarios per REQ where applicable, pure-mapper contracts table, UI Copy table. No merge logic — `notification-config` is a NEW domain with no pre-existing main spec. |

No `MODIFIED`, `REMOVED`, or `RENAMED` requirements. Change is purely additive.

---

## Commits on `feat/notification-config` since `main` (22 total)

| # | SHA | Type | Title |
|---|---|---|---|
| 1 | `0509f2a` | feat | feat(auth): register NotificationConfig permission subject *(WU-1)* |
| 2 | `ea1c148` | feat | feat(notifications): add notification-config types and query key *(WU-2)* |
| 3 | `9cf376a` | feat | feat(notifications): add pure config mappers and form guards *(WU-3)* |
| 4 | `aa81a3b` | feat | feat(notifications): add data-driven action/module registry *(WU-4)* |
| 5 | `2bfcc8e` | feat | feat(notifications): add notification-config api client *(WU-5)* |
| 6 | `9f0e076` | feat | feat(notifications): add notification-config query composable *(WU-6)* |
| 7 | `b73c6c8` | feat | feat(notifications): add notification-config update mutation *(WU-7)* |
| 8 | `8dce888` | feat | feat(notifications): add notification-config form-state composable *(WU-8)* |
| 9 | `9830d65` | feat | feat(notifications): add actions accordion grouped by module *(WU-9c)* |
| 10 | `57fcb0d` | feat | feat(notifications): add master notifications toggle *(WU-9a)* |
| 11 | `8c0585f` | feat | feat(notifications): add recipient multi-select with stale chip *(WU-9b)* |
| 12 | `827896c` | feat | feat(notifications): add notification config view *(WU-10)* |
| 13 | `d999294` | feat | feat(notifications): wire configuracion route and sidebar entry *(WU-11)* |
| 14 | `2d5344c` | feat | feat(notifications): gate screen and save by permission *(WU-12)* |
| 15 | `e04eecb` | chore | chore(notifications): final verification and task completion *(WU-13)* |
| 16 | `2ffd43b` | fix | **BUG 1**: fix(notifications): read backend error field for domain code routing |
| 17 | `f1b32c2` | fix | **BUG 2**: fix(notifications): hydrate form when GET source resolves |
| 18 | `de30844` | fix | **BUG 3**: fix(notifications): apply mapped form on hydration to avoid double-map crash |
| 19 | `6202ed8` | refactor | **S1**: refactor(notifications): source stale-recipient label from copy |
| 20 | `b3746c2` | refactor | **S2**: refactor(notifications): type notification-config query without cast |
| 21 | `2434e01` | docs | docs(notifications): mark WU-1, WU-2, WU-3 complete in tasks.md |
| 22 | `141d65d` | docs | docs(notifications): mark WU-4..WU-8 complete in tasks.md |

---

## Verification outcome (PASS, no CRITICAL)

| Gate | Result | Notes |
|---|---|---|
| `pnpm build` | **GREEN** | vue-tsc --build + vite build ~55s, no type holes. Build is authoritative here because the previous double-map `as` cast was removed in `de30844`. |
| `pnpm test:unit` (notification-config in isolation, 15 files) | **186/186 PASS** | Deterministic. |
| Spec coverage | **All 10 REQs implemented + tested** | Tests use real-shape assertions (not tautologies). `toPutBody` test asserts EXACTLY 3 whitelisted keys. |
| Bug regression-proof | **All 3 fixed bugs have regression tests** | See "Bugs found + fixed during apply" below. |
| Wiring (real seam, not mocks) | **Confirmed** | View passes `query.data` as `source` (no manual `hydrate()`). Route + sidebar both gate `['read','NotificationConfig']`. Recipients reuse `usersApi.listAssignable()` — no invented endpoint. |

Findings: **0 CRITICAL**, 1 WARNING (W1: pre-existing full-suite flakiness, see Known items), 2 SUGGESTIONS (S1, S2 — both already ADDRESSED via refactors S1/S2 above).

---

## Bugs found + fixed during apply (3)

| # | Severity | Title | Commit | Where & root cause |
|---|---|---|---|---|
| 1 | HIGH | Backend error field name mismatch | `2ffd43b` | `useUpdateNotificationConfigMutation.ts:193` — `extractErrorPayload` read `data.code` but real backend returns `{error, message}`. Result: `INVALID_RECIPIENT` never routed to inline recipients field (REQ-8) and fell through to generic 400 toast. Fix: `data.error ?? data.code`, forward `message`, exported the function for testability at the axios boundary. |
| 2 | MEDIUM | Form composable never hydrated from GET source | `f1b32c2` | `useNotificationConfigForm.ts` — `source` ref was accepted but never wired to a `watch()`. Dead code: `const hydrated = computed(() => source.value); void hydrated`. Result: form stuck at defaults forever. Fix: `watch(source, v => v && hydrate(v), {immediate:true})`. Reuses `applyFormSnapshot` so form+pristine stay in lockstep → no spurious dirty-on-hydration. |
| 3 | HIGH | Double-map crash on hydration | `de30844` | `useNotificationConfigForm.ts` — production seam: query maps GET→Form once, then form's watch called `fromConfigResponse` AGAIN with the Form's shape. `fromConfigResponse` does `[...view.recipients]`, but a Form has no `recipients` → `TypeError: view.recipients is not iterable`. The `as NotificationConfigResponse` cast silenced vue-tsc so `pnpm build` was green and the bug shipped. Tests passed only because they fed raw `recipients` shape, not the real query→form seam. Fix: `source: Ref<NotificationConfigForm \| undefined>`; `hydrate` applies DIRECTLY; type the seam, never the cast. GET→Form mapping happens EXACTLY ONCE in `useNotificationConfigQuery`. |

All three bugs discovered during strict-TDD RED-first cycles. Pure helpers extracted for testability; RED tests feed the **real production shape** (not hand-picked test fixtures), ensuring the regression tests catch the same class of bug in the future.

---

## Quality refactors (2)

| Tag | Commit | What | Where |
|---|---|---|---|
| S1 | `6202ed8` | Stale-recipient label `'Usuario no disponible'` was duplicated as a raw literal in `recipientSelectState.ts:47` while `copy.ts` exports `staleRecipient`. Now sourced from `copy.ts` to remove the drift risk. | `src/features/system/notifications/components/recipientSelectState.ts` |
| S2 | `b3746c2` | `useNotificationConfigQuery.ts:45` used a single `as NotificationConfigResponse` cast. Now types the `queryFn` generic so the cast is gone. Build stays green WITHOUT any `as` casts in the form/query seam. | `src/features/system/notifications/composables/useNotificationConfigQuery.ts` |

---

## Archive contents (in `openspec/changes/archive/2026-07-08-notification-config/`)

- `proposal.md` ✅
- `specs/notification-config/spec.md` ✅ (delta preserved verbatim)
- `design.md` ✅
- `tasks.md` ✅ (WU-1..WU-13 ✓; 6.2 + 6.3 manual click-through preserved as `[ ]` — see "Intentional-with-warnings" below)
- `verify-report.md` ✅
- `archive-report.md` ✅ (this file)

Audit trail is complete. No artifact was modified before the move.

---

## Intentional-with-warnings — manual QA preserved as unchecked

The persisted `tasks.md` shows two unchecked items at Phase 6:

- `6.2 WU-13 manual: toggle master + action; assign user; save; refresh; verify persisted.`
- `6.3 WU-13 manual: revoked perm → 403 redirect + sidebar hidden.`

**These are NOT stale checkboxes and NOT incomplete implementation.** They are click-through validations that require a human user in a browser session and explicitly cannot be automated:

- Step 6.1 (closed in commit `e04eecb chore(notifications): final verification and task completion`) already ran `pnpm test:unit` + `pnpm build` GREEN.
- The full **13-step manual-QA checklist** for human review is documented in `verify-report.md` lines 128-142 (Nav to /sistema/configuracion/notificaciones → toggle master ON → flip "Bajo inventario" → pick recipient → Save → reload → revoke perm scenarios → etc.).
- The orchestrator's launch prompt explicitly endorsed this archive disposition: *"Branch ready to merge to main; solo dev merges manually — do NOT push, do NOT merge."*

**Reconciliation policy applied:** `sdd-archive` does NOT own normal task completion. `sdd-apply` left these steps unchecked by design because no automated test can exercise browser-only click-through. The verify-report's PASS verdict covers them through the documented manual-QA checklist. **The archive preserves the audit trail exactly** — marking them `[x]` would be dishonest; deleting them would lose the manual-gate intent.

**Pre-merge gate for the user:** the 13 manual click-through steps in `verify-report.md` §"Manual-QA checklist (human click-through)" must be exercised in a real browser session **before** the user merges.

---

## Known non-blocking items

These are explicitly **out of scope** for this archive. They are pre-existing on `main` and not introduced by `notification-config`. The user should be aware of them when sizing their backlog.

1. **W1 — Pre-existing full-suite flakiness** (verify-report WARNING).
   - Running the full `pnpm test:unit` on `main` ALSO produces extra flaky failures in untouched files (`router.spec.ts`, `ProductDetailView.test.ts`).
   - The new `router.notifications.spec.ts` participates in the flaky router-cache set → possible CI false-red.
   - **Resolution path:** isolate router tests or reset the router cache, run router specs single-threaded. Address as a SEPARATE change.
   - `notification-config` itself is GREEN in isolation (186/186), so this is not a blocker for THIS archive.

2. **18 pre-existing baseline failures** in 5 unrelated files:
   - `useAuthStore`, `usePromotionColumns`, `DebtPaymentModal`, `useDebtPayment`, `SaleDetailMetadataCard`.
   - Deterministic, present on `main`, NOT introduced by `notification-config`.
   - **Resolution:** fix in a SEPARATE change.

---

## Source-of-truth updated

The canonical OpenSpec specs directory now contains:

| Domain | Spec file |
|---|---|
| `notification-config` (NEW) | `openspec/specs/notification-config/spec.md` |

Other domains are unchanged. No capabilities were modified, removed, or renamed.

---

## Git state left for the user

Per the orchestrator's explicit instruction ("do NOT commit code, do NOT merge, do NOT push"), this archive executed **filesystem operations only** — NO `git add`, NO `git commit`, NO `git merge`, NO `git push`.

After this archive, on `feat/notification-config`, `git status` shows:

- `openspec/specs/notification-config/spec.md` — **new file, UNTRACKED** (promoted delta spec → main specs).
- `openspec/changes/archive/2026-07-08-notification-config/` — **new folder, UNTRACKED** (archive + the moved content + `archive-report.md`).
- `openspec/changes/notification-config/` — **moved away** (still tracked `tasks.md` shows as deleted in the old location; will appear under the archive path).

The user should:

1. Review `git status`.
2. Decide whether to add a final docs commit, e.g. `docs(notifications): archive notification-config change (SDD cycle complete)`, that bundles the spec promotion + the archive move + the archive-report.md into one chore-style commit on `feat/notification-config` before merging.
3. Perform the **13-step manual click-through QA** in `verify-report.md` lines 128-142.
4. Merge `feat/notification-config` → `main` (solo dev, manual).

This archive did not touch any code files (`src/**`), so the existing 22-commit history of WUs + bugfixes + refactors + docs is preserved exactly.

---

## SDD cycle status

| Phase | Status |
|---|---|
| Explore | ✅ |
| Proposal | ✅ |
| Spec | ✅ |
| Design | ✅ |
| Tasks (13 WUs implementation) | ✅ |
| Apply (with 3 bugfixes) | ✅ |
| Verify (PASS) | ✅ |
| **Archive (this)** | ✅ |
| **Manual QA + Merge to main** | ⏳ user pre-merge gate |

The SDD cycle is **complete except for the user's manual QA + merge**. No further SDD phases required.

---

## Recall (for future sessions)

If a future session asks "how did we ship notification-config?", point it at:

1. **Decision history**: Engram topic `sdd/notification-config/proposal` — locked decisions §1..§10.
2. **Spec contract**: `openspec/specs/notification-config/spec.md`.
3. **Architecture**: Engram topic `sdd/notification-config/design` + `openspec/changes/archive/2026-07-08-notification-config/design.md`.
4. **Lessons from bugs** (non-obvious): Engram topics `sdd/notification-config/bugfix-error-field+hydration` (#2572) and `notifications/config-form-hydration` (#2576). The recurring pattern: **type the production seam, never cast over a type hole.** Hand-picked test fixtures mask production bugs.
5. **Suite flakiness** (warning for future work): track as a SEPARATE change, do NOT try to fix it inside feature branches.
