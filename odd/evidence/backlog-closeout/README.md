# backlog-closeout — T2 / S3 browser matrix (mocked API)

The 7 routes never matrix-checked, at 1440 and 390, light and dark, against a Playwright-intercepted API.
Same harness approach as `../selection-and-design-audit/` (the generic in-page checks in `lib.mjs` are a verbatim copy of its `audit` + `focusCheck`).

## Run

```sh
# repo root, one terminal (never :3000 / :4189)
VITE_API_BASE_URL=http://127.0.0.1:3999 pnpm exec vite --host 127.0.0.1 --port 5194 --strictPort
# this folder
node run.mjs                                   # every screen × 1440/390 × light/dark (~15 min)
node run.mjs envios perfil                     # some screens: envios validaciones solicitudes receipt zone perfil catalog chatbotcfg
ONLY=390-dark node run.mjs zone                # one viewport/theme;  SUFFIX=x keeps earlier shots
node summarize.mjs results-*.json              # one line per state
node report.mjs results-a.json results-b.json  # merged view (later files win per screen×W×theme): console, focus, checks, origins
node focus-probe.mjs /chatbot/solicitudes/req-zone 390 dark 'button[aria-label="Más acciones"]'   # focused vs blurred styles + close-ups
node verify-date-placeholder.mjs light|dark    # measures the closed-date placeholder contrast, injects the suggested CSS, re-measures
```

`PORT=…` overrides 5194 in every script.

## What is mocked

- Session: synthetic auth in localStorage (`hound.auth.*`, contract of `e2e/responsive/fixtures/auth.ts`) with `manage:all`; none for the public catalog.
- Theme: `localStorage['vueuse-color-mode'|'vueuse-color-scheme'] = light | dark` before any app script.
- `fixtures.mjs`, shaped from the app types/decoders (paths listed at the top of the file): chatbot request groups/counts/detail
  (`req-rcpt` TRANSFER_RECEIPT with a receipt preview, `req-zone` DELIVERY_ZONE with zoneImpact), chatbot settings (Zod schema),
  shipping boxes/origin/opening-hours, delivery zones, zone validations, `/me/notification-preferences`, public catalog
  branch/price-contexts/product detail (runtime guards in `catalog-*.api.ts`) with SVG images served from the mock origin.
- `opts.mode`: `loaded` | `empty` | `error` (500 on the screen's main endpoint, 404 for the request detail and the public product).
- Every non-GET is aborted (`blocked`); unmocked GETs answer 404 and are logged (`unmocked`); every request to an origin other than
  Vite or the mock API is aborted and logged (`external`).

## Checks per state

`cb` checkboxes, `ovf` document horizontal overflow + unclipped offenders, `minC/low` WCAG text contrast, `lightSurf` large
near-white surfaces under `html.dark`, `FOCUS` Tab modality then the first control after the h1 (or a named selector), console
errors / Vue warnings / page errors (tagged with the mode that produced them), `external` origins.

## Notes

- Another worker was editing `src/` during the run; Vite HMR reloaded pages mid-capture (`net::ERR_NETWORK_CHANGED`, blank page).
  `go()` retries up to 3 times when no h1 appears. Final data: `results-envios_validaciones_perfil.json` +
  `results-solicitudes_receipt_zone_catalog_chatbotcfg.json` (+ `results-zone-1440-light-r.json`, re-run of one blank capture).
  The first all-screens file is kept as raw history.
- The only console errors are the browser's «Failed to load resource» lines for the 500/404 the `error` mode serves on purpose.
- The public catalog is light-only by design (`src/features/catalog/styles/catalog.css:43` `color-scheme: light`), so `lightSurf`
  under `html.dark` there is expected.
- Shots: `shots/<screen>-<width>-<theme>-<state>.png`; `sheet-*.png` contact sheets; `defect-*.png` / `probe-*.png` close-ups. Not committed.
- `src/` untouched. Vite for this check ran on :5194 and was stopped afterwards (own PIDs only).
