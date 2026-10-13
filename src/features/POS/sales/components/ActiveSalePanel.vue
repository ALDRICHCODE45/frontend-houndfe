<script setup lang="ts">
import { hasSalesEntryToken } from '../utils/salesEntryPortal'
import { ref, computed } from 'vue'
import SaleItemRow from './SaleItemRow.vue'
import SaleTotalsFooter from './SaleTotalsFooter.vue'
import PromocionesDisponiblesAccordion from './PromocionesDisponiblesAccordion.vue'
import GlobalDiscountModal from './GlobalDiscountModal.vue'
import PriceListSelector from './PriceListSelector.vue' // sdd/pos-price-list-tiers
import '../styles/sales-pos-cart.css' // T11 (unit B): cart-only composition adapter.
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type {
  ApplicablePromotion,
  ApplyItemDiscountPayload,
  ApplyGlobalDiscountPayload,
  OverrideItemPricePayload,
  Sale,
} from '../interfaces/sale.types'
import { SALE_STATUS } from '../constants/sale.constants' // sdd/magic-string-constants slice 3

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  drafts: Sale[]
  activeDraft: Sale | null
  activeTabId: string | null
  isLoadingList: boolean
  isMutating: boolean
  isCustomerMutationPending?: boolean
  itemImageMap?: Record<string, string>
  onSubmitPriceOverride: (itemId: string, payload: OverrideItemPricePayload) => Promise<unknown>
  onApplyDiscount: (itemId: string, payload: ApplyItemDiscountPayload) => Promise<unknown>
  onRemoveDiscount: (itemId: string) => Promise<unknown>
  onRemoveItem: (itemId: string) => Promise<unknown>
  onApplyGlobalDiscount: (payload: ApplyGlobalDiscountPayload) => Promise<unknown>
  onRemoveGlobalDiscount: () => Promise<unknown>
  // promotions-in-sale C.4: data for the manual-promo accordion. Kept
  // presentational — the query lives in SalesView, this panel just renders.
  applicablePromotions?: ApplicablePromotion[]
  isLoadingPromotions?: boolean
  appliedManualPromotionIds?: string[]
  /** Presentation-only density flag for the mobile bottom-sheet instance. */
  mobileSheet?: boolean
  /**
   * Optional teleport boundary marker. Forwarded to the owned row menus and
   * dialogs (and to the shared PriceListSelector's existing opt-in). Absent by
   * default, so every consumer keeps its native defaults and prior paint.
   */
  portalClass?: string
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

// promotions-in-sale B.2: forward the order-promo remove event from
// SaleTotalsFooter up to SalesView (which routes it through the veto
// confirmation flow in work-unit C.5).
//
// C.4 adds the manual-promo apply/remove forwarding for the accordion.
//
// C.5 adds `remove-promo` — the per-line auto-promo veto coming from
// SaleItemRow's promo-badge remove control. Both `remove-order-promo`
// and `remove-promo` route through the SAME confirm+veto flow in
// SalesView (veto is permanent regardless of scope — spec §7a).
//
// pos-price-list-tiers adds `change-price-list` — the parent (SalesView)
// calls `setPriceList(activeDraftId, globalPriceListId)` to apply the
// price-list tier change. The confirm-gate lives HERE in the panel:
// PriceListSelector emits `request-confirm` when the sale has items, and
// we open a ConfirmModal that, on accept, re-emits `change-price-list`.
const emit = defineEmits<{
  'switch-tab': [saleId: string]
  'close-tab': [saleId: string]
  'create-tab': []
  'update-qty': [itemId: string, quantity: number]
  'clear-items': []
  'charge-click': []
  'open-customer-assignment': []
  'unassign-customer': []
  'remove-order-promo': [promotionId: string]
  'remove-promo': [promotionId: string]
  'apply-manual-promo': [promotionId: string]
  'remove-manual-promo': [promotionId: string]
  'change-price-list': [globalPriceListId: string | null]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const trashConfirmOpen = ref(false)
const closeTabConfirmOpen = ref(false)
const tabToClose = ref<string | null>(null)
const globalDiscountModalOpen = ref(false)
// pos-price-list-tiers: confirm modal state for price-list change. Holds
// the pending list id while the dialog is open so the confirm handler can
// forward it via `change-price-list`.
const priceListConfirmOpen = ref(false)
const pendingPriceListId = ref<string | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const hasGlobalDiscount = computed(() =>
  props.activeDraft?.items.some((item) => !!item.discountType) ?? false,
)

// T3: the same optional marker is the single "this panel is rendered inside the
// sales entry boundary" signal, so the owned children reuse it instead of
// growing a second flag. Absent marker → false → every prior class is kept.
const isThemed = computed(() => Boolean(props.portalClass))
const isSalesEntryCustomer = computed(() =>
  hasSalesEntryToken(props.portalClass),
)

// T11 (unit B): the new cart composition is gated by the EXACT sales entry
// token, not by the legacy advisory `Boolean(portalClass)`. An omitted or
// unrelated opt-in keeps the previous presentation and behavior; the mobile
// drawer forwards the same token (plus `sales-pos-cart`), so the composition
// applies on desktop and mobile alike.
const isSalesEntryComposition = computed(() =>
  hasSalesEntryToken(props.portalClass),
)

// Real cart context for the heading band: derived from the active draft only.
const itemCount = computed(() => props.activeDraft?.items.length ?? 0)
const unitCount = computed(
  () => props.activeDraft?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
)

const customerFullName = computed(() => {
  const customer = props.activeDraft?.customer
  if (!customer) return ''
  return [customer.firstName, customer.lastName ?? ''].join(' ').trim()
})

const customerAddressSummary = computed(() => {
  const address = props.activeDraft?.shippingAddress
  if (!address) return null
  return [address.street, address.exteriorNumber ? `#${address.exteriorNumber}` : null, address.city]
    .filter(Boolean)
    .join(', ')
})

const moreMenuItems = computed(() => {
  if (!props.activeDraft || props.activeDraft.items.length === 0) return []

  const items: Array<{ label: string; icon: string; color?: 'error'; onSelect: () => void }> = []

  items.push({
    label: 'Aplicar descuento global',
    icon: 'i-lucide-badge-percent',
    onSelect: () => {
      globalDiscountModalOpen.value = true
    },
  })

  if (hasGlobalDiscount.value) {
    items.push({
      label: 'Quitar descuentos',
      icon: 'i-lucide-percent-circle',
      color: 'error',
      onSelect: () => {
        void props.onRemoveGlobalDiscount()
      },
    })
  }

  return [items]
})

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleConfirmCloseTab() {
  if (tabToClose.value) {
    emit('close-tab', tabToClose.value)
  }
  closeTabConfirmOpen.value = false
  tabToClose.value = null
}

function handleTrashClick() {
  trashConfirmOpen.value = true
}

function handleConfirmTrash() {
  emit('clear-items')
  trashConfirmOpen.value = false
}

function getCloseTabDescription(): string {
  if (!tabToClose.value) return ''
  const draft = props.drafts.find((d) => d.id === tabToClose.value)
  if (!draft) return '¿Cerrar esta venta?'
  
  if (draft.items.length === 0) {
    return '¿Cerrar esta venta vacía?'
  }
  return `Vas a cerrar una venta con ${draft.items.length} productos. Esta acción no se puede deshacer.`

}

// pos-price-list-tiers: PriceListSelector hands the chosen id to the
// parent via two events. The selector itself decides which event to fire
// based on the item count; we just open the confirm modal on
// `request-confirm` and re-emit `change-price-list` on accept.
function handleRequestPriceListConfirm(globalPriceListId: string | null) {
  pendingPriceListId.value = globalPriceListId
  priceListConfirmOpen.value = true
}

function handleConfirmPriceListChange() {
  // Forward whatever the selector asked for. `null` is the "Sin lista"
  // sentinel — the parent's `setPriceList(saleId, null)` clears the
  // assignment.
  emit('change-price-list', pendingPriceListId.value)
  pendingPriceListId.value = null
  priceListConfirmOpen.value = false
}

</script>

<template>
  <div
    class="h-full flex flex-col min-w-0 sales-pos-cart-panel"
    :class="{
      'sales-pos-cart-composition': isSalesEntryComposition,
      'sales-pos-cart-composition-sheet': isSalesEntryComposition && mobileSheet,
    }"
  >
    <!-- Exact v0 cart heading (opt-in only): Tu venta + the real count over a
         supporting line. Omitted/unrelated opt-ins render the prior panel. -->
    <header
      v-if="isSalesEntryComposition"
      data-testid="cart-heading"
      class="shrink-0 sales-pos-cart-heading"
    >
      <div class="min-w-0">
        <h2 class="sales-pos-cart-title">
          Tu venta
          <span class="sales-pos-cart-count" data-testid="cart-heading-count">{{ itemCount }}</span>
        </h2>
        <p class="sales-pos-cart-support" data-testid="cart-heading-support">
          {{ unitCount }} {{ unitCount === 1 ? 'unidad' : 'unidades' }} · Revisa los productos antes de cobrar
        </p>
      </div>
      <!-- S11: v0 keeps the sale options (···) in the heading. The summary's
           "Vaciar" is the single clear action, so no duplicate trash row
           sits between the customer and the totals. -->
      <div
        v-if="activeDraft && activeDraft.items.length > 0"
        data-testid="cart-actions-toolbar"
        class="shrink-0 flex items-center sales-pos-cart-toolbar"
      >
        <UDropdownMenu
          :items="moreMenuItems"
          :ui="portalClass ? { content: portalClass } : undefined"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis"
            aria-label="Opciones de venta"
            :disabled="isMutating"
          />
        </UDropdownMenu>
      </div>
    </header>

    <!-- cart-header (sdd-4 sales-layout-redesign T3) — type toggle + trash
         + ⋮ menu + price-list selector. NO bg-* classes: stays transparent
         and inherits from UDashboardPanel body bg (SDD-3 doble-fondo rule).

         Layout (revised fix): three top-level groups so the header stays
         readable on laptop widths where the previous `md:flex-1` on the
         first child + internal spacer collapsed the action buttons into
         the gap before the price-list selector.
           [Group 1] [spacer → right] [Group 2]
         - Group 1: type toggle + action buttons (kept together, shrink-0).
         - Spacer: a dedicated `md:flex-1` div between groups pushes the
           selector to the extreme right (only renders on md+).
         - Group 2: price-list selector (shrink-0 so the label + dropdown
           are never visually overlapped). -->
    <section
      data-testid="cart-header"
      class="shrink-0 flex flex-col md:flex-row md:flex-wrap md:items-center md:gap-2 md:px-2 md:py-2 sales-pos-cart-header"
      :class="{ 'sales-pos-price-list-band': isSalesEntryComposition }"
    >
      <!-- Group 1: type toggle only; redundant inside the mobile sheet. -->
      <div
        v-if="!mobileSheet"
        data-testid="cart-type-toggle"
        class="flex items-center gap-1 px-3 py-2 md:border-0 md:bg-transparent md:p-0 md:shrink-0"
      >
        <UTabs
          :items="[
            { key: 'venta', label: 'Venta', content: false },
            { key: 'pedido', label: 'Pedido', content: false, disabled: true },
          ]"
          :model-value="'venta'"
          class="w-auto"
        />
      </div>

      <!-- Spacer -->
      <div class="hidden md:block md:flex-1" aria-hidden="true"></div>

      <!-- Price list selector -->
      <div v-if="activeDraft" class="px-4 py-2 md:border-0 md:bg-transparent md:p-0 md:shrink-0">
        <PriceListSelector
          :active-draft="activeDraft"
          :is-mutating="isMutating"
          :portal-class="portalClass"
          @change-price-list="emit('change-price-list', $event)"
          @request-confirm="handleRequestPriceListConfirm"
        />
      </div>
    </section>

    <!-- cart-body (sdd-4 sales-layout-redesign T3) — scrollable items list
         (or empty state). NO bg-* classes: stays transparent and inherits
         from UDashboardPanel body bg (SDD-3 doble-fondo rule). -->
    <section data-testid="cart-body" class="flex-1 min-h-0 overflow-y-auto sales-pos-cart-body">
      <!-- Empty state -->
      <div
        v-if="!activeDraft || activeDraft.items.length === 0"
        class="flex flex-col items-center justify-center h-full px-4 sales-pos-cart-empty"
      >
        <div class="rounded-2xl bg-primary/8 border border-primary/15 p-5 mb-4">
          <UIcon name="i-lucide-shopping-bag" class="h-10 w-10 text-primary/50" />
        </div>
        <p class="text-sm font-semibold text-highlighted mb-1">
          Tu venta está vacía
        </p>
        <p class="text-xs text-muted text-center max-w-[220px] leading-relaxed">
          Selecciona productos del catálogo para agregarlos a esta venta
        </p>
      </div>

      <!-- Items -->
      <div v-else class="py-1">
        <SaleItemRow
          v-for="item in activeDraft.items"
          :key="item.id"
          :sale-id="activeDraft.id"
          :is-draft="activeDraft.status === SALE_STATUS.DRAFT"
          :item="item"
          :image-url="itemImageMap?.[item.variantId ? `${item.productId}:${item.variantId}` : item.productId] ?? null"
          :is-updating="isMutating"
          :mobile-sheet="mobileSheet"
          :composition="isSalesEntryComposition"
          :portal-class="portalClass"
          :on-submit-price-override="onSubmitPriceOverride"
          :on-apply-discount="onApplyDiscount"
          :on-remove-discount="onRemoveDiscount"
          :on-remove-item="onRemoveItem"
          @update-qty="(itemId, quantity) => emit('update-qty', itemId, quantity)"
          @remove-promo="(promotionId) => emit('remove-promo', promotionId)"
        />
      </div>

      <!-- Venta composition: eligible promotions scroll with the items and
           precede customer context. The legacy footer keeps its own branch. -->
      <PromocionesDisponiblesAccordion
        v-if="isSalesEntryComposition && (applicablePromotions?.length ?? 0) > 0"
        :promotions="applicablePromotions ?? []"
        :loading="isLoadingPromotions ?? false"
        :applied-ids="appliedManualPromotionIds ?? []"
        @apply="(promotionId) => emit('apply-manual-promo', promotionId)"
        @remove="(promotionId) => emit('remove-manual-promo', promotionId)"
      />
    </section>

    <!-- cart-footer (sdd-4 sales-layout-redesign T3) — customer slot,
         manual-promo accordion, totals footer. NO bg-* classes: stays
         transparent and inherits from UDashboardPanel body bg (SDD-3
         doble-fondo rule). -->
    <section data-testid="cart-footer" class="shrink-0 flex flex-col sales-pos-cart-footer">
      <!-- Customer slot (slim line above totals) -->
      <div
        class="px-4 py-2 flex items-center justify-between gap-3 text-sm"
        :class="{ 'sales-pos-customer-summary': isSalesEntryCustomer }"
      >
        <div v-if="!activeDraft?.customer" class="sales-pos-customer-state flex items-center gap-2">
          <USkeleton v-if="isCustomerMutationPending" class="h-4 w-32" data-testid="customer-slot-loading" />
          <template v-else>
            <UIcon
              v-if="isSalesEntryCustomer"
              name="i-lucide-user-round"
              class="sales-pos-customer-icon size-4 shrink-0 text-muted"
              data-testid="customer-state-icon"
            />
            <span class="sales-pos-customer-label text-muted">Cliente:</span>
            <span class="sales-pos-customer-value text-muted">Sin asignar</span>
            <UButton
              data-testid="assign-customer-trigger"
              class="sales-pos-customer-trigger"
              :color="isSalesEntryCustomer ? 'neutral' : 'primary'"
              :variant="isSalesEntryCustomer ? 'outline' : undefined"
              size="sm"
              label="Asignar cliente"
              @click="emit('open-customer-assignment')"
            />
          </template>
        </div>
        <div v-else class="sales-pos-customer-state sales-pos-customer-state-assigned flex items-center justify-between gap-3 w-full">
          <div class="sales-pos-customer-identity flex min-w-0 items-center gap-2">
            <UIcon
              v-if="isSalesEntryCustomer"
              name="i-lucide-user-round"
              class="sales-pos-customer-icon size-4 shrink-0 text-muted"
              data-testid="customer-state-icon"
            />
            <div class="flex flex-col gap-0.5 min-w-0">
              <USkeleton v-if="isCustomerMutationPending" class="h-4 w-48" data-testid="customer-slot-loading" />
              <template v-else>
                <p class="sales-pos-customer-name text-sm font-medium truncate">
                  <span class="sales-pos-customer-label text-muted font-normal">Cliente:</span>
                  {{ customerFullName }}
                </p>
                <p
                  v-if="customerAddressSummary"
                  class="sales-pos-customer-address text-xs text-muted truncate"
                >
                  <UIcon
                    v-if="isSalesEntryCustomer"
                    name="i-lucide-map-pin"
                    class="sales-pos-customer-address-icon size-3.5 shrink-0"
                    data-testid="customer-address-icon"
                  />
                  Dirección: {{ customerAddressSummary }}
                </p>
                <p
                  v-else-if="isSalesEntryCustomer"
                  class="sales-pos-customer-address sales-pos-customer-empty-address text-xs text-muted"
                  data-testid="customer-address-empty"
                >
                  Sin dirección de envío
                </p>
              </template>
            </div>
          </div>
          <div class="sales-pos-customer-actions flex items-center gap-2 shrink-0">
            <UButton
              data-testid="change-customer-trigger"
              class="sales-pos-customer-action"
              variant="link"
              color="primary"
              size="xs"
              label="Cambiar"
              :disabled="isCustomerMutationPending"
              @click="emit('open-customer-assignment')"
            />
            <UButton
              data-testid="unassign-customer-trigger"
              class="sales-pos-customer-action sales-pos-customer-action-destructive"
              variant="link"
              color="error"
              size="xs"
              label="Quitar"
              :disabled="isCustomerMutationPending"
              @click="emit('unassign-customer')"
            />
          </div>
        </div>
      </div>

      <!-- Promociones disponibles (C.4) — manual-promo accordion mounted
           above the totals footer. The outer v-if ensures the section hides
           when there are no applicable promos; the inner component also
           guards with v-if on its own. -->
      <PromocionesDisponiblesAccordion
        v-if="!isSalesEntryComposition && (applicablePromotions?.length ?? 0) > 0"
        :promotions="applicablePromotions ?? []"
        :loading="isLoadingPromotions ?? false"
        :applied-ids="appliedManualPromotionIds ?? []"
        @apply="(promotionId) => emit('apply-manual-promo', promotionId)"
        @remove="(promotionId) => emit('remove-manual-promo', promotionId)"
      />

      <!-- Phase 14b: Cart actions toolbar at bottom before totals -->
      <div
        v-if="!isSalesEntryComposition && activeDraft && activeDraft.items.length > 0"
        data-testid="cart-actions-toolbar"
        class="px-4 pb-2 flex items-center justify-end gap-1 sales-pos-cart-toolbar"
      >
        <UTooltip
          :text="'Vaciar venta'"
          :ui="portalClass ? { content: portalClass } : undefined"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            size="xs"
            :disabled="isMutating"
            @click="handleTrashClick"
          />
        </UTooltip>
        <UDropdownMenu
          :items="moreMenuItems"
          :ui="portalClass ? { content: portalClass } : undefined"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis"
            size="xs"
            :disabled="isMutating"
          />
        </UDropdownMenu>
      </div>

      <!-- Totals footer (sticky bottom) — B.2 binds the full sale so the
           footer can read backend totals + appliedOrderPromotion directly. -->
      <SaleTotalsFooter
        v-if="activeDraft"
        :sale="activeDraft"
        :is-charge-pending="isMutating"
        :themed="isThemed"
        :composition="isSalesEntryComposition"
        :portal-class="portalClass"
        @charge-click="emit('charge-click')"
        @clear-click="handleTrashClick"
        @remove-order-promo="(promotionId) => emit('remove-order-promo', promotionId)"
      />
    </section>

    <!-- Global discount modal -->
    <GlobalDiscountModal
      v-if="globalDiscountModalOpen"
      v-model:open="globalDiscountModalOpen"
      :item-count="activeDraft?.items.length ?? 0"
      :has-existing-discounts="hasGlobalDiscount"
      :portal-class="portalClass"
      :on-apply-global-discount="onApplyGlobalDiscount"
    />

    <!-- Confirm modals -->
    <ConfirmModal
      v-model:open="closeTabConfirmOpen"
      title="Cerrar venta"
      :description="getCloseTabDescription()"
      confirm-label="Cerrar venta"
      confirm-color="error"
      :ui="portalClass ? { content: portalClass } : undefined"
      @confirm="handleConfirmCloseTab"
    />

    <ConfirmModal
      v-model:open="trashConfirmOpen"
      title="Quitar todos los productos"
      description="Vas a quitar todos los productos de esta venta. ¿Continuar?"
      confirm-label="Quitar todos"
      confirm-color="error"
      :ui="portalClass ? { content: portalClass } : undefined"
      @confirm="handleConfirmTrash"
    />

    <!-- pos-price-list-tiers: confirmation gate for changing the active
         price list when the sale has items. The backend will reprice all
         non-sticky lines on success — the seller gets one chance to back
         out. -->
    <ConfirmModal
      v-model:open="priceListConfirmOpen"
      title="Cambiar lista de precios"
      description="Esto va a recalcular los precios de todos los ítems."
      confirm-label="Cambiar lista"
      confirm-color="primary"
      :ui="portalClass ? { content: portalClass } : undefined"
      @confirm="handleConfirmPriceListChange"
    />
  </div>
</template>
