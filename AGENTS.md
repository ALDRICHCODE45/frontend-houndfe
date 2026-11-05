# Agent instructions

## Running tests

Always run tests through the project's test scripts (`pnpm test`, `make test`,
etc.), never by invoking the runner binary directly (`npx vitest`, `go test`,
`pytest`), so the machine-wide `run-tests` queue applies. Subagents run only
the tests related to the files they changed (for example `vitest related`,
`jest --findRelatedTests`, `go test ./changed/pkg/...`, `pytest path/to/test`),
passing them through the project script. Only the main agent runs the full
suite, once, before finishing. If you see `[run-tests] waiting`, the suite is
queued, not hung: wait for it and do not kill or retry it.

In this repository:

- `pnpm test` runs the whole Vitest suite once (`vitest run --dir src --maxWorkers=4`; both scripts scan only `src`, never the stale copies under `.worktrees/`).
- `pnpm test <path…>` runs a folder or file, for example `pnpm test src/features/POS/sales`. Do not add `--`: pnpm passes it to Vitest, which then ignores the filter and runs the whole suite.
- `pnpm test:related <changed files…>` runs the tests related to the files you changed.
- `pnpm test:responsive:*` run the Playwright responsive specs (the config already uses 1 worker).
- `pnpm test:unit` is watch mode for humans. It is not queued; do not use it from an agent.
