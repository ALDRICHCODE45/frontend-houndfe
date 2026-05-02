<script setup lang="ts">
import { ref, computed } from 'vue'
import SalesTabsStrip from './SalesTabsStrip.vue'
import SaleItemRow from './SaleItemRow.vue'
import SaleTotalsFooter from './SaleTotalsFooter.vue'
import GlobalDiscountModal from './GlobalDiscountModal.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { ApplyItemDiscountPayload, ApplyGlobalDiscountPayload, OverrideItemPricePayload, Sale } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  drafts: Sale[]
  activeDraft: Sale | null
  activeTabId: string | null
  isLoadingList: boolean
  isMutating: boolean
  itemImageMap?: Record<string, string>
  onSubmitPriceOverride: (itemId: string, payload: OverrideItemPricePayload) => Promise<unknown>
  onApplyDiscount: (itemId: string, payload: ApplyItemDiscountPayload) => Promise<unknown>
  onRemoveDiscount: (itemId: string) => Promise<unknown>
  onRemoveItem: (itemId: string) => Promise<unknown>
  onApplyGlobalDiscount: (payload: ApplyGlobalDiscountPayload) => Promise<unknown>
  onRemoveGlobalDiscount: () => Promise<unknown>
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'switch-tab': [saleId: string]
  'close-tab': [saleId: string]
  'create-tab': []
  'update-qty': [itemId: string, quantity: number]
  'clear-items': []
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
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Tabs strip -->
    <SalesTabsStrip
      :drafts="drafts"
      :active-tab-id="activeTabId"
      @switch="emit('switch-tab', $event)"
      @close="handleCloseTabRequest"
      @create="emit('create-tab')"
    />

    <!-- Type toggle + actions row -->
    <div class="flex items-center gap-3 px-4 py-2.5 border-b border-default">
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
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div
        v-if="!activeDraft || activeDraft.items.length === 0"
        class="flex flex-col items-center justify-center h-full px-4"
      >
        <div class="rounded-2xl bg-primary/8 p-5 mb-4">
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
        />
      </div>
    </div>

    <!-- Totals footer (sticky bottom) -->
    <SaleTotalsFooter v-if="activeDraft" :items="activeDraft.items" />

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
