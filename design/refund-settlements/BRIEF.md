# Brief: liquidar reembolsos pendientes

## Origen
The user approved it (S17, verbatim: "Si hermano, por favor, una detas de la otra."). The FE has no UI to settle refunds. Today only a pending count appears in the branch summary of the dashboard (`usePendingRefunds`, `GET /sales/refunds/pending`).

## Contrato
`odd/handoff/06-refund-settlements.md` is the BE contract, verified with 31 real HTTP exchanges. Read it COMPLETE: body, validations, errors with their exact messages, replay with Idempotency-Key, and §9 «known gaps».

Key points for the design:
- A refund never moves to «liquidado». `status` is always PENDING, and it leaves the list when `outstandingCents` reaches 0.
- Partial settlements exist. The outstanding balance goes down.
- There is no endpoint for one refund's detail, its settlement history, or the refunds already settled. Do not design screens that need them. If a direction NEEDS one of them, say so in the artboard as an explicit dependency.
- `GET /sales/:id` returns 404 for canceled sales. See §9 for how to open the origin sale.
- Permissions are SaleRefund read and update; the demo gives them to Manager and Cashier in Centro.

## Principios (design system, obligatorios)
- **Use only the tokens and patterns in `design/system.md` and `docs/design-system.md`.**
  - Calm forms: soft borders, label on top, HfCombobox for lists, HfSaveBar or a single primary.
  - Tables: AppDataTable rows of 64px, the ⋮ menu, toolbar with search and filters.
  - The four states: empty, loading, error and forbidden.
  - StatusBadge tones. Pending uses `--hf-warning`, never red.
- **Money:** tabular figures aligned right, in MXN format `$1,234.50`.
- **Interaction:** one primary per view; confirmations use ConfirmModal; no native dialogs.
- **Copy:** neutral Mexican Spanish with tú, sentence case, no ids, «clic».
- **Viewports:** desktop 1440 and mobile 390, light and dark, with a toggle in a floating panel outside the mock.
- **Interactive:** a working flow (pick a refund, type an amount, method/reference if the contract asks for them, confirm, see the outstanding balance go down or the row leave), plus the validation error and the 409/422 errors shown in place.
