<script setup lang="ts">
import { computed } from 'vue'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { unitLabel } from '../utils/order-quantities'
const props = defineProps<{ order: PurchaseOrder }>()
const date = (value: string) => new Date(value).toLocaleString('es-MX')
const statusLabel = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }
const closure = computed(() => {
  const { confirmedBy, confirmedAt, cancelledBy, cancelledAt } = props.order
  // A cancelled order that was confirmed first keeps both records.
  return [
    confirmedAt && `Confirmada${confirmedBy ? ` por ${confirmedBy.displayName}` : ''} el ${date(confirmedAt)}`,
    cancelledAt && `Cancelada${cancelledBy ? ` por ${cancelledBy.displayName}` : ''} el ${date(cancelledAt)}`,
  ].filter(Boolean).join(' · ')
})
const lines = computed(() => props.order.lines.map(line => {
  const display = props.order.lineDisplaySnapshots.find(item => item.lineId === line.lineId)
  const subtotal = props.order.lineSubtotals.find(item => item.lineId === line.lineId)?.subtotal
  const cost = line.informedUnitCost
  return { lineId: line.lineId, product: display?.productName || 'Sin producto', variant: display?.variantName, unit: unitLabel(display?.unit ?? cost?.unit) ?? '',
    quantity: line.orderedQuantity ?? '—', cost: cost?.amount ? `${cost.amount} ${cost.currency ?? ''}`.trim() : '—',
    tax: cost?.taxBasis === 'INCLUDES_TAX' ? 'Incluye impuestos' : cost?.taxBasis === 'EXCLUDES_TAX' ? 'No incluye impuestos' : '',
    subtotal: subtotal ? `${subtotal.amount} ${subtotal.currency}` : '—' }
}))
</script>

<template>
  <div data-testid="order-readonly" class="order-readonly">
    <dl class="order-readonly-details">
      <dt>Estado</dt><dd>{{ statusLabel[order.status] }}</dd>
      <template v-if="closure"><dt>Registro</dt><dd>{{ closure }}</dd></template>
      <dt>Proveedor</dt><dd>{{ order.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</dd>
      <dt>Ubicación</dt><dd>{{ order.locationSnapshot.tenantName }}<template v-if="order.locationSnapshot.detail"> · {{ order.locationSnapshot.detail }}</template></dd>
      <dt>Nota</dt><dd class="order-readonly-note">{{ order.note || 'Sin nota' }}</dd>
    </dl>
    <section class="order-section" aria-label="Renglones">
      <h2>Renglones · {{ lines.length }}</h2>
      <article v-for="(line, index) in lines" :key="line.lineId" class="order-line" :aria-label="`Renglón ${index + 1}`">
        <div class="order-line-title"><h3>{{ line.product }}</h3><p v-if="line.variant">{{ line.variant }}</p></div>
        <dl class="order-readonly-details">
          <dt>Cantidad</dt><dd>{{ line.quantity }} {{ line.unit }}</dd>
          <dt>Costo unitario</dt><dd>{{ line.cost }}<template v-if="line.tax"> · {{ line.tax }}</template></dd>
        </dl>
        <p class="order-subtotal">Subtotal: {{ line.subtotal }}</p>
      </article>
    </section>
  </div>
</template>
