# Design — custom-payment-methods (Métodos de cobro)

> Phase: `sdd-design` · Store: `openspec` · Change id: `custom-payment-methods`
> Authoritative inputs: `proposal.md`, `exploration.md`, and
> `houndfe-backend/docs/payment-methods-frontend.md` (backend contract wins on wire shapes).

This document locks the contracts for the custom-payment-methods frontend integration. It is
written against the existing `payment-details` admin module (the structural template) and the two
POS charge modals (`PaymentModal.vue`, `DebtPaymentModal.vue`). The single most important contract
is the **payment-method tile identity** in §1 — it resolves the inherited collision risk that two
custom methods of the same `category` would otherwise collide with the current `method`-keyed
toggle/count/entry mapping.

---

## 1. Locked decision — payment-method tile identity (resolves inherited risk #1)

### 1.1 Two distinct identities, never conflated

A chosen payment method has **two** identities that must stay separate:

| Identity | Value | Where it lives | Purpose |
| --- | --- | --- | --- |
| **Wire category** | `method` = base category (`cash` \| `card_credit` \| `card_debit` \| `transfer`) | `PaymentEntry.method`, backend `metodo` field | Backend contract + aggregation |
| **Selection key** | `paymentMethodId ?? method` | tiles grid `:key`, entries list `:key`, toggle matcher, count badge | Uniquely identify the chosen tile |

- A **fixed** tile (the legacy 4) has `paymentMethodId === undefined`, so its selection key is its
  base `method` — this preserves the existing single-selection-per-method UX byte-for-byte.
- A **custom** tile has `paymentMethodId === <uuid>`, so its selection key is the UUID — two customs
  of the same `category` (e.g. "Transferencia BBVA" + "Transferencia AFIRME") get **different**
  keys and no longer collide.

### 1.2 Single source of truth

A new shared util owns the identity derivation so the tiles grid, the "Pagos agregados" entries
list, and the count badges **cannot** drift:

`src/features/POS/sales/utils/paymentMethodTile.utils.ts` (NEW)

```ts
import type { ActivePaymentMethodProjection, CollectionPaymentMethod, PaymentEntry } from '../interfaces/sale.types'
import { PAYMENT_METHOD_CATEGORY, PAYMENT_METHOD_CATEGORY_ICONS } from '@/core/shared/constants/payment-method-category'

// ── Tile model ────────────────────────────────────────────────────────────────
export interface FixedPaymentMethodTile {
  kind: 'fixed'
  value: CollectionPaymentMethod          // base category == method
  label: string                           // 'Efectivo' | 'Tarjeta crédito' | ...
  icon: string                            // CATEGORY_ICON_MAP[value]
  paymentMethodId: undefined
}

export interface CustomPaymentMethodTile {
  kind: 'custom'
  value: CollectionPaymentMethod          // == projection.category
  label: string                           // projection.name (catalog name)
  icon: string                            // CATEGORY_ICON_MAP[projection.category]
  subtitle: string | null                 // projection.subtitle (nullable)
  paymentMethodId: string                 // projection.id (UUID)
}

export type PaymentMethodTile = FixedPaymentMethodTile | CustomPaymentMethodTile

export const FIXED_METHOD_OPTIONS: readonly FixedPaymentMethodTile[] = [ /* 4 fixed tiles */ ]

export function toCustomTile(m: ActivePaymentMethodProjection): CustomPaymentMethodTile { /* ... */ }

export function buildMergedMethodOptions(
  customs: ActivePaymentMethodProjection[],
): PaymentMethodTile[] {
  return [...FIXED_METHOD_OPTIONS, ...customs.map(toCustomTile)]
}

// ── THE key derivation (single source) ────────────────────────────────────────
export function paymentMethodTileKey(tile: PaymentMethodTile): string {
  return tile.paymentMethodId ?? tile.value
}

export function paymentEntryKey(entry: PaymentEntry): string {
  return entry.paymentMethodId ?? entry.method
}

// ── Matching (toggle + count + entries list all use this) ─────────────────────
export function entryMatchesTile(entry: PaymentEntry, tile: PaymentMethodTile): boolean {
  if (tile.kind === 'custom') return entry.paymentMethodId === tile.paymentMethodId
  // CRITICAL: fixed matching requires NO id, so a custom entry with the same base
  // category never collides with the fixed 'Transferencia' / 'Tarjeta' tile.
  return entry.paymentMethodId === undefined && entry.method === tile.value
}

export function findEntryIndex(
  entries: readonly PaymentEntry[],
  tile: PaymentMethodTile,
): number {
  return entries.findIndex((e) => entryMatchesTile(e, tile))
}

export function getMethodCount(
  entries: readonly PaymentEntry[],
  tile: PaymentMethodTile,
): number {
  // Each identity maps to at most one entry → 0 or 1 (equivalent to legacy for fixed).
  return findEntryIndex(entries, tile) >= 0 ? 1 : 0
}

export function findTileForEntry(
  tiles: readonly PaymentMethodTile[],
  entry: PaymentEntry,
): PaymentMethodTile | undefined {
  return tiles.find((t) => entryMatchesTile(entry, t))
}
```

### 1.3 Why `PaymentEntry` keeps `method` AND gains `paymentMethodId`

`PaymentEntry.method` is **not replaced** — it remains the base category that the backend `metodo`
wire contract expects and that aggregation/`CARD_METHODS`/`entryNeedsReference` rely on. The new
optional `paymentMethodId` is additive and default-`undefined`:

```ts
export interface PaymentEntry {
  method: CollectionPaymentMethod
  amountCents: number
  reference?: string
  paymentMethodId?: string   // present ONLY for custom tiles; omitted for legacy/fixed
}
```

Consequences (and how the two coexist):

- **Fixed entry** → `{ method: 'transfer', amountCents: N }`. `paymentEntryKey` → `'transfer'`.
  Legacy payload stays byte-identical (no new key on the wire).
- **Custom entry** → `{ method: 'transfer', amountCents: N, paymentMethodId: '<uuid>' }`.
  `paymentEntryKey` → `'<uuid>'`. The `method` value still equals the method's `category`, so the
  backend category-match validation passes and `metadataJson.catalog` is written.

### 1.4 Toggle / count / entries-list wiring (both modals)

Every surface switches from `method`-keyed to **tile-identity**-keyed:

| Surface | Before | After |
| --- | --- | --- |
| Grid `:key` | `option.value` | `paymentMethodTileKey(option)` |
| Grid click | `toggleMethod(option.value)` | `toggleMethod(option)` (whole tile) |
| Grid badge count | `getMethodCount(option.value)` | `getMethodCount(entries, option)` |
| Grid testid | `payment-method-tile-${option.value}` | fixed keeps `payment-method-tile-${option.value}`; custom uses `payment-method-tile-custom-${option.paymentMethodId}` |
| Entries list `:key` | `entry-${index}` | `paymentEntryKey(entry)` |
| Entries list label | `formatPaymentMethod(entry.method.toUpperCase())` | `resolveEntryDisplay(entry, tiles).label` (catalog name when custom) |
| Entries list icon | `methodIconMap[entry.method]` | `PAYMENT_METHOD_CATEGORY_ICONS[entry.method]` |

`toggleMethod(tile)` / `handleMethodToggle(tile)` both become:

```ts
function toggleMethod(tile: PaymentMethodTile): void {
  const idx = findEntryIndex(entries, tile)
  if (idx >= 0) {
    entries = removeEntry(entries, idx)              // toggle OFF
  } else if (canAddEntry) {
    entries = addEntry(entries, tile.value, totalCents, tile.paymentMethodId) // toggle ON
  }
}
```

The fixed-vs-custom matcher in §1.2 guarantees the legacy single-selection-per-method behavior for
the fixed 4 tiles (toggling "Transferencia" never touches a custom "transfer" entry, and vice
versa), while allowing two custom methods of the same category to coexist as two separate entries.

---

## 2. Data contracts — Zod schemas / DTO shapes (derived exactly from backend)

### 2.1 Shared category primitive (cross-feature, no reinvention)

`src/core/shared/constants/payment-method-category.ts` (NEW) is the single source for the catalog
enum values + label + icon maps. Both the admin module and the POS module import it; the wire value
is identical in both (`cash | card_credit | card_debit | transfer`, lowercase, **no `credit`**).

```ts
export const PAYMENT_METHOD_CATEGORY = {
  CASH: 'cash',
  CARD_CREDIT: 'card_credit',
  CARD_DEBIT: 'card_debit',
  TRANSFER: 'transfer',
} as const

export type PaymentMethodCategory =
  (typeof PAYMENT_METHOD_CATEGORY)[keyof typeof PAYMENT_METHOD_CATEGORY]

export const PAYMENT_METHOD_CATEGORY_VALUES = [
  PAYMENT_METHOD_CATEGORY.CASH,
  PAYMENT_METHOD_CATEGORY.CARD_CREDIT,
  PAYMENT_METHOD_CATEGORY.CARD_DEBIT,
  PAYMENT_METHOD_CATEGORY.TRANSFER,
] as const

export const PAYMENT_METHOD_CATEGORY_LABELS: Record<PaymentMethodCategory, string> = {
  cash: 'Efectivo',
  card_credit: 'Tarjeta de crédito',
  card_debit: 'Tarjeta de débito',
  transfer: 'Transferencia',
}

export const PAYMENT_METHOD_CATEGORY_ICONS: Record<PaymentMethodCategory, string> = {
  cash: 'i-lucide-banknote',
  card_credit: 'i-lucide-credit-card',
  card_debit: 'i-lucide-wallet-cards',
  transfer: 'i-lucide-arrow-right-left',
}
```

> The per-module "homonym guardrail" (`sale.constants.ts` header) does **not** forbid this shared
> module: `PAYMENT_METHOD_CATEGORY` is a *single* lowercase enum with no cross-module homonym, and
> the existing `PAYMENT_METHOD` (which includes `credit`) remains untouched in
> `sale.constants.ts`. Pin tests in both modules freeze the 4 values against drift.

### 2.2 Admin types — `src/features/admin/payment-methods/interfaces/payment-method.types.ts`

```ts
import { z } from 'zod'
import { PAYMENT_METHOD_CATEGORY_VALUES, type PaymentMethodCategory } from '@/core/shared/constants/payment-method-category'

// ── Form schemas ──────────────────────────────────────────────────────────────
const CategoryFieldSchema = z.enum(PAYMENT_METHOD_CATEGORY_VALUES, {
  message: 'Selecciona una categoría válida',
})

const NameFieldSchema = z
  .string({ required_error: 'El nombre es obligatorio' })
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(60, 'El nombre no puede superar 60 caracteres')

const SubtitleFieldSchema = z
  .string()
  .trim()
  .max(120, 'El subtítulo no puede superar 120 caracteres')
  .optional()

export const CreatePaymentMethodSchema = z.object({
  name: NameFieldSchema,
  category: CategoryFieldSchema,
  subtitle: SubtitleFieldSchema,   // optional; empty string normalized to omit (§8.1)
})

export const UpdatePaymentMethodSchema = z.object({
  name: NameFieldSchema.optional(),
  category: CategoryFieldSchema.optional(),
  subtitle: SubtitleFieldSchema,   // already optional
  isActive: z.boolean().optional(), // REVERSAL vs PaymentDetail: reactivation IS editable
})

export type CreatePaymentMethodFormValues = z.infer<typeof CreatePaymentMethodSchema>
export type UpdatePaymentMethodFormValues = z.infer<typeof UpdatePaymentMethodSchema>
```

> **`isActive` REVERSAL (locked).** `UpdatePaymentMethodSchema` **includes** `isActive: z.boolean()`.
> This is the one deliberate structural difference from `PaymentDetail`. Do **not** copy
> `filterAllowedKeys` from `payment-details.api.ts`.

```ts
// ── Response DTO (exact backend shape) ────────────────────────────────────────
export interface PaymentMethodResponse {
  id: string
  tenantId: string
  name: string
  category: PaymentMethodCategory
  subtitle: string | null            // null when not provided
  isActive: boolean
  createdAt: string                  // ISO 8601
  updatedAt: string                  // ISO 8601
}

export interface PaymentMethodTableRow extends PaymentMethodResponse {}

// ── Request shapes (whitelisted; nothing else crosses the wire) ───────────────
export interface CreatePaymentMethodRequest {
  name: string
  category: PaymentMethodCategory
  subtitle?: string                  // absent when empty/whitespace (backend stores null)
  // NO isActive, NO id/tenantId/createdAt/updatedAt/metadataJson (forbidNonWhitelisted)
}

export interface UpdatePaymentMethodRequest {
  name?: string
  category?: PaymentMethodCategory
  subtitle?: string
  isActive?: boolean                 // REVERSAL: forwarded (reactivation), never stripped
  // tenantId NEVER sent
}

// ── Label maps ────────────────────────────────────────────────────────────────
export const PAYMENT_METHOD_STATUS_LABELS = { active: 'Activo', inactive: 'Inactivo' } as const
export function paymentMethodStatusLabel(isActive: boolean): string {
  return isActive ? PAYMENT_METHOD_STATUS_LABELS.active : PAYMENT_METHOD_STATUS_LABELS.inactive
}
```

A small pure `normalizeSubtitle(subtitle: string | undefined): string | undefined` (trim; empty →
`undefined`) is applied when the slideover emits the payload, so an empty subtitle is omitted from
the wire rather than sent as `''`.

### 2.3 POS projection + charge/detail extensions — `sale.types.ts`

```ts
// GET /sales/payment-methods — read:Sale, active only, ordered by name
export interface ActivePaymentMethodProjection {
  id: string                          // UUID → becomes PaymentEntry.paymentMethodId
  name: string
  category: PaymentMethodCategory     // structurally identical to CollectionPaymentMethod
  subtitle: string | null
}

// PaymentEntry (charge + debt)
export interface PaymentEntry {
  method: CollectionPaymentMethod
  amountCents: number
  reference?: string
  paymentMethodId?: string            // NEW — optional; see §1.3 for key coexistence
}

// LegacyChargePayload gains the same optional field because buildPayload() flattens a
// single-entry charge into the legacy single-payment shape (backend §7.1 accepts
// paymentMethodId in BOTH shapes).
export interface LegacyChargePayload {
  method: PaymentMethod
  amountCents: number
  dueDate?: string
  paymentMethodId?: string            // NEW
}

// SaleDetailPayment — 3 optional catalog fields (absent in legacy rows)
export interface SaleDetailPayment {
  method: SaleDetailPaymentMethod     // base UPPERCASE category stays populated
  amountCents: number
  tenderedCents: number
  changeCents: number
  reference: string | null
  paidAt: string
  paymentId: string
  paymentMethodId?: string            // NEW
  paymentMethodName?: string          // NEW — preferred display label
  paymentMethodSubtitle?: string      // NEW — grey sub-line
}

// PAYMENT_RECEIVED timeline member — same 3 optional fields
//   { type: 'PAYMENT_RECEIVED'; ...; method; amountCents; reference;
//     paymentMethodId?; paymentMethodName?; paymentMethodSubtitle? }
```

Display rule (single place per surface): **`paymentMethodName ?? baseLabel`**; render
`paymentMethodSubtitle` (truthy, trimmed) as a grey sub-line.

---

## 3. Per-component split + single-responsibility justification

### 3.1 Admin module — `src/features/admin/payment-methods/` (mirrors `payment-details`)

| File | Responsibility | Why it is separate |
| --- | --- | --- |
| `interfaces/payment-method.types.ts` | Zod schemas, DTO/request types, label maps | Single source for validation + wire shapes; pin-testable in isolation |
| `interfaces/errors.ts` | `PaymentMethodDomainErrorCode`, `PAYMENT_METHOD_ERROR_MAP`, `extractPaymentMethodErrorCode` | Error classification owns no HTTP/UI; mirrors payment-details §1.3 |
| `api/payment-methods.api.ts` | `paymentMethodsApi` (list/getById/create/update/remove) + pure `applyLocalPaymentMethodFilters` / `paginatePaymentMethods` | HTTP boundary + client-side list projection (flat array → `PaginatedResponse`) |
| `composables/usePaymentMethodsTable.ts` | Single-source wrapper over `useServerTable` + `fullList` | ONE fetch drives table + derived flags (no banner required) |
| `composables/usePaymentMethodColumns.ts` | `TableColumn<PaymentMethodTableRow>[]` | Structural columns only; cell rendering stays in the view |
| `composables/usePaymentMethodForm.ts` | `createState` / `editState`, `schema` by mode, `setValues`, per-field setters | Form state + prefilling (incl. `isActive` in edit) owns no DOM |
| `composables/usePaymentMethodViewMode.ts` | `table`/`card` toggle + `displayMode` bridge | View-mode persistence is orthogonal to data + form |
| `components/PaymentMethodUpsertSlideover.vue` | Create/edit slideover: category select, optional subtitle, edit-mode `isActive` toggle; emits `create`/`edit` | Capture/validate/emit; parent owns the mutation |
| `components/PaymentMethodCardGrid.vue` | Presentational card grid (skeleton/empty/grid) | Pure rendering + `card-click` forwarding; no mutation/permission logic |
| `utils/payment-method-actions.utils.ts` | `buildPaymentMethodDeactivateDescription` + `buildPaymentMethodRowActions` | Pure copy/action builders; no store/HTTP coupling |
| `views/AdminPaymentMethodsView.vue` | Route composition surface: inline mutations, CASL gating, ConfirmModal, AppDataTable wiring | Orchestration only; no field/card markup |

### 3.2 POS + sale detail — `src/features/POS/sales/`

| File | Responsibility | Why it is separate |
| --- | --- | --- |
| `utils/paymentMethodTile.utils.ts` (NEW) | Tile identity keying, merging, matching, `resolveEntryDisplay`, UUID guard | **The** single source of the §1 identity contract (prevents re-drift) |
| `utils/paymentMethodChargeErrors.utils.ts` (NEW) | `PaymentMethodChargeErrorCode` + `PAYMENT_METHOD_CHARGE_ERROR_MAP` + action resolver | Isolated from legacy `salePaymentErrors.utils.ts` (proposal risk #7) |
| `composables/useSalePaymentMethods.ts` (NEW) | `useQuery` over `GET /sales/payment-methods` | Owns the POS projection fetch lifecycle |
| `api/sale.api.ts` (MOD) | `getPaymentMethods()` | One method per endpoint convention |
| `utils/paymentEntries.utils.ts` (MOD) | `createEntry`/`addEntry` thread `paymentMethodId` | Entry construction stays in the shared entry util |
| `components/PaymentModal.vue` (MOD) | Merged tile options, tile-aware toggle/count, thread id through `normalizeEntries`/`buildPayload`, `catalogClearSignal` watcher | Charge modal remains the only place the charge payload is built |
| `components/DebtPaymentModal.vue` (MOD) | Same tile treatment; preserve id in `normalizedPayments` | Debt modal owns its own entry state |
| `components/PaymentsListSection.vue` (MOD) | Prefer `paymentMethodName` + grey `paymentMethodSubtitle` | Presentational snapshot display |
| `components/SaleDetailTimeline.vue` (MOD) | `PAYMENT_RECEIVED` prefers name + subtitle sub-line | Timeline label/sub-line rendering |
| `views/SalesView.vue` (MOD) | Charge error dispatch intercept + `catalogClearSignal` to `PaymentModal` | Owns the normal-sale charge mutation + modal orchestration |
| `composables/useDebtPayment.ts` (MOD) | Debt charge catalog-error dispatch + `catalogClearSignal` | Owns debt-payment mutation + error surfacing |

### 3.3 Cross-cutting

| File | Responsibility |
| --- | --- |
| `src/core/shared/constants/payment-method-category.ts` (NEW) | Category enum values + labels + icons (admin + POS) |
| `src/core/shared/constants/query-keys.ts` (MOD) | `adminPaymentMethodQueryKeys` + `saleQueryKeys.paymentMethods` |
| `auth/interfaces/auth.types.ts`, `auth/authorization/ability.ts`, `admin/roles/i18n/permissions.ts` (MOD) | CASL subject registration |
| `app/router/index.ts`, `app/navigation/navigation.registry.ts` (MOD) | Route + sidebar entry |

---

## 4. TanStack Query keys + cache invalidation

### 4.1 Exact keys — `query-keys.ts`

```ts
// Admin CRUD — mirrors adminPaymentDetailQueryKeys verbatim
export const adminPaymentMethodQueryKeys = {
  list: (tenantId: string) => ['admin', 'payment-methods', tenantId, 'list'] as const,
  detail: (tenantId: string, id: string) =>
    ['admin', 'payment-methods', tenantId, 'detail', id] as const,
}

// In saleQueryKeys:
paymentMethods: (tenantId: string) => ['sales', tenantId, 'payment-methods'] as const,
```

`useServerTable` appends `serverParams` to the `list` key (`[...list(tenantId), serverParams]`), so
`invalidateQueries({ queryKey: adminPaymentMethodQueryKeys.list(tenantId) })` prefix-matches all
page/filter/sort slots in one call — same contract as `payment-details` REQ-PD-007.

### 4.2 Invalidation

| Event | Invalidate / mutate | Note |
| --- | --- | --- |
| Admin create/update/delete success | `invalidateQueries({ queryKey: adminPaymentMethodQueryKeys.list(tenantId) })` | Re-fetches the flat list (active + inactive) |
| POS projection fetch | `useSalePaymentMethods` with `staleTime: 5 * 60_000`, `refetchOnWindowFocus: false` | Static per tenant; no admin↔POS cross-cache invalidation (proposal out-of-scope) |
| Charge / add-payment success | existing `saleQueryKeys.detail` + `saleQueryKeys.confirmed` invalidation (already in `useDebtPayment`; charge evicts the draft in `useSalesDrafts`) | Catalog projection is **not** invalidated — snapshot semantics make it unnecessary |
| Charge catalog error (`PAYMENT_METHOD_NOT_FOUND` / `INACTIVE_PAYMENT_METHOD`) | `invalidateQueries({ queryKey: saleQueryKeys.paymentMethods(tenantId) })` | Refreshes the selector because the catalog changed mid-selection |

---

## 5. Permission matrix + CASL registration

| Action | Endpoint | CASL verb | Subject |
| --- | --- | --- | --- |
| List / detail admin | `GET /admin/payment-methods[/:id]` | `read` | `PaymentMethod` |
| Create | `POST /admin/payment-methods` | `create` | `PaymentMethod` |
| Update / reactivate | `PATCH /admin/payment-methods/:id` | `update` | `PaymentMethod` |
| Deactivate (logical) | `DELETE /admin/payment-methods/:id` | `delete` | `PaymentMethod` |
| POS selector | `GET /sales/payment-methods` | `read` | **`Sale`** (NOT `PaymentMethod`) |

### 5.1 CASL insertion points (verified against source)

1. **`src/features/auth/interfaces/auth.types.ts`** — `AppSubject` union: insert
   `| 'PaymentMethod'` immediately **before `| 'all'`** (after the existing
   `| 'PaymentDetail'` at line 70).
2. **`src/features/auth/authorization/ability.ts`** — `APP_SUBJECTS: AppSubject[]`: insert
   `'PaymentMethod'` immediately **before `'all'`** (after `'PaymentDetail'` at line 28). Without
   this runtime entry, `parsePermissionCode` returns `null` for `*:PaymentMethod` and the ability
   silently drops the permission (same failure mode the `PaymentDetail` comment documents).
3. **`src/features/admin/roles/i18n/permissions.ts`**:
   - `SUBJECT_LABELS` (line 35 block): add `PaymentMethod: 'Métodos de cobro'`.
   - `PERMISSION_COPY` (line 83 block): add a `PaymentMethod` block with **exactly** the 4 CRUD
     actions (`create` / `read` / `update` / `delete`) — **no `manage`, no `batch_delete`**.
   - Do **NOT** add `PaymentMethod` to `HIDDEN_SUBJECTS`.

Copy for the `PERMISSION_COPY` block (neutral impersonal Spanish, matches the `PaymentDetail`
precedent):

```ts
PaymentMethod: {
  create: { label: 'Crear métodos de cobro', description: 'Dar de alta métodos de cobro personalizados de la sucursal.' },
  read:   { label: 'Ver métodos de cobro',    description: 'Listar los métodos de cobro de la sucursal.' },
  update: { label: 'Editar métodos de cobro', description: 'Modificar nombre, categoría, subtítulo o estado activo de un método.' },
  delete: { label: 'Desactivar métodos de cobro', description: 'Dar de baja un método. Deja de aparecer al cobrar; puede reactivarse.' },
},
```

### 5.2 POS gating

`useSalePaymentMethods` is **not** wrapped in a `read:PaymentMethod` check. The backend enforces
`read:Sale` on `GET /sales/payment-methods`; a cashier who can reach the POS already holds
`read:Sale`, so they see custom tiles with no extra permission. The route/menu gating for
`/admin/payment-methods` uses `read:PaymentMethod`; the create/edit/delete buttons gate on
`create/update/delete:PaymentMethod` via `authStore.userCan(...)` (mirrors `payment-details`).

---

## 6. Reused primitives (no reinvention)

| Primitive | Reused for | Why reuse instead of reinventing |
| --- | --- | --- |
| `AppDataTable` + `SortableHeader` | Admin list table | Identical v-model/props/slots contract as `payment-details` |
| `StatusDotBadge` + `activityToBadgeTone` | Activo/Inactivo badge | Single badge tone source; only label differs |
| `ConfirmModal` | Deactivate confirmation | Already owns open/loading/confirm contract |
| `AdminPageHeader` | `/admin/payment-methods` header | Standard admin title/description |
| `ViewToggle` + `useViewMode` | table/card toggle | Reuse `usePaymentMethodViewMode` wrapper pattern |
| `useServerTable` | List single-source wrapper | Prefix-matched invalidation + pagination prefs |
| `createSimpleHeader` | Non-sortable `isActive`/`actions` columns | Already the codebase convention |
| `formatCentsMXN` | Timeline/amount rendering | Single MXN currency formatter |
| `normalizeApiError` / `DEFAULT_FALLBACK` | Generic admin/POS error fallback | Single defensive envelope parser |
| `useSafeTenantId` | `useSalePaymentMethods` tenant scoping | Same safe tenant resolution as `useDebtPayment` |
| `mountWithUApp` | Co-located component tests | Nuxt UI provider contexts already solved |

The `applyLocalPaymentDetailFilters` / `paginatePaymentDetails` helpers are **not imported
literally** — the domain differs (search `name` only; `category` label map; `subtitle` optional).
`payment-methods` re-implements the same *shape* (`applyLocalPaymentMethodFilters` +
`paginatePaymentMethods`) with its own search fields, per the proposal out-of-scope note.

---

## 7. Empty / loading / error states

### 7.1 Admin list (`AdminPaymentMethodsView`)

| State | Behavior |
| --- | --- |
| Loading | `AppDataTable :loading="isLoading"` skeleton; card grid renders 8 skeleton cards |
| Empty | `empty="No hay métodos de cobro"` (table empty state + card-grid empty state) |
| Error (list fetch) | Block via `normalizeApiError(error, 'No se pudieron cargar los métodos de cobro. Reintenta.')`; NOT a toast |
| Fetching (background) | `:fetching="isFetching"` (soft indicator) |

No "sin método activo" banner is required (unlike `payment-details`), because an empty/fully
inactive catalog is a valid opt-in state and the POS falls back to the 4 fixed tiles.

### 7.2 Admin slideover (`PaymentMethodUpsertSlideover`)

| State | Behavior |
| --- | --- |
| Create submit | Submit button `:loading="isSubmitting"`; on success closes + toast "Método creado"; on error stays open |
| Edit submit | Same; prefills from `props.paymentMethod` (incl. `isActive`) |
| Field validation | Inline per-field errors via `UForm` + zod (`name` 1..60, `category` enum, `subtitle` ≤120) |
| Edit-mode `isActive` | `USwitch`/`UToggle` bound to `editState.isActive` (reactivation) |

### 7.3 POS selector (both charge modals)

| State | Behavior |
| --- | --- |
| Projection loading | Fixed 4 tiles render immediately; custom tiles append when the query resolves (no blocking spinner) |
| Projection `[]` | Only the 4 fixed tiles; **no warning** (opt-in catalog — assumption #4) |
| Projection error (403/500/network) | Degrade to fixed-only tiles; charge remains usable; **no blocking error / no toast** |
| Selected custom tile | Tile highlighted + count badge; entry appears in "Pagos agregados" with catalog `name` + grey `subtitle` |

### 7.4 Sale detail + timeline

| Surface | Loading | Empty | Error |
| --- | --- | --- | --- |
| `PaymentsListSection` | `USkeleton` rows (`:loading`) | "Sin pagos registrados" | N/A (presentational; parent owns detail fetch error) |
| `SaleDetailTimeline` | N/A (renders from `timeline` prop) | N/A (empty timeline is a parent concern) | N/A |

---

## 8. Error handling contract

### 8.1 Admin (`/admin/payment-methods/*`)

`interfaces/errors.ts` (mirrors payment-details extractor — reads **only**
`error.response.data.error`):

```ts
export type PaymentMethodDomainErrorCode =
  | 'INVALID_NAME' | 'NAME_TOO_LONG' | 'INVALID_CATEGORY'
  | 'INVALID_SUBTITLE' | 'SUBTITLE_TOO_LONG'
  | 'DUPLICATE_NAME' | 'ENTITY_NOT_FOUND'

export const PAYMENT_METHOD_ERROR_MAP: Record<PaymentMethodDomainErrorCode, string> = {
  INVALID_NAME:       'El nombre es inválido.',
  NAME_TOO_LONG:      'El nombre no puede superar 60 caracteres.',
  INVALID_CATEGORY:   'La categoría seleccionada no es válida.',
  INVALID_SUBTITLE:   'El subtítulo es inválido.',
  SUBTITLE_TOO_LONG:  'El subtítulo no puede superar 120 caracteres.',
  DUPLICATE_NAME:     'Ya existe un método con ese nombre en esta sucursal.',
  ENTITY_NOT_FOUND:   'No encontrado.',
}
```

User-facing behavior per case:

| Code | HTTP | User-facing behavior |
| --- | --- | --- |
| `INVALID_NAME` / `NAME_TOO_LONG` | 400 | **Pre-validated client-side** by zod (`1..60`); server fallback → field toast. Slideover stays open. |
| `INVALID_CATEGORY` | 400 | Client select offers only the 4 valid options (no `credit`); server fallback → toast. |
| `INVALID_SUBTITLE` / `SUBTITLE_TOO_LONG` | 400 | **Pre-validated client-side** (`≤120`, trimmed); server fallback → toast. |
| `DUPLICATE_NAME` | 409 | Toast "Ya existe un método con ese nombre en esta sucursal."; **form stays open** (no debounce pre-check — delegated to backend). |
| `ENTITY_NOT_FOUND` | 404 | Toast "No encontrado." (ID missing or another tenant — never reveal presence). |

The view's `resolveMutationError(err, fallback)` short-circuits on a known domain code, else falls
back to `normalizeApiError` (same pipeline as `payment-details`).

### 8.2 Charge (`POST /sales/drafts/:id/charge`, `POST /sales/:id/payments`)

New isolated map — `src/features/POS/sales/utils/paymentMethodChargeErrors.utils.ts` (kept separate
from `salePaymentErrors.utils.ts` per proposal risk #7; matches only on `error` code):

```ts
export type PaymentMethodChargeErrorCode =
  | 'INVALID_PAYMENT_METHOD_ID'
  | 'PAYMENT_METHOD_CATEGORY_MISMATCH'
  | 'PAYMENT_METHOD_NOT_FOUND'
  | 'INACTIVE_PAYMENT_METHOD'

export interface PaymentMethodChargeErrorAction {
  clearCatalogSelection: boolean
  refetchSelector: boolean
  toast?: string   // undefined = silent (mismatch)
}

export const PAYMENT_METHOD_CHARGE_ERROR_MAP:
  Record<PaymentMethodChargeErrorCode, PaymentMethodChargeErrorAction> = {
  PAYMENT_METHOD_CATEGORY_MISMATCH: { clearCatalogSelection: true,  refetchSelector: false },
  PAYMENT_METHOD_NOT_FOUND:        { clearCatalogSelection: true,  refetchSelector: true,
                                     toast: 'Método de cobro no disponible.' },
  INACTIVE_PAYMENT_METHOD:         { clearCatalogSelection: true,  refetchSelector: true,
                                     toast: 'Este método fue desactivado.' },
  INVALID_PAYMENT_METHOD_ID:       { clearCatalogSelection: false, refetchSelector: false,
                                     toast: 'Método de cobro inválido.' },
}

export function getPaymentMethodChargeErrorAction(
  code: string | undefined,
): PaymentMethodChargeErrorAction | null
```

Dispatch order in **both** `SalesView.handleChargeDraft` and `useDebtPayment.onError`:

1. Call `getPaymentMethodChargeErrorAction(code)` **first**.
2. If non-null → handle it and **return** (do NOT fall through to the legacy
   `getSalePaymentErrorAction` dispatch).
3. Else → existing legacy charge/debt error handling unchanged.

| Code | HTTP | Exact behavior |
| --- | --- | --- |
| `PAYMENT_METHOD_CATEGORY_MISMATCH` | 400 | **Clear catalog selection silently — NO toast.** The modal removes every entry with `paymentMethodId` (custom entries) and keeps fixed entries; cashier re-chooses. |
| `PAYMENT_METHOD_NOT_FOUND` | 404 | Clear custom selection + `invalidateQueries({ queryKey: saleQueryKeys.paymentMethods(tenantId) })` + toast "Método de cobro no disponible." |
| `INACTIVE_PAYMENT_METHOD` | 409 | Clear custom selection + invalidate selector + toast "Este método fue desactivado." |
| `INVALID_PAYMENT_METHOD_ID` | 400 | Defensive toast only. **Client-side prevention**: `paymentMethodId` is sourced exclusively from `ActivePaymentMethodProjection.id`; `buildMergedMethodOptions` runs a UUID guard (`isUuidString(id)`) and drops non-UUID rows, so a malformed id cannot originate from the UI. |

### 8.3 Clear-selection signal (both modals)

- **Charge:** `SalesView` holds `catalogClearSignal = ref(0)`; passes it to `PaymentModal` as a prop.
  On a clear action, increment it; on `refetchSelector`, also invalidate the projection key.
  `PaymentModal` watches the prop and runs `entries.value = entries.value.filter(e => !e.paymentMethodId)`.
- **Debt:** `useDebtPayment` returns `catalogClearSignal = ref(0)` (incremented in `onError` for
  `clearCatalogSelection`; it also invalidates the projection key and toasts when specified).
  `DebtPaymentModal` watches it and runs the same custom-entry filter.

Both clear paths preserve the existing idempotency regeneration (the `entries` deep watcher already
regenerates the key on any entry change).

---

## 9. Data flow (selection → entry → payload → snapshot)

```
open modal
  └─ useSalePaymentMethods() → GET /sales/payment-methods (read:Sale) ──────────────► projection[]
       └─ buildMergedMethodOptions(projection) ──► [4 fixed, ...customs]   (methodOptions computed)

tap tile(tile)
  └─ toggleMethod(tile): findEntryIndex(entries, tile) ── key = paymentMethodId ?? method
       ├─ found → remove entry
       └─ not found → add entry { method: tile.value, amountCents, paymentMethodId?: tile.paymentMethodId }

submit
  └─ normalizeEntries()/normalizedPayments → PaymentEntry { method, amountCents, reference?, paymentMethodId? }
       └─ buildPayload(): single-entry custom → { method, amountCents, paymentMethodId }
          multi-entry → payments[] each carrying paymentMethodId when custom
              └─ chargeDraft / registerDebtPayment ── backend validates + snapshots
                    └─ metadataJson.catalog = { paymentMethodId, name, subtitle? }

sale detail / timeline (later read)
  └─ paymentMethodName ?? getMethodMeta(method).label   (+ grey paymentMethodSubtitle)
```

Fixed tiles omit `paymentMethodId` everywhere → legacy payloads stay byte-identical (idempotency
hash unchanged).

---

## 10. Rollout / slice alignment

The proposal's 5-slice boundary is preserved; this design only sharpens the contracts:

1. **Foundations** — CASL (3 files) + `query-keys.ts` + shared category constant +
   `payment-method.types.ts` + `errors.ts`. No UI. Type/pin tests green.
2. **Admin read** — `payment-methods.api.ts` + `usePaymentMethodsTable` + `usePaymentMethodColumns`
   + `AdminPaymentMethodsView.vue` (read-only) + route + nav.
3. **Admin mutations** — `usePaymentMethodForm` + `PaymentMethodUpsertSlideover` (edit-mode
   `isActive` toggle) + `PaymentMethodCardGrid` + `payment-method-actions.utils.ts` + ConfirmModal +
   error-map dispatch. `isActive` forwarded on PATCH; `tenantId` omitted.
4. **POS projection + tiles + threading** — shared `payment-method-category.ts` icon map,
   `paymentMethodTile.utils.ts` (identity fix), `useSalePaymentMethods`, `saleApi.getPaymentMethods`,
   `paymentEntries.utils` id threading, `PaymentModal` + `DebtPaymentModal` merged tiles and
   tile-aware toggle, `PaymentEntry.paymentMethodId` + `LegacyChargePayload.paymentMethodId`.
5. **Sale detail + timeline + charge errors** — `SaleDetailPayment`/`PAYMENT_RECEIVED` fields,
   `PaymentsListSection` + `SaleDetailTimeline` preference + subtitle,
   `paymentMethodChargeErrors.utils.ts` + dispatch in `SalesView`/`useDebtPayment`.

Slices 1–3 and 4–5 remain independently verifiable (`pnpm test:unit --run` per slice).

---

## 11. Risks / notes

- **`isActive` reversal is load-bearing.** Any future generalization of a shared
  `filterAllowedKeys` must NOT be applied to `PaymentMethod.update()`. The whitelist here is
  `['name','category','subtitle','isActive']` (create: `['name','category','subtitle']`). Pin tests
  in `payment-methods.api.spec.ts` assert `isActive` IS forwarded and `tenantId` is NOT.
- **Fixed-matcher guard.** The `entryMatchesTile` fixed branch requires
  `entry.paymentMethodId === undefined`; dropping that guard reintroduces the collision for any
  custom method whose `category` equals a fixed method.
- **`LegacyChargePayload.paymentMethodId`** is an addition beyond the proposal's impact table,
  required by backend §7.1 (single-payment charge also accepts the id) and by
  `PaymentModal.buildPayload()`'s single-entry flattening.
- **Charge catalog errors must short-circuit** before the legacy `getSalePaymentErrorAction`
  dispatch, or `PAYMENT_METHOD_CATEGORY_MISMATCH` would surface a cryptic generic toast.
