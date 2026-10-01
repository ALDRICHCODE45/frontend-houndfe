# EXPIRATION human decisions

Authorization: local frontend integration, backend contract first; no commits, push, deploy, environment, services, DB or WhatsApp. RESTOCK unchanged. Limit each work unit to 400 authored diff lines.

- [ ] WU1: additive EXPIRATION DTOs and text validator with tests. Four new files; RED (missing module), GREEN (focused tests); independent verification passed (16 tests, noEmit app/test types, ESLint, Oxlint, Prettier); native review pending: consent expired before lineage creation. No consumers wired.
- [ ] WU2: resolution payload, attempt identity and idempotence; scope/test before writing.
- [ ] WU3: typed public union and safe presentation; scope/test before writing.
- [ ] WU4: dedicated controls, stale/conflict handling and regression coverage; scope/test before writing.

Next: finish WU1 independent checks and review; never claim UI integration before WU2–4. Work-unit commits deferred by owner's explicit no-commit boundary.
