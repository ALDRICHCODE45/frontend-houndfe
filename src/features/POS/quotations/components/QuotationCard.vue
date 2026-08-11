<script setup lang="ts">
import { computed } from 'vue'
import type { QuotationResponseDto, QuotationStatus } from '../interfaces/quotation.types'
import { QUOTATION_STATUS } from '../constants/quotation.constants'
import { isExpired, statusToTone, statusToLabel } from '../utils/quotation.utils'
import { formatCentsMXN } from '../utils/currency.utils'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'

const props = withDefaults(
  defineProps<{
    quotation: QuotationResponseDto
    canDelete?: boolean
  }>(),
  { canDelete: false },
)

const emit = defineEmits<{
  click: [quotation: QuotationResponseDto]
  navigate: []
  delete: [quotation: QuotationResponseDto]
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

/** Avatar status dot is on for DRAFT and SENT (the active states). */
const showAvatarDot = computed(() => {
  const s = effectiveStatus.value
  return s === QUOTATION_STATUS.DRAFT || s === QUOTATION_STATUS.SENT
})

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
        onSelect: () => emit('delete', props.quotation),
      }]
    : []

  return [navigationActions, destructiveActions].filter((section) => section.length > 0)
})
</script>

<template>
  <article
    data-testid="quotation-card"
    class="group relative flex min-h-[220px] cursor-pointer flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    @click="emit('click', quotation)"
  >
    <!-- Row action menu (top-right) — @click.stop so the dropdown does not
         trigger card navigation (REQ-17). -->
    <div v-if="rowActions.length > 0" class="absolute right-3 top-3 z-10" @click.stop>
      <UDropdownMenu
        :items="rowActions"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis-vertical"
          color="neutral"
          variant="ghost"
          class="size-7 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Acciones de la cotización"
        />
      </UDropdownMenu>
    </div>

    <!-- Card header: avatar + customer + truncated id -->
    <div class="flex flex-col items-start gap-3">
      <EntityAvatar
        :name="customerName"
        :seed="quotation.id"
        :show-dot="showAvatarDot"
        size="lg"
      />

      <div class="min-w-0 space-y-1 pr-7">
        <p class="truncate text-sm font-semibold leading-tight text-highlighted">
          {{ customerName }}
        </p>
        <p class="truncate font-mono text-xs text-muted">{{ truncatedId }}</p>
      </div>

      <div class="flex min-h-6 flex-wrap items-center gap-1.5">
        <StatusDotBadge :tone="statusTone" :label="statusLabel" compact />
      </div>
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <!-- 2-col body (Total / Expira) -->
    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Total</p>
        <p class="mt-1 truncate font-semibold text-default">
          {{ formatCentsMXN(quotation.totalCents) }}
        </p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Expira</p>
        <p class="mt-1 truncate font-medium text-default">{{ expiryLabel }}</p>
      </div>
    </div>
  </article>
</template>
