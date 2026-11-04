<script setup lang="ts">
/**
 * Central "selected turn" card.
 *
 * It frames the explicitly selected session: a status badge, the real register
 * name and a small meta row built only from values the session projection
 * actually carries. It never selects a register/session on its own, never
 * discovers a cashier name and never claims a session-opening time the contract
 * does not expose.
 *
 * Without a selection it renders a genuine unselected state with ONE contextual
 * navigation (open a turn), never a command. Loading, failure and no selection
 * each have their own shape.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import CashSessionSummary from './CashSessionSummary.vue'
import { blindSafeDetail, cashSessionFacts } from '../composables/cashRules'
import type { CashSessionDetail } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'

const props = withDefaults(
  defineProps<{
    hasSelection?: boolean
    detail?: CashSessionDetail | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    /** `true` when the selected shift belongs to the current actor, `false` when it does not, `null` when unknown. */
    isOwnShift?: boolean | null
  }>(),
  {
    hasSelection: false,
    detail: null,
    loading: false,
    error: false,
    errorMessage: 'No se pudo cargar la sesión. Reintenta.',
    isOwnShift: null,
  },
)

const emit = defineEmits<{
  requestOpening: []
  retry: []
}>()

const safeDetail = computed(() => blindSafeDetail(props.detail))
const facts = computed(() => cashSessionFacts(safeDetail.value?.session))

const registerName = computed(() => safeDetail.value?.register?.name ?? '—')
const status = computed(() => facts.value.status)

/**
 * The unselected card invites the viewer; a selected card only claims "tu turno"
 * when the shift is actually theirs. Another person's or an unknown shift is
 * presented neutrally, never as the viewer's own.
 */
const heroTitle = computed(() => {
  if (!props.hasSelection) return 'Tu turno'
  return props.isOwnShift === true ? 'Tu turno' : 'Turno seleccionado'
})

const cashierLabel = computed(() => {
  if (props.isOwnShift === true) return 'Tú'
  if (props.isOwnShift === false) return 'Otra persona'
  return 'Cajera/o asignado'
})

const frozenLabel = computed(() =>
  facts.value.frozenAt ? formatShortDateTime(facts.value.frozenAt) : 'Sin iniciar',
)
</script>

<template>
  <section class="cash-shift-card" data-testid="cash-workspace-shift-card">
    <div class="cash-shift-top">
      <p class="cash-shift-label" data-testid="cash-workspace-shift-title">{{ heroTitle }}</p>
      <StatusBadge
        v-if="hasSelection && !loading && !error && status"
        :label="CASH_SESSION_STATUS_LABELS[status]"
        :tone="cashSessionStatusTone(status)"
        data-testid="cash-shift-status"
      />
    </div>

    <div
      v-if="hasSelection && loading"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="cash-shift-loading"
    >
      <span class="sr-only">Cargando</span>
      <div class="h-6 w-1/3 animate-pulse rounded bg-[var(--hf-surface-muted)]" aria-hidden="true" />
      <div class="h-16 w-full animate-pulse rounded bg-[var(--hf-surface-muted)]" aria-hidden="true" />
    </div>

    <EmptyState
      v-else-if="hasSelection && error"
      kind="error"
      title="No se pudo cargar la sesión"
      :description="errorMessage"
      action-label="Reintentar"
      data-testid="cash-shift-error"
      @action="emit('retry')"
    />

    <template v-else-if="hasSelection">
      <h2 class="cash-shift-register" data-testid="cash-shift-register">{{ registerName }}</h2>
      <dl class="cash-shift-meta">
        <div class="cash-shift-meta-item">
          <dt>Cajera/o</dt>
          <dd data-testid="cash-shift-cashier">{{ cashierLabel }}</dd>
        </div>
        <div class="cash-shift-meta-item">
          <dt>Conteo</dt>
          <dd data-testid="cash-shift-frozen">{{ frozenLabel }}</dd>
        </div>
      </dl>
      <CashSessionSummary
        :detail="detail"
        :loading="loading"
        :error="error"
        :error-message="errorMessage"
        @retry="emit('retry')"
      />
    </template>

    <EmptyState
      v-else
      title="Aún no hay un turno en foco"
      description="Abre una caja o elige una sesión para operar, contar o verificar."
      action-label="Abrir un turno"
      action-test-id="cash-workspace-shift-open"
      data-testid="cash-workspace-no-shift"
      @action="emit('requestOpening')"
    />
  </section>
</template>
