# Prepare verified RESTOCK sources for MAIN

Prepare local, identified source commits for the owner to push and redeploy. Include completed RESTOCK and address-editor/coordinate units; pause additional map UI work. Do not publish a dirty working directory or the local preview bundle. The owner performs browser acceptance and service startup.

## Evidence checkpoint before final delivery

This record is frozen before its own documentation commit and the local MAIN fast-forward. The final owner handoff supplies the resulting MAIN SHA; pending delivery steps below are not claims that those actions already happened.

| Area               | Status and boundary                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local MAIN         | `bed98c03bbcad0468e8c3cd2cb2bcc55c247f447`; reviewed implementation tip `8a25c47fad3f445f6e958bbbffe68f8576261e6a`, 49 local commits ahead. No remote freshness claim.                      |
| RESTOCK            | HD1–6 plus navigation, unified ALL inbox, captured query context and toolbar are committed on the feature branch. The new implementation units completed native review and acknowledgement. |
| Address editor     | AD02 independently passed; original blank-pencil runtime symptom was not reproduced by the real-child baseline test.                                                                        |
| Coordinate intent  | AD03 independently passed: 176 customer tests, app/responsive types and exact static checks. Source complete; no real address write/reopen proof.                                           |
| Backend dependency | Peer reports local migration/client/checks green, 483 tests and production types passed; hosted migration and configuration are separate.                                                   |
| Deferred           | Additional map placement/search/presentation work AD04/05; promotion F1/F2 and eligibility fixes were not implemented in this work.                                                         |

## Selected-source plan

Keep tests with behavior. Proposed units, subject to final diff/readback and repository delivery gates:

1. **Installed-worktree pnpm workflow:** `pnpm-workspace.yaml` and `frontend-local-build-preview.md`; preserve normal scripts and lockfile.
2. **Retained table query identity:** shared `useServerTable.ts`, `table.types.ts` and the table regression test. Existing one-argument consumers remain compatible.
3. **Unified Chatbot requests inbox:** human-decisions source/tests, navigation registry and its breadcrumb/navigation tests, human-decision query keys, the two responsive spec sources, and their completed task records. This depends on unit 2 and backend ALL support.
4. **Address editor and pin intent:** changed customer components/view/types and their tests, including the new view integration test, plus `customer-address-location-integrity.md`. Keep the session/acknowledgement and coordinate behavior coherent rather than reconstructing unverified intermediate snapshots.

5. **Permission-file formatting:** only `src/features/admin/roles/i18n/permissions.ts` and its existing test. Publication-wide Prettier found committed feature debt; both working files are verified byte-for-byte equal to Prettier applied to the pre-publication HEAD, with no copy or permission behavior changes.
6. **Publication record:** this file, maintained separately from implementation so it can record actual source/review identities and hosted gates.

Independent mapping assigned all 47 deliverable paths exactly once: 35 tracked modifications and 12 untracked files. Initial changed-line totals for units 1–5 are 35, 76, 2,014, 1,521 and 225 respectively; this record changes as evidence arrives.

Units 3 and 4 exceed the approximately 400-line advisory. Preserve readable tests and disclose size; do not split by file type, minify, or drop coverage. No PR has been created. Source selection is explicit, not `git add .` or `git add -A`.

## Exclusions and preservation

- `auto-imports.d.ts` and `components.d.ts`: inspected diff is only dependency-path relocation from local `./node_modules` to the sibling principal checkout, caused by this worktree's installed-dependency layout. **Exclude these nonportable local changes from commits and preserve their working copies.** No dependency/declaration reset or install.
- Never stage private environment files, `node_modules`, local credentials, ignored build outputs, runtime helpers or provider data. The existing dist was compiled for LOCAL preview and is not a hosted publication artifact.
- Preserve principal's two existing untracked paths: `openspec/changes/online-catalog-publishing/.gentle-ai-instance` and `openspec/changes/public-catalog-branch-discovery/verify-report.md`.
- No new worktree, broad reset/clean, history rewrite, force operation, automatic remote fetch/push/deploy or conversation/data deletion.

## Verification and delivery gates

- [x] **MP-01 — Inventory local source and dependencies.** Local history permits a possible fast-forward; generated relocation changes are classified and excluded. Independent AD02/AD03 verification passed.
- [x] **MP-02 — Verify the intended source candidate.** Independent full run passed 454 files / 7,466 tests, 55-file lint, 69-file formatting, responsive types and one exact `pnpm build` including root Vue/Node/Vitest types. Worktree source was unchanged during that verification. This is not committed-source identity or hosted configuration evidence; no browser/Playwright/screenshots.
- [x] **MP-03 — Prepare and review implementation work-unit commits.** All five implementation units below completed native approval and acknowledgement on their immediate-predecessor committed ranges. Independent structural verification matched their 46 files to the validated source. This separate documentation unit still requires its own ordinary review before inclusion in the final MAIN cut.
- [ ] **MP-04 — Integrate verified commits into local MAIN.** Recheck MAIN/feature identity and principal protections, use a non-destructive fast-forward only when valid, then report actual final SHA and remaining local-only changes. Do not assume origin is current.
- [ ] **MP-05 — Give the owner the publication handoff.** Owner pushes and redeploys; identify source SHA, backend contract/migration dependencies, environment-specific build configuration and manual acceptance limits. Never copy the local dist, `.env`, generated Prisma client or local bot credential to hosted services.

## Publication verification checkpoint

- First full run `pnpm exec vitest run --maxWorkers=2` reached the tool's 240-second timeout without counts/results. This is neither a PASS nor an assertion failure; no build followed. No Node/Vitest/pnpm process remained with this worktree cwd in the verifier's bounded metadata check.
- Root Vue/Node/Vitest and responsive types passed. ESLint passed for 55 candidate TS/Vue files. Prettier's 69-file check failed only on the two permission files above; their narrow formatting correction now passes Prettier, ESLint and diff checks. Other source was unchanged.
- The single controlled follow-up `pnpm exec vitest run --maxWorkers=4 --reporter=verbose` completed: **454 files, 7,466 tests PASS in 167.05 seconds**. The original timeout's cause remains unproven; no assertion failure was observed. Complete output was retained by the tool outside the repository.
- Independent verifier `muici8bl-1a-yyfx` then passed all 69 format paths, 55 lint paths, responsive types and pre/post-build diff checks. One exact `pnpm build` passed, including root Vue/Node/Vitest types; Vite processed 4,068 modules in 16.48 seconds. The existing large-chunk warning is nonblocking. Ignored dist is a LOCAL bundle, not a hosted artifact.
- During that verification the 1,576-file tracked aggregate, 12-file untracked aggregate and both excluded declaration hashes were unchanged; status remained 37 modified / 12 untracked, nothing staged, HEAD and MAIN unchanged. Subsequent parent updates to this task record report those results; no production/test source changed.

## Native review checkpoint

The complete candidate returned `lens_context_budget_exceeded`, `mutation_outcome: not_started`, and `next_action: stop`. No lineage or authority was created, so no recovery, reset or abandonment is needed. Native guidance explicitly requires smaller reviewable commits; this supersedes the original review-before-local-commit ordering, not any repository delivery policy. Each smaller candidate must still prove it fits; units 3/4 are not preapproved. Combined-worktree verification does not claim separately built intermediate commits.

### Reviewed implementation chain

Each native review below was approved and explicitly acknowledged; no correction or source change was needed. These are review outcomes, not remote publication authority.

| Unit                           | Commit    | Closed native review      |
| ------------------------------ | --------- | ------------------------- |
| pnpm workflow                  | `dd0aed0` | `review-4b5557e08639519f` |
| Captured query identity        | `562e6d8` | `review-f71a4cd801caf391` |
| Unified requests inbox         | `5cd33bd` | `review-5b70162699638247` |
| Customer editor and pin intent | `f38f335` | `review-ac4467858947eb9b` |
| Permission formatting only     | `8a25c47` | `review-073a78178fba8c25` |

Verifier `muiem31n-1d-zlxb` confirmed the immediate five-commit chain from `24f4762`, disjoint 46-file coverage, every committed blob and working copy matching the pre-commit SHA-256 manifest, no unexpected committed paths, empty index, and preserved excluded declaration hashes. Only this record remained untracked. Principal MAIN stayed at `bed98c03`, with clean tracked/index state and both protected untracked files present. No tests/build/reviews were replayed; this establishes source identity, not a pristine committed-tree build, runtime acceptance or hosted readiness.

## Hosted dependency checklist

- Backend must support `status=ALL` without explicit sort keys, pending-first global pagination and the seven-day resolved window.
- Included coordinate UI requires the nullable latitude/longitude pair contract and the corresponding schema at the target. Local 53/53 migration evidence is not hosted evidence or permission.
- Backend reports local MAIN and feature at `12602d18c57c8dac73edebaa911ebb4c6f7a0b57`, incorporating RESTOCK `97a0010819ada96e01ba44421a94532570d017b0` and the coordinate commit. Its two migrations added relative to the previous MAIN are RESTOCK `20260925000100` (SQL SHA-256 `515cd9b46241a18e554f27f141abdf1f6e8579e346d1f61fe6fcbc847c7cf283`) and coordinates `20260926000100` (SQL SHA-256 `fc71a715f9c4bbb9de73cd501e12279e35ccd7b24f0f86b545858f380398b8f0`). Its Docker build generates Prisma; its entrypoint runs `prisma migrate deploy` before starting the app. **Redeploy can mutate the hosted database automatically.** Confirm hosted target/pending inventory and authorization first, including whether pushing triggers auto-deployment. Hosted CI/configuration have not been verified here.
- Backend's local private credential must not enter a Docker context: use selected Git source, not a dirty local worktree. No environment file, generated client or local credential transfer is authorized by this publication preparation.
- Frontend must be built for the actual hosted API configuration; offline demo remains disabled. Public build settings are supplied through the owner's deployment configuration, not copied private local files.
- Bot source, service credentials, real Meta/LLM use and outbound messages have their own owners and authorization. MAIN preparation does not authorize them.
- Preserve conversation/audit history. Separate demonstration cases and the Pending filter are not deletion/reset operations.

## Next step

Commit and review this documentation-only record, then perform the guarded local MAIN fast-forward and report its actual SHA and preservation checks. No feature writer remains active after AD03. Owner-only push, deployment, services and browser acceptance remain separate.
