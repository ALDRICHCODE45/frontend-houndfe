<script setup lang="ts">
import { computed, nextTick, reactive, shallowRef, watch } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import { useSuppliers } from '@/features/procurement/suppliers/composables/useSuppliers'
import { usePurchaseOrderProducts } from '../composables/usePurchaseOrderProducts'
import type { OrderProductReadContext } from '../composables/usePurchaseOrderProducts'
import type { OrderInput, PurchaseOrder } from '../interfaces/purchase-order.types'
import type { OrderPickerProduct } from '../api/purchase-order-products.api'
import { bufferErrors, createOrderBuffer, replaceLineProduct, serializeOrderBuffer } from '../utils/order-buffer'
import { buildChecklist, CHECKLIST_ID, lineFlags, noFlags, ORDER_FORM_ID } from '../utils/order-checklist'
import PurchaseOrderLine from './PurchaseOrderLine.vue'
import OrderIssueChecklist from './OrderIssueChecklist.vue'
import OrderReferencePicker, { type OrderReferenceOption } from './OrderReferencePicker.vue'
const props = defineProps<{ initial: PurchaseOrder | null; context: OrderProductReadContext & { canReadSupplier: boolean }; disabled?: boolean; mobile?: boolean }>()
const emit = defineEmits<{ save: [order: OrderInput]; dirty: [value: boolean] }>()
// The parent keys this component on explicit load/save, never on query refresh.
const buffer = reactive(createOrderBuffer(props.initial))
const baseline = JSON.stringify(buffer)
const lineBaseline = new Map(buffer.lines.map(line => [line.lineId, JSON.stringify(line)]))
const dirty = shallowRef(false)
watch(buffer, () => { dirty.value = JSON.stringify(buffer) !== baseline; emit('dirty', dirty.value) }, { flush: 'sync' })
const suppliers = useSuppliers(() => ({ ...props.context, canRead: props.context.canReadSupplier }))
const products = usePurchaseOrderProducts(() => props.context)
const { search: supplierSearch, items: supplierItems, error: supplierError, isFetching: supplierFetching, hasNext: supplierNext, hasPrevious: supplierPrevious } = suppliers
const { search: productSearch, items: productItems, error: productError, isFetching: productFetching, hasNext: productNext, hasPrevious: productPrevious } = products
const picker = shallowRef<number | 'add' | null>(null)
const attempted = shallowRef(false)
const localErrors = computed(() => bufferErrors(buffer))
// Server diagnostics live in the checklist and in the line markers; only local format errors sit under their field.
const messages = computed(() => {
  const grouped: Record<string, string[]> = {}
  if (attempted.value) for (const error of localErrors.value) (grouped[error.path] ??= []).push(error.message)
  return grouped
})
const checklist = computed(() => props.initial ? buildChecklist(props.initial) : [])
const flagsFor = (lineId: string) => props.initial ? lineFlags(props.initial, lineId) : noFlags
const linkable = (lineId: string) => buffer.lines.some(line => line.lineId === lineId)
// A saved subtotal describes the saved line; once the line is edited it reads a dash until the next save.
const subtotalFor = (line: (typeof buffer.lines)[number]) => lineBaseline.get(line.lineId) === JSON.stringify(line) ? props.initial?.lineSubtotals.find(item => item.lineId === line.lineId)?.subtotal : undefined
const supplierOption = shallowRef<OrderReferenceOption | null>(props.initial?.supplierId ? {
  id: props.initial.supplierId,
  label: `${props.initial.supplierDisplaySnapshot?.displayName || 'Proveedor guardado'}${props.initial.supplierDisplaySnapshot?.status === 'ARCHIVED' ? ' · Archivado' : ''}`,
} : null)
const supplierOptions = computed(() => supplierItems.value.map(item => ({ id: item.id, label: item.displayName })))
const productOptions = computed(() => productItems.value.map(item => ({ id: item.id, label: item.name })))
// Counters stay out of the way until a field is within 10% of its limit.
const NOTE_MAX = 2000
const LOCATION_MAX = 500
const countOf = (value: string) => [...value].length
const nearLimit = (value: string, max: number) => countOf(value) >= max * 0.9
const counterText = (value: string, max: number) => `${countOf(value).toLocaleString('es-MX')} / ${max.toLocaleString('es-MX')}`

// Each field is written once and placed either in the desktop grid or in the mobile fold.
const [DefineSupplier, ReuseSupplier] = createReusableTemplate()
const [DefineLocation, ReuseLocation] = createReusableTemplate()
const [DefineNote, ReuseNote] = createReusableTemplate()
// Mobile folds location and note into one row; a refused save opens it so the reason is never hidden.
const moreOpen = shallowRef(false)
const moreSummary = computed(() => buffer.locationDetail || buffer.note.split('\n')[0] || '')
const openLines = reactive(new Set<string>())
const lineRefs = new Map<string, { focusIssue: () => void }>()
function setLineRef(lineId: string, instance: unknown) { if (instance) lineRefs.set(lineId, instance as { focusIssue: () => void }); else lineRefs.delete(lineId) }
function setOpen(lineId: string, open: boolean) { if (open) openLines.add(lineId); else openLines.delete(lineId) }
async function goToLine(lineId: string) {
  if (!linkable(lineId)) return
  openLines.add(lineId)
  await nextTick()
  lineRefs.get(lineId)?.focusIssue()
}
function selectSupplier(option: OrderReferenceOption | null) {
  if (props.disabled) return
  supplierOption.value = option
  buffer.supplierId = option?.id ?? null
}
function selectProduct(option: OrderReferenceOption | null) {
  const product = productItems.value.find(item => item.id === option?.id)
  if (product) chooseProduct(product)
}
function chooseProduct(product: OrderPickerProduct | null) {
  if (props.disabled || picker.value === null) return
  if (picker.value === 'add') {
    if (buffer.lines.length >= 200) return
    const line = replaceLineProduct(product)
    buffer.lines.push(line)
    openLines.add(line.lineId)
  } else {
    const replaced = buffer.lines[picker.value]
    const line = replaceLineProduct(product)
    buffer.lines.splice(picker.value, 1, line)
    if (replaced) openLines.delete(replaced.lineId)
    openLines.add(line.lineId)
  }
  picker.value = null
}
function save() {
  if (props.disabled) return
  attempted.value = true
  if (localErrors.value.length) {
    // A refused save must not hide its reason inside a collapsed line.
    if (localErrors.value.some(error => error.path === '/note' || error.path === '/location/detail')) moreOpen.value = true
    for (const error of localErrors.value) {
      const index = /^\/lines\/(\d+)\//.exec(error.path)?.[1]
      const line = index === undefined ? undefined : buffer.lines[Number(index)]
      if (line) openLines.add(line.lineId)
    }
    return
  }
  emit('save', serializeOrderBuffer(buffer))
}
function remove(index: number) {
  if (props.disabled) return
  const [removed] = buffer.lines.splice(index, 1)
  if (removed) openLines.delete(removed.lineId)
  picker.value = null
}
</script>

<template>
  <form :id="ORDER_FORM_ID" class="order-form" novalidate @submit.prevent="save">
    <OrderIssueChecklist v-if="initial" :items="checklist" :dirty="dirty" :ready="initial.canConfirm === true" :linkable="linkable" @goto="goToLine" />
    <DefineSupplier>
      <UFormField label="Proveedor" class="order-field">
        <OrderReferencePicker :model-value="supplierOption" v-model:search-term="supplierSearch" :items="supplierOptions" clear-label="Sin proveedor" placeholder="Seleccionar proveedor" search-placeholder="Buscar proveedor activo..." :loading="supplierFetching" :disabled="disabled" :error="!!supplierError" :has-next="supplierNext" :has-previous="supplierPrevious" @update:model-value="selectSupplier" @previous="suppliers.back" @next="suppliers.next" @retry="suppliers.refresh" />
      </UFormField>
    </DefineSupplier>
    <DefineLocation>
      <label class="order-field">Detalle de ubicación<input v-model="buffer.locationDetail" type="text" />
        <span v-if="nearLimit(buffer.locationDetail, LOCATION_MAX)" class="order-counter" :class="{ 'is-limit': countOf(buffer.locationDetail) >= LOCATION_MAX }" aria-live="polite">{{ counterText(buffer.locationDetail, LOCATION_MAX) }}</span>
        <span v-for="(message, n) in messages['/location/detail']" :key="n" class="order-warning">{{ message }}</span>
      </label>
    </DefineLocation>
    <DefineNote>
      <label class="order-field">Nota<textarea v-model="buffer.note" rows="2" />
        <span v-if="nearLimit(buffer.note, NOTE_MAX)" class="order-counter" :class="{ 'is-limit': countOf(buffer.note) >= NOTE_MAX }" aria-live="polite">{{ counterText(buffer.note, NOTE_MAX) }}</span>
        <span v-for="(message, n) in messages['/note']" :key="n" class="order-warning">{{ message }}</span>
      </label>
    </DefineNote>
    <fieldset :disabled="disabled" class="order-section">
      <template v-if="!mobile">
        <div class="order-grid"><ReuseSupplier /><ReuseLocation /></div>
        <ReuseNote />
      </template>
      <template v-else>
        <ReuseSupplier />
        <details class="order-more" :open="moreOpen" @toggle="moreOpen = ($event.target as HTMLDetailsElement).open">
          <summary><span>Nota y ubicación</span><span v-if="moreSummary" class="order-more-summary">{{ moreSummary }}</span><UIcon name="i-lucide-chevron-down" aria-hidden="true" /></summary>
          <div class="order-more-body"><ReuseNote /><ReuseLocation /></div>
        </details>
      </template>
    </fieldset>
    <section class="order-section" aria-label="Renglones">
      <div class="order-section-heading"><h2>Renglones · {{ buffer.lines.length }}</h2><UButton type="button" color="neutral" variant="outline" icon="i-lucide-plus" :disabled="disabled || buffer.lines.length >= 200" @click="picker = 'add'">Agregar renglón</UButton></div>
      <p v-for="(message, n) in messages['/lines']" :key="n" class="order-warning">{{ message }}</p>
      <div v-if="picker !== null" class="order-picker">
        <h3>{{ picker === 'add' ? 'Agregar producto' : 'Cambiar producto' }}</h3>
        <OrderReferencePicker :model-value="null" v-model:search-term="productSearch" :items="productOptions" placeholder="Seleccionar producto" search-placeholder="Buscar producto..." :loading="productFetching" :disabled="disabled" :error="!!productError" :has-next="productNext" :has-previous="productPrevious" @update:model-value="selectProduct" @previous="products.back" @next="products.next" @retry="products.refresh" />
        <div class="order-actions"><UButton v-if="picker === 'add'" type="button" color="neutral" variant="outline" :disabled="disabled" @click="chooseProduct(null)">Agregar sin producto</UButton><UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="picker = null">Cerrar búsqueda</UButton></div>
      </div>
      <p v-if="!buffer.lines.length" class="order-empty">Todavía no hay renglones.</p>
      <div v-else class="order-lines">
        <div class="order-lines-head" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Costo unit.</span><span>Subtotal</span><span /></div>
        <PurchaseOrderLine v-for="(line, index) in buffer.lines" :key="line.lineId" :ref="instance => setLineRef(line.lineId, instance)" :model-value="line" :index="index" :context="context" :disabled="disabled" :messages="messages" :subtotal="subtotalFor(line)" :flags="flagsFor(line.lineId)" :open="openLines.has(line.lineId)" :describedby="CHECKLIST_ID" @update:model-value="buffer.lines[index] = $event" @update:open="setOpen(line.lineId, $event)" @replace="picker = index" @remove="remove(index)" />
      </div>
    </section>
  </form>
</template>
