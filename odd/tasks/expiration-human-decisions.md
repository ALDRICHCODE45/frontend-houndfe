# EXPIRATION human decisions

Authorization: local frontend integration, backend contract first; no commits, push, deploy, environment, services, DB or WhatsApp. RESTOCK unchanged. Limit each work unit to 400 authored diff lines.

- [x] WU1: additive EXPIRATION DTOs and text validator with tests. Four new files; RED (missing module), GREEN (focused tests); independent verification passed (16 tests, noEmit app/test types, ESLint, Oxlint, Prettier); native review pending: consent expired before lineage creation. No consumers wired. Approved and committed as 81e693a.
- [ ] WU2: resolution payload, attempt identity and idempotence. Pure `prepareExpirationDecisionResolutionAttempt`: validate positive text before UUID generation, explicit payload whitelist, previous-UUID reuse on matching decision/action/version/normalized text. RED (missing module) then GREEN (13 new tests, 29 with WU1, 19 composable regression tests, noEmit app/test types, ESLint, Oxlint, Prettier). Pending review; no UI wiring yet.
- [ ] WU3: typed public union and safe presentation; scope/test before writing.
- [ ] WU4: dedicated controls, stale/conflict handling and regression coverage; scope/test before writing.

Next: WU1 approved and committed (81e693a); WU2 implemented and locally verified, pending review. The owner authorizes continued local frontend progress (WU3–WU4) without waiting for backend or bot, but no further commit or push is authorized. Never claim UI integration before WU2–4.
