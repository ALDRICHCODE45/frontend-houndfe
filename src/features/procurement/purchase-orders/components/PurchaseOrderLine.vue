<script setup lang="ts">
import { computed } from 'vue'
import type { OrderProductReadContext } from '../composables/usePurchaseOrderProducts'
import { usePurchaseOrderVariants } from '../composables/usePurchaseOrderProducts'
import type { LineBuffer } from '../utils/order-buffer'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { quantityRule, unitLabel } from '../utils/order-quantities'
const props = defineProps<{ modelValue: LineBuffer; index: number; context: OrderProductReadContext; disabled?: boolean; messages: Record<string, string[]>; subtotal?: PurchaseOrder['lineSubtotals'][number]['subtotal'] }>()
const emit = defineEmits<{ 'update:modelValue': [line: LineBuffer]; replace: []; remove: [] }>()
const variants = usePurchaseOrderVariants(() => props.modelValue.productId, () => props.context)
const { items, error, isFetching } = variants
const showVariants = computed(() => props.modelValue.hasVariants === true || props.modelValue.variantId !== null || items.value.length > 0)
function update<K extends keyof LineBuffer>(key: K, value: LineBuffer[K]) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
const messagesFor = (field: string) => props.messages[`/lines/${props.index}${field ? '/' + field : ''}`] ?? []
</script>

<template>
  <article class="order-line" :aria-label="`Renglón ${index + 1}`">
    <div class="order-line-heading">
      <div class="order-product-icon"><UIcon name="i-lucide-package" aria-hidden="true" /></div>
      <div class="order-line-title"><h3>{{ modelValue.name || 'Sin producto' }}</h3><p>Renglón {{ index + 1 }}</p></div>
      <UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="emit('replace')">Cambiar producto</UButton>
      <UButton type="button" color="error" variant="outline" icon="i-lucide-trash-2" :disabled="disabled" :aria-label="`Quitar renglón ${index + 1}`" @click="emit('remove')">Quitar</UButton>
    </div>
    <p v-for="(message, n) in [...messagesFor(''), ...messagesFor('productId')]" :key="n" class="order-warning">{{ message }}</p>
    <div class="order-line-fields" :class="{ 'order-line-with-variant': showVariants }">
      <label v-if="showVariants" class="order-field">Variante
        <select :value="modelValue.variantId || ''" :disabled="disabled || isFetching" @change="update('variantId', ($event.target as HTMLSelectElement).value || null)">
          <option value="">Pendiente de selección</option>
          <option v-if="modelValue.variantId && !items.some(item => item.id === modelValue.variantId)" :value="modelValue.variantId">{{ modelValue.variantName || 'Variante guardada' }}</option>
          <option v-for="variant in items" :key="variant.id" :value="variant.id">{{ variant.name }}</option>
        </select>
        <span v-for="(message, n) in messagesFor('variantId')" :key="n" class="order-warning">{{ message }}</span>
      </label>
      <template v-else><p v-for="(message, n) in messagesFor('variantId')" :key="n" class="order-warning">{{ message }}</p></template>
      <label class="order-field">Cantidad · {{ unitLabel(modelValue.unit) || 'Unidad pendiente' }}
        <input data-testid="line-quantity" type="text" inputmode="decimal" :step="quantityRule(modelValue.unit) === 'fractional' ? '0.001' : '1'" :value="modelValue.quantity" :disabled="disabled" @input="update('quantity', ($event.target as HTMLInputElement).value)" />
        <span v-for="(message, n) in messagesFor('orderedQuantity')" :key="n" class="order-warning">{{ message }}</span>
      </label>
      <fieldset class="order-cost"><legend>Costo unitario · Solo MXN · {{ unitLabel(modelValue.unit) || 'Unidad pendiente' }}</legend>
        <div class="order-cost-fields">
          <label class="order-field">Importe<input data-testid="line-amount" type="text" inputmode="decimal" :value="modelValue.amount" :disabled="disabled" @input="update('amount', ($event.target as HTMLInputElement).value)" />
            <span v-for="(message, n) in messagesFor('informedUnitCost/amount')" :key="n" class="order-warning">{{ message }}</span>
          </label>
          <label class="order-field">Impuestos<select data-testid="line-tax" :value="modelValue.taxBasis" :disabled="disabled" @change="update('taxBasis', ($event.target as HTMLSelectElement).value as LineBuffer['taxBasis'])"><option value="">Pendiente de selección</option><option value="INCLUDES_TAX">Incluye impuestos</option><option value="EXCLUDES_TAX">No incluye impuestos</option></select>
            <span v-for="(message, n) in messagesFor('informedUnitCost/taxBasis')" :key="n" class="order-warning">{{ message }}</span>
          </label>
        </div>
        <p v-for="(message, n) in [...messagesFor('informedUnitCost'), ...messagesFor('informedUnitCost/currency'), ...messagesFor('informedUnitCost/unit')]" :key="n" class="order-warning">{{ message }}</p>
      </fieldset>
    </div>
    <p v-if="error" role="alert">No se pudieron cargar las variantes. <UButton type="button" color="neutral" variant="outline" :disabled="disabled || isFetching" @click="variants.refresh">Reintentar</UButton></p>
    <p v-if="subtotal" class="order-subtotal">Último subtotal guardado: {{ subtotal.amount }} {{ subtotal.currency }} · {{ subtotal.taxBasis === 'INCLUDES_TAX' ? 'Incluye impuestos' : 'No incluye impuestos' }}</p>
  </article>
</template>
