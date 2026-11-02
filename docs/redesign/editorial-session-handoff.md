# Single-contract editorial handoff

## Delivery boundary

The human authorized local commits and integration into `main` in both repositories. The human owns pushing. No deployment or production database operation is included.

Keep one editorial implementation. Existing test data is not a reason to retain legacy runtimes or converters. Protocol identifiers such as `contractVersion: 2` describe the current strict contract, not parallel implementations. Remove only scoped obsolete code/data; retain permissions, validation, consent and command safety.

## Verified runtime state

- Frontend: one fresh authenticated load of product `feedfd3f-07d9-4a77-a805-289203624c8e` returned vocabulary, editorial state and context HTTP 200. Contenido and Revisar rendered a coherent uninitialized state.
- No draft initialization, save, publication or replay was performed in that check. It does not prove the persisted end-to-end flow or every product.
- The controlled browser was drained: the verification page closed, and the only remaining page was `about:blank`. This says nothing about human browsers or unrelated processes.
- Backend reports vocabulary installation completed locally (73 definitions). Four legacy state slots and 23 receipts remain pending scoped retirement; do not infer readiness for those products.

## Next session

1. Coordinate the remaining legacy-state disposition and a fresh-client maintenance boundary with the backend owner. Do not reuse old requests or retired credentials.
2. Once ready, agree on a test product and verify actual draft initialization, content edits, save, reload and review against the local runtime. These are persisted writes, not presentation fixtures.
3. Keep publication/C3.3 separate until explicitly enabled. Backend S89 is also unfinished.
4. Resume the broader HF audit from `odd/tasks/hf-ui-complete-audit.md` and `odd/evidence/hf-ui-complete-audit/coverage.json`; partial route coverage is not complete verification.

## Verification and review limits

- Native review is operational. For a committed slice, INSPECT and START must use the same full base reference and `committedOnly: true`; explicitly declare untracked selection. Do not delete local artifacts to satisfy inventory selection.
- Cash recipient commit `ec0d58d` was approved by readability/reliability and acknowledged under `review-4ee2db4fea03b279`. This is not approval of the accumulated branch.
- The earlier general frontend suite timed out after 600 seconds; do not report it as passing. Product-scope delivery checks are recorded separately in the task log.
- Existing build CSS/chunk-size warnings remain. Fresh LSP probes of `guided-main.ts` were clean despite stale cascade notices.
- Historical preview hosts, differential scratch and browser captures remain local unless explicitly selected as deliverables. Never bulk-stage credentials or session artifacts.

## Backend delivery receipt

Backend owner reports local fast-forward integration complete at `2c2cb4044d0f243c9455df67de6655af1deb8d68`, with `main` and its feature branch at that commit and tracked/index state clean. No push or production operation. Its latest full check was 12,592 passed / 58 skipped plus build; installer independent checks: 12 passed. Native review was unavailable there. Unrelated habitat work and the private untracked manifest remain outside delivery. Backend authority is its own `odd/tasks/editorial-local-vocabulary-repair.md` and session memory, not this summary.

## Frontend delivery verification

Product-scope job38 passed 2,797 tests in 91 suites, full build and diff check. Fresh source/test/config search found no references to the 17 retired legacy modules. Retirement commit `f8f3abe` and typed-test fix `d3c586f` were approved in native reliability review `review-cb042c6e054cf1bc`; exact acknowledgement completed. This does not cover every earlier feature commit.

Design sources and machine-readable reports are preserved as historical handoff artifacts. Screenshot files referenced by reports remain local evidence, not portable proof in a fresh clone; re-run the documented harness when needed. Temporary preview hosts and Git-history differential scratch remain untracked and untouched.
