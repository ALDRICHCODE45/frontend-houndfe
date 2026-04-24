<script setup lang="ts">
import { ref } from 'vue'
import SalesTabsStrip from './SalesTabsStrip.vue'
import SaleItemRow from './SaleItemRow.vue'
import SaleTotalsFooter from './SaleTotalsFooter.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { Sale } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  drafts: Sale[]
  activeDraft: Sale | null
  activeTabId: string | null
  isLoadingList: boolean
  isMutating: boolean
  itemImageMap?: Record<string, string>
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
    <div class="flex items-center gap-3 px-4 py-3 border-b border-default bg-elevated/20">
      <!-- Type toggle using UTabs -->
      <UTabs
        :items="[
          { key: 'venta', label: 'Venta', content: false },
          { key: 'pedido', label: 'Pedido', content: false, disabled: true },
        ]"
        :model-value="'venta'"
        class="w-auto"
      />

      <div class="flex-1"></div>

      <!-- Action buttons -->
      <div class="flex items-center gap-2">
        <!-- Trash button -->
        <div :title="activeDraft && activeDraft.items.length === 0 ? 'La venta no tiene productos' : ''">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            size="sm"
            :disabled="!activeDraft || activeDraft.items.length === 0 || isMutating"
            @click="handleTrashClick"
          />
        </div>

        <!-- 3-dot button -->
        <div title="Disponible próximamente">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-ellipsis"
            size="sm"
            disabled
          />
        </div>
      </div>
    </div>

    <!-- Items list (scrollable middle section) -->
    <div class="flex-1 overflow-y-auto bg-default">
      <!-- Empty state -->
      <div
        v-if="!activeDraft || activeDraft.items.length === 0"
        class="flex flex-col items-center justify-center py-20 px-4"
      >
        <div class="rounded-full bg-primary/10 p-6 mb-4">
          <UIcon name="i-lucide-shopping-cart" class="h-12 w-12 text-primary/60" />
        </div>
        <p class="text-base font-medium text-highlighted mb-1">
          Tu venta está vacía
        </p>
        <p class="text-sm text-muted text-center max-w-xs">
          Buscá productos en el panel izquierdo para agregarlos a la venta
        </p>
      </div>

      <!-- Items -->
      <div v-else class="py-2">
        <SaleItemRow
          v-for="item in activeDraft.items"
          :key="item.id"
          :item="item"
          :image-url="itemImageMap?.[item.variantId ? `${item.productId}:${item.variantId}` : item.productId] ?? null"
          :is-updating="isMutating"
          @update-qty="(itemId, quantity) => emit('update-qty', itemId, quantity)"
        />
      </div>
    </div>

    <!-- Totals footer (sticky bottom) -->
    <SaleTotalsFooter v-if="activeDraft" :items="activeDraft.items" />

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
