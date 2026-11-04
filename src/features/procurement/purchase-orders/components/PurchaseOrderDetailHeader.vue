<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { CHECKLIST_ID } from '../utils/order-checklist'
import { statusLabels, statusTones } from '../utils/order-presentation'
import OrderStepStrip from './OrderStepStrip.vue'
const props = defineProps<{ order: PurchaseOrder | null; mobile?: boolean; readOnly?: boolean; closeDisabled?: boolean; showConfirm: boolean; confirmEnabled: boolean; actions: RowAction[]; dirty: boolean; pending: number }>()
const emit = defineEmits<{ confirm: []; action: [key: string]; close: [] }>()
const primary = useTemplateRef<HTMLButtonElement>('primary')
const root = useTemplateRef<HTMLElement>('root')
// Menu items vanish when their dialog closes, so the owner gives focus back to the ⋮ trigger or, failing that, the primary.
const menuTrigger = () => root.value?.querySelector<HTMLElement>('.order-header-actions .hf-row-actions-trigger') ?? null
const focusTarget = () => primary.value ?? menuTrigger()
defineExpose({ menuTrigger, focusTarget })
const title = computed(() => props.order ? props.order.supplierDisplaySnapshot?.displayName || 'Sin proveedor' : 'Nueva orden')
// The date words follow what the status last did to the order; full dates stay in the read-only record.
const meta = computed(() => {
  const order = props.order
  if (!order) return ''
  const [word, at] = order.status === 'CONFIRMED' ? ['confirmada', order.confirmedAt] : order.status === 'CANCELLED' ? ['cancelada', order.cancelledAt] : ['guardada', order.updatedAt]
  return `${order.locationSnapshot.tenantName} · ${word} ${formatShortDateTime(at ?? order.updatedAt)}`
})
</script>

<template>
  <header ref="root" class="order-header" :class="{ 'is-mobile': mobile }">
    <div class="order-header-row">
      <UButton v-if="mobile" type="button" color="neutral" variant="ghost" icon="i-lucide-arrow-left" class="order-header-close" aria-label="Cerrar" :disabled="closeDisabled" @click="emit('close')" />
      <div class="order-header-heading">
        <div v-if="order" class="order-header-meta">
          <StatusBadge data-testid="order-status" :label="statusLabels[order.status]" :tone="statusTones[order.status]" />
          <span v-if="readOnly" class="order-readonly-chip">Solo lectura</span>
          <span>{{ meta }}</span>
        </div>
        <h2 class="order-header-title">{{ title }}</h2>
      </div>
      <div class="order-header-actions">
        <button v-if="showConfirm && !mobile" ref="primary" type="button" data-testid="confirm-order" class="hf-primary-control" :aria-disabled="confirmEnabled ? undefined : 'true'" :aria-describedby="confirmEnabled ? undefined : CHECKLIST_ID" @click="confirmEnabled && emit('confirm')"><UIcon name="i-lucide-check" aria-hidden="true" />Confirmar orden</button>
        <RowActionsMenu :actions="actions" row-label="la orden" aria-label="Más acciones de la orden" portal-class="purchase-orders-portal" @select="emit('action', $event)" />
        <UButton v-if="!mobile" type="button" color="neutral" variant="ghost" icon="i-lucide-x" class="order-header-close" aria-label="Cerrar" :disabled="closeDisabled" @click="emit('close')" />
      </div>
    </div>
    <OrderStepStrip v-if="order?.status === 'DRAFT'" :pending="pending" :dirty="dirty" :compact="mobile" />
  </header>
</template>
