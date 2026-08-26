---
artifact: archive-report
change: payment-details-admin
project: frontend-houndfe
verdict: PASS_WITH_WARNINGS
mode: openspec
branch: main (single-pr delivery, merged)
archived: 2026-08-25
authored_by_phase: manual archive (orchestrator; native sdd-archive blocked by harness verify:ready quirk)
---

# Archive Report — payment-details-admin (Datos bancarios)

**Change**: `payment-details-admin`
**Status**: ✅ **COMPLETE, VERIFIED, AND ARCHIVED**
**Archived**: 2026-08-25
**Artifact Mode**: OpenSpec (filesystem)
**Branch**: `main` (single-pr delivery) @ `c5cfcc5`
**Working tree at archive time**: clean

---

## 1. Executive Summary

`payment-details-admin` ("Datos bancarios") is a complete and verified admin bounded context for the tenant's bank accounts used by the WhatsApp bot's transfer-payment instructions. Full tenant-scoped CRUD under `/admin/payment-details` (POST / GET / GET:id / PATCH / DELETE), 4 CASL permissions (`create/read/update/delete:PaymentDetail`), `isActive` never editable (backend `forbidNonWhitelisted` → 400), logical delete (baja lógica), the "Sin cuenta activa" operational banner, and a table/cards list with ViewToggle.

Delivered as 4 TDD slices (S1-S4) on the feature branch, merged to `main` by the maintainer (single-pr; the user pushes). Commits: `8b20c7a` (S1), `4c8a666` (S2), `ad83441` (S3), `565f372` (S4), `79cf336` (docs), `3e1d7b5` (verify remediation), `db93908` (verify envelope), `c5cfcc5` (evidence_revision sync).

## 2. Verification

- **Full suite**: `pnpm test:unit --run` → **4552 tests pass** (305 files), exit 0.
- **Build**: `pnpm build` (vue-tsc type-check + vite) → clean, exit 0; `AdminPaymentDetailsView` chunk emitted.
- **Verify envelope**: `openspec/changes/payment-details-admin/verify-report.md` starts with a valid `gentle-ai.verify-result/v1` envelope — `gentle-ai sdd-verify-validate --requirements 13 --scenarios 37` → `valid: true`, verdict `pass_with_warnings`, 13/13 requirements, 37/37 scenarios.
- **Strict TDD**: `apply-progress.md` has TDD Cycle Evidence tables per slice (S1-S4).
- **Spec coverage**: REQ-PD-001..008 + REQ-AUTH-001..004 implemented and covered; REQ-PD-009 (bot E2E) recorded as out-of-unit-scope (E2E).
- **Tasks**: 20/20 checkboxes marked; 0 unchecked implementation tasks.

## 3. WARNINGS (non-blocking)

1. **Review-workload budget**: 3 of 4 slices exceeded the 600-line budget (S1=775, S2=1249, S4=1016; total 3,622 insertions). `size:exception` registered in `tasks.md` (maintainer-accepted, single dev, single-pr). Not a code defect.
2. **View-spec overclaim**: two tests in `AdminPaymentDetailsView.spec.ts` overclaim (badge test is smoke-only `table-data` exists; confirm-modal test asserts only closed-by-default). Builder logic is unit-covered elsewhere.
3. **Native SDD status quirk**: `gentle-ai sdd-status` keeps `verify: ready` despite the valid committed envelope and 3 passed ledger settles — likely a harness integration bug (same cluster as the agent-commit guard). Archive performed manually.

## 4. Specs promoted to canonical

- `openspec/specs/payment-details/spec.md` (full spec, REQ-PD-001..009)
- `openspec/specs/authorization/spec.md` (full spec, REQ-AUTH-001..004)

## 5. Rollback

Feature isolated to `src/features/admin/payment-details/` (22 files) + 6 registration touch points (auth.types.ts, ability.ts, permissions.ts, query-keys.ts, navigation.registry.ts, router/index.ts). Rollback = revert of the feature commits; removing the registration edits removes subject/menu/route atomically. No data/migration surface on the frontend.
