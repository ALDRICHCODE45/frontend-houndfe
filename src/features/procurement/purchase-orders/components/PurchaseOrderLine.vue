<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import HfCombobox, { type HfComboboxItem } from '@/core/shared/components/form/HfCombobox.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { decimalMoneyTitle, formatDecimalMoney } from '@/core/shared/utils/currency.utils'
import type { OrderProductReadContext } from '../composables/usePurchaseOrderProducts'
import { usePurchaseOrderVariants } from '../composables/usePurchaseOrderProducts'
import type { LineBuffer } from '../utils/order-buffer'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import type { LineFlags } from '../utils/order-checklist'
import { quantityRule, unitLabel } from '../utils/order-quantities'
const props = defineProps<{ modelValue: LineBuffer; index: number; context: OrderProductReadContext; disabled?: boolean; messages: Record<string, string[]>; subtotal?: PurchaseOrder['lineSubtotals'][number]['subtotal']; flags: LineFlags; open: boolean; describedby?: string }>()
const emit = defineEmits<{ 'update:modelValue': [line: LineBuffer]; 'update:open': [open: boolean]; replace: []; remove: [] }>()
const variants = usePurchaseOrderVariants(() => props.modelValue.productId, () => props.context)
const { items, error, isFetching } = variants
const showVariants = computed(() => props.modelValue.hasVariants === true || props.modelValue.variantId !== null || items.value.length > 0)
function update<K extends keyof LineBuffer>(key: K, value: LineBuffer[K]) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
// The system combobox has no empty pick, so «Pendiente de selección» is an item of its own.
const PENDING = '__pending'
const PENDING_ITEM: HfComboboxItem = { label: 'Pendiente de selección', value: PENDING }
const variantItems = computed<HfComboboxItem[]>(() => [
  PENDING_ITEM,
  ...(props.modelValue.variantId && !items.value.some(item => item.id === props.modelValue.variantId)
    ? [{ label: props.modelValue.variantName || 'Variante guardada', value: props.modelValue.variantId }] : []),
  ...items.value.map(variant => ({ label: variant.name, value: variant.id })),
])
const taxItems: HfComboboxItem[] = [PENDING_ITEM, { label: 'Incluye impuestos', value: 'INCLUDES_TAX' }, { label: 'No incluye impuestos', value: 'EXCLUDES_TAX' }]
function variantPicked(value: string | string[] | null) { if (typeof value === 'string') selectVariant(value === PENDING ? '' : value) }
function taxPicked(value: string | string[] | null) {
  if (typeof value === 'string') update('taxBasis', (value === PENDING ? '' : value) as LineBuffer['taxBasis'])
}
function selectVariant(id: string) { emit('update:modelValue', { ...props.modelValue, variantId: id || null, variantName: items.value.find(item => item.id === id)?.name ?? (id ? props.modelValue.variantName : null) }) }
const messagesFor = (field: string) => props.messages[`/lines/${props.index}/${field}`] ?? []

// A marker shows only while the value the server asked for is still empty here; typing it clears it before the next save.
// One marker says Falta once; the missing part is a description, and the open editor outlines the exact field.
const missing = computed(() => ({
  product: props.flags.product && !props.modelValue.productId, variant: props.flags.variant && !props.modelValue.variantId,
  quantity: props.flags.quantity && !props.modelValue.quantity, cost: props.flags.cost && !props.modelValue.amount, tax: props.flags.tax && !props.modelValue.taxBasis,
}))
const otherIssue = computed(() => props.flags.any && !(props.flags.product || props.flags.variant || props.flags.quantity || props.flags.cost || props.flags.tax))
const flagged = computed(() => otherIssue.value || Object.values(missing.value).some(Boolean))
const unit = computed(() => unitLabel(props.modelValue.unit))
const quantityText = computed(() => props.modelValue.quantity ? `${props.modelValue.quantity}${unit.value ? ` ${unit.value}` : ''}` : '—')
const costText = computed(() => props.modelValue.amount ? formatDecimalMoney(props.modelValue.amount, 'MXN') : '—')
const costTitle = computed(() => props.modelValue.amount ? decimalMoneyTitle(props.modelValue.amount, 'MXN') : undefined)
const subtotalTitle = computed(() => props.subtotal ? decimalMoneyTitle(props.subtotal.amount, props.subtotal.currency) : undefined)
const taxText = computed(() => ({ INCLUDES_TAX: 'con imp.', EXCLUDES_TAX: 'sin imp.', '': '' })[props.modelValue.taxBasis])
const subtotalText = computed(() => props.subtotal ? formatDecimalMoney(props.subtotal.amount, props.subtotal.currency) : '—')
const label = computed(() => `Editar renglón ${props.index + 1}: ${props.modelValue.name || 'Sin producto'}${props.modelValue.variantName ? `, ${props.modelValue.variantName}` : ''}`)
const editId = computed(() => `order-line-edit-${props.index}`)
const actions = computed<RowAction[]>(() => [
  { key: 'edit', label: 'Editar renglón', icon: 'i-lucide-pencil', disabled: props.disabled },
  { key: 'replace', label: 'Cambiar producto', icon: 'i-lucide-replace', disabled: props.disabled },
  { key: 'remove', label: 'Quitar renglón', icon: 'i-lucide-trash-2', destructive: true, disabled: props.disabled },
])
function choose(key: string) {
  if (key === 'edit') emit('update:open', true)
  else if (key === 'replace') emit('replace')
  else if (key === 'remove') emit('remove')
}
const toggleButton = useTemplateRef<HTMLButtonElement>('toggle')
const editRow = useTemplateRef<HTMLElement>('edit')
// The product button is the tab stop, so the row itself is not focusable.
const { rowProps } = useClickableRow<void>(() => emit('update:open', !props.open), { focusable: false })
function done() { emit('update:open', false); void nextTick(() => toggleButton.value?.focus()) }
// Called by the checklist link after the row opened: land on the first missing field.
function focusIssue() {
  const target = editRow.value?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? editRow.value?.querySelector<HTMLElement>('input, [role="combobox"]')
  target?.focus()
}
defineExpose({ focusIssue })
</script>

<template>
  <div class="order-line-group" role="group" :aria-label="`Renglón ${index + 1}`">
    <div class="order-line-row" v-bind="rowProps()" :data-flagged="flagged ? 'true' : undefined">
      <div class="order-line-product">
        <button ref="toggle" type="button" class="order-line-toggle" :aria-expanded="open" :aria-controls="open ? editId : undefined" :aria-label="label" @click="emit('update:open', !open)">{{ modelValue.name || 'Sin producto' }}</button>
        <span v-if="missing.product" class="order-line-variant order-missing"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta el producto</span>
        <span v-else-if="missing.variant" class="order-line-variant order-missing"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta la variante</span>
        <span v-else-if="modelValue.variantName" class="order-line-variant">{{ modelValue.variantName }}</span>
      </div>
      <div class="order-line-qty order-money">
        <span v-if="missing.quantity" class="order-missing" title="Falta la cantidad"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta <span class="order-missing-part">la cantidad</span></span>
        <template v-else>{{ quantityText }}</template>
      </div>
      <div class="order-line-cost">
        <span data-testid="line-cost" class="order-money" :class="{ 'order-missing': missing.cost }" :title="missing.cost ? 'Falta el costo' : costTitle"><template v-if="missing.cost"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta <span class="order-missing-part">el costo</span></template><template v-else>{{ costText }}</template></span>
        <small v-if="missing.tax && !missing.cost" class="order-line-tax order-missing" title="Falta indicar los impuestos">Falta <span class="order-missing-part">impuestos</span></small>
        <small v-else-if="taxText && !missing.cost" class="order-line-tax">{{ taxText }}</small>
      </div>
      <div class="order-line-total"><span data-testid="line-subtotal" class="order-money order-line-subtotal" :title="subtotalTitle">{{ subtotalText }}</span></div>
      <RowActionsMenu class="order-line-menu" :actions="actions" :row-label="`renglón ${index + 1}`" :aria-label="`Más acciones del renglón ${index + 1}`" portal-class="purchase-orders-portal" @select="choose" />
    </div>
    <div v-if="open" :id="editId" ref="edit" class="order-line-edit" role="group" :aria-label="`Edición del renglón ${index + 1}`">
      <div class="order-edit-grid">
        <label v-if="showVariants" class="order-field order-edit-wide">Variante
          <HfCombobox data-testid="line-variant" label="Variante" placeholder="Pendiente de selección" :items="variantItems" :model-value="modelValue.variantId || PENDING" :disabled="disabled || isFetching" :invalid="missing.variant" :describedby="missing.variant ? describedby : undefined" @update:model-value="variantPicked" />
        </label>
        <label class="order-field">Cantidad · {{ unit || 'Unidad pendiente' }}
          <input data-testid="line-quantity" type="text" inputmode="decimal" :step="quantityRule(modelValue.unit) === 'fractional' ? '0.001' : '1'" :value="modelValue.quantity" :disabled="disabled" :aria-invalid="missing.quantity ? 'true' : undefined" :aria-describedby="missing.quantity ? describedby : undefined" @input="update('quantity', ($event.target as HTMLInputElement).value)" />
          <span v-for="(message, n) in messagesFor('orderedQuantity')" :key="n" class="order-warning">{{ message }}</span>
        </label>
        <label class="order-field">Costo unitario (MXN)
          <input data-testid="line-amount" type="text" inputmode="decimal" placeholder="0.00" :value="modelValue.amount" :disabled="disabled" :aria-invalid="missing.cost ? 'true' : undefined" :aria-describedby="missing.cost ? describedby : undefined" @input="update('amount', ($event.target as HTMLInputElement).value)" />
          <span v-for="(message, n) in messagesFor('informedUnitCost/amount')" :key="n" class="order-warning">{{ message }}</span>
        </label>
        <label class="order-field">Impuestos
          <HfCombobox data-testid="line-tax" label="Impuestos" placeholder="Pendiente de selección" :items="taxItems" :model-value="modelValue.taxBasis || PENDING" :disabled="disabled" :invalid="missing.tax" :describedby="missing.tax ? describedby : undefined" @update:model-value="taxPicked" />
        </label>
        <div class="order-edit-done"><UButton type="button" color="neutral" variant="outline" class="order-line-done" @click="done">Listo</UButton></div>
      </div>
      <p v-if="error" role="alert" class="order-warning">No se pudieron cargar las variantes. <UButton type="button" color="neutral" variant="outline" class="order-line-retry" :disabled="disabled || isFetching" @click="variants.refresh">Reintentar</UButton></p>
    </div>
  </div>
</template>
