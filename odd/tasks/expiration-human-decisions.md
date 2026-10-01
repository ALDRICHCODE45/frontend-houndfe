# EXPIRATION human decisions

Authorization: local frontend integration, backend contract first; no commits, push, deploy, environment, services, DB or WhatsApp. RESTOCK unchanged. Limit each work unit to 400 authored diff lines.

- [x] WU1: additive EXPIRATION DTOs and text validator with tests. Four new files; RED (missing module), GREEN (focused tests); independent verification passed (16 tests, noEmit app/test types, ESLint, Oxlint, Prettier); native review pending: consent expired before lineage creation. No consumers wired. Approved and committed as 81e693a.
- [x] WU2: resolution payload, attempt identity and idempotence. Pure `prepareExpirationDecisionResolutionAttempt`: validate positive text before UUID generation, explicit payload whitelist, previous-UUID reuse on matching decision/action/version/normalized text. RED (missing module) then GREEN (13 new tests, 29 with WU1, 19 composable regression tests, noEmit app/test types, ESLint, Oxlint, Prettier). Approved and committed as 6e9ac57.
- [ ] WU3: typed public union, safe presentation and read integration; RESTOCK controls gated by `decision.type`. RED (10 focused failures) then GREEN (147 tests, noEmit app/test types, ESLint, Oxlint, Prettier). Local dirty worktree; pending review, not complete.
- [ ] WU4: dedicated controls, stale/conflict handling and regression coverage; scope/test before writing.

Next: WU1 (81e693a) and WU2 (6e9ac57) approved and committed; WU3 implemented and locally verified in the dirty worktree, pending review; WU4 dedicated controls remain. No further commit or push is authorized. Never claim UI integration before WU2–4.
