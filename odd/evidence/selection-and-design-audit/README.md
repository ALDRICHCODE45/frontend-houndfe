# selection-and-design-audit — T7 browser live check (mocked API)

No backend was running (:3003 down; :3000 belongs to another project and was not touched), so Vite runs from the repo root
against a Playwright-intercepted API, same approach as `odd/evidence/chatbot-receipt-zoom/`.

## Run

```sh
# from the repo root (one terminal)
VITE_API_BASE_URL=http://127.0.0.1:3999 pnpm exec vite --host 127.0.0.1 --port 5197 --strictPort
# from this folder
node run.mjs                         # every screen × 1440/390 × light/dark  (slow: ~3 min per screen)
node run.mjs routes notif            # some screens
ONLY=390-dark node run.mjs promo     # one viewport/theme
node summarize.mjs results-*.json    # one line per state with the generic checks
node verify-picker.mjs 390           # measures the EligibleSalesPicker row overflow, injects the suggested CSS, re-measures
node crop.mjs <in> <out> x y w h     # close-ups (defect-*.png)
node probe.mjs <route>               # discovery: prints the GETs a route makes that fixtures.mjs does not answer
```

- Session: synthetic auth in localStorage (contract of `e2e/responsive/fixtures/auth.ts`) with `manage:all`.
- Theme: `localStorage['vueuse-color-mode'] = light | dark` (read by `src/main.ts`), set before any app script.
- Fixtures (`fixtures.mjs`) are shaped from the app types/decoders: notification-config, users/assignable, product + variants + price lists
  + catalog-settings (Zod schema), promotions bot capabilities, roles/permissions (RBAC types), cash registers/sessions/custody,
  employees (EmployeeSchema), sale detail (parseSaleDetail), customers, sales drafts/pos-catalog, delivery-routes eligible sales
  (shapes from `e2e/responsive/fixtures/delivery-route-assignment-safety.ts`). Every non-GET is aborted (logged as `blocked`).
- Vue DevTools overlay is hidden with injected CSS. Tall screens are captured by growing the viewport to the inner scroller height.

## Generic checks per state (`run.mjs › audit`)

- `cb` visible `input[type=checkbox]` / `[role=checkbox]` larger than 4px (must be 0).
- `rows` whole-row `HfSwitchRow` buttons; `small` any other `[role=switch]` (control-only switch); `noState` rows without the state word.
- `ovf` document horizontal overflow and unclipped elements past the viewport.
- `minC/low` WCAG contrast of every visible text node against its effective background (disabled controls excluded).
- `lightSurf` large near-white surfaces while `html.dark` is set.
- `FOCUS` keyboard focus: Tab for keyboard modality, focus moved into the screen (dialog or content after the h1, or a named
  selector such as `.hf-switch-row__button`, `[role=option][tabindex="0"]`, `.hf-row-mark`, `.hf-toggle-chip`), then outline/box-shadow read.
- Console errors / Vue warnings and page errors are collected per screen (`console=[]` means none).

## Files

- `shots/<screen>-<width>-<theme>-<state>.png` — every state; `defect-*.png` — close-ups; `design-*.png` — design/notification-config renders;
  `routes-*-picker-FIX-PREVIEW.png` — the picker with the suggested CSS injected.
- `results-*.json` — raw audit output; `run-*.log` — run logs.
- Source untouched (`src/` not edited). Vite started for this check was stopped afterwards (own PID only).

## T8 re-check (defects D1–D10 from L18)

```sh
node verify-t8.mjs 390 light   # also: 390 dark, 1440 light → results-t8-<w>-<theme>-fixed.json, shots/t8-*-fixed.png
SUFFIX=fixed ONLY=390-light node run.mjs notif promo product employees sales routes   # generic audit, shots/*-fixed.png
```

`verify-t8.mjs` measures each defect instead of eyeballing it (row squeeze/overlap, name vs «Activar todas» boxes, save bar
label truncation, notice text/link stacking, radiogroup semantics + hover paint, segment truncation, summary bullets, margin
contrast, supports-all copy, modal title vs close box, birth date text, placeholder contrast, tab panel focus ring).
`run.mjs` gained `SUFFIX` so the first run's shots stay as the «before». Before/after pairs: `defect-*.png` (before) ↔
`t8-*-fixed.png` (after). Vite for T8 ran on :5197 and was stopped (own PID only); `vite-t8.log` is its log.
