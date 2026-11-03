# Draft purchase orders — O3b verification report

**Status: T4 verified.** The real disposable backend runs passed and the independent
recheck passed. The screenshots stay local and untracked, as in O3a.
Task: `odd/tasks/procurement-draft-orders.md` (S1–S7, Log L10–L20).

## Environment

- Backend: disposable runtime on `feat/procurement-po-drafts-o3b`, API `http://127.0.0.1:40377`.
  It used a fresh disposable database with an additive migration. No existing database was touched.
- Frontend: production entry served by `start-runtime-server.mjs` on `http://127.0.0.1:43179`.
- Credentials: read only in browser memory from the exact path the human authorized (L18).
  No secret, token or email is in any report.
- Seed prefix `PO-e473f791-9135-473e-a30b-6face6a13b7a`. Each run creates its own `FEProbe-<uuid>` drafts.

## Results

| Evidence | Result |
| --- | --- |
| Fixture MCP (`browser-fixture-check.js`, vite preview, all API fulfilled in-harness) | 20/20 |
| Real manager stage (`runtime-manager-final.json`) | 79/79 checks, 0 outsideScope, 0 runtime errors |
| Real permissions stage (`runtime-permissions-final.json`) | 43/43 checks, 0 outsideScope, 0 runtime errors |
| Unit/integration (procurement, auth, purchase-order route) | 43 suites / 564 tests |
| `vue-tsc` test config, `vue-tsc --build`, `vite build`, `git diff --check` | pass |
| Independent verification (`gentle-ai-verify`) | S2 pass, S4 pass, S3 pass after one correction |

The manager stage covers these flows:
- an incomplete draft (POST 201) and its server diagnostics;
- server search by note and by current supplier name;
- ARCHIVED suppliers and SERVICE products are absent from the pickers;
- a KILOGRAMO line with a canonical PUT, and the server subtotal shown exactly as returned;
- `1.5` on a UNIDAD product blocked locally, with no PUT sent;
- VARIANT_REQUIRED, then cleared by choosing a real variant;
- a competing PUT returns 409 ORDER_VERSION_CONFLICT, the local buffer is kept, and reload is explicit;
- a committed PUT whose response is dropped is replayed by "Reintentar" with the same key and body, and the version advances once;
- supplier DELETE returns 409 SUPPLIER_HAS_PURCHASE_ORDERS, shown on the supplier screen;
- discard returns 204, the row disappears, and GET returns 404;
- list, editor and discard confirmation at 390 and 1440, light and dark, with no page or overlay overflow.

The permissions stage covers two roles:
- **reader:** read-only, with no mutation UI; direct POST, PUT and DELETE all return 403;
- **noaccess:** the route shows 403, and GET, list and every write return 403.

## Defects found and fixed

The real runtime and the independent verifier found five product defects that the
fixture checks did not show. Each was fixed test-first:

1. **Empty picker value** (`58dc3a30`). The "Sin proveedor" option used `''` as its
   value. Reka `ComboboxItem` throws on that, so the picker search never rendered.
   The option now uses a non-empty sentinel.
2. **Picker overflow at 390** (`58dc3a30`). The supplier picker trigger overflowed the
   editor. The field grid track is now `minmax(0, 1fr)` and the value truncates.
3. **Empty actions column** (`58dc3a30`). A reader saw an empty "Acciones" column.
   The column is now conditional, as in `SupplierList`.
4. **Unvalidated quantity without a product** (`e3df65f6`, severe, independent verifier).
   A line without a product skipped canonical quantity validation. Syntax and
   positivity are now always checked; an unknown unit defers only the
   integer/decimal step.
5. **Create-only editor** (`e3df65f6`, minor). After POST, a create-only user kept an
   editable form that could not be saved. The form is now disabled and explains why.

The harness also had defects, none of them product defects (Log L18). The worst was
that its first overlay check measured only the dialog box, not the scrolling body.

## Follow-ups

These are not blocking:
- Add a purchase-order test that goes through the real credential-refresh queue.
- Cover explicitly a command rejection that arrives late, after a context change.
- Cover the full permission matrix of the view.
- Add boundary tests for 200/201 lines and 500/501 location code points.
- Three router specs time out under full-batch load. This happens on `main` without these changes (L10).
- On the backend side, schema and default grants were verified by the backend owner, not by the FE.
