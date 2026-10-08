# EXPIRATION human decisions

Authorization: local frontend work; no further commits, push, deploy, environment changes, services, DB or WhatsApp. Preserve RESTOCK. Maximum 400 authored diff lines per unit. Visual checks are deferred to the owner.

- [x] WU1: DTOs and text validator; reviewed and committed as 81e693a.
- [x] WU2: whitelisted attempts and canonical retry identity; reviewed and committed as 6e9ac57.
- [x] WU3: read union and safe inbox presentation; reviewed and committed as c28c304. Feature tests: 147 passed; conflict harness correction: 11 passed. Historical RED 148 versus final 147 remains unreconciled; visual acceptance pending.
- [ ] WU4a (in progress): isolated EXPIRATION controls and tests; no production wiring.
- [ ] WU4b: tagged internal transport/mutation context and originating-tenant refresh.
- [ ] WU4c: guarded EXPIRATION preparation, retries and duplicate-submit protection.
- [ ] WU4d: EXPIRATION context invalidation and obsolete-settlement protection.
- [ ] WU4e: activate detail/view controls only after WU4b–d verification.

Baseline tenant capture and late-settlement risks are pre-existing; scope new protections to EXPIRATION, not a blanket RESTOCK refactor. WU4a emits validated inputs only; UUID/HTTP/context ownership remains outside controls. Preserve the production read-only notice until activation is safe.
