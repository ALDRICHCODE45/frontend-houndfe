<script setup lang="ts">
/**
 * RequestDetailCustomerCard — who asked (read only). The phone is printed exactly as the server
 * sent it: the backend masks it without `read:CustomerPhone`; nothing here masks or unmasks. With
 * no linked customer it says so and lists the candidates (linking is an action of the panel).
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestDetailCustomer } from '../interfaces/chatbot-request.types'
import { formatDate, formatMoney, orderStatusLabel } from '../utils/detail-format'

const props = defineProps<{
  customer: ChatbotRequestDetailCustomer
  /** The signed-in user lacks `read:CustomerPhone`: the phone arrives masked. */
  phoneRestricted: boolean
  timeZone?: string
}>()

const headingId = useId()
const linked = computed(() => props.customer.id !== null)
const name = computed(() => props.customer.displayName?.trim() || 'Cliente sin vincular')
const initials = computed(() =>
  linked.value
    ? name.value
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0] ?? '')
        .join('')
        .toUpperCase()
    : '?',
)
const since = computed(() => formatDate(props.customer.customerSince, props.timeZone) ?? '—')
const candidates = computed(() => props.customer.candidates ?? [])
const orders = computed(() => props.customer.recentOrders ?? [])

function lastOrder(iso: string | null): string {
  const date = formatDate(iso, props.timeZone)
  return date ? `Último pedido ${date}` : 'Sin pedidos'
}
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="customer-card">
    <div class="rd-panel__head">
      <h2 :id="headingId">Cliente</h2>
      <span v-if="customer.isTrusted" class="rd-badge rd-badge--success">De confianza</span>
    </div>

    <div class="rd-person">
      <span class="rd-avatar" aria-hidden="true">{{ initials }}</span>
      <div class="rd-person__text">
        <div class="rd-person__name">{{ name }}</div>
        <div class="rd-person__phone">
          <UIcon name="i-lucide-phone" aria-hidden="true" />
          <span data-testid="customer-phone">{{ customer.phone ?? 'Sin teléfono' }}</span>
        </div>
      </div>
    </div>

    <p v-if="phoneRestricted" class="rd-help" data-testid="phone-restricted">
      <UIcon name="i-lucide-lock" aria-hidden="true" />
      El teléfono completo requiere el permiso «Ver teléfono completo». Sin él no hay botones de llamar ni copiar.
    </p>

    <template v-if="linked">
      <dl class="rd-kv">
        <dt>Cliente desde</dt>
        <dd>{{ since }}</dd>
        <dt>Lista de precios</dt>
        <dd data-testid="customer-price-list">{{ customer.priceList?.name ?? '—' }}</dd>
      </dl>

      <table v-if="orders.length" class="rd-table" aria-label="Pedidos recientes" data-testid="recent-orders">
        <thead>
          <tr>
            <th scope="col">Pedido</th>
            <th scope="col" class="rd-num">Total</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orders" :key="order.saleId">
            <td>
              <b class="rd-fig">{{ order.folio }}</b>
              <div class="rd-sub">{{ formatDate(order.createdAt, timeZone) ?? '—' }}</div>
            </td>
            <td class="rd-num">{{ formatMoney(order.totalCents) }}</td>
            <td>{{ orderStatusLabel(order.status, order.paymentStatus) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-else>
      <div class="rd-alert rd-alert--warn" role="note">
        <UIcon name="i-lucide-user" aria-hidden="true" />
        <div>
          <strong>Sin cliente vinculado</strong>
          <template v-if="customer.ambiguous">
            Hay {{ candidates.length }} clientes con este teléfono y el bot no pudo elegir. Una persona debe vincular
            el correcto.
          </template>
          <template v-else>La identidad es solo el teléfono.</template>
        </div>
      </div>

      <ul v-if="candidates.length" class="rd-candidates" data-testid="customer-candidates">
        <li v-for="candidate in candidates" :key="candidate.id">
          <b>{{ candidate.displayName ?? 'Cliente sin nombre' }}</b>
          <span v-if="candidate.isTrusted" class="rd-badge rd-badge--success">De confianza</span>
          <span class="rd-sub">{{ candidate.phone ?? 'Sin teléfono' }} · {{ lastOrder(candidate.lastOrderAt) }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>
