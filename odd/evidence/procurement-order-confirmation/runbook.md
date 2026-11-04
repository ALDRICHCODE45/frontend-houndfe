# O3c real disposable-backend browser harness (confirm / cancel)

**Prepared, not executed.** Only syntax and parse checks were run. No server was started, no credentials were read, no backend was contacted.
Pattern reused from `../procurement-draft-orders/` (O3b): same mounted-store login, same FE origin `http://127.0.0.1:43179`, same allowlist idea, same overflow inspection of scrolling descendants.

Re-run for the UI clarity pass (T4 → T5): the list per artboard 02, the open order per 04/05 and the shared patterns (`docs/design-system.md`, Patrones). Inputs: API `http://127.0.0.1:42271` (BE `feat/procurement-po-list-totals`, e51299e + 6e5c352, list `totals`), credentials `po-runtime.N2VBXY` (authorized by the human for this session only, L10; the path is an argument and the contents are never printed), seeds as below plus `mixedTaxBasis` (DRAFT, two totals) and `confirmedMixedTaxBasis`.

Earlier re-run, for the S9 design pass (T7). Inputs (L21/L22): API `http://127.0.0.1:33855` (a fresh disposable runtime; the API origin is always a command argument, never baked into the harness), tenant «Mascotas y Alimentos El Roble», BE @ 5e4c020, seeds `readyToConfirm`/`2`/`3`, `incompleteCost`, `archivedSupplierDraft`, `confirmed`/`2`/`3` (`confirmed3` by Sofía Ramírez), `cancelledFromDraft`, `cancelledFromConfirmed`. The human authorized, for this session only, the credentials file `po-runtime.fXEKWW` below, with contents never printed. Confirm the exact path with the parent before generating.

```sh
API=http://127.0.0.1:42271
CREDS=/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/po-runtime.N2VBXY/credentials.json
EVID=odd/evidence/procurement-order-confirmation
```

## 1. Static checks (no side effects)

```sh
node --check $EVID/runtime-checks.mjs
node --check $EVID/generate-runtime-mcp.mjs
node --check $EVID/start-runtime-server.mjs
git diff --check
```

## 2. Generate the three self-contained stage scripts

```sh
node $EVID/generate-runtime-mcp.mjs $API $CREDS
```

Writes `generated/mcp-runtime-{manager,permissions,transitions}.js` (git-ignored: they carry the credentials **path**, never its contents). Parse-only; nothing is evaluated.
Every report carries `commit` (git HEAD read at generation time, or `--commit=<40-hex sha>`) and `workingTreeDirty` (uncommitted changes under `src/` or `docs/`). **Commit the code under test first, then generate**, so a report's `commit` is the code it ran on and `workingTreeDirty` is `false`. Reports also carry `showcaseOrders`: the readable supplier · note of each seed used (no ids).
Optional: add `--check-schema` to make the generator itself open the file locally and print **booleans only** (API origin matches, each of the six roles has an email, a password is resolvable). Off by default.

## 3. Start the frontend (parent owns the process)

Port 43179 must be free. If it is occupied, identify the owner; do not kill an unrelated process.

```sh
node $EVID/start-runtime-server.mjs $API
```

Serves the real production entry/router with `VITE_API_BASE_URL=$API` (`envDir: false`, no env file read). Generated root and Vite cache go to `$EVID/runtime-server/` (git-ignored).

## 4. Execute in this order (Playwright MCP, parent only)

Disable tracing, video, HAR, storage-state export, console dumping and request/body logging. Use `browser_run_code_unsafe` with `filename`, never paste source:

1. `…/$EVID/generated/mcp-runtime-manager.js`
2. Only after reviewing its report: `…/generated/mcp-runtime-transitions.js`
3. Then `…/generated/mcp-runtime-permissions.js`

(Absolute paths: prefix with `/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/`.)

Stop on `verdict: stopped`, a `failureCheck`, a runtime error, or any `outsideScope` entry. `verdict: script assertions passed with findings` means every hard check passed and `findings[]` lists documented divergences to review. Save only the returned redacted report, as `runtime-<stage>-final.json` if fully passed, or an attempt filename if stopped. Screenshots land in this directory as `runtime-<stage>-<name>.png`.

Each stage opens and closes its own browser context. A stage runs for a few minutes (manager takes about 50 screenshots); raise the MCP tool timeout if needed.

## 5. What each stage asserts

All order lookups are by readable attributes (note or supplier name) plus the row position of the same query; no ids are typed, searched or shown. Reports contain no ids (paths are redacted to `:id`), emails, passwords or tokens.

### Showcase resolution (read-only, every stage)
The stage lists DRAFT/CONFIRMED/CANCELLED orders through the manager session and classifies them by semantics. It stops before any mutation if a needed one is missing (`missingShowcase` lists the keys).
- `readyToConfirm`, `readyToConfirmSpare`: the first two DRAFT orders with `canConfirm=true` and an ACTIVE supplier (oldest first); the third (`readyToConfirm3`) stays untouched. `confirmed` is the first CONFIRMED order with a named confirmer; the transitions stage cancels the two most recently created CONFIRMED orders, so `confirmed`, `confirmed2` and `confirmed3` need three.
- `incompleteCost`: DRAFT, `canConfirm=false`, ACTIVE supplier, an issue code starting `COST_`.
- `archivedSupplierDraft`: DRAFT whose supplier snapshot is ARCHIVED.
- `mixedTaxBasis`: DRAFT whose list `totals` has two entries (EXCLUDES_TAX then INCLUDES_TAX); required by the manager stage. `confirmedMixedTaxBasis` is the CONFIRMED equivalent (a finding if missing). The list `totals` are read from the order list, never recomputed.
- `confirmed` / `confirmedSpare`: CONFIRMED with a named confirmer / the most recently created CONFIRMED.
- `cancelledFromDraft`: CANCELLED, never confirmed, at least one line. `cancelledFromConfirmed`: CANCELLED with confirmed and cancelled actors.
- Notes starting `Pedido de prueba de permisos` (this harness's own probes) are never showcase candidates.

### manager (mutates `readyToConfirm` and `readyToConfirmSpare` only)
Per viewport × theme (1440/390 × light/dark, 4 tours):
- List: canonical table (1440) or cards (390); a status badge on every row, labels in {Borrador, Confirmada, Cancelada}; the row-by-row design checks of D6 against the API page.
- Row ⋮ menus (D7) and the row-menu flows: `Confirmar…` / `Cancelar…` open the order and then the dialog (neither is confirmed); a row click opens the order; the ⋮ never does.
- Ready draft: the header primary `Confirmar orden` is ready (not `aria-disabled`) and `Cancelar orden…` is in the header ⋮; confirm dialog says it freezes data and does not move stock, payments or debt; cancel dialog says it is final and has no input/textarea/select (no reason); Escape closes only the dialog and focus returns to the invoker (the primary for Confirmar, the header ⋮ trigger for Cancelar); `Volver` closes.
- Unsaved edit (D8): `Guardar` becomes the current step, the footer reads `Cambios sin guardar`, the checklist asks to save, the primary is `aria-disabled` and `Cancelar orden…` is disabled in the ⋮; closing asks exactly one native confirm.
- `incompleteCost`: the checklist lists each pending item once with a link that opens the flagged line and focuses its missing field; the primary is `aria-disabled` and points at the checklist. `archivedSupplierDraft`: the primary is `aria-disabled`.
- `confirmed`: read-only record, `Confirmada por …`, server subtotals and unit costs as currency (digits equal to the server values), no Confirmar, `Cancelar orden…` available in the ⋮.
- `cancelledFromConfirmed`: actors are Sofía Ramírez and Jorge Martínez; the block shows **both** `Confirmada por Sofía Ramírez` and `Cancelada por Jorge Martínez` (fixed in bb1ba884; a hard check).
- `cancelledFromDraft`: every line subtotal is `—`.
- Every snapshot: no uuid-like string in visible text or aria-label/title/placeholder/alt; no page overflow; no overflow in any visible dialog or its scrolling descendants (and, at 390, in `main`).
- Status filter, once per width (light): Estado (a `USelect`) defaults to Todas and the first list request carries no `status`; opening its listbox and picking Borradores/Confirmadas/Canceladas by readable label sends `status=DRAFT|CONFIRMED|CANCELLED` and the rows and API items match; Todas drops the param. At 390 the control is reached through the Filtros sheet.
- Mutations: confirm `readyToConfirm` at 1440/light (status Confirmada, `Confirmada por María González`, form fields gone, notice, API agrees, list badge) and cancel `readyToConfirmSpare` at 390/dark (Cancelada, `Cancelada por María González`, no transition buttons, API agrees).
- Seeds of the Total contract (D6): `incompleteCost` and `cancelledFromDraft` read `—`, `readyToConfirm` shows one amount, `mixedTaxBasis` shows **two stacked** amounts labelled `sin imp.` / `con imp.` whose digits equal the server values and are never summed.
- Screenshots: `list|draft-ready|confirm-dialog|cancel-dialog|draft-unsaved|draft-incomplete|draft-archived-supplier|confirmed|cancelled-from-confirmed|cancelled-from-draft-{390,1440}-{light,dark}.png` plus the two `result-*` shots.

### transitions (stale state; mutates CONFIRMED orders only)
At 1440/light and 390/dark, each on its own CONFIRMED order (most recently created first; a viewport is skipped and recorded if there are not enough):
- Open it; Cancelar is available. Through the harness session, cancel the same order directly (POST cancel with the order's current version) → 200 CANCELLED.
- Click Cancelar in the UI → confirm. Expect a 409 whose code is `ORDER_STATE_CONFLICT` **or** `ORDER_VERSION_CONFLICT` (the backend checks the version first, and the competing cancel bumped it, so `ORDER_VERSION_CONFLICT` is the likely one). The observed code is recorded in `observed.staleErrorCode-*`.
- The dialog closes; the order is re-read (a GET detail and a GET list follow the 409); the read-only block shows Cancelada by María González; the rejection message for the observed code stays visible (`La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.` for version, `La orden ya no está en un estado que permita esta acción. Revisa su estado actual.` for state); no transition buttons; the list row shows Cancelada.

### permissions (mutates two cloned Pedido de prueba de permisos drafts only)
The stage logs in as manager, clones two ready drafts (`Pedido de prueba de permisos confirmar …`, `Pedido de prueba de permisos cancelar …`) from a complete order through `POST` (seeds untouched), logs out, then for each role at 1440/light:
Every role: the Acciones column holds only the ⋮, and `Descartar borrador`, when offered, is last, separated and destructive.
- **editor**: draft ⋮ menu offers `Continuar` and neither `Confirmar…` nor `Cancelar…`; opens the draft (step strip, no `Confirmar orden` primary, no `Cancelar orden…`) and a confirmed order; direct confirm and cancel are 403.
- **confirmer**: draft ⋮ menu is `Ver orden` + `Confirmar…` (no Continuar, no Cancelar…); the draft opens as the read-only block (no form, no controls in it, Borrador, `Solo lectura`); `Confirmar orden` ready, no `Cancelar orden…`; direct cancel 403; confirms the probe through the dialog → Confirmada por Sofía Ramírez; no Cancelar afterwards.
- **canceller**: draft ⋮ menu is `Ver orden` + `Cancelar…`; the draft opens as the read-only block; `Cancelar orden…` available in the header ⋮, no primary; cancels the probe → Cancelada por Jorge Martínez; direct confirm 403.
- **reader**: every ⋮ menu is `Ver orden` only; no Nueva orden; opens a draft (read-only block, readable pending items in the checklist, no ⋮ and no primary in the header), a confirmed and a cancelled order; direct confirm and cancel 403.
- **noaccess**: either the forbidden route or the no-access message, no rows or actions, direct list 403.

### Design assertions (S8/S9 and the clarity pass; hard checks unless noted)
- **D1 filter** (manager, once per width, light): Estado is a `role=combobox` with `aria-label=Estado` and the 44px hit area; there is **no native `<select>`** in the toolbar or the Filtros sheet; at 1440 it sits **on the same row as the search** (vertical centers within 6px, to its right) with `Nueva orden` at the card's right edge and **no refresh button** (`refresh-orders` is gone); at 390 it is a titled `Estado` section in the Filtros sheet; the listbox offers Todas, Borradores, Confirmadas, Canceladas, picked by readable label.
- **D2 money** (read-only views: confirmed, both cancelled, and the read-only drafts): every unit cost and subtotal matches `/\$[\d,]+\.\d{2}/`, is `—`, or (flagged lines of a draft) `Falta`; the digits equal the server decimal (no rounding or recalculation), and the cells are right-aligned with `tabular-nums`.
- **D3 read-only draft** (permissions: confirmer, canceller, reader): no `form.order-form`, no Guardar/Agregar/Cambiar/Quitar buttons, **no button or disabled control inside the read-only block**, status badge Borrador and a `Solo lectura` mark in the header, and for the reader's incomplete draft readable pending items and no raw issue codes.
- **D4 disabled primary** (manager): the `aria-disabled` Confirmar orden (unsaved edit, incomplete cost) has computed `opacity: 1` and `cursor: not-allowed`; judge the dark screenshots by eye.
- **D5 summary** (manager, both dialogs, every tour): `order-summary` names the supplier and the location, shows the line count, lists min(5, n) lines as product — quantity, says `y N renglones más` past five, and shows no totals.
- **D6 list** (manager, every tour, against the API page the list shows): the page header is only the title (no subtitle); columns Proveedor, Estado, Renglones, Total, Actualizada, Acciones; per row the supplier is the semibold `.hf-row-primary` button, the note the `.hf-row-secondary` line, the badge carries its tone (Borrador warning, Confirmada success, Cancelada neutral), an `aviso` marker appears iff `issueCount > 0`, the date is short (`3 nov, 20:43`), Acciones holds exactly one ⋮ named `Acciones de la orden de …`, and the Total shows the server totals: `—` for null, one amount without label, or two stacked amounts labelled `sin imp.` / `con imp.`.
- **D7 row menus** (manager): draft `Continuar`, `Confirmar…`, `Cancelar…`, then the separated destructive `Descartar borrador`; a draft with avisos has `Confirmar…` disabled; confirmed `Ver orden`, `Cancelar…`; cancelled `Ver orden`. Opening the ⋮ never opens the order; closing an order opened from the list returns focus to the row's primary button.
- **D8 open order** (manager): meta line (status badge, location, `guardada` + short date), supplier as the title, **one** solid primary (header at 1440, the sticky bar at 390), a header ⋮ (`Cancelar orden…`, then the separated `Descartar borrador`), the step strip (`Completar → Guardar → Confirmar`) derived from pendings and unsaved changes, the checklist, no permanent help paragraphs (`Puedes guardar el borrador incompleto`, `Hasta 2000 caracteres`, …) and no character counter by default, supplier and location in two columns with the note below (1440) or folded into `Nota y ubicación` (390), compact line rows with a per-line ⋮ and an inline edit row (`Listo` returns focus to the line), the footer `Guardado · {fecha}` / `Cambios sin guardar` next to `Guardar borrador`, and a closed order with the same header and lines but no step strip, footer or edit affordance.
- **D9 chrome** (every open order): at most 48rem at 1440 and a full-screen sheet at 390; header above the scrolling body above the footer; the sticky bar's bottom edge is the viewport's at 390; no loose Cancelar/Descartar/Quitar/Cambiar buttons; computed `font-family` contains **Geist** (page and open order).
- The runtime must seed at least three ready drafts and three confirmed orders (findings otherwise).

## 6. Assumptions to confirm before running
1. Credentials schema as in O3b, extended to the six roles: optional `apiOrigin`, a shared top-level `password` (or a per-user `password`), `users.<role>.email` for manager, editor, confirmer, canceller, reader, noaccess. Nothing was read to verify this; `--check-schema` can.
2. The six display names match L13 (María González, Sofía Ramírez, Jorge Martínez).
3. The seeds provide: ≥2 ready drafts, one incomplete-cost draft, one archived-supplier draft, ≥1 CONFIRMED with a named confirmer, a never-confirmed CANCELLED with lines, and a CANCELLED that was confirmed first. Otherwise the stage stops before mutating.
4. The manager can create orders (permissions stage clones probes), and the permissions are as named: editor has update but not confirm/cancel; confirmer has confirm+read only; canceller has cancel+read only; reader has read only.
5. The seeds are consumed: manager uses the two ready drafts, transitions cancels up to two CONFIRMED orders. Re-running needs a reseeded runtime. A manager rerun resolves the next ready drafts, if any.
6. The permissions stage creates two probe orders, which deviates from "spares and leftovers only"; the alternative is to give the stage two spare ready drafts, so tell the harness owner if the clone is not acceptable.

## 7. Boundaries
- Credentials: selected only with `setInputFiles` on a blank, network-blocked page and read in browser memory; the page is closed before any screenshot. The generator never opens the file unless `--check-schema` is passed.
- API allowlist: auth login/logout/refresh/me/permissions; supplier list and detail GET; order list GET/POST, detail GET, confirm/cancel POST; products list and variants GET. No PUT or DELETE of orders (so `Descartar borrador` is only inspected, never chosen), and no other host except public font/icon GETs (Google Fonts serves Geist). Anything else is aborted and recorded in `outsideScope`.
- Dialogs: the only native prompt expected is the unsaved-changes confirm; every native dialog is counted and accepted.
- Cleanup: none. Probe orders and cancelled/confirmed seeds stay in the disposable database. The parent owns stopping its own server and the runtime.
