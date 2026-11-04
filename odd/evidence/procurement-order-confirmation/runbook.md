# O3c real disposable-backend browser harness (confirm / cancel)

**Prepared, not executed.** Only syntax and parse checks were run. No server was started, no credentials were read, no backend was contacted.
Pattern reused from `../procurement-draft-orders/` (O3b): same mounted-store login, same FE origin `http://127.0.0.1:43179`, same allowlist idea, same overflow inspection of scrolling descendants.

Re-run for the S9 design pass (T7). Inputs (L21/L22): API `http://127.0.0.1:33855` (a fresh disposable runtime; the API origin is always a command argument, never baked into the harness), tenant «Mascotas y Alimentos El Roble», BE @ 5e4c020, seeds `readyToConfirm`/`2`/`3`, `incompleteCost`, `archivedSupplierDraft`, `confirmed`/`2`/`3` (`confirmed3` by Sofía Ramírez), `cancelledFromDraft`, `cancelledFromConfirmed`. The human authorized, for this session only, the credentials file `po-runtime.fXEKWW` below, with contents never printed. Confirm the exact path with the parent before generating.

```sh
API=http://127.0.0.1:33855
CREDS=/home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/.tmp/procurement-suppliers-o3a/.tmp/po-runtime.fXEKWW/credentials.json
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
- `confirmed` / `confirmedSpare`: CONFIRMED with a named confirmer / the most recently created CONFIRMED.
- `cancelledFromDraft`: CANCELLED, never confirmed, at least one line. `cancelledFromConfirmed`: CANCELLED with confirmed and cancelled actors.
- Notes starting `Pedido de prueba de permisos` (this harness's own probes) are never showcase candidates.

### manager (mutates `readyToConfirm` and `readyToConfirmSpare` only)
Per viewport × theme (1440/390 × light/dark, 4 tours):
- List: canonical table (1440) or cards (390); a status badge on every row, labels in {Borrador, Confirmada, Cancelada}.
- Ready draft: Confirmar and Cancelar enabled; confirm dialog says it freezes data and does not move stock, payments or debt; cancel dialog says it is final and has no input/textarea/select (no reason); Escape closes only the dialog and focus returns to the invoker (`confirm-order` / `cancel-order`) for both; `Volver` closes.
- Unsaved edit: both buttons disabled, `Guarda tus cambios antes de confirmar o cancelar.` shown, closing asks exactly one native confirm.
- `incompleteCost`: Confirmar disabled and `Completa los avisos del borrador para poder confirmarla.`. `archivedSupplierDraft`: Confirmar disabled.
- `confirmed`: read-only block, `Confirmada por …`, server subtotals and unit costs as currency (digits equal to the server values), no Confirmar, Cancelar available.
- `cancelledFromConfirmed`: actors are Sofía Ramírez and Jorge Martínez; the block shows **both** `Confirmada por Sofía Ramírez` and `Cancelada por Jorge Martínez` (fixed in bb1ba884; a hard check).
- `cancelledFromDraft`: every line subtotal is `—`.
- Every snapshot: no uuid-like string in visible text or aria-label/title/placeholder/alt; no page overflow; no overflow in any visible dialog or its scrolling descendants (and, at 390, in `main`).
- Status filter, once per width (light): Estado (a `USelect`) defaults to Todas and the first list request carries no `status`; opening its listbox and picking Borradores/Confirmadas/Canceladas by readable label sends `status=DRAFT|CONFIRMED|CANCELLED` and the rows and API items match; Todas drops the param. At 390 the control is reached through the Filtros sheet.
- Mutations: confirm `readyToConfirm` at 1440/light (status Confirmada, `Confirmada por María González`, form fields gone, notice, API agrees, list badge) and cancel `readyToConfirmSpare` at 390/dark (Cancelada, `Cancelada por María González`, no transition buttons, API agrees).
- Screenshots: `list|draft-ready|confirm-dialog|cancel-dialog|draft-unsaved|draft-incomplete|draft-archived-supplier|confirmed|cancelled-from-confirmed|cancelled-from-draft-{390,1440}-{light,dark}.png` plus the two `result-*` shots.

### transitions (stale state; mutates CONFIRMED orders only)
At 1440/light and 390/dark, each on its own CONFIRMED order (most recently created first; a viewport is skipped and recorded if there are not enough):
- Open it; Cancelar is available. Through the harness session, cancel the same order directly (POST cancel with the order's current version) → 200 CANCELLED.
- Click Cancelar in the UI → confirm. Expect a 409 whose code is `ORDER_STATE_CONFLICT` **or** `ORDER_VERSION_CONFLICT` (the backend checks the version first, and the competing cancel bumped it, so `ORDER_VERSION_CONFLICT` is the likely one). The observed code is recorded in `observed.staleErrorCode-*`.
- The dialog closes; the order is re-read (a GET detail and a GET list follow the 409); the read-only block shows Cancelada by María González; the rejection message for the observed code stays visible (`La orden cambió en otra sesión. Ya se cargó su versión actual; revísala antes de continuar.` for version, `La orden ya no está en un estado que permita esta acción. Revisa su estado actual.` for state); no transition buttons; the list row shows Cancelada.

### permissions (mutates two cloned Pedido de prueba de permisos drafts only)
The stage logs in as manager, clones two ready drafts (`Pedido de prueba de permisos confirmar …`, `Pedido de prueba de permisos cancelar …`) from a complete order through `POST` (seeds untouched), logs out, then for each role at 1440/light:
- **editor**: opens the draft and a confirmed order; no `confirm-order`/`cancel-order` and no Confirmar/Cancelar button; direct confirm and cancel are 403.
- **confirmer**: no Continuar (edit); the draft opens as the read-only block (no form, no disabled buttons, Borrador); Confirmar available, no Cancelar; direct cancel 403; confirms the probe through the dialog → Confirmada por Sofía Ramírez; no Cancelar afterwards.
- **canceller**: the draft opens as the read-only block; Cancelar available, no Confirmar; cancels the probe → Cancelada por Jorge Martínez; direct confirm 403.
- **reader**: list with no Nueva orden, Descartar or Continuar; opens a draft (read-only block with readable warnings), a confirmed and a cancelled order; no action buttons; direct confirm and cancel 403.
- **noaccess**: either the forbidden route or the no-access message, no rows or actions, direct list 403.

### Design assertions (S8/S9; hard checks unless noted)
- **D1 filter** (manager, once per width, light): Estado is a `role=combobox` with `aria-label=Estado` and the 44px hit area; there is **no native `<select>`** in the toolbar or the Filtros sheet; at 1440 it sits **on the same row as the search** (vertical centers within 6px, to its right); at 390 it is a titled `Estado` section in the Filtros sheet; the listbox offers Todas, Borradores, Confirmadas, Canceladas, picked by readable label.
- **D2 money** (read-only views: confirmed, both cancelled, and the read-only drafts): every unit cost and subtotal matches `/\$[\d,]+\.\d{2}/` or is `—`, the digits equal the server decimal (no rounding or recalculation), and the cells are right-aligned with `tabular-nums`. The editable draft's saved subtotal is currency formatted (finding).
- **D3 read-only draft** (permissions: confirmer, canceller, reader): no `form.order-form`, no Guardar/Agregar/Cambiar/Quitar buttons, **no disabled button inside the read-only block**, status Borrador, and for the reader's incomplete draft readable warnings and no raw issue codes.
- **D4 disabled primary** (manager): the disabled Confirmar orden (unsaved edit, incomplete cost) has computed `opacity: 1` and `cursor: not-allowed`; judge the dark screenshots by eye.
- **D5 summary** (manager, both dialogs, every tour): `order-summary` names the supplier and the location, shows the line count, lists min(5, n) lines as product — quantity, says `y N renglones más` past five, and shows no totals.
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
- API allowlist: auth login/logout/refresh/me/permissions; supplier list and detail GET; order list GET/POST, detail GET, confirm/cancel POST; products list and variants GET. No PUT or DELETE of orders, and no other host except public font/icon GETs. Anything else is aborted and recorded in `outsideScope`.
- Dialogs: the only native prompt expected is the unsaved-changes confirm; every native dialog is counted and accepted.
- Cleanup: none. Probe orders and cancelled/confirmed seeds stay in the disposable database. The parent owns stopping its own server and the runtime.
