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
 * each have their own shape, and the unselected copy says the next step the page
 * is actually in (`noShiftContext`): wait, create a register, choose one, enter
 * the float, or pick a session. The view derives it from the registers read.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import CashSessionSummary from './CashSessionSummary.vue'
import { blindSafeDetail, cashSessionFacts } from '../composables/cashRules'
import type { CashSessionDetail } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'

/** Where the page is while no shift is selected. */
export type CashShiftContext =
  | 'loading'
  | 'no-registers'
  | 'choose-register'
  | 'register-chosen'
  | 'choose-session'

const NO_SHIFT_DESCRIPTIONS: Record<Exclude<CashShiftContext, 'loading'>, string> = {
  'no-registers': 'Aún no hay cajas para abrir un turno.',
  'choose-register': 'Elige una caja para abrir tu turno.',
  'register-chosen': 'Ingresa el fondo inicial para abrir tu turno.',
  'choose-session': 'Elige una sesión para operar, contar o verificar.',
}

const props = withDefaults(
  defineProps<{
    hasSelection?: boolean
    detail?: CashSessionDetail | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    /** `true` when the selected shift belongs to the current actor, `false` when it does not, `null` when unknown. */
    isOwnShift?: boolean | null
    /** What the unselected card reflects; see `CashShiftContext`. */
    noShiftContext?: CashShiftContext
    /** The Apertura task is already showing, so "Abrir un turno" would lead nowhere. */
    openingActive?: boolean
  }>(),
  {
    hasSelection: false,
    detail: null,
    loading: false,
    error: false,
    errorMessage: undefined,
    isOwnShift: null,
    noShiftContext: 'choose-register',
    openingActive: false,
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

const noShiftDescription = computed(() =>
  props.noShiftContext === 'loading' ? '' : NO_SHIFT_DESCRIPTIONS[props.noShiftContext],
)
// Opening a turn is only offered where it is the next step and not already on screen.
const canRequestOpening = computed(
  () => !props.openingActive && props.noShiftContext !== 'choose-session',
)

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

    <div
      v-else-if="noShiftContext === 'loading'"
      class="flex flex-col items-center gap-3 py-8"
      aria-busy="true"
      data-testid="cash-shift-context-loading"
    >
      <span class="sr-only">Cargando</span>
      <div class="size-6 animate-pulse rounded-full bg-[var(--hf-surface-muted)]" aria-hidden="true" />
      <div class="h-4 w-48 animate-pulse rounded bg-[var(--hf-surface-muted)]" aria-hidden="true" />
      <div class="h-3.5 w-64 max-w-full animate-pulse rounded bg-[var(--hf-surface-muted)]" aria-hidden="true" />
    </div>

    <EmptyState
      v-else
      title="Aún no hay un turno en foco"
      :description="noShiftDescription"
      :action-label="canRequestOpening ? 'Abrir un turno' : undefined"
      action-test-id="cash-workspace-shift-open"
      data-testid="cash-workspace-no-shift"
      @action="emit('requestOpening')"
    />
  </section>
</template>
