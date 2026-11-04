<script setup lang="ts">
import { computed } from 'vue'
import { decimalMoneyTitle, formatDecimalMoney } from '@/core/shared/utils/currency.utils'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { buildChecklist, lineFlags } from '../utils/order-checklist'
import { describeLines, locationLabel } from '../utils/order-lines'
import OrderIssueChecklist from './OrderIssueChecklist.vue'
const props = defineProps<{ order: PurchaseOrder }>()
const date = (value: string) => new Date(value).toLocaleString('es-MX')
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
const moneyTitle = (amount: string | null | undefined, currency: string | null | undefined) => amount ? decimalMoneyTitle(amount, currency ?? undefined) : undefined
const checklist = computed(() => props.order.status === 'DRAFT' ? buildChecklist(props.order) : [])
// Only drafts carry diagnostics: the flagged line is tinted and the missing cell says Falta once, without repeating the checklist message.
const lines = computed(() => describeLines(props.order).map(line => {
  const flags = props.order.status === 'DRAFT' ? lineFlags(props.order, line.lineId) : null
  const missing = { quantity: Boolean(flags?.quantity) && line.quantity === '—', cost: Boolean(flags?.cost) && !line.cost?.amount, product: Boolean(flags?.product) && line.product === 'Sin producto' }
  return { ...line, missing, flagged: Boolean(flags?.any),
    tax: line.cost?.taxBasis === 'INCLUDES_TAX' ? 'con imp.' : line.cost?.taxBasis === 'EXCLUDES_TAX' ? 'sin imp.' : '',
    unitCost: money(line.cost?.amount, line.cost?.currency), unitCostTitle: moneyTitle(line.cost?.amount, line.cost?.currency),
    total: money(line.subtotal?.amount, line.subtotal?.currency), totalTitle: moneyTitle(line.subtotal?.amount, line.subtotal?.currency) }
}))
</script>

<template>
  <div data-testid="order-readonly" class="order-readonly">
    <OrderIssueChecklist v-if="checklist.length" data-testid="order-readonly-warnings" :items="checklist" :dirty="false" :ready="order.canConfirm === true" :linkable="() => false" />
    <dl class="order-readonly-details">
      <div v-if="closure" class="order-detail"><dt>Registro</dt><dd>{{ closure }}</dd></div>
      <div class="order-detail"><dt>Ubicación</dt><dd>{{ locationLabel(order) }}</dd></div>
      <div class="order-detail"><dt>Nota</dt><dd class="order-readonly-note">{{ order.note || 'Sin nota' }}</dd></div>
    </dl>
    <section class="order-section" aria-label="Renglones">
      <h2>Renglones · {{ lines.length }}</h2>
      <div class="order-lines is-readonly">
        <div class="order-lines-head" aria-hidden="true"><span>Producto</span><span>Cantidad</span><span>Costo unit.</span><span>Subtotal</span></div>
        <div v-for="(line, index) in lines" :key="line.lineId" class="order-line-group" role="group" :aria-label="`Renglón ${index + 1}`">
          <div class="order-line-row" :data-flagged="line.flagged ? 'true' : undefined">
            <div class="order-line-product">
              <span class="order-line-name">{{ line.product }}</span>
              <span v-if="line.missing.product" class="order-line-variant order-missing"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta el producto</span>
              <span v-else-if="line.variant" class="order-line-variant">{{ line.variant }}</span>
            </div>
            <div class="order-line-qty order-money"><span v-if="line.missing.quantity" class="order-missing" title="Falta la cantidad"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta <span class="order-missing-part">la cantidad</span></span><template v-else>{{ line.quantity }}{{ line.unit ? ` ${line.unit}` : '' }}</template></div>
            <div class="order-line-cost">
              <span data-testid="line-cost" class="order-money" :class="{ 'order-missing': line.missing.cost }" :title="line.missing.cost ? 'Falta el costo' : line.unitCostTitle"><template v-if="line.missing.cost"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />Falta <span class="order-missing-part">el costo</span></template><template v-else>{{ line.unitCost }}</template></span>
              <small v-if="line.tax" class="order-line-tax">{{ line.tax }}</small>
            </div>
            <div class="order-line-total"><span data-testid="line-subtotal" class="order-money order-line-subtotal" :title="line.totalTitle">{{ line.total }}</span></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
