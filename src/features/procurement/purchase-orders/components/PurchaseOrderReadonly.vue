<script setup lang="ts">
import { computed } from 'vue'
import { formatDecimalMoney } from '@/core/shared/utils/currency.utils'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { diagnosticMessage, diagnosticTarget } from '../utils/order-diagnostics'
import { describeLines, locationLabel } from '../utils/order-lines'
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
// Display-only: the server decimals and currency go through the shared formatter untouched.
const money = (amount: string | null | undefined, currency: string | null | undefined) => amount ? formatDecimalMoney(amount, currency ?? undefined) : '—'
const lines = computed(() => describeLines(props.order).map(line => ({ ...line,
  tax: line.cost?.taxBasis === 'INCLUDES_TAX' ? 'Incluye impuestos' : line.cost?.taxBasis === 'EXCLUDES_TAX' ? 'No incluye impuestos' : '',
  unitCost: money(line.cost?.amount, line.cost?.currency), total: money(line.subtotal?.amount, line.subtotal?.currency) })))
// Same routing as the editable form: line issues sit under their line, the rest on top.
const warnings = computed(() => {
  const summary: string[] = []
  const byLine: string[][] = props.order.lines.map(() => [])
  for (const issue of props.order.validation.issues) {
    const target = diagnosticTarget(issue.path, props.order.lines.length)
    const message = diagnosticMessage(issue.code)
    const bucket = target.startsWith('/lines/') ? byLine[Number(target.split('/')[2])]! : summary
    if (!bucket.includes(message)) bucket.push(message)
  }
  return { summary, byLine }
})
</script>

<template>
  <div data-testid="order-readonly" class="order-readonly">
    <div v-if="warnings.summary.length" data-testid="order-readonly-warnings" class="order-warning" role="status" aria-label="Avisos del borrador"><p v-for="message in warnings.summary" :key="message">{{ message }}</p></div>
    <dl class="order-readonly-details">
      <div class="order-detail"><dt>Estado</dt><dd>{{ statusLabel[order.status] }}</dd></div>
      <div class="order-detail"><dt>Proveedor</dt><dd>{{ order.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</dd></div>
      <div v-if="closure" class="order-detail order-detail-wide"><dt>Registro</dt><dd>{{ closure }}</dd></div>
      <div class="order-detail order-detail-wide"><dt>Ubicación</dt><dd>{{ locationLabel(order) }}</dd></div>
      <div class="order-detail order-detail-wide"><dt>Nota</dt><dd class="order-readonly-note">{{ order.note || 'Sin nota' }}</dd></div>
    </dl>
    <section class="order-section" aria-label="Renglones">
      <h2>Renglones · {{ lines.length }}</h2>
      <article v-for="(line, index) in lines" :key="line.lineId" class="order-line" :aria-label="`Renglón ${index + 1}`">
        <div class="order-line-title"><h3>{{ line.product }}</h3><p v-if="line.variant">{{ line.variant }}</p></div>
        <p v-for="message in warnings.byLine[index]" :key="message" class="order-warning" role="status">{{ message }}</p>
        <dl class="order-readonly-figures">
          <div><dt>Cantidad</dt><dd class="order-money">{{ line.quantity }} {{ line.unit }}</dd></div>
          <div><dt>Costo unitario</dt><dd class="order-money" data-testid="line-cost">{{ line.unitCost }}</dd></div>
          <div v-if="line.tax"><dt>Impuestos</dt><dd>{{ line.tax }}</dd></div>
          <div class="order-subtotal-row"><dt>Subtotal</dt><dd class="order-money" data-testid="line-subtotal">{{ line.total }}</dd></div>
        </dl>
      </article>
    </section>
  </div>
</template>
