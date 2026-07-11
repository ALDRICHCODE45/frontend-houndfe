<script setup lang="ts">
import { ref, computed } from 'vue'
import SalesTabsStrip from './SalesTabsStrip.vue'
import SaleItemRow from './SaleItemRow.vue'
import SaleTotalsFooter from './SaleTotalsFooter.vue'
import PromocionesDisponiblesAccordion from './PromocionesDisponiblesAccordion.vue'
import GlobalDiscountModal from './GlobalDiscountModal.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type {
  ApplicablePromotion,
  ApplyItemDiscountPayload,
  ApplyGlobalDiscountPayload,
  OverrideItemPricePayload,
  Sale,
} from '../interfaces/sale.types'

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
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const trashConfirmOpen = ref(false)
const closeTabConfirmOpen = ref(false)
const tabToClose = ref<string | null>(null)
const globalDiscountModalOpen = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

const hasGlobalDiscount = computed(() =>
  props.activeDraft?.items.some((item) => !!item.discountType) ?? false,
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

function handleCloseTabRequest(saleId: string) {
  tabToClose.value = saleId
  closeTabConfirmOpen.value = true
}

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

</script>

<template>
  <div class="h-full flex flex-col min-w-0 bg-default">
    <!-- Tabs strip -->
    <SalesTabsStrip
      :drafts="drafts"
      :active-tab-id="activeTabId"
      @switch="emit('switch-tab', $event)"
      @close="handleCloseTabRequest"
      @create="emit('create-tab')"
    />

    <!-- Type toggle + actions row -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-default bg-elevated/20">
      <!-- Type toggle using UTabs with icons -->
      <UTabs
        :items="[
          { key: 'venta', label: 'Venta', icon: 'i-lucide-shopping-bag', content: false },
          { key: 'pedido', label: 'Pedido', icon: 'i-lucide-clipboard-list', content: false, disabled: true },
        ]"
        :model-value="'venta'"
        class="w-auto"
      />

      <div class="flex-1"></div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1">
        <!-- Trash button -->
        <UTooltip :text="activeDraft && activeDraft.items.length === 0 ? 'La venta no tiene productos' : 'Vaciar venta'">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            size="xs"
            :disabled="!activeDraft || activeDraft.items.length === 0 || isMutating"
            @click="handleTrashClick"
          />
        </UTooltip>

        <!-- 3-dot menu -->
        <UDropdownMenu :items="moreMenuItems">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis"
            size="xs"
            :disabled="!activeDraft || activeDraft.items.length === 0 || isMutating"
          />
        </UDropdownMenu>
      </div>
    </div>



    <!-- Items list (scrollable middle section) -->
      <div class="flex-1 overflow-y-auto bg-[#fafafa] dark:bg-[#09090b]">
      <!-- Empty state -->
      <div
        v-if="!activeDraft || activeDraft.items.length === 0"
          class="flex flex-col items-center justify-center h-full px-4"
        >
        <div class="rounded-2xl bg-primary/8 border border-primary/15 p-5 mb-4">
          <UIcon name="i-lucide-shopping-bag" class="h-10 w-10 text-primary/50" />
        </div>
        <p class="text-sm font-semibold text-highlighted mb-1">
          Tu venta está vacía
        </p>
        <p class="text-xs text-muted text-center max-w-[220px] leading-relaxed">
          Seleccioná productos del catálogo para agregarlos a esta venta
        </p>
      </div>

      <!-- Items -->
      <div v-else class="py-1">
        <SaleItemRow
          v-for="item in activeDraft.items"
          :key="item.id"
          :sale-id="activeDraft.id"
          :is-draft="activeDraft.status === 'DRAFT'"
          :item="item"
          :image-url="itemImageMap?.[item.variantId ? `${item.productId}:${item.variantId}` : item.productId] ?? null"
          :is-updating="isMutating"
          :on-submit-price-override="onSubmitPriceOverride"
          :on-apply-discount="onApplyDiscount"
          :on-remove-discount="onRemoveDiscount"
          :on-remove-item="onRemoveItem"
          @update-qty="(itemId, quantity) => emit('update-qty', itemId, quantity)"
          @remove-promo="(promotionId) => emit('remove-promo', promotionId)"
        />
      </div>
    </div>

    <!-- Customer slot (slim line above totals) -->
    <div class="border-t border-default px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div v-if="!activeDraft?.customer" class="flex items-center gap-2">
        <USkeleton v-if="isCustomerMutationPending" class="h-4 w-32" data-testid="customer-slot-loading" />
        <template v-else>
          <span class="text-muted">Cliente:</span>
          <span class="text-muted">Sin asignar</span>
          <UButton
            data-testid="assign-customer-trigger"
            variant="link"
            color="primary"
            size="xs"
            label="Asignar cliente"
            @click="emit('open-customer-assignment')"
          />
        </template>
      </div>
      <div v-else class="flex items-center justify-between gap-3 w-full">
        <div class="flex flex-col gap-0.5 min-w-0">
          <USkeleton v-if="isCustomerMutationPending" class="h-4 w-48" data-testid="customer-slot-loading" />
          <template v-else>
            <p class="text-sm font-medium truncate">
              <span class="text-muted font-normal">Cliente:</span> {{ customerFullName }}
            </p>
            <p v-if="customerAddressSummary" class="text-xs text-muted truncate">
              Dirección: {{ customerAddressSummary }}
            </p>
          </template>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <UButton
            data-testid="change-customer-trigger"
            variant="link"
            color="primary"
            size="xs"
            label="Cambiar"
            :disabled="isCustomerMutationPending"
            @click="emit('open-customer-assignment')"
          />
          <UButton
            data-testid="unassign-customer-trigger"
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
      v-if="(applicablePromotions?.length ?? 0) > 0"
      :promotions="applicablePromotions ?? []"
      :loading="isLoadingPromotions ?? false"
      :applied-ids="appliedManualPromotionIds ?? []"
      @apply="(promotionId) => emit('apply-manual-promo', promotionId)"
      @remove="(promotionId) => emit('remove-manual-promo', promotionId)"
    />

    <!-- Totals footer (sticky bottom) — B.2 binds the full sale so the
         footer can read backend totals + appliedOrderPromotion directly. -->
    <SaleTotalsFooter
      v-if="activeDraft"
      :sale="activeDraft"
      :is-charge-pending="isMutating"
      @charge-click="emit('charge-click')"
      @remove-order-promo="(promotionId) => emit('remove-order-promo', promotionId)"
    />

    <!-- Global discount modal -->
    <GlobalDiscountModal
      v-if="globalDiscountModalOpen"
      v-model:open="globalDiscountModalOpen"
      :item-count="activeDraft?.items.length ?? 0"
      :has-existing-discounts="hasGlobalDiscount"
      :on-apply-global-discount="onApplyGlobalDiscount"
    />

    <!-- Confirm modals -->
    <ConfirmModal
      v-model:open="closeTabConfirmOpen"
      title="Cerrar venta"
      :description="getCloseTabDescription()"
      confirm-label="Cerrar venta"
      confirm-color="error"
      @confirm="handleConfirmCloseTab"
    />

    <ConfirmModal
      v-model:open="trashConfirmOpen"
      title="Quitar todos los productos"
      description="Vas a quitar todos los productos de esta venta. ¿Continuar?"
      confirm-label="Quitar todos"
      confirm-color="error"
      @confirm="handleConfirmTrash"
    />
  </div>
</template>
