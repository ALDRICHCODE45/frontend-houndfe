<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usePurchaseOrders } from '../composables/usePurchaseOrders'
import { usePurchaseOrderWorkspace } from '../composables/usePurchaseOrderWorkspace'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import PurchaseOrderList from '../components/PurchaseOrderList.vue'
import PurchaseOrderForm from '../components/PurchaseOrderForm.vue'
import PurchaseOrderReadonly from '../components/PurchaseOrderReadonly.vue'
import PurchaseOrderSummary from '../components/PurchaseOrderSummary.vue'
import type { PurchaseOrderStatus } from '../interfaces/purchase-order.types'
import '../styles/purchase-orders-visual.css'
const auth = useAuthStore()
const context = computed(() => {
  const canRead = auth.userCan('read', 'ProcurementPurchaseOrder')
  const canReadSupplier = auth.userCan('read', 'ProcurementSupplier')
  const canReadProduct = auth.userCan('read', 'Product')
  return { userId: auth.user?.id ?? '', tenantId: auth.currentTenantId, ready: auth.authPhase === 'authenticated' && auth.permissionsLoaded,
    canRead, canReadSupplier, canReadProduct,
    canCreate: canRead && auth.userCan('create', 'ProcurementPurchaseOrder') && canReadSupplier && canReadProduct,
    canUpdate: canRead && auth.userCan('update', 'ProcurementPurchaseOrder'),
    canDelete: canRead && auth.userCan('delete', 'ProcurementPurchaseOrder'),
    canConfirm: canRead && auth.userCan('create', 'ProcurementOrderConfirmation'),
    canCancel: canRead && auth.userCan('create', 'ProcurementOrderCancellation') }
})
const list = usePurchaseOrders(context)
const { search, status, items, hasNext, hasPrevious, isLoading, isFetching, error } = list
const workspace = usePurchaseOrderWorkspace(context, list.refresh)
const { commands, selected, open, editorOpen, deleteOpen, dirty, formKey, detailLoading, detailError, deleteTarget, notice, locked, message, conflict, deleteRejected, canSave, transition, transitionOpen, transitionRejected, needsSave, canConfirm, canCancel } = workspace
const statusItems = [{ label: 'Todas', value: 'ALL' }, { label: 'Borradores', value: 'DRAFT' }, { label: 'Confirmadas', value: 'CONFIRMED' }, { label: 'Canceladas', value: 'CANCELLED' }]
const statusFilter = computed({ get: () => status.value ?? 'ALL', set: value => { status.value = value === 'ALL' ? undefined : value as PurchaseOrderStatus } })
// Confirm/cancel-only and read-only users open drafts without update permission (S7).
const readOnlyDraft = computed(() => selected.value?.status === 'DRAFT' && !context.value.canUpdate)
const editorTitle = computed(() => !selected.value ? 'Nueva orden' : readOnlyDraft.value ? 'Ver borrador' : { DRAFT: 'Continuar borrador', CONFIRMED: 'Orden confirmada', CANCELLED: 'Orden cancelada' }[selected.value.status])
const editorDescription = computed(() => readOnlyDraft.value ? 'Solo lectura: no tienes permiso para editar este borrador.' : !selected.value || selected.value.status === 'DRAFT' ? 'Puedes guardar datos incompletos y retomarlos después.' : selected.value.status === 'CONFIRMED' ? 'Proveedor, productos y costos quedaron congelados. No se modifican existencias, pagos ni deuda.' : 'Esta orden fue cancelada y ya no admite cambios.')
const { isPending, hasUncertainResult } = commands
if (getCurrentInstance()?.appContext.config.globalProperties.$router) onBeforeRouteLeave(workspace.canLeave)
function preventUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
watch(() => dirty.value || locked.value, value => {
  if (value) window.addEventListener('beforeunload', preventUnload)
  else window.removeEventListener('beforeunload', preventUnload)
}, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => window.removeEventListener('beforeunload', preventUnload))
</script>

<template>
  <main class="hf-theme hf-ui purchase-orders-page">
    <header class="hf-page-header"><div><h1 class="hf-page-title">Órdenes de compra</h1><p class="hf-page-subtitle">Guarda borradores, confírmalos o cancélalos. No se modifican existencias, pagos ni deuda.</p></div></header>
    <p v-if="notice" role="status" class="order-notice">{{ notice }}</p>
    <p v-if="!context.ready || !context.canRead" role="status">No tienes acceso a las órdenes de compra de esta sucursal.</p>
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm" aria-label="Órdenes de compra">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <PurchaseOrderList v-model:search="search" :items="items" :loading="isLoading" :fetching="isFetching" :error="!!error" :can-edit="context.canUpdate" :can-delete="context.canDelete" :disabled="locked || detailLoading" :active-filter-count="status ? 1 : 0" @refresh="list.refresh" @open="workspace.show" @discard="workspace.requestDelete" @clear-filters="statusFilter = 'ALL'">
          <template #filters>
            <ToolbarSelectFilter v-model="statusFilter" :items="statusItems" label="Estado" portal-class="hf-theme hf-ui purchase-orders-portal" test-id="order-status-filter" />
          </template>
          <template #actions><UButton v-if="context.ready && context.canCreate" data-testid="create-order" class="hf-primary-control" :disabled="locked || detailLoading" icon="i-lucide-plus" @click="workspace.create">Nueva orden</UButton></template>
        </PurchaseOrderList>
        <p v-if="detailLoading" role="status">Consultando orden…</p><p v-if="detailError && !open" role="alert">{{ detailError }}</p>
        <div class="order-pagination" aria-label="Páginas de órdenes"><UButton type="button" color="neutral" variant="outline" :disabled="!hasPrevious || isFetching || locked" @click="list.back">Anterior</UButton><UButton type="button" color="neutral" variant="outline" :disabled="!hasNext || isFetching || locked" @click="list.next">Siguiente</UButton></div>
      </div>
    </UCard>
    <USlideover v-model:open="editorOpen" :content="{ onCloseAutoFocus: workspace.restoreInvoker }" :title="editorTitle" :description="editorDescription" :dismissible="!locked && !detailLoading" :close="locked || detailLoading ? false : undefined" :ui="{ content: 'hf-theme hf-ui hf-form-overlay purchase-orders-portal max-w-3xl' }">
      <template #body>
        <div v-if="message" role="alert" class="order-warning">{{ message }}<div class="order-actions"><UButton v-if="hasUncertainResult" type="button" color="neutral" variant="outline" :disabled="isPending" @click="workspace.retry">Reintentar</UButton><UButton v-if="conflict && selected" type="button" color="neutral" variant="outline" :disabled="detailLoading || locked" @click="workspace.reload">Descartar cambios locales y cargar versión actual</UButton></div></div>
        <p v-if="detailError" role="alert">{{ detailError }}</p>
        <section v-if="selected && selected.status !== 'CANCELLED' && (context.canConfirm || context.canCancel)" data-testid="order-transition-bar" class="order-transition-bar" aria-label="Acciones de la orden">
          <div class="order-actions">
            <UButton v-if="selected.status === 'DRAFT' && context.canConfirm" type="button" data-testid="confirm-order" class="hf-primary-control" icon="i-lucide-check" :disabled="!canConfirm" @click="workspace.requestTransition('confirm')">Confirmar orden</UButton>
            <UButton v-if="context.canCancel" type="button" data-testid="cancel-order" color="error" variant="outline" icon="i-lucide-ban" :disabled="!canCancel" @click="workspace.requestTransition('cancel')">Cancelar orden</UButton>
          </div>
          <p v-if="needsSave" role="status" class="order-warning">Guarda tus cambios antes de confirmar o cancelar.</p>
          <p v-else-if="selected.status === 'DRAFT' && context.canConfirm && selected.canConfirm !== true" role="status" class="order-help">Completa los avisos del borrador para poder confirmarla.</p>
          <p v-else-if="selected.status === 'DRAFT' && context.canConfirm" role="status" class="order-help">Al confirmar se congelan el proveedor, los productos y los costos.</p>
          <p v-else role="status" class="order-help">La cancelación es definitiva y no se puede deshacer.</p>
        </section>
        <p v-if="(!selected || (selected.status === 'DRAFT' && !readOnlyDraft)) && (!context.canReadSupplier || !context.canReadProduct)" role="status" class="order-warning">Para guardar cambios necesitas permiso de lectura de proveedores y productos.</p>
        <PurchaseOrderReadonly v-if="open && selected && (selected.status !== 'DRAFT' || readOnlyDraft)" :order="selected" />
        <PurchaseOrderForm v-else-if="open" :key="formKey" :initial="selected" :context="context" :disabled="locked || detailLoading || !canSave" @save="workspace.save" @cancel="workspace.close" @dirty="dirty = $event" />
      </template>
    </USlideover>
    <UModal v-model:open="transitionOpen" :content="{ onCloseAutoFocus: workspace.restoreTransitionInvoker }" :title="transition === 'cancel' ? 'Cancelar orden' : 'Confirmar orden'" :description="transition === 'cancel' ? 'La cancelación es definitiva y no se puede deshacer. No se modifican existencias, pagos ni deuda.' : 'Se congelarán el proveedor, los productos y los costos de esta orden. No se modifican existencias, pagos ni deuda.'" :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui purchase-orders-portal' }">
      <template #body><PurchaseOrderSummary v-if="selected" :order="selected" /><p v-if="message" role="alert" class="order-warning">{{ message }}</p></template>
      <template #footer><UButton type="button" data-testid="cancel-transition" color="neutral" variant="outline" :disabled="locked" @click="transition = null">Volver</UButton><button v-if="hasUncertainResult" type="button" data-testid="retry-transition" class="hf-primary-control" :disabled="isPending" @click="workspace.retry">Reintentar</button><button v-else type="button" data-testid="confirm-transition" class="hf-primary-control" :class="{ 'order-confirm-danger': transition === 'cancel' }" :disabled="isPending || transitionRejected" @click="workspace.confirmTransition">{{ transition === 'cancel' ? 'Sí, cancelar orden' : 'Sí, confirmar' }}</button></template>
    </UModal>
    <UModal v-model:open="deleteOpen" :content="{ onCloseAutoFocus: workspace.restoreInvoker }" title="Descartar borrador" description="Se eliminará permanentemente. Su historial de auditoría se conserva." :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui purchase-orders-portal' }">
      <template #body><p>{{ deleteTarget?.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</p><p v-if="message" role="alert" class="order-warning">{{ message }}</p></template>
      <template #footer><UButton type="button" color="neutral" variant="outline" :disabled="locked" @click="deleteTarget = null">Cancelar</UButton><button v-if="hasUncertainResult" type="button" class="hf-primary-control" :disabled="isPending" @click="workspace.retry">Reintentar</button><button v-else type="button" data-testid="confirm-discard" class="hf-primary-control order-confirm-danger" :disabled="isPending || deleteRejected" @click="workspace.confirmDelete"><UIcon name="i-lucide-trash-2" aria-hidden="true" />Sí, descartar</button></template>
    </UModal>
  </main>
</template>
