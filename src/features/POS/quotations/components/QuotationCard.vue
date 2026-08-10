<script setup lang="ts">
import { computed } from 'vue'
import type { QuotationResponseDto, QuotationStatus } from '../interfaces/quotation.types'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'

const props = withDefaults(
  defineProps<{
    quotation: QuotationResponseDto
    canDelete?: boolean
  }>(),
  { canDelete: false },
)

const emit = defineEmits<{
  navigate: []
  delete: []
}>()

/** Truncated id — mirrors the list view's `truncatedId` helper. */
const truncatedId = computed(() =>
  props.quotation.id.length > 8 ? `${props.quotation.id.slice(0, 8)}…` : props.quotation.id,
)

/** Customer display name — mirrors the list view's `customerName` helper. */
const customerName = computed(() => {
  const c = props.quotation.customer
  if (!c) return 'Sin cliente'
  const full = `${c.firstName} ${c.lastName ?? ''}`.trim()
  return full || 'Sin cliente'
})

/**
 * Effective status — mirrors the list view: a SENT quotation whose expiresAt
 * is in the past renders as EXPIRED (lazy client-side transition).
 */
const effectiveStatus = computed<QuotationStatus>(() => {
  if (props.quotation.status === 'SENT' && isExpired(props.quotation)) {
    return 'EXPIRED'
  }
  return props.quotation.status
})

const statusTone = computed(() => statusToTone(effectiveStatus.value))
const statusLabel = computed(() => statusToLabel(effectiveStatus.value))

/** Localized es-MX expiry date — same formatter as the list view. */
function formatExpiryDate(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

const expiryLabel = computed(() => formatExpiryDate(props.quotation.expiresAt))

/** Dropdown items — "Ver detalle" always; "Eliminar" only for deletable statuses. */
const rowActions = computed(() => {
  const navigationActions = [
    { label: 'Ver detalle', onSelect: () => emit('navigate') },
  ]

  const isDeletableStatus =
    props.quotation.status === QUOTATION_STATUS.DRAFT ||
    props.quotation.status === QUOTATION_STATUS.CANCELLED

  const destructiveActions = props.canDelete && isDeletableStatus
    ? [{
        label: 'Eliminar',
        color: 'error' as const,
        'data-testid': 'quotation-card-delete',
        onSelect: () => emit('delete'),
      }]
    : []

  return [navigationActions, destructiveActions].filter((section) => section.length > 0)
})
</script>

<template>
  <UCard
    class="rounded-xl border border-default"
    :ui="{ body: 'p-4 bg-coco-neutral-50 dark:bg-coco-neutral-950' }"
  >
    <article class="space-y-3" data-testid="quotation-card">
      <RouterLink
        :to="`/pos/cotizaciones/${quotation.id}`"
        class="block space-y-3 focus:outline-none"
        data-testid="quotation-card-link"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="truncate font-mono text-xs text-muted">{{ truncatedId }}</p>
          <StatusDotBadge :tone="statusTone" :label="statusLabel" compact />
        </div>

        <p class="truncate text-sm font-semibold text-highlighted">{{ customerName }}</p>

        <p class="text-xl font-semibold text-highlighted">{{ formatCentsMXN(quotation.totalCents) }}</p>
      </RouterLink>

      <div class="flex items-center justify-between">
        <p class="text-sm text-muted">Expira: {{ expiryLabel }}</p>
        <UDropdownMenu :items="rowActions" :content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            color="neutral"
            variant="ghost"
            class="size-7"
            aria-label="Acciones de la cotización"
          />
        </UDropdownMenu>
      </div>
    </article>
  </UCard>
</template>
