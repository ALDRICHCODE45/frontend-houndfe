<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type {
  ChargeSalePayload,
  LegacyChargePayload,
  NonCreditPaymentMethod,
  PaymentEntry,
  SaleDraftCustomer,
  SaleShippingAddress,
} from '../interfaces/sale.types'
import { PAYMENT_METHOD } from '../constants/sale.constants' // sdd/magic-string-constants slice 3 — lowercase contract.
import DateFieldPopover from './DateFieldPopover.vue'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import {
  CHANGE_EXCEEDS_CASH_MESSAGE,
  NON_CASH_EXCEEDS_TOTAL_MESSAGE,
} from '../utils/salePaymentErrors.utils'
import { normalizeReferenceInput } from '../utils/paymentEntries.utils'
import { useSalePaymentMethods } from '../composables/useSalePaymentMethods'
import { useCashSaleSession } from '@/features/POS/cash-register/composables/useCashSaleSession'
import CashSaleSessionPicker from './CashSaleSessionPicker.vue'
import { useCashRegisterNames } from '../composables/useCashRegisterNames'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import {
  buildMergedMethodOptions,
  findEntryIndex,
  getMethodCount,
  paymentEntryKey,
  paymentMethodTileKey,
  resolveEntryDisplay,
  type EntryDisplay,
  type PaymentMethodTile,
} from '../utils/paymentMethodTile.utils'
import { PAYMENT_METHOD_CATEGORY_ICONS } from '@/core/shared/constants/payment-method-category'
// payment-split T2 (S2-S5, S7): the shared split helper and controls. The target is the sale
// total (what is due now); whatever stays unpaid is the debt to generate, never a bigger split.
import TenderSplitControl from '@/core/shared/components/payments/TenderSplitControl.vue'
import TenderRemainingButton from '@/core/shared/components/payments/TenderRemainingButton.vue'
import type { SplitControlTender } from '@/core/shared/components/payments/splitControl.types'
import { remainingDueCents } from '@/core/shared/payments/tenderSplit'
// T3 (checkout composition): the owned checkout/support-window adapter (sheet,
// body, footer, supporting windows). It is imported from this statically
// imported modal so the stylesheet loads with the sales feature only, and every
// rule is scoped to the `.sales-pos-checkout` marker on the content root.
import '../styles/sales-pos-checkout.css'
// style-cleanup U3 (owner S3 «una sola pieza»): total, method tiles, entries,
// summary and panels share the marker-free `hf-pay-*` payment sheet with the
// debt payment and «Cobrar todo».
import '@/core/shared/components/payments/payment-sheet.css'

const props = defineProps<{
  open: boolean
  totalCents: number
  saleId: string
  customer?: SaleDraftCustomer | null
  // pos-sale-delivery S2 (CAP-DLV-1): reactive shipping address from the
  // active draft. Gates the "Entrega a domicilio" USwitch — when null the
  // toggle is disabled with an inline hint and a CTA that reuses the
  // existing request-assign-customer emit (opens AssignCustomerSlideover).
  // SalesView passes `activeDraft.shippingAddress ?? null` so prop changes
  // follow backend-driven clears (e.g. customer reassign → backend
  // shippingAddress: null → hasShippingAddress flips → toggle disables).
  // The sale snapshot keeps every field even when its `id` is null (customer
  // deleted the address later), so presence — not the id — opens the gate.
  shippingAddress?: SaleShippingAddress | null
  isSubmitting?: boolean
  externalError?: string | null
  // sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): the parent
  // increments this counter when a charge resolves a catalog error; the modal
  // then drops every entry carrying a `paymentMethodId` (custom tiles) and
  // preserves fixed entries. The increment dispatch lands in S5A.
  catalogClearSignal?: number
  // PCA-2 (capacity re-quote): the parent increments this nonce ONLY when the
  // cashier accepts a refreshed server quote after a `PROMO_CAPACITY_RE_QUOTE`.
  // The modal then mints a fresh idempotency key while preserving the entered
  // payments; it never charges automatically — the cashier must click the
  // charge action again. An unchanged retry leaves the nonce untouched, so the
  // current logical-attempt key is reused.
  requoteAcceptSignal?: number
  /**
   * Teleport boundary marker (Venta passes the sales entry portal). Forwarded to
   * the slideover content root, to the shared DateFieldPopover and to the owned
   * CashSaleSessionPicker.
   */
  portalClass?: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [{ saleId: string; payload: ChargeSalePayload; idempotencyKey: string }]
  'request-assign-customer': []
}>()

type PaymentEntryForm = {
  method: NonCreditPaymentMethod
  // Cents typed in HfMoneyInput; `null` while the field is empty (counts as 0).
  amountCents: number | null
  // The parser error of the typed text; it blocks the charge while present.
  amountError?: string | null
  reference: string
  // sdd custom-payment-methods S4B (REQ-CAT-001 / design §1.3): present ONLY
  // for custom tiles; absent for fixed tiles (legacy byte-identical).
  paymentMethodId?: string
}

const CARD_METHODS: NonCreditPaymentMethod[] = [
  PAYMENT_METHOD.CARD_CREDIT,
  PAYMENT_METHOD.CARD_DEBIT,
  PAYMENT_METHOD.TRANSFER,
]
const MAX_ENTRIES = 5

const entries = ref<PaymentEntryForm[]>([])
const inlineError = ref<string | null>(null)
// T6/S3: binding-specific validation error, kept separate from `inlineError` so
// a deliberate binding edit can clear ONLY the stale-selection message without
// wiping unrelated validation (e.g. an invalid due date).
const bindingError = ref<string | null>(null)
// T6/S3: true when a previous explicit binding was invalidated (identity /
// permission / lifecycle reset, or a live scope change). The old scope id is
// already gone; this marker blocks an IMPLICIT unbound charge until the cashier
// re-selects a session or explicitly opts out. It holds no session id.
const needsBindingDecision = ref(false)
const idempotencyKey = ref<string>('')
const dueDateInput = ref<string | null>(null)
const isDueDateExpanded = ref(false)
// pos-sale-delivery S2 (CAP-DLV-1): the "Entrega a domicilio" toggle. Lives
// only in the modal's local state — the backend does not own it. Reset on
// every modal open (see watch(() => props.open, …)) and whenever the
// shipping-address gate closes (see watch(shippingAddress, …)) so a stale
// ON state cannot leak into a subsequent buildPayload().
const delivery = ref(false)

function todayISODate(): string {
  const t = new Date()
  const yyyy = t.getFullYear()
  const mm = String(t.getMonth() + 1).padStart(2, '0')
  const dd = String(t.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const minDueDate = computed(() => todayISODate())
const isDueDateValid = computed(() => {
  if (!dueDateInput.value) return true // empty is valid (optional)
  return dueDateInput.value >= minDueDate.value
})

// sdd custom-payment-methods S4B (REQ-PT-004): merged tile options — the 4
// fixed tiles followed by every active custom method from the projection.
// Empty / failed projection degrades to fixed-only (REQ-PT-005 / 006).
const { data: projection } = useSalePaymentMethods()
const methodOptions = computed<PaymentMethodTile[]>(() =>
  buildMergedMethodOptions(projection.value ?? []),
)

function tileTestId(tile: PaymentMethodTile): string {
  if (tile.kind === 'custom') return `payment-method-tile-custom-${tile.paymentMethodId}`
  // Legacy testids: cash keeps `add-payment-entry`, the other fixed tiles
  // keep `payment-method-tile-${value}` (design §1.4 — no testid drift).
  if (tile.value === PAYMENT_METHOD.CASH) return 'add-payment-entry'
  return `payment-method-tile-${tile.value}`
}

const totalFormatted = computed(() => formatCentsMXN(props.totalCents))

// T6/S3: the optional explicit Caja session link. The composable owns the
// eligible own/OPEN rows and the selected id; the charge payload carries the
// id only when the cashier made an explicit selection. Nothing here auto-selects
// a session, and a stale/invalid selection is blocked (never silently unbound).
const cashSaleSession = useCashSaleSession()
// Names each till in the picker («Caja Principal · abierta 9:12»), never by raw session id.
const cashRegisterNames = useCashRegisterNames()
const paidSumCents = computed(() => {
  return entries.value.reduce(
    (sum, entry) => sum + Math.max(0, entry.amountCents ?? 0),
    0,
  )
})
const hasCashPayment = computed(() =>
  entries.value.some((entry) => entry.method === PAYMENT_METHOD.CASH),
)
const remainingCents = computed(() => props.totalCents - paidSumCents.value)
const hasCustomer = computed(() => props.customer != null)
// pos-sale-delivery S2 (CAP-DLV-1): drives the USwitch `:disabled` and the
// inline gating hint ("asigná cliente y dirección primero"). Recomputes
// reactively whenever SalesView flips `shippingAddress` (e.g. customer
// reassign → backend clears the address → prop goes null → gate closes).
const hasShippingAddress = computed(() => props.shippingAddress != null)
const isPartial = computed(() => paidSumCents.value < props.totalCents)
const debtToGenerateCents = computed(() => Math.max(0, props.totalCents - paidSumCents.value))
const canSubmitPartial = computed(() => hasCustomer.value && isPartial.value)
const changeDueCents = computed(() => {
  if (!hasCashPayment.value || isPartial.value) return 0
  return paidSumCents.value - props.totalCents
})
// charge-change-cap S2: change is handed back from the cash drawer, so it can
// never exceed the cash tendered (the backend rejects it with 422).
const cashTenderedCents = computed(() =>
  entries.value
    .filter((entry) => entry.method === PAYMENT_METHOD.CASH)
    .reduce((sum, entry) => sum + Math.max(0, entry.amountCents ?? 0), 0),
)
const changeExceedsCash = computed(() => changeDueCents.value > cashTenderedCents.value)
// Without cash there is no change: paying more than the total by card, transfer or
// another method is refused by the backend (422 PAYMENT_AMOUNT_INVALID); block it here.
const nonCashExceedsTotal = computed(
  () => !hasCashPayment.value && paidSumCents.value - cashTenderedCents.value > props.totalCents,
)
const canAddEntry = computed(() => entries.value.length < MAX_ENTRIES)
const canSubmit = computed(
  () =>
    !props.isSubmitting &&
    (entries.value.length === 0 ? hasCustomer.value : !isPartial.value || canSubmitPartial.value) &&
    !inlineError.value &&
    !bindingError.value &&
    !changeExceedsCash.value &&
    !nonCashExceedsTotal.value &&
    !entries.value.some((entry) => entry.amountError),
)
const confirmButtonLabel = computed(() => {
  if (entries.value.length === 0 && hasCustomer.value) {
    return `Confirmar cobro · Deuda ${formatCentsMXN(debtToGenerateCents.value)}`
  }
  if (isPartial.value && hasCustomer.value) {
    return `Confirmar cobro · Deuda ${formatCentsMXN(debtToGenerateCents.value)}`
  }

  return 'Confirmar cobro'
})

function entryNeedsReference(method: NonCreditPaymentMethod): boolean {
  return CARD_METHODS.includes(method)
}

// ── sdd custom-payment-methods S4B — wire projection helpers ────────────────────
//
// `toWireEntry` is THE single normalization from a form row to the wire
// `PaymentEntry` shape. It forwards `paymentMethodId` ONLY when present
// (custom tiles), so fixed entries stay byte-identical (REQ-CAT-001 / §1.3).
function toWireEntry(entry: PaymentEntryForm): PaymentEntry {
  const payment: PaymentEntry = {
    method: entry.method,
    amountCents: Math.max(0, entry.amountCents ?? 0),
  }

  if (entry.paymentMethodId !== undefined) {
    payment.paymentMethodId = entry.paymentMethodId
  }

  return payment
}

// Wire projection of the current form rows — single source for tile matching
// (toggle / count badge / entries-list key), 1:1 with `entries`.
const wireEntries = computed<PaymentEntry[]>(() => entries.value.map(toWireEntry))

// Entries-list display labels: catalog name for custom entries, base category
// label for fixed entries (design §1.4 — resolveEntryDisplay, single source).
const entryDisplays = computed<EntryDisplay[]>(() =>
  entries.value.map((entry) => resolveEntryDisplay(toWireEntry(entry), methodOptions.value)),
)

// Split helpers see each row with its tile key and label (payment-split S3/S4).
const splitTenders = computed<SplitControlTender[]>(() =>
  entries.value.map((entry, index) => ({
    key: paymentEntryKey(wireEntries.value[index]!),
    label: entryDisplays.value[index]?.label ?? '',
    method: entry.method,
    amountCents: entry.amountCents,
  })),
)

// payment-split S5: a new method enters with what the other rows leave pending of the total
// (the whole total for the first one). When the total is already covered — cash over included —
// it enters blank (`null`, counts as 0 and is never charged) with no error until typed.
function createDefaultEntry(tile: PaymentMethodTile): PaymentEntryForm {
  const pending = remainingDueCents(
    props.totalCents,
    entries.value.map((row) => row.amountCents),
  )
  const entry: PaymentEntryForm = {
    method: tile.value,
    amountCents: pending > 0 ? pending : null,
    reference: '',
  }

  // paymentMethodId is set ONLY for custom tiles (REQ-CAT-001 / design §1.3).
  if (tile.kind === 'custom') {
    entry.paymentMethodId = tile.paymentMethodId
  }

  return entry
}

function normalizeEntries(): PaymentEntry[] {
  // sales-pos-charge WU-C.2 (REQ-NEW-9): reference is optional for non-CASH
  // entries. `normalizeReferenceInput` trims; an empty/whitespace input
  // becomes `undefined`, which we treat as "omit the key" — the backend
  // defaults the reference to null on save. A non-empty trimmed string is
  // passed through verbatim.
  return entries.value
    .map((entry) => {
      const payment = toWireEntry(entry)

      if (entryNeedsReference(entry.method)) {
        // Treat null and undefined the same: omit the key entirely so the
        // backend never receives `reference: null` (the spec requires
        // omitting, REQ-NEW-9). Only forward non-empty trimmed strings.
        const normalized = normalizeReferenceInput(entry.reference)
        if (normalized !== null && normalized !== undefined) {
          payment.reference = normalized
        }
      }

      return payment
    })
    .filter((payment) => payment.amountCents > 0) // Filter out zero-amount entries
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    entries.value = [] // Start with empty list, no preselected payment
    inlineError.value = null
    bindingError.value = null
    idempotencyKey.value = newIdempotencyKey()
    dueDateInput.value = null
    isDueDateExpanded.value = false
    // pos-sale-delivery S2 (CAP-DLV-1): reset the delivery toggle on
    // every modal open so a stale ON state from a prior session cannot
    // leak into the next charge.
    delivery.value = false
    // T6/S3: a reopened modal starts unbound; the cashier must re-select the
    // Caja session explicitly. The composable would also drop the selection on
    // any identity change. Any invalidated-binding marker is reset too.
    cashSaleSession.clearSelection()
    needsBindingDecision.value = false
  },
  { immediate: true },
)

// T6/S3: the selection belongs to the sale being charged. Switching drafts
// clears it so a session picked for one sale can never bind another.
watch(
  () => props.saleId,
  () => {
    cashSaleSession.clearSelection()
    needsBindingDecision.value = false
  },
)

// Collapses the optional due-date field and clears any half-entered value.
function collapseDueDate() {
  dueDateInput.value = null
  isDueDateExpanded.value = false
}

// The "no customer + partial/empty payment" state is communicated by the UAlert
// in the footer (with its CTA). Do NOT duplicate that message in inlineError —
// it would render twice (yellow alert + red inline text). inlineError is kept
// for orthogonal validation messages (due-date in the past, etc.).
watch(
  [isPartial, hasCustomer, entries],
  () => {
    if (!props.open) return
    inlineError.value = null
  },
  { deep: true },
)

// sdd custom-payment-methods S4B: entry construction is tile-aware so custom
// tiles thread their UUID while fixed tiles stay byte-identical (REQ-CAT-001).
// toggleMethod(tile) below is the single add/remove entry path.

// toggleMethod(tile) — tile-identity matcher (design §1.2/§1.4). The grid
// passes the WHOLE tile; the matcher resolves the selection key as
// `paymentMethodId ?? method`, so a fixed tile never toggles a custom entry of
// the same category and two customs of the same category never collide.
function toggleMethod(tile: PaymentMethodTile) {
  const existingIndex = findEntryIndex(wireEntries.value, tile)

  if (existingIndex >= 0) {
    // Remove the matching entry (toggle off) — only the identity-matched row.
    entries.value = entries.value.filter((_entry, index) => index !== existingIndex)
  } else {
    // Add new entry (toggle on)
    if (canAddEntry.value) {
      entries.value.push(createDefaultEntry(tile))
    }
  }
}

// payment-split S2-S4: helper amounts are written exactly like a typed amount (the money field's
// v-model), so the deep entries watcher mints the new idempotency key and every gate re-runs.
function setEntryAmount(index: number, amountCents: number) {
  if (props.isSubmitting) return
  const entry = entries.value[index]
  if (entry) entry.amountCents = amountCents
}

function applySplit(amounts: number[]) {
  if (props.isSubmitting || amounts.length !== entries.value.length) return
  amounts.forEach((amountCents, index) => setEntryAmount(index, amountCents))
}

function removeEntry(index: number) {
  if (entries.value.length <= 1) return
  entries.value = entries.value.filter((_entry, currentIndex) => currentIndex !== index)
}

function validate(): boolean {
  // sales-pos-charge WU-C.2 (REQ-NEW-9): reference is OPTIONAL. We no
  // longer block submit on missing reference. The remaining gates:
  //   1. "no customer + partial/empty payment" — handled by the UAlert in
  //      the footer; validate() just blocks submit silently (no inline msg).
  //   2. due-date must be today or later, if specified.
  if (entries.value.length === 0 && !hasCustomer.value) {
    return false
  }

  if (isPartial.value && !hasCustomer.value) {
    return false
  }

  if (!isDueDateValid.value) {
    inlineError.value = 'La fecha de vencimiento debe ser hoy o posterior'
    return false
  }

  inlineError.value = null
  return true
}

function buildPayload(): ChargeSalePayload {
  const payments = normalizeEntries()
  const dueDate = dueDateInput.value || undefined
  // pos-sale-delivery S2 (CAP-DLV-1, design §2/Q4): single source of truth
  // for the delivery patch. `{}` when off → key absent → legacy charges
  // stay byte-identical (no `delivery: false` ever emitted, per spec).
  // `{ delivery: true }` when on → spread into BOTH branches below.
  const deliveryPatch = delivery.value ? { delivery: true } : {}
  // T6/S3: the explicit Caja link is an OPTIONAL top-level key on BOTH payload
  // shapes. `{}` when no explicit selection → key absent → byte-identical
  // legacy charges (never `null`, never an empty string). The backend accepts
  // it only as a top-level field, never nested inside `payments`.
  const cashSessionPatch =
    cashSaleSession.selectedId.value !== null
      ? { cashSessionId: cashSaleSession.selectedId.value }
      : {}

  if (payments.length === 1) {
    const single = payments[0]
    if (!single) {
      return dueDate
        ? { payments, dueDate, ...deliveryPatch, ...cashSessionPatch }
        : { payments, ...deliveryPatch, ...cashSessionPatch }
    }

    // sdd custom-payment-methods S4B (REQ-CAT-002 / design §1.3): flatten a
    // single-entry charge into the legacy single-payment shape, forwarding
    // `paymentMethodId` ONLY when the entry is a custom tile (fixed entries
    // stay byte-identical).
    const legacy: LegacyChargePayload = {
      method: single.method,
      amountCents: single.amountCents,
      ...deliveryPatch,
      ...cashSessionPatch,
    }
    if (single.paymentMethodId !== undefined) {
      legacy.paymentMethodId = single.paymentMethodId
    }
    if (dueDate) {
      legacy.dueDate = dueDate
    }
    return legacy
  }

  return dueDate
    ? { payments, dueDate, ...deliveryPatch, ...cashSessionPatch }
    : { payments, ...deliveryPatch, ...cashSessionPatch }
}

function handleSubmit() {
  if (!validate()) return
  if (!canSubmit.value) return

  if (cashSaleSession.selectedId.value !== null) {
    // A non-reactive scope change (e.g. a session-generation write) is not
    // visible to the reactive reset watcher yet. Detect it here, clear the
    // ACTUAL selection and require an explicit decision — never auto-emit.
    if (!cashSaleSession.isSelectionScopeCurrent()) {
      cashSaleSession.clearSelection()
      needsBindingDecision.value = true
      bindingError.value =
        'La sesión de caja elegida ya no está disponible. Elige otra o cobra sin vincular.'
      return
    }
    // The scope is current but the chosen row is not on the current page
    // (ordinary paging/refetch): keep the explicit selection and block.
    if (!cashSaleSession.revalidateSelection()) {
      bindingError.value =
        'La sesión de caja elegida ya no está disponible. Elige otra o cobra sin vincular.'
      return
    }
  }

  // A previously bound attempt lost its binding: require an explicit opt-out or
  // a new selection before an implicit unbound charge can go out. Ordinary
  // legacy unbound charges (no prior selection) are unaffected.
  if (needsBindingDecision.value) {
    bindingError.value =
      'La sesión de caja elegida ya no está disponible. Elige otra o cobra sin vincular.'
    return
  }

  bindingError.value = null
  emit('submit', {
    saleId: props.saleId,
    payload: buildPayload(),
    idempotencyKey: idempotencyKey.value,
  })
}

watch(
  () => props.totalCents,
  () => {
    if (!props.open || entries.value.length !== 1) return
    if (entries.value[0]) {
      entries.value[0].amountCents = props.totalCents
    }
  },
)

// sales-pos-charge WU-C.2 + pos-sale-delivery S2 (CAP-DLV-1 idempotency):
// regenerate the idempotency key on any entry change (amount, method,
// reference) AND on every "Entrega a domicilio" toggle flip. The `delivery`
// ref is added to the watch source tuple so a legitimate toggle edit never
// reuses a key whose backend hash captured the prior `delivery` value
// (would otherwise respond with `409 IDEMPOTENCY_KEY_CONFLICT`). `delivery`
// is a primitive `ref<boolean>`, so the `{ deep: true }` flag is a no-op
// for it and remains correct for the `entries` array source.
watch(
  [entries, delivery],
  () => {
    if (!props.open) return
    idempotencyKey.value = newIdempotencyKey()
  },
  { deep: true },
)

// T6/S3: the Caja binding is part of the request body, so ANY selection change
// invalidates the current logical-attempt key — a new body must never reuse the
// previous key. `flush: 'sync'` also covers a binding change that happens in the
// SAME tick as the submit.
//
// `onSelectSession` is the modal's only selection writer: it distinguishes an
// explicit opt-out (allowed) from a composable-driven reset of an actual
// selection (which raises `needsBindingDecision` so the next confirm cannot
// silently charge unbound).
let explicitOptOut = false

function onSelectSession(id: string | null): void {
  explicitOptOut = true
  cashSaleSession.selectSession(id)
  explicitOptOut = false
}

function optOutBinding(): void {
  onSelectSession(null)
  needsBindingDecision.value = false
  bindingError.value = null
}

watch(
  () => cashSaleSession.selectedId.value,
  (next, prev) => {
    if (prev !== null && next === null) {
      // An ACTUAL selection was cleared by an identity/permission/lifecycle
      // reset — require an explicit decision before an unbound charge.
      needsBindingDecision.value = !explicitOptOut
    }
    if (next !== null) needsBindingDecision.value = false
    bindingError.value = null
    if (!props.open) return
    idempotencyKey.value = newIdempotencyKey()
  },
  { flush: 'sync' },
)

watch(entries, (next) => {
  if (!props.open || next.length === 0) return
  if (next.length <= MAX_ENTRIES) return
  entries.value = next.slice(0, MAX_ENTRIES)
})

// pos-sale-delivery S2 (CAP-DLV-1, design §2/Q7): when the shipping address
// is cleared reactively (e.g. customer reassign → backend clears it →
// activeDraft.shippingAddress becomes null → prop goes null → gate closes),
// reset the toggle to OFF so a stale ON state cannot leak into a subsequent
// buildPayload(). buildPayload() is additionally gated by the
// `delivery.value ? … : {}` patch, but this watch makes the user-visible
// state honest too (the switch shows OFF the moment the gate closes).
watch(
  () => props.shippingAddress,
  (addr) => {
    if (addr == null) {
      delivery.value = false
    }
  },
)

// sdd custom-payment-methods S4B (design §8.3 / REQ-CAT-007): when the parent
// increments `catalogClearSignal` (a charge resolved a catalog error), drop
// EVERY entry carrying a `paymentMethodId` (custom tiles) and preserve the
// fixed entries. The deep `entries` watcher above then regenerates the
// idempotency key, so the follow-up submit is a fresh request.
watch(
  () => props.catalogClearSignal,
  () => {
    if (!props.open) return
    entries.value = entries.value.filter((entry) => entry.paymentMethodId === undefined)
  },
)

// PCA-2 (capacity re-quote): the ONLY path that mints a fresh key after a
// `PROMO_CAPACITY_RE_QUOTE` without an explicit payment edit. The parent bumps
// `requoteAcceptSignal` when the cashier accepts the refreshed quote; the
// entries (and therefore the rest of the payment draft) stay untouched, and no
// submit is emitted here — the cashier must click the existing charge action
// again. Ignored while the modal is closed so the open watcher stays the
// single source of the initial key.
watch(
  () => props.requoteAcceptSignal,
  () => {
    if (!props.open) return
    idempotencyKey.value = newIdempotencyKey()
  },
)

// The content root carries the caller's portal marker (Venta passes the sales
// entry portal) plus the owned checkout composition marker.
const slideoverUi = computed(() => ({
  content: ['sm:max-w-lg overflow-hidden', props.portalClass, 'sales-pos-checkout']
    .filter(Boolean)
    .join(' '),
  body: 'p-0 flex flex-col h-full',
}))
</script>

<template>
  <USlideover
    :open="open"
    inset
    :ui="slideoverUi"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full max-h-[100dvh] flex-col sales-pos-checkout-sheet">
        <!-- Header -->
        <div class="shrink-0 space-y-4 border-b border-default px-5 py-4 sales-pos-checkout-header">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-lg font-semibold text-highlighted">Cobrar venta</p>
              <p class="text-xs text-muted">Selecciona los métodos de pago</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              :disabled="isSubmitting"
              @click="emit('update:open', false)"
            />
          </div>

          <div class="hf-pay-total">
            <p class="hf-pay-total-label">Total a cobrar</p>
            <p class="hf-figure hf-pay-total-value">{{ totalFormatted }}</p>
          </div>
        </div>

        <!-- Scrollable body -->
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sales-pos-checkout-body">
          <!-- Method picker grid -->
          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Métodos de pago</p>
            <div class="hf-pay-methods">
              <button
                v-for="option in methodOptions"
                :key="paymentMethodTileKey(option)"
                :data-testid="tileTestId(option)"
                :data-method="option.value"
                :aria-pressed="getMethodCount(wireEntries, option) > 0"
                type="button"
                class="hf-pay-tile"
                :disabled="
                  (getMethodCount(wireEntries, option) === 0 && !canAddEntry) || isSubmitting
                "
                @click="toggleMethod(option)"
              >
                <UIcon :name="option.icon" class="hf-pay-tile-icon" />
                <p class="hf-pay-tile-label">{{ option.label }}</p>
                <span v-if="getMethodCount(wireEntries, option) > 0" class="hf-pay-tile-count">
                  {{ getMethodCount(wireEntries, option) }}
                </span>
                <!-- REQ-PT-007: custom tiles render the subtitle as a grey sub-line (trimmed, when present) -->
                <p
                  v-if="option.kind === 'custom' && (option.subtitle?.trim() ?? '') !== ''"
                  :data-testid="`payment-method-tile-subtitle-${option.paymentMethodId}`"
                  class="hf-pay-tile-subtitle"
                >
                  {{ option.subtitle }}
                </p>
              </button>
            </div>
          </section>

          <USeparator />

          <!-- Payment entries -->
          <section class="space-y-3">
            <p class="text-sm font-semibold text-highlighted">Pagos agregados</p>

            <div v-if="entries.length === 0" class="hf-pay-empty">
              <p>Selecciona un método de pago arriba</p>
            </div>

            <div v-else class="hf-pay-entries">
              <div
                v-for="(entry, index) in entries"
                :key="paymentEntryKey(wireEntries[index]!)"
                :data-testid="`payment-entry-${index}`"
                class="hf-pay-entry"
              >
                <div class="hf-pay-entry-head">
                  <UIcon :name="PAYMENT_METHOD_CATEGORY_ICONS[entry.method]" class="hf-pay-entry-icon" />

                  <p :data-testid="`payment-method-${index}`" class="hf-pay-entry-label">
                    {{ entryDisplays[index]?.label }}
                  </p>

                  <TenderRemainingButton
                    :data-testid="`payment-fill-remaining-${index}`"
                    :tenders="entries"
                    :index="index"
                    :target-cents="totalCents"
                    :label="entryDisplays[index]?.label ?? ''"
                    :disabled="isSubmitting"
                    @fill="setEntryAmount(index, $event)"
                  />

                  <UButton
                    v-if="entries.length > 1"
                    :data-testid="`remove-payment-entry-${index}`"
                    type="button"
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    :disabled="isSubmitting"
                    @click="removeEntry(index)"
                  />
                </div>

                <UFormField label="Monto recibido">
                  <HfMoneyInput
                    :id="`payment-amount-${index}`"
                    v-model="entry.amountCents"
                    :data-testid="`payment-amount-${index}`"
                    :disabled="isSubmitting"
                    class="w-full"
                    @validation="entry.amountError = $event"
                  />
                </UFormField>

                <UFormField v-if="entryNeedsReference(entry.method)" label="Referencia (opcional)">
                  <UInput
                    :data-testid="`payment-reference-${index}`"
                    v-model="entry.reference"
                    placeholder="Ej: VOUCHER-123"
                    :disabled="isSubmitting"
                  />
                </UFormField>
              </div>
            </div>

            <TenderSplitControl
              :tenders="splitTenders"
              :target-cents="totalCents"
              :disabled="isSubmitting"
              @apply="applySplit"
            />
          </section>

          <!-- T6/S3: explicit Caja session link. Rendered only when
               `read:CashSession` is held, so an unauthorized cashier never
               renders it and never triggers a session read. Selection is
               explicit — there is no automatic binding. -->
          <section v-if="cashSaleSession.canReadSessions.value" class="space-y-2 sales-pos-checkout-session">
            <CashSaleSessionPicker
              :sessions="cashSaleSession.availableSessions.value"
              :selected-id="cashSaleSession.selectedId.value"
              :is-selection-eligible="cashSaleSession.isSelectionEligible.value"
              :is-fetching="cashSaleSession.isFetching.value"
              :is-error="cashSaleSession.isError.value"
              :page="cashSaleSession.page.value"
              :page-count="cashSaleSession.pageCount.value"
              :total="cashSaleSession.total.value"
              :portal-class="portalClass"
              :register-names="cashRegisterNames"
              @update:selected-id="onSelectSession($event)"
              @update:page="cashSaleSession.setPage($event)"
            />
            <p class="text-xs text-muted">
              Vincula el cobro a una sesión de caja abierta propia. Si no eliges ninguna, el cobro
              queda sin vincular.
            </p>
          </section>

          <!-- T6/S3: a lost binding needs an explicit decision. This control
               lives OUTSIDE the permission-gated picker, so it stays reachable
               when `read:CashSession` is revoked or unresolved. It preserves the
               payment entries, delivery and due date. -->
          <section
            v-if="needsBindingDecision"
            data-testid="cash-session-binding-lost"
            data-tone="warning"
            class="hf-pay-panel space-y-2"
          >
            <p class="text-xs text-warning">
              La sesión de caja vinculada ya no está disponible. Elige otra sesión o cobra sin
              vincular.
            </p>
            <UButton
              data-testid="cash-session-binding-optout"
              type="button"
              color="neutral"
              variant="soft"
              size="sm"
              :disabled="isSubmitting"
              @click="optOutBinding"
            >
              Cobrar sin vincular a caja
            </UButton>
          </section>

          <!-- Optional due date for resulting debt — collapsed by default -->
          <section data-testid="due-date-section" class="sales-pos-checkout-due-date">
            <button
              v-if="!isDueDateExpanded && !dueDateInput"
              type="button"
              data-testid="expand-due-date"
              class="flex items-center gap-1.5 text-xs text-(--hf-action) underline-offset-2 hover:underline disabled:opacity-50"
              :disabled="isSubmitting"
              @click="isDueDateExpanded = true"
            >
              <UIcon name="i-lucide-calendar-plus" class="size-3.5" />
              Agregar fecha de vencimiento
            </button>

            <div v-else class="space-y-1.5">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium text-highlighted">Vencimiento</p>
                <button
                  type="button"
                  data-testid="collapse-due-date"
                  class="text-xs text-muted hover:underline"
                  :disabled="isSubmitting"
                  @click="collapseDueDate"
                >
                  Quitar
                </button>
              </div>
              <p class="text-xs text-muted">
                Fecha en que vence la deuda generada. Si no la indicas, el sistema aplica el plazo
                por defecto.
              </p>
              <DateFieldPopover
                v-model="dueDateInput"
                testid="due-date-input"
                placeholder="Elegir fecha"
                :disabled="isSubmitting"
                :min-iso="minDueDate"
                :portal-class="portalClass"
              />
            </div>
          </section>

          <!-- pos-sale-delivery S2 (CAP-DLV-1): "Entrega a domicilio" toggle.
                 Gates on `hasShippingAddress` (design §2/Q1, §2/Q7). When the
                 gate is closed the switch is disabled and an inline hint
                 explains why, plus a CTA that reuses the existing
                 request-assign-customer emit to open AssignCustomerSlideover.
                 Placed immediately after the due-date section per design
                 §2/Q1 (due-date + delivery are the two optional charge
                 modifiers that only make sense after a customer is assigned). -->
          <section data-testid="delivery-section" class="space-y-2 sales-pos-checkout-delivery">
            <USwitch
              v-model="delivery"
              :disabled="!hasShippingAddress || isSubmitting"
              label="Entrega a domicilio"
              description="Marca la venta para entrega a domicilio; el estado inicial será pendiente."
              data-testid="delivery-toggle"
            />

            <p v-if="!hasShippingAddress" data-testid="delivery-hint" class="text-xs text-warning">
              asigna cliente y dirección primero
            </p>

            <div v-if="!hasShippingAddress">
              <UButton
                data-testid="delivery-assign-cta"
                color="warning"
                variant="soft"
                size="sm"
                :disabled="isSubmitting"
                @click="emit('request-assign-customer')"
              >
                Asignar cliente
              </UButton>
            </div>
          </section>
        </div>

        <!-- Sticky footer -->
        <div class="shrink-0 space-y-3 border-t border-default bg-default px-5 py-4 sales-pos-checkout-footer">
          <div class="hf-pay-summary">
            <div class="hf-pay-summary-row">
              <p>
                Recibido: <span class="hf-pay-summary-value">{{ formatCentsMXN(paidSumCents) }}</span>
              </p>
              <p>
                Restante:
                <span class="hf-pay-summary-value">{{ formatCentsMXN(Math.max(remainingCents, 0)) }}</span>
              </p>
            </div>
            <p v-if="changeDueCents > 0">
              Cambio: <span class="hf-pay-summary-value">{{ formatCentsMXN(changeDueCents) }}</span>
            </p>
            <p v-if="changeExceedsCash" data-testid="change-exceeds-cash" class="text-error">
              {{ CHANGE_EXCEEDS_CASH_MESSAGE }}
            </p>
            <p v-if="nonCashExceedsTotal" data-testid="non-cash-exceeds-total" class="text-error">
              {{ NON_CASH_EXCEEDS_TOTAL_MESSAGE }}
            </p>
          </div>

          <UAlert
            v-if="(isPartial || entries.length === 0) && !hasCustomer"
            color="warning"
            variant="soft"
            icon="i-lucide-info"
            title="Asigna un cliente para registrar una venta con deuda"
            description="Asigna un cliente para registrar una venta con deuda"
          >
            <template #actions>
              <UButton
                data-testid="assign-customer-cta"
                color="warning"
                variant="soft"
                size="sm"
                @click="emit('request-assign-customer')"
              >
                Asignar cliente
              </UButton>
            </template>
          </UAlert>

          <div
            v-if="(isPartial || entries.length === 0) && hasCustomer"
            data-tone="warning"
            class="hf-pay-panel flex items-center justify-between gap-2 text-sm"
          >
            <p class="text-highlighted">
              Deuda a generar:
              <span class="font-semibold">{{ formatCentsMXN(debtToGenerateCents) }}</span>
            </p>
          </div>

          <p v-if="bindingError || inlineError || externalError" class="text-sm text-error">
            {{ bindingError ?? inlineError ?? externalError }}
          </p>

          <div data-testid="payment-actions" class="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <UButton
              color="neutral"
              variant="soft"
              class="w-full justify-center sm:w-auto"
              :disabled="isSubmitting"
              @click="emit('update:open', false)"
            >
              Cancelar
            </UButton>
            <UButton
              data-testid="confirm-charge"
              color="primary"
              :loading="isSubmitting"
              :disabled="!canSubmit"
              class="w-full justify-center sales-entry-primary-action rounded-xl font-semibold shadow-sm sm:w-auto"
              @click="handleSubmit"
            >
              {{ confirmButtonLabel }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
