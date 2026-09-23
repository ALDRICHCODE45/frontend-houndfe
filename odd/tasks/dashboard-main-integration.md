# Dashboard Main Integration

## Goal

Integrate the reviewed branch-sales time-series backend and operational dashboard frontend into each repository's local `main`, then remove only the two explicitly obsolete feature worktrees.

## Authorization and boundaries

- User explicitly authorized local merges and removal of these worktrees only:
  - `/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend-branch-sales-timeseries`
  - `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe-branch-sales-summary`
- Do not touch, clean, reset, merge, remove, or mutate any other worktree or unrelated in-progress work.
- Do not delete feature branches unless separately authorized.
- No push, pull request, deployment, release, or remote mutation is authorized.
- The frontend canonical worktree contains unrelated in-progress work and is excluded from all integration writes. Use a new isolated temporary `main` worktree.
- The backend owner may mutate only the clean canonical backend `main` worktree for this integration.
- Preserve reviewed commits; use ordinary merge commits when histories diverge. Do not rebase or rewrite reviewed history.

## Starting evidence

- Backend `main`: `a69d852b12fb83dc445311ef3f2f47eeb003c3e9`, clean, 36 commits ahead of the feature merge base.
- Backend feature: `feat/branch-sales-timeseries` at `3da066c82572a75efdaec2303de35b60bd714312`, clean, five reviewed commits.
- Frontend `main`: `f9891db`, not checked out in the canonical worktree.
- Frontend feature: `feat/branch-sales-summary` at `ab94d071b10213a646a15873cbfeef8c7b0c34cf`, clean before this tracker, 35 dashboard commits after its merge base.
- Frontend canonical worktree is on `feat/public-catalog-visual-redesign` with unrelated uncommitted work and must remain untouched.
- The Playwright/Vite process previously occupying port 4173 exited normally before integration began.

## Tasks

- [x] **DMI-1 — Coordinate runtime ownership.** Identified the Playwright owner boundary, confirmed that it exited without intervention, and obtained explicit read-only safety confirmations from the backend and frontend owner sessions.
- [x] **DMI-2 — Integrate and verify backend.** Completed in local `main` merge `d46a435880acfef92502d4227f93a249121b467a` with parents `a69d852b12fb83dc445311ef3f2f47eeb003c3e9` and `3da066c82572a75efdaec2303de35b60bd714312`. The clean deterministic merge matched inspected tree `116cc3910c5aa90031e3cd6b988b938907124351`; 145/145 analytics unit tests, 5/5 local PostgreSQL tests, build, and diff check passed. Existing assembled native review `review-cd491f040f4d9451` remains the approval for the reviewed feature range. `main` is clean and contains the feature; only the authorized backend feature worktree was removed without force, its branch was preserved, and every unrelated worktree remained untouched.
- [ ] **DMI-3 — Integrate and verify frontend.** In a newly created isolated temporary worktree at local `main`, merge `feat/branch-sales-summary` without rewriting history, resolve only candidate-caused conflicts, run focused dashboard, type, build, and responsive gates, confirm the canonical frontend worktree is unchanged, and record the merge commit.
- [ ] **DMI-4 — Remove only obsolete worktrees and reconcile.** After each merge is verified, remove only the two explicitly authorized feature worktrees, preserve their branches, remove the temporary frontend integration worktree, verify repository/worktree status, update the Engram mirror, and report that delivery remains local-only.

## Recovery and rollback

- Before each merge, record the exact `main` and feature heads.
- If a merge conflicts outside the candidate's owned paths or verification fails, abort that merge and leave the feature worktree intact.
- Do not use reset, clean, force removal, force branch deletion, rebase, or history rewriting.
- A merged but unverified `main` is not eligible for worktree removal.

## Delivery status

Local integration is authorized. Push, pull request, merge to any remote, deployment, and release remain unauthorized.
