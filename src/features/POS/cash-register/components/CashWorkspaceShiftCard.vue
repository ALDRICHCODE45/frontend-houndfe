<script setup lang="ts">
/**
 * Central "selected turn" hero.
 *
 * It frames the explicitly selected session as the reference overview does:
 * a task eyebrow, a soft status badge, the real register name and a small meta
 * row built only from values the session projection actually carries. It never
 * selects a register/session on its own, never discovers a cashier name and
 * never claims a session-opening time the contract does not expose.
 *
 * Without a selection it renders a genuine unselected state: it explains how to
 * choose one and offers ONLY contextual navigation (open a turn / see the
 * session list), never a command.
 */
import { computed } from 'vue'
import CashSessionSummary from './CashSessionSummary.vue'
import { blindSafeDetail, cashSessionFacts } from '../composables/cashRules'
import type { CashSessionDetail, CashSessionStatus } from '../interfaces/cash.types'

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
  requestSessions: []
  requestOpening: []
}>()

const STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  COUNTING: 'Congelada',
  SUBMITTED: 'Declarada',
  CLOSED: 'Cerrada',
}

const STATUS_NOTES: Record<CashSessionStatus, string> = {
  OPEN: 'Lista para seguir operando.',
  COUNTING: 'Conteo en curso: los importes quedan ocultos.',
  SUBMITTED: 'Declaración enviada.',
  CLOSED: 'Turno cerrado.',
}

const safeDetail = computed(() => blindSafeDetail(props.detail))
const facts = computed(() => cashSessionFacts(safeDetail.value?.session))

const registerName = computed(() => safeDetail.value?.register?.name ?? '—')
const statusLabel = computed(() => (facts.value.status ? STATUS_LABELS[facts.value.status] : null))
const statusNote = computed(() => (facts.value.status ? STATUS_NOTES[facts.value.status] : null))

/**
 * The unselected card invites the viewer; a selected card only claims "tu turno"
 * when the shift is actually theirs. Another person's or an unknown shift is
 * presented neutrally, never as the viewer's own. Owner copy is untouched.
 */
const heroTitle = computed(() => {
  if (!props.hasSelection) return 'Tu turno'
  return props.isOwnShift === true ? 'Tu turno, bajo control' : 'Turno seleccionado'
})

const cashierLabel = computed(() => {
  if (props.isOwnShift === true) return 'Tú'
  if (props.isOwnShift === false) return 'Otra persona'
  return 'Cajera/o asignado'
})

const frozenLabel = computed(() =>
  facts.value.frozenAt ? formattedTime(facts.value.frozenAt) : 'Aún no inicia el conteo',
)

function formattedTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <section class="cash-shift-hero" data-testid="cash-workspace-shift-card">
    <div class="cash-shift-top">
      <p class="cash-shift-eyebrow" data-testid="cash-workspace-shift-title">
        <span class="cash-icon-tile cash-icon-tile-sm" aria-hidden="true">
          <UIcon :name="hasSelection ? 'i-lucide-wallet' : 'i-lucide-clock-3'" />
        </span>
        <span>{{ heroTitle }}</span>
      </p>
      <UBadge
        v-if="hasSelection && !loading && !error && statusLabel"
        color="primary"
        variant="subtle"
        data-testid="cash-shift-status"
      >
        {{ statusLabel }}
      </UBadge>
      <UBadge v-else-if="hasSelection && loading" color="neutral" variant="subtle">
        Cargando…
      </UBadge>
      <UBadge
        v-else-if="!hasSelection"
        color="neutral"
        variant="subtle"
        data-testid="cash-shift-status"
      >
        Sin sesión
      </UBadge>
    </div>

    <div v-if="hasSelection && loading" aria-busy="true" data-testid="cash-shift-loading">
      <USkeleton class="h-24 w-full" />
    </div>

    <UAlert
      v-else-if="hasSelection && error"
      color="error"
      variant="subtle"
      title="No se pudo cargar la sesión"
      :description="errorMessage"
      data-testid="cash-shift-error"
    />

    <template v-else-if="hasSelection">
      <h2 class="cash-shift-register" data-testid="cash-shift-register">{{ registerName }}</h2>
      <p class="cash-shift-description" data-testid="cash-shift-description">
        Sobre este turno trabajan las tareas que necesitan una sesión.
      </p>
      <dl class="cash-shift-meta">
        <div class="cash-shift-meta-item">
          <span class="cash-icon-tile" aria-hidden="true"
            ><UIcon name="i-lucide-user-round"
          /></span>
          <span>
            <small>Cajera/o</small>
            <span data-testid="cash-shift-cashier">{{ cashierLabel }}</span>
          </span>
        </div>
        <div class="cash-shift-meta-item">
          <span class="cash-icon-tile" aria-hidden="true"><UIcon name="i-lucide-clock-3" /></span>
          <span>
            <small>Conteo</small>
            <span data-testid="cash-shift-frozen">{{ frozenLabel }}</span>
          </span>
        </div>
      </dl>
    </template>

    <template v-else>
      <h2 class="cash-shift-register" data-testid="cash-workspace-no-shift">
        Aún no hay un turno en foco
      </h2>
      <p class="cash-shift-description">
        No se selecciona sola: abre una caja o elige una sesión para operar, contar o verificar.
      </p>
      <div class="cash-shift-bottom">
        <span class="cash-shift-note">
          <UIcon name="i-lucide-info" aria-hidden="true" />
          Elige una tarea cuando la necesites.
        </span>
        <div class="cash-shift-actions">
          <button
            type="button"
            class="cash-control"
            data-testid="cash-workspace-shift-open"
            @click="emit('requestOpening')"
          >
            Abrir un turno
          </button>
          <UButton
            type="button"
            color="primary"
            data-testid="cash-workspace-shift-select"
            @click="emit('requestSessions')"
          >
            Ver sesiones
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="hasSelection && !loading && !error" class="cash-shift-bottom">
      <span class="cash-shift-note">
        <span class="cash-live-dot" aria-hidden="true" />
        {{ statusNote }}
      </span>
    </div>

    <CashSessionSummary
      v-if="hasSelection && !loading && !error"
      variant="flat"
      :detail="detail"
      :loading="loading"
      :error="error"
      :error-message="errorMessage"
    />
  </section>
</template>
