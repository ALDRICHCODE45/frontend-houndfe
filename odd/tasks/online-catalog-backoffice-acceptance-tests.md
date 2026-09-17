# Online catalog backoffice — creation acceptance follow-up

## Outcome and authority

Complete direct acceptance evidence for product creation (REQ-13) and new/inline variant omission (REQ-17), then resolve the confirmed product-create gap. This is ODD, not SDD.

Baseline: `feat/online-catalog-backoffice` at `de12025dd8dc114cffe29a6d3f86fce35f377bdc` (tree `08d1464f075bdb7e1dfdc768fc194e7d4851ddfb`). Original `odd/tasks/online-catalog-backoffice.md` and mirror 8295 remain frozen. Their historical T6/T7 text is superseded by completed RDD approval 8402 and commit 8409; never reopen those reviews.

User authority:

1. Initial focused test creation/execution: granted in Engram 8438.
2. Final inline rendered-switch correction plus one view-spec run: granted in Engram 8519.
3. Bounded PRODUCT/SERVICE REQ-13 production fix with strict focused TDD: granted in Engram 8519, but sequenced after disposition of A2.
4. One fresh deterministic inline selector correction and one post-edit view-spec run: explicitly granted after the partial final validation, recorded in Engram 8530. The prior execution overrun remains disclosed and is not waived.
5. Static-only parent correction for the final two selector gaps, followed by independent readback and no runtime rerun: explicitly granted after verifier `mu4sdex4-f-taci` returned PARTIAL, recorded in Engram 8541.
6. One independent evidence-capture rerun of the focused REQ-13 payload spec, with raw stdout/stderr and no retry: explicitly granted after the first GREEN omitted the raw log, recorded in Engram 8562.
7. No full suite, build, browser, backend access, new RDD, commit, archive, merge, or push is authorized automatically.

## Requirements and findings

### REQ-13 — product advanced fields on create

The literal contract requires PRODUCT/SERVICE create payloads to carry:

- `hidePriceInOnlineCatalog`
- `supportedCatalogPriceListIds`, including `[]`
- `onlineStockPresentation`
- `onlineStockPresentationCustomQty`, preserving literal `0`

`supportsAllCatalogPriceLists` is derived/read-only and must never be sent.

Retained RED evidence confirmed both create builders omitted the four writable fields. The production fix now adds them at the create-only boundary for PRODUCT and SERVICE with nullish defaults `false`, `[]`, `null`, and `null`; literal `0` survives. Update payloads continue to use advanced changed-only semantics. The unsupported asymmetric PRODUCT-only explicit-null assertion was removed. The final focused spec contains 23 tests and passes completely.

### REQ-17 — create/inline variants omit catalog keys

Both actual create paths must omit:

- `catalogPublishMode`
- `onlineStockPresentation`
- `onlineStockPresentationCustomQty`

The persisted variant case is independently valid. Inline acceptance is now closed through user-approved split provenance: the real rendered switch/forms/builders/API path passed at SHA-256 `57ed3238d22dc66ae77f8bcc59ad277d2c26d361a3cc97fc6f6dd7f6180c90e8`, and verifier `mu4srgiq-h-g0ke` reconstructed that exact source from current SHA-256 `26d570075cf0f214eb12bda9e3ae7a65b23166cc8c080a80fef838cb2d17ae26` by reversing only the two authorized selector constraints and two local import annotations.

Mocked browser evidence is not real backend integration. No real-backend claim is made or required by REQ-20.

## Final edit surfaces

- `src/features/POS/products/composables/useProductForm.ts`
- `src/features/POS/products/interfaces/product.types.ts`
- `src/features/POS/products/composables/__tests__/useProductForm.payload.test.ts`
- `src/features/POS/products/views/__tests__/ProductDetailView.catalogCreatePayload.spec.ts` (new, untracked)
- this parent-owned follow-up document

No configuration or OpenSpec artifact changed. Staging is empty.

## Tasks

- [x] **A1 — Map test surfaces and real mutation paths.** Mapper `mu4oo5k5-3-t0ak`; no writes or execution.
- [x] **A2 — Establish focused creation evidence.**
  - REQ-13 RED: valid retained evidence.
  - REQ-17 persisted: PASS.
  - REQ-17 inline: PASS under user-approved runtime-plus-static split provenance; final repository/provenance verifier `mu4srgiq-h-g0ke` passed.
- [x] **A3 — Independently audit scope, behavior, logs, hashes, and protected state.** Final state/provenance verification passed with staging empty and protected stash unchanged.
- [x] **B1 — Resolve REQ-13 production gap with strict focused TDD.** Final independent capture: 1 file / 23 tests passed, exit 0, no warnings; complete raw evidence, hashes stable, staging empty, protected stash unchanged.

## TDD and verification contract

TDD: **on**, explicitly user-selected. Runner: `pnpm test:unit --run`.

Named focused files:

```sh
pnpm test:unit --run src/features/POS/products/composables/__tests__/useProductForm.payload.test.ts
pnpm test:unit --run src/features/POS/products/views/__tests__/ProductDetailView.catalogCreatePayload.spec.ts
```

Every authorized run must retain raw stdout/stderr, exact command, CWD, start/end times, actual exit, and source hashes. A failed or unauthorized run is never relabeled as acceptance evidence.

## Evidence ledger

### REQ-13

- Baseline payload test: 9 passed.
- Original post-test execution: 24 total, 11 failed / 13 passed, exit 1.
- Ten failures cover the required PRODUCT/SERVICE matrix.
- Four new assertions confirm the derived field is omitted.
- One asymmetric explicit-null failure was outside the required matrix and has been removed without rerun.
- RED evidence: `/tmp/online-catalog-create-acceptance-20260916164738/`.
- First GREEN metadata-only evidence: `/tmp/online-catalog-create-acceptance-req13-green-20260916-184018/`.
- Final complete GREEN evidence: `/tmp/online-catalog-create-acceptance-req13-raw-green-20260917T005727Z/` — 1 file, 23 passed, exit 0, no warnings; pre/post/current hashes identical.

### REQ-17 evolution

1. First view spec: five passing tests rejected for passive `UForm`, direct state/mutation calls, and invalid cleanup.
2. Second view spec: two passing tests rejected for direct `wrapper.vm` handler invocation.
3. Real-form attempt: failed due incorrect control events and stale log/source correspondence; Teleport itself was not the blocker.
4. Event-contract correction: two passed, but inline used a `wrapper.vm` fallback for `hasVariants`; persisted case validated independently.
5. User-authorized rendered-switch correction: two passed with current bytes matching the run, but the helper still contained generic selector fallbacks and evidence recorded an additional pre-edit invocation.
6. Fresh exact-selector correction: one authorized post-edit run passed 2/2 with matching source SHA-256 `57ed3238d22dc66ae77f8bcc59ad277d2c26d361a3cc97fc6f6dd7f6180c90e8`; final readback found two remaining mechanical contract gaps: helper returns the first valid exact-text label instead of requiring exactly one, and the caller still finds a broad `div` whose text contains `inventario`.

REQ-17 final evidence:

- Earlier switch evidence: `/tmp/online-catalog-create-acceptance-req17-switch-20260916180852/`; 2 passed, exit 0, but historical selector constraints remained incomplete.
- Exact-selector runtime evidence: `/tmp/online-catalog-create-acceptance-req17-exact-switch-20260917182211/`; 2 passed, exit 0 at SHA-256 `57ed3238d22dc66ae77f8bcc59ad277d2c26d361a3cc97fc6f6dd7f6180c90e8`.
- Current final view-spec SHA-256: `26d570075cf0f214eb12bda9e3ae7a65b23166cc8c080a80fef838cb2d17ae26`.
- Verifier `mu4srgiq-h-g0ke` proved the current-to-runtime delta consists exactly of the user-authorized uniqueness/root-scope selector correction and two local import annotations.
- Acceptance: persisted PASS; inline PASS under the approved split-provenance model.

## Preservation

Preserve:

- `stash@{0}`: `0a121804f963e07b4038547b5b2e3c96cfbc2893`
- `/tmp/wu3b-candidate-input-20260915-113735`
- `/tmp/online-catalog-recovery-20260916141505-72w1wu`
- every acceptance evidence directory
- the two historical untracked OpenSpec files and their established hashes
- all OpenSpec artifacts and original ODD evidence

No automatic review, commit, archive, merge, or push.

## Outcome and next decisions

A1-A3 and B1 are complete. REQ-17 persisted and inline paths are accepted; REQ-13 PRODUCT/SERVICE creation now carries all writable advanced fields while preserving changed-only updates. Focused evidence is complete and independently validated.

Native review, broader verification, commit, archive, merge, and push remain separate human-controlled decisions. This document grants none of them automatically.
