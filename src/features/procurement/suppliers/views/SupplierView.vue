<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { suppliersApi } from '../api/suppliers.api'
import { useSupplierCommands } from '../composables/useSupplierCommands'
import { useSuppliers } from '../composables/useSuppliers'
import SupplierForm from '../components/SupplierForm.vue'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import SupplierList from '../components/SupplierList.vue'
import type { Supplier, SupplierInput } from '../interfaces/supplier.types'
import '../styles/suppliers-visual.css'

const auth = useAuthStore()
const context = computed(() => ({
  userId: auth.user?.id ?? '', tenantId: auth.currentTenantId,
  ready: auth.authPhase === 'authenticated' && auth.permissionsLoaded,
  canRead: auth.userCan('read', 'ProcurementSupplier'),
  canCreate: auth.userCan('read', 'ProcurementSupplier') && auth.userCan('create', 'ProcurementSupplier'),
  canUpdate: auth.userCan('read', 'ProcurementSupplier') && auth.userCan('update', 'ProcurementSupplier'),
  canDelete: auth.userCan('read', 'ProcurementSupplier') && auth.userCan('delete', 'ProcurementSupplier'),
}))
const { search, status, items, hasNext, hasPrevious, next, back, refresh, isLoading, isFetching, error: listError } = useSuppliers(context)
const statusItems = [{ label: 'Activos', value: 'ACTIVE' }, { label: 'Archivados', value: 'ARCHIVED' }, { label: 'Todos', value: 'ALL' }]
const statusFilter = computed({ get: () => status.value ?? 'ACTIVE', set: value => { status.value = value as NonNullable<typeof status.value> } })
const commands = useSupplierCommands(context)
const { isPending, hasUncertainResult, error: commandError } = commands
const locked = computed(() => isPending.value || hasUncertainResult.value)
const open = shallowRef(false)
const selected = shallowRef<Supplier | null>(null)
const stateTarget = shallowRef<Supplier | null>(null)
const confirmOpen = computed({ get: () => stateTarget.value !== null, set: value => { if (!value && !locked.value) stateTarget.value = null } })
const deleteTarget = shallowRef<Supplier | null>(null)
const deleteOpen = computed({ get: () => deleteTarget.value !== null, set: value => { if (!value && !locked.value) deleteTarget.value = null } })
const page = shallowRef<HTMLElement | null>(null)
const formKey = shallowRef(0)
const detailLoading = shallowRef(false)
const detailError = shallowRef(false)
const notice = shallowRef('')
const initial = computed<SupplierInput>(() => selected.value ?? { displayName: '', termsText: null, status: 'ACTIVE' })
const canWriteForm = computed(() => selected.value ? context.value.canUpdate : context.value.canCreate)
let epoch = 0
let detailController: AbortController | null = null
let overlayInvoker: HTMLButtonElement | null = null
function captureInvoker() {
  overlayInvoker = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
}
function restoreInvoker(event: Event) {
  // Controlled Nuxt UI overlays have no DialogTrigger slot to return focus to.
  event.preventDefault()
  const invoker = overlayInvoker
  const origin = epoch
  overlayInvoker = null
  void nextTick(() => {
    if (origin === epoch && !open.value && !confirmOpen.value && !deleteOpen.value && invoker?.isConnected && !invoker.disabled) {
      invoker.focus({ preventScroll: true })
    }
  })
}
function clearContext() {
  epoch++
  overlayInvoker = null
  detailController?.abort()
  detailController = null
  open.value = false
  selected.value = null
  stateTarget.value = null
  deleteTarget.value = null
  notice.value = ''
  detailError.value = false
  detailLoading.value = false
}
watch(() => [context.value.userId, context.value.tenantId, context.value.ready, context.value.canRead, context.value.canCreate, context.value.canUpdate, context.value.canDelete], clearContext, { flush: 'sync' })
onBeforeUnmount(clearContext)

const errorCode = computed(() => (commandError.value as { response?: { data?: { error?: string } } } | null)?.response?.data?.error)
const conflict = computed(() => errorCode.value === 'SUPPLIER_VERSION_CONFLICT')
const commandMessage = computed(() => {
  if (hasUncertainResult.value) return 'El resultado está pendiente de confirmar. Recupera el mismo intento antes de iniciar otro.'
  if (conflict.value) return 'El proveedor cambió en otra sesión. Tus cambios locales se conservan; consulta la versión actual antes de volver a guardar.'
  if (!commandError.value) return ''
  const messages: Record<string, string> = {
    MALFORMED: 'Revisa el nombre, las condiciones y el estado del proveedor.',
    UNAUTHORIZED: 'La sesión dejó de estar disponible. Vuelve a iniciar sesión.',
    FORBIDDEN: 'No tienes permiso para realizar esta operación.',
    NOT_FOUND: 'El proveedor ya no está disponible en esta sucursal.',
    IDEMPOTENCY_KEY_CONFLICT: 'Este intento no coincide con el registrado. Consulta el estado antes de volver a operar.',
    SUPPLIER_HAS_PURCHASE_ORDERS: 'Este proveedor tiene órdenes de compra y no se puede eliminar. Puedes archivarlo.',
  }
  return messages[errorCode.value ?? ''] ?? 'No se pudo completar la operación.'
})
// Deletion has no local buffer to preserve, so its conflict copy differs from editing.
const deleteMessage = computed(() => conflict.value && !hasUncertainResult.value
  ? 'El proveedor cambió en otra sesión. Cierra esta confirmación y vuelve a intentarlo con la versión actual.'
  : commandMessage.value)
const deleteRejected = computed(() => !hasUncertainResult.value && commandError.value !== null)
function create() {
  if (!context.value.ready || !context.value.canCreate || locked.value) return
  captureInvoker()
  commands.clearFeedback()
  selected.value = null
  formKey.value++
  open.value = true
}
async function show(supplier: Supplier) {
  if (!context.value.ready || !context.value.canRead || locked.value) return
  // Capture before the async read disables (and browsers blur) the row button.
  // Explicit reload inside the open form must retain the original invoker.
  if (!open.value) captureInvoker()
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller
  const origin = epoch
  detailLoading.value = true
  detailError.value = false
  try {
    const current = await suppliersApi.get(supplier.id, controller.signal)
    if (origin !== epoch || controller.signal.aborted || detailController !== controller) return
    commands.clearFeedback()
    selected.value = current
    formKey.value++
    open.value = true
  } catch {
    if (origin === epoch && !controller.signal.aborted) detailError.value = true
  } finally {
    if (origin === epoch && detailController === controller) detailLoading.value = false
  }
}
async function finish(outcome: Awaited<ReturnType<typeof commands.create>>, origin: number) {
  if (origin !== epoch || outcome.status !== 'applied') return
  open.value = false
  stateTarget.value = null
  notice.value = 'Proveedor guardado. Actualizando la lista…'
  const result = await refresh()
  if (origin !== epoch) return
  notice.value = result?.isError
    ? 'Proveedor guardado; no se pudo actualizar la lista. Puedes volver a consultarla sin repetir el guardado.'
    : 'Proveedor guardado correctamente.'
}
async function save(input: SupplierInput) {
  if (!canWriteForm.value || locked.value) return
  const origin = epoch
  const result = selected.value
    ? await commands.update(selected.value.id, { expectedVersion: selected.value.version, changes: { displayName: input.displayName, termsText: input.termsText } })
    : await commands.create(input)
  await finish(result, origin)
}
function requestStatus(supplier: Supplier) {
  if (context.value.ready && context.value.canUpdate && !locked.value) {
    captureInvoker()
    commands.clearFeedback()
    stateTarget.value = supplier
  }
}
async function changeStatus() {
  const target = stateTarget.value
  if (!target || !context.value.canUpdate || locked.value) return
  const origin = epoch
  await finish(await commands.update(target.id, { expectedVersion: target.version, changes: { status: target.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' } }), origin)
}
function requestDelete(supplier: Supplier) {
  if (context.value.ready && context.value.canDelete && !locked.value) {
    captureInvoker()
    commands.clearFeedback()
    deleteTarget.value = supplier
  }
}
async function confirmDelete() {
  const target = deleteTarget.value
  if (!target || !context.value.canDelete || locked.value) return
  const origin = epoch
  await finishDelete(await commands.delete(target.id, { expectedVersion: target.version }), origin)
}
async function finishDelete(outcome: Awaited<ReturnType<typeof commands.delete>>, origin: number) {
  if (origin !== epoch || outcome.status !== 'deleted') return
  // The row that opened the confirmation disappears; continue from the search.
  overlayInvoker = null
  deleteTarget.value = null
  if (selected.value?.id === outcome.id) selected.value = null
  notice.value = 'Proveedor eliminado. Actualizando la lista…'
  const result = await refresh()
  if (origin !== epoch) return
  notice.value = result?.isError
    ? 'Proveedor eliminado; no se pudo actualizar la lista. Puedes volver a consultarla sin repetir la eliminación.'
    : 'Proveedor eliminado correctamente.'
  await nextTick()
  if (origin === epoch && !open.value && !confirmOpen.value && !deleteOpen.value) {
    page.value?.querySelector<HTMLInputElement>('input[placeholder="Buscar proveedor..."]')?.focus({ preventScroll: true })
  }
}
async function retry() {
  const origin = epoch
  const outcome = await commands.retry()
  if (outcome.status === 'deleted') await finishDelete(outcome, origin)
  else await finish(outcome, origin)
}
async function reloadSelected() {
  if (selected.value) await show(selected.value)
}
</script>

<template>
  <main ref="page" class="hf-theme hf-ui suppliers-page">
    <header class="hf-page-header suppliers-header">
      <div><h1 class="hf-page-title">Proveedores</h1><p class="hf-page-subtitle">Contactos comerciales y condiciones para preparar tus compras.</p></div>
    </header>
    <p v-if="notice" role="status" class="supplier-notice">{{ notice }}</p>
    <p v-if="!context.ready || !context.canRead" role="status">No tienes acceso a los proveedores de esta sucursal.</p>
    <UCard v-else :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm" aria-label="Directorio de proveedores">
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
      <SupplierList v-model:search="search" :items="items" :loading="isLoading" :fetching="isFetching" :error="!!listError" :can-edit="context.canUpdate" :can-delete="context.ready && context.canDelete" :disabled="locked || detailLoading" :active-filter-count="status !== 'ACTIVE' ? 1 : 0" @refresh="refresh" @open="show" @change-status="requestStatus" @delete="requestDelete" @clear-filters="status = 'ACTIVE'">
        <template #filters>
          <ToolbarSelectFilter v-model="statusFilter" :items="statusItems" label="Estado" portal-class="hf-theme hf-ui suppliers-portal" test-id="supplier-status-filter" />
        </template>
        <template #actions>
          <UButton v-if="context.ready && context.canCreate" data-testid="create-supplier" class="hf-primary-control" :disabled="locked" icon="i-lucide-plus" @click="create">Crear proveedor</UButton>
        </template>
      </SupplierList>
      <p v-if="detailLoading" role="status">Consultando proveedor…</p>
      <p v-if="detailError" role="alert">No se pudo consultar el proveedor. Intenta abrirlo de nuevo.</p>
      <div class="supplier-pagination" aria-label="Páginas de proveedores">
        <button type="button" class="supplier-button" :disabled="!hasPrevious || isFetching" @click="back">Anterior</button>
        <button type="button" class="supplier-button" :disabled="!hasNext || isFetching" @click="next">Siguiente</button>
      </div>
      </div>
    </UCard>
    <div v-if="commandMessage && !open && !confirmOpen && !deleteOpen" role="alert" class="supplier-warning">{{ commandMessage }}<button v-if="hasUncertainResult" type="button" class="supplier-button" :disabled="isPending" @click="retry">Recuperar resultado</button></div>
    <USlideover v-model:open="open" :content="{ onCloseAutoFocus: restoreInvoker }" :title="selected ? 'Detalle del proveedor' : 'Crear proveedor'" description="Datos comerciales de esta sucursal. No se modifican existencias, pagos ni deuda." :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui hf-form-overlay suppliers-portal' }">
      <template #body>
        <div v-if="commandMessage" role="alert" class="supplier-warning">
          {{ commandMessage }}
          <button v-if="hasUncertainResult" type="button" class="supplier-button" :disabled="isPending" @click="retry">Recuperar resultado</button>
          <button v-if="conflict && selected" type="button" data-testid="reload-supplier" class="supplier-button" :disabled="detailLoading" @click="reloadSelected">Descartar cambios locales y cargar versión actual</button>
        </div>
        <SupplierForm v-if="open && canWriteForm" :key="formKey" :initial="initial" :editing="!!selected" :disabled="locked || detailLoading" @save="save" @cancel="open = false" />
        <dl v-else-if="open && selected" data-testid="supplier-readonly" class="supplier-readonly"><dt>Nombre</dt><dd>{{ selected.displayName }}</dd><dt>Condiciones</dt><dd>{{ selected.termsText || 'Sin condiciones registradas' }}</dd><dt>Estado</dt><dd>{{ selected.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</dd></dl>
      </template>
    </USlideover>
    <UModal v-model:open="confirmOpen" :content="{ onCloseAutoFocus: restoreInvoker }" :title="stateTarget?.status === 'ACTIVE' ? 'Archivar proveedor' : 'Reactivar proveedor'" :description="stateTarget?.status === 'ACTIVE' ? 'Se conservarán sus datos e historial. No estará disponible para nuevas compras hasta reactivarlo.' : 'El proveedor volverá a estar disponible para nuevas compras.'" :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui suppliers-portal' }">
      <template #body><p>{{ stateTarget?.displayName }}</p><p v-if="commandMessage" role="alert" class="supplier-warning">{{ commandMessage }}</p></template>
      <template #footer>
        <button type="button" class="supplier-button" :disabled="locked" @click="stateTarget = null">Cancelar</button>
        <button v-if="hasUncertainResult" type="button" class="hf-primary-control" :disabled="isPending" @click="retry">Recuperar resultado</button>
        <button v-else type="button" data-testid="confirm-status" class="hf-primary-control" :disabled="isPending || conflict" @click="changeStatus">{{ stateTarget?.status === 'ACTIVE' ? 'Archivar' : 'Reactivar' }}</button>
      </template>
    </UModal>
    <UModal v-model:open="deleteOpen" :content="{ onCloseAutoFocus: restoreInvoker }" title="Eliminar proveedor" description="Se eliminará permanentemente. Su historial de auditoría se conserva." :dismissible="!locked" :close="locked ? false : undefined" :ui="{ content: 'hf-theme hf-ui suppliers-portal' }">
      <template #body><p>{{ deleteTarget?.displayName }}</p><p v-if="deleteMessage" role="alert" class="supplier-warning">{{ deleteMessage }}</p></template>
      <template #footer>
        <button type="button" data-testid="cancel-delete" class="supplier-button" :disabled="locked" @click="deleteTarget = null">Cancelar</button>
        <button v-if="hasUncertainResult" type="button" class="hf-primary-control" :disabled="isPending" @click="retry">Recuperar resultado</button>
        <button v-else type="button" data-testid="confirm-delete" class="hf-primary-control supplier-confirm-danger" :disabled="isPending || deleteRejected" @click="confirmDelete"><UIcon name="i-lucide-trash-2" aria-hidden="true" />Sí, eliminar</button>
      </template>
    </UModal>
  </main>
</template>

<style scoped>
.suppliers-page { display: grid; gap: 24px; color: var(--hf-ink); }
.suppliers-header { align-items: flex-start; }
.supplier-button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--hf-field-border); border-radius: 6px; background: var(--hf-field); color: var(--hf-ink); font: inherit; }
.supplier-button { background: var(--hf-surface); }
.hf-primary-control.supplier-confirm-danger:not(:disabled) { display: inline-flex; align-items: center; gap: 6px; background: var(--ui-error); border-color: var(--ui-error); color: var(--ui-bg); }
.supplier-pagination { display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--hf-border); padding-top: 16px; }
.supplier-notice { background: var(--hf-active-soft); color: var(--hf-ink); padding: 12px 16px; border-radius: 6px; }
.supplier-warning { background: var(--hf-warning-soft); color: var(--hf-warning); padding: 12px; margin-bottom: 16px; border-radius: 6px; overflow-wrap: anywhere; }
.supplier-warning button { display: block; margin-top: 12px; }
.supplier-readonly { display: grid; gap: 8px; overflow-wrap: anywhere; }
.supplier-readonly dt { color: var(--hf-muted); font-size: 13px; }
.supplier-readonly dd { margin-bottom: 16px; white-space: pre-wrap; }
button:disabled { opacity: .55; cursor: not-allowed; }
button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }

</style>
