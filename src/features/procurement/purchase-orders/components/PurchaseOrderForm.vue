<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from 'vue'
import { useSuppliers } from '@/features/procurement/suppliers/composables/useSuppliers'
import { usePurchaseOrderProducts } from '../composables/usePurchaseOrderProducts'
import type { OrderProductReadContext } from '../composables/usePurchaseOrderProducts'
import type { OrderInput, PurchaseOrder } from '../interfaces/purchase-order.types'
import type { OrderPickerProduct } from '../api/purchase-order-products.api'
import { bufferErrors, createOrderBuffer, replaceLineProduct, serializeOrderBuffer } from '../utils/order-buffer'
import { diagnosticMessage, diagnosticTarget } from '../utils/order-diagnostics'
import PurchaseOrderLine from './PurchaseOrderLine.vue'
import OrderReferencePicker, { type OrderReferenceOption } from './OrderReferencePicker.vue'
const props = defineProps<{ initial: PurchaseOrder | null; context: OrderProductReadContext & { canReadSupplier: boolean }; disabled?: boolean; readOnly?: boolean }>()
const emit = defineEmits<{ save: [order: OrderInput]; cancel: []; dirty: [value: boolean] }>()
// The parent keys this component on explicit load/save, never on query refresh.
const buffer = reactive(createOrderBuffer(props.initial))
const baseline = JSON.stringify(buffer)
watch(buffer, () => emit('dirty', JSON.stringify(buffer) !== baseline), { flush: 'sync' })
const suppliers = useSuppliers(() => ({ ...props.context, canRead: props.context.canReadSupplier }))
const products = usePurchaseOrderProducts(() => props.context)
const { search: supplierSearch, items: supplierItems, error: supplierError, isFetching: supplierFetching, hasNext: supplierNext, hasPrevious: supplierPrevious } = suppliers
const { search: productSearch, items: productItems, error: productError, isFetching: productFetching, hasNext: productNext, hasPrevious: productPrevious } = products
const picker = shallowRef<number | 'add' | null>(null)
const attempted = shallowRef(false)
const localErrors = computed(() => bufferErrors(buffer))
const messages = computed(() => {
  const grouped: Record<string, string[]> = {}
  function add(path: string, message: string) { (grouped[path] ??= []).push(message) }
  for (const issue of props.initial?.validation.issues ?? []) {
    let target = diagnosticTarget(issue.path, props.initial?.lines.length ?? 0)
    if (target.startsWith('/lines/')) {
      const index = Number(target.split('/')[2])
      const id = props.initial?.lines[index]?.lineId
      const current = buffer.lines.findIndex(line => line.lineId === id)
      target = current < 0 ? 'summary' : target.replace(/^\/lines\/\d+/, `/lines/${current}`)
    }
    add(target, diagnosticMessage(issue.code))
  }
  if (attempted.value) for (const error of localErrors.value) add(error.path, error.message)
  return grouped
})
const supplierOption = shallowRef<OrderReferenceOption | null>(props.initial?.supplierId ? {
  id: props.initial.supplierId,
  label: `${props.initial.supplierDisplaySnapshot?.displayName || 'Proveedor guardado'}${props.initial.supplierDisplaySnapshot?.status === 'ARCHIVED' ? ' · Archivado' : ''}`,
} : null)
const supplierOptions = computed(() => supplierItems.value.map(item => ({ id: item.id, label: item.displayName })))
const productOptions = computed(() => productItems.value.map(item => ({ id: item.id, label: item.name })))
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
    buffer.lines.push(replaceLineProduct(product))
  } else buffer.lines.splice(picker.value, 1, replaceLineProduct(product))
  picker.value = null
}
function save() {
  if (props.disabled) return
  attempted.value = true
  if (!localErrors.value.length) emit('save', serializeOrderBuffer(buffer))
}
function remove(index: number) { if (!props.disabled) { buffer.lines.splice(index, 1); picker.value = null } }
</script>

<template>
  <form class="order-form" novalidate @submit.prevent="save">
    <p v-if="!readOnly" class="order-help">Puedes guardar el borrador incompleto. Los avisos del servidor no impiden guardarlo.</p>
    <div v-if="messages.summary?.length" class="order-warning" role="status"><p v-for="(message, index) in messages.summary" :key="index">{{ message }}</p></div>
    <fieldset :disabled="disabled" class="order-section"><legend>Proveedor y ubicación</legend>
      <UFormField label="Proveedor" class="order-field">
        <OrderReferencePicker :model-value="supplierOption" v-model:search-term="supplierSearch" :items="supplierOptions" clear-label="Sin proveedor" placeholder="Seleccionar proveedor" search-placeholder="Buscar proveedor activo..." :loading="supplierFetching" :disabled="disabled" :error="!!supplierError" :has-next="supplierNext" :has-previous="supplierPrevious" @update:model-value="selectSupplier" @previous="suppliers.back" @next="suppliers.next" @retry="suppliers.refresh" />
        <span v-for="(message, n) in messages['/supplierId']" :key="n" class="order-warning">{{ message }}</span>
      </UFormField>
      <p v-if="buffer.supplierId === initial?.supplierId && initial?.supplierDisplaySnapshot?.status === 'ARCHIVED'" class="order-warning">Proveedor archivado. Puedes conservarlo en este borrador.</p>

      <label class="order-field">Nota<textarea v-model="buffer.note" rows="3" /><span class="order-help">Hasta 2000 caracteres.</span><span v-for="(message, n) in messages['/note']" :key="n" class="order-warning">{{ message }}</span></label>
      <label class="order-field">Detalle de ubicación<input v-model="buffer.locationDetail" type="text" /><span class="order-help">Hasta 500 caracteres.</span><span v-for="(message, n) in messages['/location/detail']" :key="n" class="order-warning">{{ message }}</span></label>
    </fieldset>
    <section class="order-section" aria-label="Renglones">
      <div class="order-section-heading"><h2>Renglones · {{ buffer.lines.length }}/200</h2><UButton type="button" color="neutral" variant="outline" :disabled="disabled || buffer.lines.length >= 200" @click="picker = 'add'">Agregar renglón</UButton></div>
      <p v-for="(message, n) in messages['/lines']" :key="n" class="order-warning">{{ message }}</p>
      <p v-if="!buffer.lines.length" class="order-help">Todavía no hay renglones.</p>
      <div v-if="picker !== null" class="order-picker">
        <h3>{{ picker === 'add' ? 'Agregar producto' : 'Cambiar producto' }}</h3>
        <OrderReferencePicker :model-value="null" v-model:search-term="productSearch" :items="productOptions" placeholder="Seleccionar producto" search-placeholder="Buscar producto..." :loading="productFetching" :disabled="disabled" :error="!!productError" :has-next="productNext" :has-previous="productPrevious" @update:model-value="selectProduct" @previous="products.back" @next="products.next" @retry="products.refresh" />
        <div class="order-actions"><UButton v-if="picker === 'add'" type="button" color="neutral" variant="outline" :disabled="disabled" @click="chooseProduct(null)">Agregar sin producto</UButton><UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="picker = null">Cerrar búsqueda</UButton></div>
      </div>
      <PurchaseOrderLine v-for="(line, index) in buffer.lines" :key="line.lineId" :model-value="line" :index="index" :context="context" :disabled="disabled" :messages="messages" :subtotal="initial?.lineSubtotals.find(item => item.lineId === line.lineId)?.subtotal" @update:model-value="buffer.lines[index] = $event" @replace="picker = index" @remove="remove(index)" />
    </section>
    <div class="order-actions"><UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="emit('cancel')">Cerrar</UButton><button type="submit" class="hf-primary-control" :disabled="disabled">Guardar borrador</button></div>
  </form>
</template>
