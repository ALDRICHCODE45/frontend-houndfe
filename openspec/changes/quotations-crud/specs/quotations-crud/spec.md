# Delta for Quotations Management

## ADDED Requirements

### REQ-QTN-001: Navigation & Routing
"Cotizaciones" sidebar item MUST appear for users with `read:Quotation`. Routes CASL-guarded via meta `permission: [action, 'Quotation']`. Routes: `/pos/cotizaciones` (list, read), `/pos/cotizaciones/nueva` (create, create), `/pos/cotizaciones/:id` (detail, read). Sidebar hidden, routes forbidden without required permission.

### REQ-QTN-002: List View
Paginated list via `GET /quotations` with status, customer, search, sortBy/sortOrder filters. Uses `AppDataTable` with `useServerTable`. States: skeleton during load, descriptive empty when zero results, error + retry on failure.

### REQ-QTN-003: Create Draft
`POST /quotations/drafts` with optional `customerId`. Backend auto-seeds price list from customer. Button hidden without `create:Quotation`. With customer → draft has customer + price list. Without → `globalPriceListId: null`.

### REQ-QTN-004: Customer & Price List Assignment
DRAFT only. Assign/change customer: `PUT /quotations/drafts/:id/customer` auto-seeds price list unless explicitly set. Change/clear price list: `PUT /quotations/drafts/:id/price-list`; CUSTOM items excluded from re-pricing. Controls hidden for non-DRAFT.

### REQ-QTN-005: Item Management
DRAFT only. Add: `POST /quotations/drafts/:id/items` (productId, optional variantId, qty ≥ 1). Change qty: `PATCH .../items/:itemId/quantity`. Remove: `DELETE .../items/:itemId`. Qty < 1 → validation error. All return full quotation with recalculated totals.

### REQ-QTN-006: Price Override
DRAFT only. `PATCH /quotations/drafts/:id/items/:itemId/price` with `unitPriceCents ≥ 0`. Negative → error. Overridden items marked `priceSource: 'CUSTOM'`, immune to re-pricing, show ✏️ visual indicator.

### REQ-QTN-007: Promotions (Manual & Veto)
DRAFT only. Manual: `PUT/DELETE .../manual-promotions/:promoId`. Veto: `POST/DELETE .../promotions/:promoId/veto`. Totals recalculate after each action. Manual promos must be type MANUAL. Veto applies to AUTOMATIC promos; undo re-evaluates.

### REQ-QTN-008: Expiry Management
DRAFT only. `PATCH /quotations/drafts/:id/expiry` with `expiresAt` (ISO 8601 or null). Null = never expires. Lazy EXPIRED detection: `status === 'SENT' && expiresAt < now` → display as EXPIRED.

### REQ-QTN-009: PDF Preview
`GET /quotations/:id/pdf?format=quotation-a4` — works in all statuses. Blob fetch → `URL.createObjectURL` → `window.open(_blank)` → revoke after 1s. Popup blocked → anchor download fallback. 400/500 → error toast.

### REQ-QTN-010: Send Flow
`POST /quotations/drafts/:id/send`. Pre-validation: `items.length > 0`, `customer.email != null`. Success → SENT + toast. 422 no items → validation message. 422 no email → email capture dialog. 502 (Resend fail) → retry toast, stays DRAFT. `email=false` → SENT without email.

### REQ-QTN-011: Cancel Flow
`POST /quotations/drafts/:id/cancel` with required `cancelReason`: `CUSTOMER_REQUEST | PRICE_OBJECTION | EXPIRED | OTHER`. No reason → blocked. Success → CANCELLED with reason saved.

### REQ-QTN-012: Read-Only Detail View
SENT/EXPIRED/CANCELLED quotations MUST render without edit controls. All item/customer/price-list/promo/send/cancel actions hidden. PDF preview remains available. CANCELLED displays `cancelReason`. EXPIRED shows expired badge (lazy or server-computed).

### REQ-QTN-013: Stock Badges
Advisory only — never blocks any action. Informational label on items when stock data is available. Low or zero stock shows badge but all actions remain enabled. No validation or reservation logic.

### REQ-QTN-014: Permissions (CASL)
`APP_SUBJECTS` MUST include `'Quotation'` with actions `create | read | update | delete`. Route meta uses `permission: [action, 'Quotation']`. UI hides controls lacking the required permission. Navigation item gated by `read:Quotation`.

### REQ-QTN-015: Cache Management (TanStack Query)
After every mutation, cache MUST be updated via `queryClient.setQueryData` with the complete backend response. Keys: `['quotations', tenantId, 'list']`, `['quotations', tenantId, 'detail', id]`. Mutations use `useMutation` with `onSuccess` replacing cached state.

### REQ-QTN-016: Loading, Empty & Error States
Every view MUST handle: loading (skeleton/spinner via `isLoading`), empty (descriptive message when zero results), error (message + retry via `isError`). Mutations SHALL show success/error toast via `useToast()`.

### REQ-QTN-017: Anti-Requirements
MUST NOT implement: CONVERTED_TO_SALE state (no UI, API, tests); stock validation/reservation; WebSocket/real-time updates; batch operations (bulk send/cancel/select) in MVP.
