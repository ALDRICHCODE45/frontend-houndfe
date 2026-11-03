<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usePurchaseOrders } from '../composables/usePurchaseOrders'
import { usePurchaseOrderWorkspace } from '../composables/usePurchaseOrderWorkspace'
import PurchaseOrderList from '../components/PurchaseOrderList.vue'
import PurchaseOrderForm from '../components/PurchaseOrderForm.vue'
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
    canDelete: canRead && auth.userCan('delete', 'ProcurementPurchaseOrder') }
})
const list = usePurchaseOrders(context)
const { search, items, hasNext, hasPrevious, isLoading, isFetching, error } = list
const workspace = usePurchaseOrderWorkspace(context, list.refresh)
const { commands, selected, open, editorOpen, deleteOpen, dirty, formKey, detailLoading, detailError, deleteTarget, notice, locked, message, conflict, deleteRejected } = workspace
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
    <header class="hf-page-header"><div><h1 class="hf-page-title">Órdenes de compra</h1><p class="hf-page-subtitle">Guarda y retoma tus borradores. No se modifican existencias, pagos ni deuda.</p></div></header>
    <p v-if="notice" role="status" class="order-notice">{{ notice }}</p>
    <p v-if="!context.ready || !context.canRead" role="status">No tienes acceso a las órdenes de compra de esta sucursal.</p>
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm" aria-label="Borradores de órdenes de compra">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <PurchaseOrderList v-model:search="search" :items="items" :loading="isLoading" :fetching="isFetching" :error="!!error" :can-edit="context.canUpdate" :can-delete="context.canDelete" :disabled="locked || detailLoading" @refresh="list.refresh" @open="workspace.show" @discard="workspace.requestDelete">
          <template #actions><UButton v-if="context.ready && context.canCreate" data-testid="create-order" class="hf-primary-control" :disabled="locked || detailLoading" icon="i-lucide-plus" @click="workspace.create">Nueva orden</UButton></template>
        </PurchaseOrderList>
        <p v-if="detailLoading" role="status">Consultando borrador…</p><p v-if="detailError && !open" role="alert">{{ detailError }}</p>
        <div class="order-pagination" aria-label="Páginas de borradores"><UButton type="button" color="neutral" variant="outline" :disabled="!hasPrevious || isFetching || locked" @click="list.back">Anterior</UButton><UButton type="button" color="neutral" variant="outline" :disabled="!hasNext || isFetching || locked" @click="list.next">Siguiente</UButton></div>
      </div>
    </UCard>
    <USlideover v-model:open="editorOpen" :content="{ onCloseAutoFocus: workspace.restoreInvoker }" :title="selected ? 'Continuar borrador' : 'Nueva orden'" description="Puedes guardar datos incompletos y retomarlos después." :dismissible="!locked && !detailLoading" :close="locked || detailLoading ? false : undefined" :ui="{ content: 'hf-theme hf-ui hf-form-overlay purchase-orders-portal max-w-3xl' }">
      <template #body>
        <div v-if="message" role="alert" class="order-warning">{{ message }}<div class="order-actions"><UButton v-if="hasUncertainResult" type="button" color="neutral" variant="outline" :disabled="isPending" @click="workspace.retry">Reintentar</UButton><UButton v-if="conflict && selected" type="button" color="neutral" variant="outline" :disabled="detailLoading || locked" @click="workspace.reload">Descartar cambios locales y cargar versión actual</UButton></div></div>
        <p v-if="detailError" role="alert">{{ detailError }}</p>
        <p v-if="!context.canReadSupplier || !context.canReadProduct" role="status" class="order-warning">Para guardar cambios necesitas permiso de lectura de proveedores y productos.</p>
        <PurchaseOrderForm v-if="open" :key="formKey" :initial="selected" :context="context" :disabled="locked || detailLoading || !context.canReadSupplier || !context.canReadProduct" @save="workspace.save" @cancel="workspace.close" @dirty="dirty = $event" />
      </template>
    </USlideover>
    <UModal v-model:open="deleteOpen" :content="{ onCloseAutoFocus: workspace.restoreInvoker }" title="Descartar borrador" description="Se eliminará permanentemente. Su historial de auditoría se conserva." :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui purchase-orders-portal' }">
      <template #body><p>{{ deleteTarget?.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</p><p v-if="message" role="alert" class="order-warning">{{ message }}</p></template>
      <template #footer><UButton type="button" color="neutral" variant="outline" :disabled="locked" @click="deleteTarget = null">Cancelar</UButton><button v-if="hasUncertainResult" type="button" class="hf-primary-control" :disabled="isPending" @click="workspace.retry">Reintentar</button><button v-else type="button" data-testid="confirm-discard" class="hf-primary-control order-confirm-danger" :disabled="isPending || deleteRejected" @click="workspace.confirmDelete"><UIcon name="i-lucide-trash-2" aria-hidden="true" />Sí, descartar</button></template>
    </UModal>
  </main>
</template>
