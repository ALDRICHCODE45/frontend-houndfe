<script setup lang="ts">
/**
 * RequestDetailDecision — read view of the per-subtype decision data (RESTOCK, EXPIRATION,
 * DELIVERY_ZONE with its impact, TRANSFER_RECEIPT with the file preview). Read side only: the
 * resolve forms are unit 4. Every field is optional on purpose: a snapshot the server left
 * incomplete, a shape a later unit adds, or a hostile URL must never crash or inject the page.
 */
import { computed, ref, useId } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import ReceiptSaleSummaryModal from './ReceiptSaleSummaryModal.vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import {
  formatMoney,
  previewStatusLabel,
  resolutionActionLabel,
  zoneImpactText,
} from '../utils/detail-format'
import { useReceiptFile } from '../composables/useReceiptFile'
import { extractedReading, isMismatchFlagged } from '../utils/decision-summary'
import { formatWhen, SUBTYPE_LABELS } from '../utils/requestLabels'

const props = defineProps<{
  request: ChatbotRequestDetail
  timeZone?: string
  now?: Date
}>()

const headingId = useId()
const when = (iso: string | null | undefined) =>
  formatWhen(iso ?? null, { timeZone: props.timeZone, now: props.now })

const decision = computed(() => props.request.decision)
const isOpen = computed(
  () => props.request.status === 'NEW' || props.request.status === 'IN_PROGRESS',
)

const restock = computed(() => (decision.value?.subtype === 'RESTOCK' ? decision.value : null))
const expiration = computed(() =>
  decision.value?.subtype === 'EXPIRATION' ? decision.value : null,
)
const zone = computed(() => (decision.value?.subtype === 'DELIVERY_ZONE' ? decision.value : null))
const receipt = computed(() =>
  decision.value?.subtype === 'TRANSFER_RECEIPT' ? decision.value : null,
)
const known = computed(() => !!(restock.value || expiration.value || zone.value || receipt.value))

const title = computed(() => {
  const subtype = decision.value?.subtype
  const label = subtype ? SUBTYPE_LABELS[subtype] : undefined
  return label && known.value ? `${label}: datos de la solicitud` : 'Datos de la solicitud'
})

const place = computed(() => {
  const z = zone.value
  const parts = [z?.neighborhood, z?.municipality, z?.state].filter(
    (p): p is string => !!p && p.trim().length > 0,
  )
  return parts.length ? parts.join(', ') : '—'
})

const impact = computed(() =>
  isOpen.value && props.request.zoneImpact ? zoneImpactText(props.request.zoneImpact) : null,
)

const file = computed(() => receipt.value?.file ?? null)
const receiptFile = useReceiptFile(
  () => (file.value?.mimeType?.startsWith('image/') ? file.value.previewUrl : null),
  () => file.value?.originalUrl,
)
const previewUrl = receiptFile.previewUrl
const zoomOpen = ref(false)
const extracted = computed(() => extractedReading(receipt.value?.extracted))
const saleOpen = ref(false)
const auth = useAuthStore()
const canReadSale = computed(() => auth.userCan('read', 'Sale') && !!receipt.value?.saleId)
const showOriginal = computed(() => receiptFile.canRead.value && receiptFile.hasOriginal.value)
const previewMessage = computed(() => {
  const f = file.value
  if (!f) return 'El archivo ya se eliminó'
  if (
    !receiptFile.canRead.value &&
    (receiptFile.hasPreview.value || receiptFile.hasOriginal.value)
  ) {
    return 'No tienes permiso para ver el comprobante.'
  }
  if (receiptFile.previewLoading.value) return 'Cargando la vista previa…'
  if (receiptFile.previewError.value) return receiptFile.previewError.value
  return f.previewStatus === 'READY'
    ? 'Vista previa no disponible'
    : previewStatusLabel(f.previewStatus)
})
const fileMeta = computed(() => {
  const f = file.value
  if (!f) return null
  const kb =
    typeof f.sizeBytes === 'number' ? `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB` : null
  return [f.mimeType, kb].filter(Boolean).join(' · ') || null
})

const resolution = computed(() => {
  const r = decision.value?.resolution
  if (!r) return null
  const by = r.resolvedBy?.displayName
  return [
    resolutionActionLabel(r.action) ?? 'Resuelta',
    by ? `por ${by}` : null,
    when(r.resolvedAt),
  ]
    .filter(Boolean)
    .join(' · ')
})
</script>

<template>
  <section
    v-if="decision"
    class="rd-panel"
    :aria-labelledby="headingId"
    data-testid="request-decision"
  >
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
      <dd>
        <span class="rd-fig">{{ restock.snapshot?.requestedQuantity ?? '—' }}</span>
      </dd>
      <dt>Existencias al pedir</dt>
      <dd>
        <span class="rd-fig">{{ restock.snapshot?.observedStockAtRequest ?? '—' }}</span>
        <template v-if="when(restock.snapshot?.stockObservedAt)">
          · visto {{ when(restock.snapshot?.stockObservedAt) }}</template
        >
      </dd>
    </dl>

    <dl v-else-if="expiration" class="rd-kv">
      <dt>Producto</dt>
      <dd>
        <b>{{ expiration.snapshot?.productName ?? '—' }}</b>
      </dd>
      <dt>Variante</dt>
      <dd data-testid="decision-variant">{{ expiration.snapshot?.variantName ?? '—' }}</dd>
      <dt>Sucursal</dt>
      <dd>{{ expiration.snapshot?.branchName ?? '—' }}</dd>
    </dl>

    <template v-else-if="zone">
      <dl class="rd-kv">
        <dt>Código postal</dt>
        <dd>
          <b class="rd-fig">{{ zone.zipCode ?? '—' }}</b>
        </dd>
        <dt>Colonia</dt>
        <dd data-testid="decision-place">{{ place }}</dd>
        <dt>Clientes que preguntaron</dt>
        <dd>
          <span class="rd-fig">{{ zone.requesterCount ?? '—' }}</span> (incluye resueltas y
          canceladas)
        </dd>
      </dl>
      <div v-if="impact" class="rd-alert rd-alert--warn" role="note" data-testid="zone-impact">
        <UIcon name="i-lucide-users" aria-hidden="true" />
        <div>
          <strong>{{ impact }}</strong>
          La decisión aplica a todos los clientes que preguntaron por el código postal
          {{ zone.zipCode }}.
        </div>
      </div>
    </template>

    <template v-else-if="receipt">
      <dl class="rd-kv">
        <dt>Venta</dt>
        <dd>
          <b class="rd-fig">{{ receipt.saleFolio ?? '—' }}</b> · total
          {{ formatMoney(receipt.saleTotalCents) }}
          <button
            v-if="canReadSale"
            type="button"
            class="rd-link rd-sale-open"
            data-testid="receipt-sale-open"
            @click="saleOpen = true"
          >
            Ver venta
          </button>
        </dd>
        <dt>Pagado / debe</dt>
        <dd>
          {{ formatMoney(receipt.salePaidCents) }} / <b>{{ formatMoney(receipt.saleDebtCents) }}</b>
        </dd>
        <dt>Declarado por el cliente</dt>
        <dd>
          <template v-if="receipt.declaredAmountProvided">{{
            formatMoney(receipt.declaredAmountCents)
          }}</template>
          <template v-else>No indicó monto</template>
          <template v-if="receipt.declaredDate"> · {{ receipt.declaredDate }}</template>
          <template v-if="receipt.declaredReference">
            · ref. {{ receipt.declaredReference }}</template
          >
        </dd>
        <template v-if="extracted">
          <dt>Detectado en la imagen</dt>
          <dd data-testid="receipt-extracted">
            {{ extracted }}
            <span class="rd-sub rd-auto-note">
              <UIcon name="i-lucide-scan-text" aria-hidden="true" />
              Lectura automática del bot
            </span>
          </dd>
        </template>
      </dl>
      <p
        v-if="isMismatchFlagged(receipt.mismatch)"
        class="rd-tag rd-tag--warn"
        data-testid="receipt-mismatch"
      >
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
        El monto no coincide
      </p>
      <div class="rd-file" data-testid="receipt-preview">
        <button
          v-if="previewUrl"
          type="button"
          class="rd-file__zoom"
          data-testid="receipt-zoom"
          aria-label="Ampliar comprobante"
          @click="zoomOpen = true"
        >
          <img
            class="rd-file__img"
            :src="previewUrl"
            alt="Comprobante enviado por el cliente"
            loading="lazy"
          />
          <span class="rd-file__zoom-hint" aria-hidden="true">
            <UIcon name="i-lucide-zoom-in" />
          </span>
        </button>
        <p v-else class="rd-file__note">
          <UIcon name="i-lucide-image" aria-hidden="true" />
          {{ previewMessage }}
        </p>
        <p v-if="fileMeta" class="rd-sub">{{ fileMeta }}</p>
        <button
          v-if="showOriginal"
          type="button"
          class="rd-link"
          data-testid="receipt-original"
          :disabled="receiptFile.opening.value"
          :aria-busy="receiptFile.opening.value || undefined"
          @click="receiptFile.openOriginal"
        >
          Abrir original
        </button>
        <p
          v-if="receiptFile.originalError.value"
          class="rd-sub"
          role="alert"
          data-testid="receipt-original-error"
        >
          {{ receiptFile.originalError.value }}
        </p>
      </div>
      <UModal
        v-model:open="zoomOpen"
        title="Comprobante ampliado"
        description="Comprobante de transferencia enviado por el cliente"
        :ui="{ content: 'max-w-3xl' }"
      >
        <template #body>
          <img
            v-if="previewUrl"
            data-testid="receipt-zoom-image"
            class="mx-auto block max-h-[80vh] w-auto max-w-full rounded-md object-contain"
            :src="previewUrl"
            alt="Comprobante enviado por el cliente"
          />
        </template>
      </UModal>
      <ReceiptSaleSummaryModal
        v-if="canReadSale"
        v-model:open="saleOpen"
        :sale-id="receipt.saleId"
        :folio="receipt.saleFolio"
      />
    </template>

    <p v-else class="rd-sub">Esta solicitud trae datos que esta versión no sabe mostrar.</p>

    <p v-if="resolution" class="rd-resolution" data-testid="decision-resolution">
      <UIcon name="i-lucide-circle-check" aria-hidden="true" />
      {{ resolution }}
    </p>
  </section>
</template>
