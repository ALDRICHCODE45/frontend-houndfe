# Backend handoff 26 — restock backorders (copy received 2026-11-20 from the backend session, backend main 0c337060)

Source: houndfe-backend `docs/frontend-handoff/26-restock-backorder.md`. Copied verbatim from the intercom attachment so frontend workers can read it without leaving this repo.

# POS — restock backorders («pedidos por reposición»): staff list, detail and cancel

**Status:** T5a (staff API, CASL subject `Backorder`, seed grants, notification item shape) and T5b (stock fields, counter error, variant block, dev sample data) implemented on `feat/restock-backorder`; merged to `main` and deployed to dev `:3003` once their verify passes.

## 1. Permissions

CASL subject **`Backorder`**, actions `read` and `update` (`create`, `delete` and `manage` do not exist for it).

| Route | Needs |
| --- | --- |
| `GET /backorders`, `GET /backorders/:id` | `read:Backorder` |
| `POST /backorders/:id/cancel` | `update:Backorder` |
| Receive the staff notices (§6) | `read:Backorder` (a `manage` or `all` grant counts too) |

Seeded roles: **Manager** `read` + `update`, **Cashier** `read` only. So `manager@houndfe.com` (Sucursal Centro) can list, open and cancel; `cashier@houndfe.com` can list and open but gets `403` on cancel. Hide the «Cancelar pedido» button without `update:Backorder`.

**Existing databases:** role grants only come from `prisma db seed`; a database seeded before this change has no `Backorder` grant until the grants are added.

The **sucursal is the token's**: never send a tenant, and a backorder of another sucursal is `404`, exactly like an unknown id. A super admin without a selected sucursal gets `403`. All responses carry `Cache-Control: no-store`.

## 2. `GET /backorders` — the list (§9.1)

| Query param | Meaning |
| --- | --- |
| `page` | 1-based integer, default `1`. A page beyond the end answers `items: []` with the real `total`. |
| `limit` | 1 to **100**, default **20**. Above 100 is a `400`, not clamped. |
| `status` | Comma list of `WAITING,RESERVED,CONFIRMED,EXPIRED,CANCELLED` (exact upper case, repeats ignored). Absent = every status. |
| `productId`, `variantId`, `customerId` | UUIDs. A value that is not a UUID is a `400`. |
| `q` | Free text, ≤ 100 characters, trimmed. Split on spaces (at most 5 words) and **every word must match**; a word matches the customer's first or last name, the product name, the variant name (case-insensitive, «contains»), and a word with digits also the customer's phone digits or country code, so `+52 5512345678` works. |
| `from`, `to` | Bounds on `scheduledAt`, **both inclusive**, ISO 8601 **with a zone** (`2026-11-01T00:00:00-06:00` or `…Z`; a date without a time or zone is a `400`). `from` after `to` is a `400`. A `+` in an offset must be URL-encoded as `%2B`. |
| `sortBy` | `scheduledAt` (default), `status` (enum order) or `reservedUntil` (backorders with no reservation always last, in both directions). |
| `sortOrder` | `asc` (default) or `desc`. Ties break by queue order (`scheduledAt` asc, then id). |

An empty value (`?status=&q=`) counts as absent. Unknown params, repeated params and bad values answer `400 INVALID_BACKORDER_REQUEST` (§7).

Response `200`: `{ "items": [BackorderStaff], "page": 1, "limit": 20, "total": 37, "counts": { "WAITING": 21, "RESERVED": 4, "CONFIRMED": 9, "EXPIRED": 2, "CANCELLED": 1 } }`

- `total` = rows matching **all** filters including `status` (pager).
- `counts` honours **every filter except `status`**; all five keys always present.
- Default order is the queue order (oldest first).

## 3. `GET /backorders/:id` and the `BackorderStaff` shape (§9.2)

Same object as a list item. `404 BACKORDER_NOT_FOUND` for an unknown, malformed or other-sucursal id.

```json
{
  "id": "8f0c2b6e-3a41-4f9d-9d52-6a1b7c9e0d11",
  "folio": "BO-000012",
  "status": "WAITING",
  "version": 1,
  "productId": "5c1e9a02-77d4-4b8a-a1f3-0e2d4c6b8a90",
  "productName": "Croquetas Adulto Raza Grande 18 kg",
  "productImageUrl": "https://…/croquetas.png",
  "variantId": null,
  "variantName": null,
  "quantity": 2,
  "referencePriceCents": 114900,
  "priceListId": null,
  "currentPriceCents": null,
  "finalPriceCents": null,
  "scheduledAt": "2026-11-20T15:00:00.000Z",
  "estimatedAt": "2026-11-27T15:00:00.000Z",
  "estimatedArrivalDays": 7,
  "reservedAt": null,
  "reservedUntil": null,
  "reminderAt": null,
  "queuePosition": 2,
  "saleId": null,
  "saleStatus": null,
  "sourceDecisionId": "b4d1…",
  "chatbotRequestId": null,
  "origin": "CHATBOT",
  "confirmedAt": null,
  "cancelledAt": null,
  "expiredAt": null,
  "cancelledBy": null,
  "cancelledByKind": null,
  "cancelReason": null,
  "etaOverdue": false,
  "passedOverCount": 3,
  "branchName": "Centro",
  "customerFirstName": "Rosa",
  "phoneCountryCode": "52",
  "phone": "5512345678",
  "customer": { "id": "2a7f…", "name": "Rosa Gómez", "phone": "+525512345678" }
}
```

All timestamps are ISO 8601 **UTC** (`…Z`): render them in the sucursal time zone.

| Field | Meaning |
| --- | --- |
| `version` | Optimistic-concurrency token: send it back in the cancel. It changes on every state change, so a list that is minutes old usually holds a stale one. |
| `referencePriceCents` | Unit price when scheduled. `priceListId` null = public list. |
| `currentPriceCents`, `finalPriceCents` | Set **when it becomes `RESERVED`**: that day's unit price with automatic promotions, and `min(reference, current)`. `null` while `WAITING`. Cents, MXN. |
| `estimatedAt`, `estimatedArrivalDays` | Staff's restock estimate («aproximadamente»). |
| `reservedAt`, `reservedUntil`, `reminderAt` | The 24 h window; reminder 3 h before. `null` unless RESERVED (or was). |
| `queuePosition` | 1-based among WAITING of the same product/variant; `null` otherwise. |
| `passedOverCount` | Times later backorders were reserved while this head kept waiting (whole quantity did not fit). Show a «le pasaron N pedidos» flag when `> 0` and `status === "WAITING"`. |
| `etaOverdue` | `true` only when WAITING, the overdue-ETA re-estimate was already answered and that new `estimatedAt` is past too. Highlight it. |
| `saleId`, `saleStatus`, `confirmedAt` | Set when CONFIRMED. `saleStatus` = sale enum `DRAFT`, `CONFIRMED`, `CANCELED` (one L); it can change later. |
| `expiredAt` | Set when EXPIRED. |
| `cancelledAt`, `cancelledByKind`, `cancelReason`, `cancelledBy` | Set when CANCELLED. `CUSTOMER` (`cancelledBy` null) or `STAFF` (`{id, name}` or null if the user was deleted). `cancelReason` ≤ 280, may be null. |
| `origin` | Always `"CHATBOT"` in v1. |
| `chatbotRequestId` | `null` unless created through the requests route. |
| `productImageUrl` | Variant image, else product main image, else `null`. |
| `customer.phone` | Full international number (`+525512345678`), `null` if none. **Not masked** (the Cashier phones the customer). |
| `customer.name` | First and last name joined. |

A variant backorder has `variantId` and `variantName` (e.g. `"Bolsa 5 kg"`); a simple product has both `null`.

## 4. `POST /backorders/:id/cancel` (§9.3)

Needs `update:Backorder`. Answers **`200`** with the cancelled `BackorderStaff`. Body `{ "reason": "Producto descontinuado", "version": 3 }`.

- `version` **required**, integer ≥ 1. `reason` optional ≤ 280 (trimmed; blank/null stored as null). The reason is sent to the customer's bot (`backorder.cancelled_by_staff`), which may quote it: **ask for a customer-safe reason**.
- Any other field is a `400`. No Idempotency-Key: a double click gets `409 BACKORDER_NOT_CANCELLABLE {status: "CANCELLED"}`.
- One transaction: only WAITING/RESERVED; becomes CANCELLED with `cancelledByKind: "STAFF"`, `version + 1`; a RESERVED backorder releases its units and **the next WAITING backorder of the same product/variant that fits is reserved right away** (refresh the list, do not patch only the cancelled row).

## 5. Concurrency

On any `409`: reload that backorder (`GET /backorders/:id`), show its new state and let the user decide again. Status is checked **before** version: `BACKORDER_NOT_CANCELLABLE` carries the status (tell the user why: «ya fue confirmado»); `VERSION_CONFLICT` always means «still cancellable, but it changed».

## 6. Staff notices (§9.5)

Existing notifications API; in-app only.

| `type` | When |
| --- | --- |
| `BACKORDER_RESERVED` | Stock arrived and a backorder became RESERVED (24 h start) |
| `BACKORDER_EXPIRED` | A RESERVED backorder lapsed after 24 h unconfirmed |
| `BACKORDER_NOTICE_UNDELIVERED` | The bot could not deliver the «apartado» notice or its reminder: **phone the customer** |

Item: standard notification view with **`backorderId` filled**; `requestId` and `saleId` are `null`; `folio` is the backorder folio (`BO-000012`).

| `type` | `title` | `body` |
| --- | --- | --- |
| `BACKORDER_RESERVED` | `Pedido por reposición apartado` | `Pedido BO-000012 · 2 × <producto>` (` (<variante>)` after the product for a variant) |
| `BACKORDER_EXPIRED` | `Apartado de pedido por reposición vencido` | same |
| `BACKORDER_NOTICE_UNDELIVERED` | `No se pudo avisar al cliente de su pedido por reposición` | same + ` · Llámale para que confirme antes de que venza el apartado` |

Switch on `type`, never on `title`/`body`. `backorderId !== null` is a safe test.

## 7. Errors

Envelope with **detail members at the root**: `{ "statusCode", "error", "message", …detail }`, `message` repeats `error`; **no `timestamp`, no `details` wrapper**. Switch on `error`.

| Status | Body | When |
| --- | --- | --- |
| `404` | `{ "statusCode": 404, "error": "BACKORDER_NOT_FOUND", "message": "BACKORDER_NOT_FOUND" }` | Unknown/malformed/other-sucursal id. |
| `409` | `{ "statusCode": 409, "error": "BACKORDER_NOT_CANCELLABLE", "message": "BACKORDER_NOT_CANCELLABLE", "status": "CONFIRMED" }` | Not WAITING/RESERVED; `status` ∈ CONFIRMED, EXPIRED, CANCELLED. |
| `409` | `{ "statusCode": 409, "error": "VERSION_CONFLICT", "message": "VERSION_CONFLICT", "currentVersion": 4 }` | Stale version, still cancellable; nothing changed. |
| `400` | `{ "statusCode": 400, "error": "INVALID_BACKORDER_REQUEST", "message": "INVALID_BACKORDER_REQUEST" }` | Bad list query or cancel body; never says which field. |
| `503` | `{ "statusCode": 503, "error": "BACKORDER_RETRY_REQUIRED", "message": "BACKORDER_RETRY_REQUIRED" }` | Transient serialisation conflict; nothing changed: retry the same request once. |
| `401` | `{ "statusCode": 401, "message": "Unauthorized" }` | No/invalid token. |
| `403` | `{ "statusCode": 403, "error": "INSUFFICIENT_PERMISSIONS", "message": "Insufficient permissions", "timestamp": "…" }` | Missing permission (app-wide envelope). |

## 8. Screen summary

- List: tabs from `counts`, search = `q`, date range = `from`/`to`, pager from `total`/`page`/`limit`. Default order is the queue; offer «Vence pronto» = `sortBy=reservedUntil`.
- Row: folio, customer name + phone, product/variant + quantity, status, queuePosition (WAITING), reservedUntil countdown (RESERVED), estimatedAt with etaOverdue, passedOverCount flag.
- Detail: the same plus final/reference price, saleId link (saleStatus badge), cancel info.
- Cancel: only WAITING/RESERVED with `update:Backorder`; for RESERVED say units go to the next customer; send version; on 409 reload.
- Notifications: link `BACKORDER_*` by `backorderId`.

## Stock fields, counter error and variant block (T5b)

### Stock fields (additive)

Integers. `availableToSell` = what the counter can sell now (today's `quantity` for a product without variants); `reservedForBackorders` = sum of RESERVED quantities; `stockOnHand = availableToSell + reservedForBackorders`. Existing fields keep their meaning.

| Route | Where the fields are |
| --- | --- |
| `GET /products` (bare array) | At each product's root. For a product with variants the root aggregates its variants (same number as `variantStockTotal`); no variants array in this list. |
| `GET /products/:id` | Product root (same rule) and at the root of each `variants[i]`. |
| `GET /products/:id/variants` | At the root of every variant in the array. |
| `GET /sales/pos-catalog` and `GET /sales/pos-catalog/:productId` | Inside the existing `stock` object: `items[i].stock.{stockOnHand,reservedForBackorders,availableToSell}` for a product without variants and `items[i].variants[j].stock.{…}` per variant. `stock` stays `null` for a product with variants (use its variants) and for `useStock:false`. |

### Add-item warning (non-blocking)

- `POST /sales/drafts/:id/items` and `PATCH /sales/drafts/:id/items/:itemId`.
- When the requested cumulative quantity exceeds `availableToSell` but not `stockOnHand`: 200, the line is saved, and that line carries `items[i].stockWarning = { "code": "STOCK_RESERVED_FOR_BACKORDER", "available": 2, "reserved": 3 }`. Only on the touched line and only in that response (not persisted, not on `GET /sales/drafts`). Lines without a warning have no `stockWarning` key.
- Above `stockOnHand`, or with nothing reserved, the existing 422 is unchanged: `{ "statusCode": 422, "error": "BUSINESS_RULE_VIOLATION", "message": "Insufficient stock for product …. Available: N, Requested: M", "timestamp": "…" }`.
- Behaviour change: a quantity that exceeds `availableToSell` while units are reserved used to be 422 and is now 200 with the warning.

### Counter confirm: `STOCK_RESERVED_FOR_BACKORDER`

Route: `POST /sales/drafts/:id/charge` only. 409, details at the root (like `PROMO_RE_QUOTE`):

```json
{ "statusCode": 409, "error": "STOCK_RESERVED_FOR_BACKORDER", "message": "STOCK_RESERVED_FOR_BACKORDER",
  "timestamp": "2026-11-20T21:12:56.365Z", "available": 2, "reserved": 3 }
```

- `available`: what the counter can sell now; `reserved`: what backorders hold. Raised only when `available + reserved ≥ requested` for the first failing line; the error does not name the line.
- Otherwise the plain `{ "statusCode": 409, "error": "STOCK_INSUFFICIENT_AT_CONFIRM", … }`, unchanged.
- The sale stays `DRAFT` and nothing is charged.

### Variant block

Blocked while the product has a WAITING or RESERVED backorder with `variantId` null:

- `POST /products/:id/variants`;
- `PATCH /products/:id` with `hasVariants: true` on a product that has none.

409, nothing changes:

```json
{ "statusCode": 409, "error": "PRODUCT_HAS_ACTIVE_BACKORDERS",
  "message": "El producto tiene pedidos por reposición activos", "timestamp": "2026-11-20T21:12:56.365Z" }
```

Known limit: deleting a variant that has any backorder (even finished) is refused by the database with the generic relation error. Treat it like a variant that already has sales.

### Dev sample data

- `node scripts/dev-showcase/backorders.cjs --apply` (backend repo) creates in Centro 7 backorders on products with SKU `DEMO-BO-*`: `GATO` → WAITING head with `passedOverCount` 1, RESERVED, WAITING behind; `SHAMPOO` → CONFIRMED with its sale; `COLLAR` → EXPIRED, CANCELLED by the customer, CANCELLED by staff.
- The RESERVED sample expires about 21 h after the run (reminder ~18 h).
- `manager@houndfe.com` (Centro) has read/update:Backorder; `cashier@houndfe.com` has read.

Backend session notes (2026-11-20): T5 in backend main 0c337060 on dev :3003 with independent verify approved. Samples BO-000001 WAITING (head, passedOverCount 1), BO-000002 RESERVED, BO-000003 WAITING, BO-000004 CONFIRMED (sale A-202611-000081), BO-000005 EXPIRED, BO-000006 CANCELLED by customer, BO-000007 CANCELLED by staff; GET /backorders total 7, counts {WAITING 2, RESERVED 1, CONFIRMED 1, EXPIRED 1, CANCELLED 2}. Product «Alimento Gato Senior 7 kg (demo reposición)»: stockOnHand 3, reservedForBackorders 2, availableToSell 1.
