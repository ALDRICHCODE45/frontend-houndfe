# Standard local build and preview

Owner requests literal `pnpm build` and `pnpm preview`, preserving type checking.

## Scope

- Edit only `pnpm-workspace.yaml` and this tracker; no application, package-script or lockfile edits planned.
- pnpm 11.25.0 reports `verifyDepsBeforeRun` unset. Its documented default is `install`; owner observed dependency-check installation failing against this worktree's shared `node_modules` symlink.
- Keep existing `allowBuilds` approvals. Disable only automatic dependency checks at project scope, not install safety checks.
- Do not install dependencies, modify the shared dependency directory, change global settings, or commit.
- Preserve private `.env.production.local` (public API localhost port 3000, offline demo disabled) and existing user-generated declaration changes. Do not stop user processes.

## Tasks

- [x] Inspect scripts, project config, installed pnpm, shared link and port availability. Both setting spellings return unset; port 4173 is free.
- [x] Set and verify project-local dependency-check policy. `pnpm config get verifyDepsBeforeRun` now returns `false`.
- [x] Execute literal `pnpm build` with type checking intact. Exit 0; original `run-p` launched both `vue-tsc --build` and `vite build`; 4,066 modules transformed. Existing >500 kB chunk warning remains nonfatal.
- [x] Execute literal `pnpm preview`, verify default port 4173 and a local page GET, then stop only that owned process. Spawned exactly `pnpm preview` without flags or environment overrides. Confirmed listener ownership, printed `http://localhost:4173/`, and GET `/login` returned 200 with built app-shell HTML. No browser, authentication or API requests. Stopped only the newly owned process group; port 4173 is free afterward.
- [x] Review exact changes and record results. `pnpm exec prettier --check pnpm-workspace.yaml` and `git diff --check` pass. Package scripts and lockfile unchanged; dependency symlink unchanged. No install or dependency repair was needed.

## Generated-file accounting

The worktree was already dirty in `auto-imports.d.ts` and `components.d.ts` before this task. Neither was reset or manually edited. The normal build regenerated `components.d.ts`; both remain unstaged.

- `auto-imports.d.ts`: unchanged from pre-build hash `ae849ab7d38f5e1fbdd90aa2d5c80ff0cbbdc897e51852bb4c58afa7328e10d4`.
- `components.d.ts`: pre-build `1f35eb83d2c2e5a6f8ec2ac0d0689543945f506a7cdb037c45d58a4122249793`; post-build `58462246710cb4af5d6062f51214814b47a1c87bf33870fd609c3acb5e3e300b`.

The functional configuration change is only three added lines in `pnpm-workspace.yaml`. No commit was made. Serving the app shell does not establish successful login, RESTOCK resolution or backend readiness.

No backend, database, browser authentication, provider or production validation is included. The existing owner-reported failing command is the RED evidence; do not repeat an unsafe installation attempt merely to reproduce it.

Rollback boundary: remove only the new dependency-check setting and this task record. Never reset user-generated declarations or delete dependency targets.
