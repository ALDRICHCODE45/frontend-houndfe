# T6 live check: Caja redesign (/pos/caja) against DEV :3003

- **Setup.** FE branch `feat/cash-redesign`, working tree unchanged (nothing modified under `src/`). Repo-root Vite ran on `127.0.0.1:5195` with `--strictPort` and `VITE_API_BASE_URL=http://localhost:3003`. That is the DEV backend, running BE main `0b985890`. Port :3000 was not touched.
- **Harness.** The harness is `lib.mjs` and `api.mjs`, adapted from `odd/evidence/hold-expire-live/`. Login goes through the real form. The dev seed password is read from `houndfe-backend/prisma/seed.ts` at runtime and is never printed or written. No storage state is written to disk. Logs keep only `METHOD path ?param-keys -> status`, and request bodies are logged as keys or types, plus amounts.
- **Browser.** Headless Playwright Chromium, locale es-MX, tz America/Mexico_City, reduced motion.
- **Teardown.** Vite was stopped at the end, and :5195 is no longer listening.
- **Users.**
  - `cashier@` has create:CashSession, CashIn, CashOut, CashCount and CashHandover, read:CashHandover, update:CashHandover, read:CashRegister and read:CashSession.
  - `manager@` has create:CashClosing, CashVerification and CashRegister, read:CashClosing, CashSessionAudit, CashHandover, CashSession and CashRegister, and update:CashHandover and CashRegister.
  - No roles were changed. `admin@` has no tenant grants on cash, so it got 403 and was not used.

## Results

| # | Check | Spec | Result |
|---|---|---|---|
| 1a | «Tu turno» selected by default; 9 steps with who does each; «Siguiente paso» | S4 | **PASS** (shots 01, 04, explore-cashier, M-cashier-*). Who: Cajera/o ×4, «Cajera/o y quien recibe», «Otra persona», Cajera/o, Supervisor, Consulta. |
| 1b | Opening: register radio cards, fund in pesos, «Confirmar fondo de $500.00», «Abrir caja con $500.00» → Abierta | S3, S4 | **PASS**, with one caveat (shots 02–04, 41–42). The body sent `openingCents:50000, openingConfirmed`. The no-shift state was only reachable by masking one read, see D4. |
| 1c | Cash in and cash out with a reason. Only the last-entry confirmation is shown, no list | S9 | **PASS** (shots 05–07, 43). An empty reason gives an inline «El motivo es obligatorio…» message. After each entry only «Entrada/Salida de $X registrada a las … · motivo» (role=status) appears, with no table. |
| 1d | Start count → count with the denomination counter | S4 | **FAIL (layout)**: works, but has a layout defect (D1). The freeze works, the counter adds up to «$550.00 · Coincide con Efectivo», and the body carries the denominations. |
| 1e | After the declaration, «Entregar efectivo» is offered before verification | S8 | **PASS** (shot 11). Siguiente paso: «Entregar efectivo… No necesitas esperar la verificación». |
| 1f | Handover FLOAT and WITHDRAWAL, with the recipient picked by name and role, no UUID field | S6 | **PASS** (shots 12–13, 47). FLOAT recipients: Cajero Centro (tú), Manager Centro, Super Admin. WITHDRAWAL excludes self. The only text inputs are amount and notes. |
| 2 | Recipient receives («Recibir $100.00» / «Recibir $450.00» / «Recibir $320.00»); cashier releases the drawer | S4 | **PASS** (shots 14–17, 49–50). Release stays disabled with Spanish copy while any handover is pending. |
| 3a | Supervisor sessions list with status filter | S7 | **PASS** (shots 18–19). The chips Todas/Abiertas/En conteo/Por verificar o cerrar/Cerradas send `?status=` and return 9/2/0/3/4 rows, each with the matching status. A register filter is also present. |
| 3b | Verify (second count) | S3 | **PASS functionally, FAIL layout** (D1 again, shots 21, 52). 550 = «Sin diferencia». |
| 3c | «Cerrar caja» checklist, then close → corte (folio, totals, channels, handovers) | S5 | **PASS** (shots 23–25b, 53–55). All 7 checklist rows show as met. The confirm dialog reads «¿Cerrar Caja QA rediseño T6?», and close returns 201. The corte shows folio, people and times, fund/expected/declared/verified, the per-channel table, both handovers and the note. |
| 3d | «Ver PDF» opens a blob; «Descargar PDF» saves `corte-caja-<folio>.pdf` | S5 | **PASS**. «Ver PDF» opens a new tab and the blob is handed to it. In headless Chromium, which has no PDF viewer, the tab turns into a download, so inline display could not be checked. The download was saved as `corte-caja-CC-bd9eb515-e2e6-42bc-893f-a8723fd4abc1.pdf` (7697 B, `%PDF-`), kept in this folder. GET `/cash-closings/:id/pdf` returned 200 with the authenticated client. |
| 3e | «Cortes» list with filters; a row opens the detail | S5, S7 | **PASS** (shots 27–31). The filters send register → `registerId` (1 row), cashier → `cashierUserId`, and Desde 18/11/2026 → `from` (2 rows). A row opens the detail, and «Volver a cortes» is available. |
| 4a | Empty count: error summary plus inline message | S3 | **PASS** (shots 09, 44). The summary «Revisa 1 dato antes de enviar» is focused and its link goes to the field. The inline message is under the input. |
| 4b | Close with a requirement missing | S5 | **Not reachable in the UI.** Before verification the «Cerrar caja» step has no toggle (it is blocked). The checklist marks verified=pending, the reason reads «Falta la verificación: otra persona, distinta de quien abrió la caja, debe recontar.» and submit is disabled (shot 20). No 422 was reached through the UI, so the backend copy for that case is untested. |
| 5a | 390: sticky action bar, no horizontal overflow | S4 | **PASS, with defects D2 and D3**. `scrollWidth == 390` in every state checked (matrix plus all 390 flow states). The bar is `position:sticky`, pinned at the bottom after scrolling, and changes per state: Abrir caja → «Registrar entrada o salida / Iniciar conteo» → «Declarar conteo» → «Agregar nota / Entregar efectivo» → «Liberar cajón» → «Verificar conteo» → «Cerrar caja» → «Ver corte». |
| 5b | Keyboard focus visible on the timeline and forms | WCAG 2.4.7 | **PASS** (shots 59–66). The timeline toggles have a 2px outline. Enter opens a panel and moves focus to its heading. Arrow keys move between register radios. The amount, confirm, Cortes combobox and row buttons all show visible focus, in light and dark. |
| 5c | Console errors and failed requests | — | **PASS**. Across every script: 0 console errors, 0 page errors, 0 failed requests, 0 API 4xx/5xx. |

## Defects

- **D1 (High, layout) — count form collapses to 24px and overflows the timeline.**
  - Where: the cashier declaration and the supervisor verification.
  - Root cause: `CashCountForm.vue:303` gives the form root `class="cash-count …"`, and `styles/cash-visual.css:739` defines `.cash-count` as the count badge (`height:1.5rem; display:grid; place-items:center; background:var(--hf-action); font-size:.75rem`).
  - Measured: the form box is 24px tall, its scrollHeight is 1412, and its background is blue. The blue pill behind «Conteo ciego» / «Tu recuento» is that badge style. The form spills over the following timeline rows (Entregar/Verificar/Liberar/Cerrar/Corte overlap the inputs), and the denomination grid pokes out of the card at 1440.
  - Shots: 09, 10, 21, 44, 45, 52.
  - Repro: cashier → Iniciar conteo → «Declarar conteo». Or manager → a SUBMITTED session → «Verificar conteo».
  - In one run Playwright could not scroll the denominations into view ("element is not visible").
  - Fix: rename the form root class, or scope the badge class.
- **D2 (Medium) — a supervisor without create:CashSession lands on a dead end.**
  - The default view is «Abre tu turno» with the «No tienes permiso para abrir caja» callout open, and at 390 the sticky bar still offers «Abrir caja».
  - Shots: M-manager-1440-dark-caja, M-manager-390-*-caja, 49, 67.
  - Repro: log in as manager → /pos/caja.
  - Expected: no «Abrir caja» CTA, and probably the branch sessions or the pending verification as the default.
- **D3 (Low, layout) — timeline row heads wrap badly.**
  - At 1440, «Entregar el efectivo y recibirlo» breaks one word per line when the active who label «Cajera/o y quien recibe» takes the width (shots explore-cashier, 11, 63).
  - At 390 the head wraps unevenly: «Ver ›» sits on its own line in some rows and right-aligned in others, and the «Cerrar caja» lock icon sits on its own line (M-cashier-390-dark-caja, 42).
- **D4 (Gap, needs decision) — a cashier with a drawer-open shift has no UI path to open another register.**
  - The «Tu turno» card hides «Abrir» once a shift exists, and the timeline «Abrir caja» shows the selected shift. The backend accepts several drawer-open sessions; the dev cashier already had 4, one on every active register.
  - To test opening, only the «Tu turno» read (`GET /cash-sessions?drawerOpen=true&limit=1`) was answered empty with a Playwright route until «Abrir caja» was pressed. All writes were real.
  - Before T3 the Apertura task was always available (L3).
- **D5 (Low) — the corte «Por canal» table clips its last columns.**
  - At 1440 «Diferencia» is not visible inside the card (25). At 390 «Verificado» is cut (55). Whether it scrolls horizontally was not checked.
  - At 390 the bar shows «Ver corte» while the corte is already open.
- **Notes (not graded).**
  - «Efectivo contado disponible para asignar: $550.00» did not drop after a $100 FLOAT was declared (shot 12-withdrawal). This may be intended.
  - The no-shift state shows no «Siguiente paso» card; the opening panel opens by default instead.
  - The folio `CC-<uuid>` wraps onto 2 lines (backend format).

## Dev data created (DEV :3003, tenant Sucursal Centro)

- **Register.** `f4f0294f-bb68-4722-befb-aea34f931946`, «Caja QA rediseño T6». Created by manager via API (`setup-register.mjs`) and left active.
- **Shift 1** (1440 flow) `d74d78fe-df73-4e91-a359-6e1a36090ba5`. Fund $500.
  - Movements: cash in $100 «Cambio QA T6» and cash out $50 «Compra de garrafón QA T6».
  - Declared $550 with denominations 1×$500 and 1×$50; verified $550 by the manager.
  - Handovers to Manager Centro, both received by the manager: FLOAT $100 `30faf0f9-e12c-4aca-b021-5402123547db` and WITHDRAWAL $450 `b58ef2a4-178a-4c96-89e6-c313fe2a2875`.
  - Drawer released and the session **CLOSED**. Closing `5fbd6044-ab66-42bc-b552-88df157d0449`, folio **CC-bd9eb515-e2e6-42bc-893f-a8723fd4abc1**, note «Cierre QA T6».
- **Shift 2** (390 flow) `4997a2fe-4194-4a68-b052-ddc110b18641`. Fund $300.
  - Movement: cash in $20 «Cambio QA T6 móvil».
  - Declared $320 with denominations 1×$200, 1×$100 and 1×$20 bill; verified $320.
  - Handover: WITHDRAWAL $320 `756f323e-8d49-4a11-a6c5-73914895dcea`, received.
  - Drawer released and the session **CLOSED**. Closing `1660a64f-f872-4f20-8ec3-d830d6bd7f8b`, folio **CC-d17e17bc-cfc7-4405-8947-da8b32d96b62**, no note.
- Nothing else was mutated. The pre-existing cashier sessions (4 drawer-open) and pending handovers were left untouched.

## Files

- Scripts: `step1-open.mjs` … `step12-date-filter.mjs`, `matrix.mjs` (light/dark × 1440/390 per role), the probes `probe-*.mjs`, and `setup-register.mjs`. Each script has a matching `.log`.
- Screenshots in `shots/`:
  - 01–31: the 1440 flow (cashier light, manager light).
  - 40–55: the 390 flow (cashier dark, manager light).
  - 59–67: keyboard focus.
  - `M-<role>-<width>-<theme>-*`: the matrix (caja, scrolled bar, cortes, corte).
