# System redesign runtime screenshots (S4, S10)

`capture.mjs` shoots every routed screen in four states (data, empty, loading, error), at 1440x900 and 390x844, in light and dark. The PNGs go to `shots/` and the findings to `report.json`. Both `shots/` and `.auth/` are git-ignored (`.git/info/exclude`), so only `capture.mjs`, this file, `report.json` and `seed-round2.md` (the data the recapture relies on) are committed.

## Run

1. API: the backend that has the O1 migration on `http://127.0.0.1:3000` (the script waits up to 5 minutes for it; it never starts it).
2. Dev server, from the project root (never a custom Vite root, see "Evidence servers" in `docs/design-system.md`):

   ```sh
   VITE_API_BASE_URL=http://127.0.0.1:3000 pnpm dev --port 5173 --strictPort --host 127.0.0.1
   ```

3. Capture, with one Chromium and one page at a time:

   ```sh
   node odd/evidence/system-redesign/capture.mjs                  # manager@houndfe.com, tenant Sucursal Centro
   node odd/evidence/system-redesign/capture.mjs --user admin     # only the routes the manager is forbidden to open
   ```

Flags: `--only slug[,slug]`, `--states data,empty,loading,error`, `--themes light,dark`, `--viewports 1440,390`, `--force` (retake existing shots and relearn the cached response shapes, so seeded data replaces a shape cached while a screen was empty), `--inventory` (list the GET calls each screen makes, no shots), `--user manager|admin`.

It is resumable: a shot whose PNG exists is skipped, so rerun after a failure. Delete a PNG (or pass `--force`) to retake it.

## How it works

- Login goes through the real login form once per user; the session is reused from `.auth/state-<user>.json`. The dev password is read from `houndfe-backend/prisma/seed.ts` at runtime and is never printed or written. `CAPTURE_BASE`, `CAPTURE_API` and `CAPTURE_SEED` override the defaults.
- Theme is the app's own `useColorMode` key (`vueuse-color-scheme` = `light` | `dark`), set before each load. `report.json` records whether the `dark` class matched (`themeApplied`).
- States use `page.route` on the screen's main API call (the `ROUTES` table in the script):
  - data: nothing intercepted.
  - empty: the same response envelope with arrays emptied (`nextCursor` null, counts 0), learned from the real response on a data load and cached in `.auth/memory.json`. Dashboards zero their numbers; detail records answer 404.
  - the login has nothing to empty: its `empty` shots are the idle form (no submit).
  - the editorial screen's empty state is a real 404 on the editorial call; the vocabulary call is not mocked in that state (`'real'` in the `ROUTES` table), because a fulfilled mock drops the contract headers (`Editorial-Contract-Version`, `Editorial-Vocabulary-Revision`) and the screen would show a contract failure instead of the not-found state.
  - error: HTTP 500 with a JSON body.
  - loading: the response is held for up to 30 s and the shot is taken 1.5 s after the request starts.
- Detail routes take the first item of their list (the id is learned from the list response).
- A route the user cannot open (redirected to `/403`) is recorded as skipped; a couple of `<slug>__forbidden-redirect__*` shots keep the forbidden screen as evidence.
- Navigation, screenshots and intercepted responses only: no data is mutated (`/pos/cotizaciones/nueva` is skipped because opening it creates a draft).

## Output

`shots/<route-slug>__<state>__<1440|390>__<light|dark>.png`, and `report.json` with per route its status, and per shot the console errors (those that come from the intercepted 500 are counted apart as `expectedConsoleErrors`), failed requests that were not intercepted, the number of intercepted requests (`0` in a non-data state means the interception was not wired) and the horizontal overflow (`scrollingElement.scrollWidth > innerWidth`, with the first offending elements).
