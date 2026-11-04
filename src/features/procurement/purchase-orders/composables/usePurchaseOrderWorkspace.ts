import { computed, nextTick, onScopeDispose, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { usePurchaseOrderCommands, type PurchaseOrderCommandContext } from './usePurchaseOrderCommands'
import { usePurchaseOrder, type PurchaseOrderReadContext } from './usePurchaseOrders'
import type { OrderInput, PurchaseOrder, PurchaseOrderSummary } from '../interfaces/purchase-order.types'
import { commandMessage } from '../utils/order-diagnostics'
export interface OrderWorkspaceContext extends PurchaseOrderCommandContext, PurchaseOrderReadContext { canReadProduct: boolean; canReadSupplier: boolean }
export function usePurchaseOrderWorkspace(context: MaybeRefOrGetter<OrderWorkspaceContext>, refresh: () => Promise<unknown>) {
  const commands = usePurchaseOrderCommands(() => {
    const c = toValue(context)
    return { ...c, canCreate: c.canRead && c.canCreate && c.canReadProduct && c.canReadSupplier,
      canUpdate: c.canRead && c.canUpdate && c.canReadProduct && c.canReadSupplier,
      canDelete: c.canRead && c.canDelete, canConfirm: c.canRead && c.canConfirm, canCancel: c.canRead && c.canCancel }
  })
  const id = shallowRef<string | null>(null)
  const detail = usePurchaseOrder(id, context)
  const selected = shallowRef<PurchaseOrder | null>(null)
  const open = shallowRef(false)
  const dirty = shallowRef(false)
  const formKey = shallowRef(0)
  const detailLoading = shallowRef(false)
  const detailError = shallowRef('')
  const deleteTarget = shallowRef<PurchaseOrderSummary | null>(null)
  const transition = shallowRef<'confirm' | 'cancel' | null>(null)
  // The intent of the last command owns how its error reads and what its success says.
  const lastKind = shallowRef<'save' | 'delete' | 'confirm' | 'cancel'>('save')
  const notice = shallowRef('')
  const locked = computed(() => commands.isPending.value || commands.hasUncertainResult.value)
  const message = computed(() => commandMessage(commands.error.value, commands.hasUncertainResult.value, lastKind.value === 'confirm' || lastKind.value === 'cancel' ? lastKind.value : 'edit'))
  const errorCode = computed(() => (commands.error.value as { response?: { data?: { error?: string } } } | null)?.response?.data?.error)
  const conflict = computed(() => errorCode.value === 'ORDER_VERSION_CONFLICT' && (lastKind.value === 'save' || lastKind.value === 'delete'))
  const deleteRejected = computed(() => commands.error.value !== null && !commands.hasUncertainResult.value)
  const transitionRejected = deleteRejected
  // A rejected transition means the order moved on: show its current state instead of retrying.
  const staleCodes = ['ORDER_NOT_READY', 'ELIGIBILITY_CHANGED', 'SUPPLIER_VERSION_CONFLICT', 'ORDER_VERSION_CONFLICT', 'ORDER_STATE_CONFLICT', 'SUPPLIER_ARCHIVED']
  function transitionAllowed(kind: 'confirm' | 'cancel') {
    const c = toValue(context); const order = selected.value
    if (!order || !c.ready || !c.canRead) return false
    return kind === 'confirm' ? c.canConfirm && order.status === 'DRAFT' && order.canConfirm === true : c.canCancel && order.status !== 'CANCELLED'
  }
  const needsSave = computed(() => dirty.value && (transitionAllowed('confirm') || transitionAllowed('cancel')))
  const canConfirm = computed(() => !dirty.value && !locked.value && transitionAllowed('confirm'))
  const canCancel = computed(() => !dirty.value && !locked.value && transitionAllowed('cancel'))
  // A created draft becomes an update target: create-only users must not keep
  // an enabled form whose save would be silently refused.
  const canSave = computed(() => {
    const c = toValue(context)
    const references = c.canRead && c.canReadSupplier && c.canReadProduct
    return references && (selected.value ? c.canUpdate && selected.value.status === 'DRAFT' : c.canCreate)
  })
  let epoch = 0
  let request = 0
  let invoker: HTMLButtonElement | null = null
  // The transition dialog opens over the editor, so it keeps its own invoker.
  let transitionInvoker: HTMLButtonElement | null = null
  function captureInvoker() { invoker = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null }
  function restoreInvoker(event: Event) {
    event.preventDefault()
    const button = invoker; const origin = epoch
    invoker = null
    void nextTick(() => { if (origin === epoch && !open.value && !deleteTarget.value && !transition.value && button?.isConnected && !button.disabled) button.focus({ preventScroll: true }) })
  }
  function restoreTransitionInvoker(event: Event) {
    event.preventDefault()
    const button = transitionInvoker; const origin = epoch
    transitionInvoker = null
    void nextTick(() => { if (origin === epoch && open.value && !transition.value && button?.isConnected && !button.disabled) button.focus({ preventScroll: true }) })
  }
  function reset() {
    epoch++; request++; invoker = null; transitionInvoker = null; id.value = null; selected.value = null; open.value = false; dirty.value = false
    deleteTarget.value = null; transition.value = null; lastKind.value = 'save'; detailLoading.value = false; detailError.value = ''; notice.value = ''
  }
  watch(() => { const c = toValue(context); return [c.userId, c.tenantId, c.ready, c.canRead, c.canCreate, c.canUpdate, c.canDelete, c.canConfirm, c.canCancel, c.canReadProduct, c.canReadSupplier] }, reset, { flush: 'sync' })
  onScopeDispose(reset)
  function canLeave() {
    if (locked.value) return false
    return !dirty.value || window.confirm('Tienes cambios sin guardar en el borrador. ¿Salir sin guardarlos?')
  }
  function close() {
    if (!canLeave()) return false
    open.value = false; dirty.value = false; request++; detailLoading.value = false
    return true
  }
  const editorOpen = computed({ get: () => open.value, set: value => { if (!value) close() } })
  const deleteOpen = computed({ get: () => deleteTarget.value !== null, set: value => { if (!value && !locked.value) deleteTarget.value = null } })
  const transitionOpen = computed({ get: () => transition.value !== null, set: value => { if (!value && !locked.value) transition.value = null } })
  function create() {
    const c = toValue(context)
    if (!c.ready || !c.canCreate || locked.value || detailLoading.value) return
    captureInvoker(); commands.clearFeedback(); selected.value = null; id.value = null; dirty.value = false; formKey.value++; open.value = true
  }
  async function show(row: Pick<PurchaseOrderSummary, 'id'>, reload = false) {
    const c = toValue(context)
    if (!c.ready || !c.canRead || locked.value || detailLoading.value) return
    if (reload && dirty.value && !window.confirm('Se reemplazarán tus cambios locales por la versión actual. ¿Continuar?')) return
    if (!open.value) captureInvoker()
    const origin = epoch; const token = ++request
    id.value = row.id; detailLoading.value = true; detailError.value = ''
    await nextTick()
    try {
      const result = await detail.refresh()
      if (origin !== epoch || token !== request) return
      if (result?.isError || !detail.order.value) {
        detailError.value = commandMessage(result?.error ?? new Error('detail'))
        return
      }
      selected.value = detail.order.value; commands.clearFeedback(); dirty.value = false; formKey.value++; open.value = true
    } catch (error) {
      if (origin === epoch && token === request) detailError.value = commandMessage(error)
    } finally { if (origin === epoch && token === request) detailLoading.value = false }
  }
  // Replaces the selection with the current server state, keeping the command message.
  async function reread(origin: number) {
    const order = selected.value
    if (!order) return
    id.value = order.id; detailLoading.value = true
    const token = ++request
    try {
      const result = await detail.refresh()
      if (origin !== epoch || token !== request) return
      if (result?.isError || !detail.order.value) detailError.value = commandMessage(result?.error ?? new Error('detail'))
      else { selected.value = detail.order.value; dirty.value = false; formKey.value++; detailError.value = '' }
    } catch (error) {
      if (origin === epoch && token === request) detailError.value = commandMessage(error)
    } finally { if (origin === epoch && token === request) detailLoading.value = false }
  }
  async function finish(outcome: Awaited<ReturnType<typeof commands.create>>, origin: number) {
    const transitioning = lastKind.value === 'confirm' || lastKind.value === 'cancel'
    if (origin === epoch && transitioning && outcome.status === 'rejected' && staleCodes.includes(errorCode.value ?? '')) {
      transition.value = null
      await reread(origin)
      try { await refresh() } catch { /* the list stays stale until the next manual refresh */ }
      return
    }
    if (origin !== epoch || !['applied', 'deleted'].includes(outcome.status)) return
    if (outcome.status === 'applied') {
      selected.value = outcome.order; id.value = outcome.order.id; dirty.value = false; formKey.value++; transition.value = null
      notice.value = { save: 'Borrador guardado correctamente.', confirm: 'Orden confirmada correctamente.', cancel: 'Orden cancelada correctamente.', delete: '' }[lastKind.value]
    } else if (outcome.status === 'deleted') {
      invoker = null; deleteTarget.value = null; notice.value = 'Borrador descartado correctamente.'
    }
    try { const result = await refresh() as { isError?: boolean } | undefined
      if (origin === epoch && result?.isError) notice.value += ' No se pudo actualizar la lista. Actualízala sin repetir la operación.'
    } catch { if (origin === epoch) notice.value += ' No se pudo actualizar la lista. Actualízala sin repetir la operación.' }
  }
  async function save(input: OrderInput) {
    const c = toValue(context)
    if (locked.value || detailLoading.value || !open.value || !(selected.value ? c.canUpdate : c.canCreate)) return
    const origin = epoch
    lastKind.value = 'save'
    const outcome = selected.value ? await commands.save(selected.value.id, { expectedVersion: selected.value.version, order: input }) : await commands.create(input)
    await finish(outcome, origin)
  }
  function requestDelete(row: PurchaseOrderSummary) {
    const c = toValue(context)
    if (!c.ready || !c.canRead || !c.canDelete || locked.value || detailLoading.value) return
    captureInvoker(); commands.clearFeedback(); deleteTarget.value = row
  }
  async function confirmDelete() {
    const c = toValue(context); const target = deleteTarget.value
    if (!target || !c.ready || !c.canRead || !c.canDelete || locked.value || deleteRejected.value) return
    const origin = epoch
    lastKind.value = 'delete'
    await finish(await commands.delete(target.id, { expectedVersion: target.version }), origin)
  }
  function requestTransition(kind: 'confirm' | 'cancel') {
    if (detailLoading.value || locked.value || dirty.value || !transitionAllowed(kind)) return
    transitionInvoker = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null
    commands.clearFeedback(); transition.value = kind
  }
  async function confirmTransition() {
    const kind = transition.value; const order = selected.value
    if (!kind || !order || locked.value || detailLoading.value || dirty.value || transitionRejected.value || !transitionAllowed(kind)) return
    const origin = epoch
    lastKind.value = kind
    await finish(kind === 'confirm'
      ? await commands.confirm(order.id, { expectedVersion: order.version, expectedSupplierVersion: order.supplierCurrentVersion, expectedReferenceToken: order.referenceToken })
      : await commands.cancel(order.id, { expectedVersion: order.version }), origin)
  }
  async function retry() { const origin = epoch; await finish(await commands.retry(), origin) }
  function reload() { if (selected.value) return show(selected.value, true) }
  return { commands, selected, open, editorOpen, deleteOpen, dirty, formKey, detailLoading, detailError, deleteTarget, notice, locked, message, conflict, deleteRejected, canSave,
    transition, transitionOpen, transitionRejected, needsSave, canConfirm, canCancel,
    create, show, save, close, canLeave, requestDelete, confirmDelete, requestTransition, confirmTransition, retry, reload, restoreInvoker, restoreTransitionInvoker }
}
