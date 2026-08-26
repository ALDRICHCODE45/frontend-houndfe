# POS Payment Method Tiles Specification

Domain: `pos-payment-method-tiles` · POS selector for charging sales. The selector renders the four fixed tiles ("Efectivo", "Tarjeta crédito", "Tarjeta débito", "Transferencia") merged with the active custom methods returned by `GET /sales/payment-methods`, threads `paymentMethodId` into `PaymentEntry` for custom tiles only, and degrades gracefully when the projection is empty or fails.

## Purpose

Let the cashier pick the exact destination they are charging to ("Transferencia BBVA", "Mercado Pago", "LINK EVO Crédito") instead of a generic category label, so the receipt and sale-detail carry the customer-facing name and the backend can snapshot that name immutably. The selector MUST keep the four fixed tiles intact for legacy flows, MUST tolerate a missing or empty projection (opt-in catalog), MUST keep the wire payload byte-identical for fixed tiles (no `paymentMethodId`), and MUST prevent two customs of the same `category` from colliding in the toggle / count / entries-list logic.

## Requirements

### REQ-PT-001: Tile identity — fixed vs custom never collide

A chosen payment method has TWO distinct identities that MUST NOT be conflated:
- **Wire category** = base category (`cash | card_credit | card_debit | transfer`); lives in `PaymentEntry.method` and the backend `metodo` field.
- **Selection key** = `paymentMethodId ?? method`; used by the grid `:key`, the entries list `:key`, the toggle matcher, and the count badge.

A **fixed** tile has `paymentMethodId === undefined`, so its selection key equals its base `method`. A **custom** tile has `paymentMethodId === <uuid>`, so its selection key equals that UUID. Two customs of the same `category` (e.g. "Transferencia BBVA" + "Transferencia AFIRME") MUST get different selection keys and MUST coexist as separate entries. The derivation MUST live in a single shared utility (`paymentMethodTileKey`) so the tiles grid, entries list, and toggle matcher cannot drift.

#### Scenario: fixed tile key equals its base method

- GIVEN the fixed tile "Efectivo"
- WHEN `paymentMethodTileKey(tile)` is invoked
- THEN it returns `"cash"` (the base method)
- AND `tile.paymentMethodId` is `undefined`

#### Scenario: custom tile key equals its UUID

- GIVEN a custom tile with `paymentMethodId: "uuid-1"`, `category: "transfer"`
- WHEN `paymentMethodTileKey(tile)` is invoked
- THEN it returns `"uuid-1"`
- AND NOT `"transfer"`

#### Scenario: two customs of the same category have distinct keys

- GIVEN two customs `Transferencia BBVA` (uuid-a) and `Transferencia AFIRME` (uuid-b), both `category: "transfer"`
- WHEN both tiles are added to the entries list
- THEN the list contains two separate entries
- AND each entry's key is its respective UUID
- AND toggling one does NOT remove the other

#### Scenario: fixed matcher requires `paymentMethodId === undefined`

- GIVEN the fixed tile "Transferencia" and a custom entry `{ method: "transfer", paymentMethodId: "uuid-a" }`
- WHEN `entryMatchesTile(customEntry, fixedTile)` is invoked
- THEN it returns `false` (the fixed branch requires `entry.paymentMethodId === undefined`)
- AND toggling the fixed tile does NOT touch the custom entry

### REQ-PT-002: `PaymentEntry` and `LegacyChargePayload` thread `paymentMethodId`

`PaymentEntry` (charge + debt modal) and `LegacyChargePayload` (single-payment charge flattening per design §1.3) MUST accept an optional `paymentMethodId?: string` field. Fixed-tile entries MUST omit the field (legacy payload byte-identical to pre-change). Custom-tile entries MUST include the field with the tile's UUID. The base `method` MUST stay populated with the tile's base category so backend category-match validation passes; the `paymentMethodId` is additive, never a replacement.

#### Scenario: fixed entry omits `paymentMethodId`

- GIVEN the cashier toggles on the fixed "Efectivo" tile
- WHEN the entry is constructed
- THEN the entry is `{ method: "cash", amountCents: N }`
- AND `paymentMethodId` is absent
- AND the wire payload hash matches the pre-change shape (legacy compatibility)

#### Scenario: custom entry includes `paymentMethodId`

- GIVEN the cashier toggles on the custom "Mercado Pago" tile (uuid-x, category `transfer`)
- WHEN the entry is constructed
- THEN the entry is `{ method: "transfer", amountCents: N, paymentMethodId: "uuid-x" }`
- AND the base `method` equals the tile's base category

#### Scenario: legacy single-payment payload accepts the id

- GIVEN a single-entry custom charge (the legacy flattening shape)
- WHEN `buildPayload()` flattens the entry
- THEN the payload is `{ method: "transfer", amountCents: N, paymentMethodId: "uuid-x" }`
- AND the legacy shape is otherwise preserved

### REQ-PT-003: Projection fetch — read-only and gated by `read:Sale`

`GET /sales/payment-methods` SHALL be called from `useSalePaymentMethods` (`useQuery` wrapper). The fetch SHALL NOT be gated by `read:PaymentMethod` — backend enforces `read:Sale`, and a cashier who can reach the POS already holds `read:Sale`. The query SHALL use a generous `staleTime` (e.g. 5 minutes), SHALL NOT refetch on window focus, and SHALL be invoked when the charge modal opens (not at app boot). The endpoint URL and response shape MUST match backend §3.6: `{ id: string, name: string, category: PaymentMethodCategory, subtitle: string | null }[]`, only active rows, only the current tenant.

#### Scenario: query fires with the correct URL and tenant scope

- GIVEN the charge modal opens and a `tenantId` is resolved via `useSafeTenantId`
- WHEN `useSalePaymentMethods` is invoked
- THEN exactly one `GET /sales/payment-methods` fires
- AND the Authorization header carries the user JWT
- AND the projection is keyed on `saleQueryKeys.paymentMethods(tenantId)`

#### Scenario: only active rows reach the tile builder

- GIVEN the backend returns active rows only
- WHEN `buildMergedMethodOptions(projection)` runs
- THEN every projection row is mapped to a custom tile
- AND no inactive row appears in the grid (backend filter is authoritative)

#### Scenario: projection UUID guard

- GIVEN the projection includes a row whose `id` is NOT a valid UUID
- WHEN `buildMergedMethodOptions` runs
- THEN the row is dropped (a UUID-only guard prevents malformed ids from reaching `PaymentEntry.paymentMethodId`)
- AND no error is surfaced to the cashier

### REQ-PT-004: Tile grid merges fixed + custom

`PaymentModal` and `DebtPaymentModal` SHALL compute their `methodOptions` from `[...FIXED_METHOD_OPTIONS, ...projection.map(toCustomTile)]` so the grid renders the four fixed tiles followed by every active custom method. The grid SHALL keep the existing 2x2 layout, icon derivation from `PAYMENT_METHOD_CATEGORY_ICONS[category]`, and toggle/count/entries-list wiring — the only surface change is the switch from `method`-keyed to tile-identity-keyed behavior per design §1.4.

#### Scenario: merged grid renders fixed then custom

- GIVEN a projection with 2 active customs and a charge modal opens
- WHEN the grid renders
- THEN it shows 4 fixed tiles followed by 2 custom tiles
- AND the order is `[Efectivo, Tarjeta crédito, Tarjeta débito, Transferencia, <custom-1>, <custom-2>]`

#### Scenario: toggle, count, and entries list use tile identity

- GIVEN the cashier taps a custom tile twice in a row
- WHEN `toggleMethod(tile)` runs both times
- THEN the first tap adds the entry (count badge shows `1`)
- AND the second tap removes it (count badge shows `0`)
- AND `getMethodCount(entries, tile)` uses the tile's identity (UUID for custom, `method` for fixed)

#### Scenario: entries list key uses tile identity

- GIVEN two custom entries with different UUIDs but the same `category`
- WHEN the entries list renders
- THEN each row's `:key` is its `paymentMethodId`
- AND no row collision or render warning appears

### REQ-PT-005: Empty projection — only the four fixed tiles, no warning

When the projection returns `[]` (or is omitted because the tenant has no customs configured), the grid SHALL render only the four fixed tiles with no warning text, no empty-state banner, and no toast. The cashier SHALL still be able to charge via the fixed tiles exactly as before this change.

#### Scenario: empty projection renders fixed-only

- GIVEN the cashier opens the charge modal and `GET /sales/payment-methods` returns `[]`
- WHEN the grid renders
- THEN exactly 4 tiles are shown: Efectivo, Tarjeta crédito, Tarjeta débito, Transferencia
- AND no warning, empty-state banner, or "configura tu catálogo" message is shown

#### Scenario: charge flow remains usable with empty projection

- GIVEN an empty projection
- WHEN the cashier selects a fixed tile and submits the charge
- THEN the charge proceeds with the legacy payload (`{ method, amountCents }`, no `paymentMethodId`)
- AND no error or warning interrupts the flow

### REQ-PT-006: Projection error — degrade silently to fixed-only

When the projection fetch fails (403, 5xx, network, timeout), the charge modal SHALL render the four fixed tiles only and SHALL NOT block the charge. The modal SHALL NOT surface a toast or a blocking error. This is deliberate: a failed catalog fetch must never stop a cashier from collecting a payment.

#### Scenario: 403 on projection fetch

- GIVEN `GET /sales/payment-methods` returns 403
- WHEN the grid renders
- THEN only the 4 fixed tiles are shown
- AND no toast or blocking error is shown
- AND charging via a fixed tile still succeeds

#### Scenario: 5xx / network error on projection fetch

- GIVEN `GET /sales/payment-methods` fails with a 500 or a network error
- WHEN the grid renders
- THEN only the 4 fixed tiles are shown
- AND the existing charge mutation proceeds unaffected

### REQ-PT-007: Subtitle grey sub-line (when present and trimmed)

Each custom tile SHALL render `name` as the primary label and `subtitle` as a secondary grey sub-line when `subtitle` is a non-empty string after trimming. When `subtitle` is `null`, missing, or whitespace-only, the sub-line MUST NOT render (no empty grey space, no "—" placeholder). Fixed tiles have no subtitle.

#### Scenario: custom tile with subtitle renders the sub-line

- GIVEN a custom tile `{ name: "Mercado Pago", subtitle: "Link" }`
- WHEN the tile renders
- THEN the label "Mercado Pago" renders
- AND a grey sub-line containing "Link" renders below it

#### Scenario: custom tile without subtitle hides the sub-line

- GIVEN a custom tile `{ name: "Efectivo USD", subtitle: null }`
- WHEN the tile renders
- THEN only the label "Efectivo USD" renders
- AND no sub-line element is present (no empty grey space)

#### Scenario: whitespace-only subtitle hides the sub-line

- GIVEN a custom tile `{ name: "Foo", subtitle: "   " }`
- WHEN the tile renders
- THEN only the label renders
- AND the trimmed-empty sub-line is treated as absent

### REQ-PT-008: POS does NOT require `read:PaymentMethod`

A user holding `read:Sale` (the standard POS cashier permission) SHALL see the custom-method tiles without any additional permission. The CASL gating for the POS selector MUST NOT branch on `PaymentMethod`. The admin route `/admin/payment-methods` continues to gate on `read:PaymentMethod` (REQ-PM-006); only the POS selector is exceptioned.

#### Scenario: cashier with only `read:Sale` sees custom tiles

- GIVEN a user with `read:Sale` and NO `read:PaymentMethod`
- WHEN the charge modal opens
- THEN `GET /sales/payment-methods` fires (backend allows because `read:Sale` is held)
- AND the custom tiles render alongside the fixed tiles
- AND no 403 is surfaced to the cashier

#### Scenario: same user sees no admin sidebar entry

- GIVEN the same user (no `read:PaymentMethod`)
- WHEN the sidebar renders
- THEN no "Métodos de cobro" entry is shown (admin gating remains in effect)

