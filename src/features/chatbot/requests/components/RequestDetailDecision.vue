<script setup lang="ts">
/**
 * RequestDetailDecision — read view of the per-subtype decision data (RESTOCK, EXPIRATION,
 * DELIVERY_ZONE with its impact, TRANSFER_RECEIPT with the file preview). Read side only: the
 * resolve forms are unit 4. Every field is optional on purpose: a snapshot the server left
 * incomplete, a shape a later unit adds, or a hostile URL must never crash or inject the page.
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import {
  formatMoney,
  previewStatusLabel,
  resolutionActionLabel,
  safeUrl,
  zoneImpactText,
} from '../utils/detail-format'
import { formatWhen, SUBTYPE_LABELS } from '../utils/requestLabels'

const props = defineProps<{
  request: ChatbotRequestDetail
  timeZone?: string
  now?: Date
}>()

const headingId = useId()
const when = (iso: string | null | undefined) => formatWhen(iso ?? null, { timeZone: props.timeZone, now: props.now })

const decision = computed(() => props.request.decision)
const isOpen = computed(() => props.request.status === 'NEW' || props.request.status === 'IN_PROGRESS')

const restock = computed(() => (decision.value?.subtype === 'RESTOCK' ? decision.value : null))
const expiration = computed(() => (decision.value?.subtype === 'EXPIRATION' ? decision.value : null))
const zone = computed(() => (decision.value?.subtype === 'DELIVERY_ZONE' ? decision.value : null))
const receipt = computed(() => (decision.value?.subtype === 'TRANSFER_RECEIPT' ? decision.value : null))
const known = computed(() => !!(restock.value || expiration.value || zone.value || receipt.value))

const title = computed(() => {
  const subtype = decision.value?.subtype
  const label = subtype ? SUBTYPE_LABELS[subtype] : undefined
  return label && known.value ? `${label}: datos de la solicitud` : 'Datos de la solicitud'
})

const place = computed(() => {
  const z = zone.value
  const parts = [z?.neighborhood, z?.municipality, z?.state].filter((p): p is string => !!p && p.trim().length > 0)
  return parts.length ? parts.join(', ') : '—'
})

const impact = computed(() =>
  isOpen.value && props.request.zoneImpact ? zoneImpactText(props.request.zoneImpact) : null,
)

const file = computed(() => receipt.value?.file ?? null)
const previewUrl = computed(() => {
  const f = file.value
  return f && f.mimeType?.startsWith('image/') ? safeUrl(f.previewUrl) : null
})
const originalUrl = computed(() => safeUrl(file.value?.originalUrl))
const previewMessage = computed(() => {
  const f = file.value
  if (!f) return 'El archivo ya se eliminó'
  return f.previewStatus === 'READY' ? 'Vista previa no disponible' : previewStatusLabel(f.previewStatus)
})
const fileMeta = computed(() => {
  const f = file.value
  if (!f) return null
  const kb = typeof f.sizeBytes === 'number' ? `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB` : null
  return [f.mimeType, kb].filter(Boolean).join(' · ') || null
})

const resolution = computed(() => {
  const r = decision.value?.resolution
  if (!r) return null
  const by = r.resolvedBy?.displayName
  return [resolutionActionLabel(r.action) ?? 'Resuelta', by ? `por ${by}` : null, when(r.resolvedAt)]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <section v-if="decision" class="rd-panel" :aria-labelledby="headingId" data-testid="request-decision">
    <h2 :id="headingId">{{ title }}</h2>

    <dl v-if="restock" class="rd-kv">
      <dt>Producto</dt>
      <dd>
        <b>{{ restock.snapshot?.productName ?? '—' }}</b>
        <template v-if="restock.snapshot?.sku"> · {{ restock.snapshot.sku }}</template>
      </dd>
      <dt>Sucursal</dt>
      <dd>{{ restock.snapshot?.branchName ?? '—' }}</dd>
      <dt>Cantidad pedida</dt>
      <dd><span class="rd-fig">{{ restock.snapshot?.requestedQuantity ?? '—' }}</span></dd>
      <dt>Existencias al pedir</dt>
      <dd>
        <span class="rd-fig">{{ restock.snapshot?.observedStockAtRequest ?? '—' }}</span>
        <template v-if="when(restock.snapshot?.stockObservedAt)"> · visto {{ when(restock.snapshot?.stockObservedAt) }}</template>
      </dd>
    </dl>

    <dl v-else-if="expiration" class="rd-kv">
      <dt>Producto</dt>
      <dd><b>{{ expiration.snapshot?.productName ?? '—' }}</b></dd>
      <dt>Variante</dt>
      <dd data-testid="decision-variant">{{ expiration.snapshot?.variantName ?? '—' }}</dd>
      <dt>Sucursal</dt>
      <dd>{{ expiration.snapshot?.branchName ?? '—' }}</dd>
    </dl>

    <template v-else-if="zone">
      <dl class="rd-kv">
        <dt>Código postal</dt>
        <dd><b class="rd-fig">{{ zone.zipCode ?? '—' }}</b></dd>
        <dt>Colonia</dt>
        <dd data-testid="decision-place">{{ place }}</dd>
        <dt>Clientes que preguntaron</dt>
        <dd>
          <span class="rd-fig">{{ zone.requesterCount ?? '—' }}</span> (incluye resueltas y canceladas)
        </dd>
      </dl>
      <div v-if="impact" class="rd-alert rd-alert--warn" role="note" data-testid="zone-impact">
        <UIcon name="i-lucide-users" aria-hidden="true" />
        <div>
          <strong>{{ impact }}</strong>
          La decisión aplica a todos los clientes que preguntaron por el código postal {{ zone.zipCode }}.
        </div>
      </div>
    </template>

    <template v-else-if="receipt">
      <dl class="rd-kv">
        <dt>Venta</dt>
        <dd>
          <b class="rd-fig">{{ receipt.saleFolio ?? '—' }}</b> · total {{ formatMoney(receipt.saleTotalCents) }}
        </dd>
        <dt>Pagado / debe</dt>
        <dd>{{ formatMoney(receipt.salePaidCents) }} / <b>{{ formatMoney(receipt.saleDebtCents) }}</b></dd>
        <dt>Declarado por el cliente</dt>
        <dd>
          <template v-if="receipt.declaredAmountProvided">{{ formatMoney(receipt.declaredAmountCents) }}</template>
          <template v-else>No indicó monto</template>
          <template v-if="receipt.declaredDate"> · {{ receipt.declaredDate }}</template>
          <template v-if="receipt.declaredReference"> · ref. {{ receipt.declaredReference }}</template>
        </dd>
      </dl>
      <p v-if="receipt.mismatch === true" class="rd-tag rd-tag--warn" data-testid="receipt-mismatch">
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
        El monto no coincide
      </p>
      <div class="rd-file" data-testid="receipt-preview">
        <img
          v-if="previewUrl"
          class="rd-file__img"
          :src="previewUrl"
          alt="Comprobante enviado por el cliente"
          loading="lazy"
        />
        <p v-else class="rd-file__note">
          <UIcon name="i-lucide-image" aria-hidden="true" />
          {{ previewMessage }}
        </p>
        <p v-if="fileMeta" class="rd-sub">{{ fileMeta }}</p>
        <a
          v-if="originalUrl"
          class="rd-link"
          data-testid="receipt-original"
          :href="originalUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir original
        </a>
      </div>
    </template>

    <p v-else class="rd-sub">Esta solicitud trae datos que esta versión no sabe mostrar.</p>

    <p v-if="resolution" class="rd-resolution" data-testid="decision-resolution">
      <UIcon name="i-lucide-circle-check" aria-hidden="true" />
      {{ resolution }}
    </p>
  </section>
</template>
