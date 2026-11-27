<script setup lang="ts">
/**
 * «Abrir caja» in ONE place (direction A): 1. the register as radio cards,
 * 2. the fund (received FLOAT or a new one) in pesos, 3. the explicit
 * confirmation that names the amount, then «Abrir caja con $X».
 *
 * Presentational: the view owns the registers read, the custody read and the
 * open command. The register list has one state at a time — loading, failed
 * (one message with Reintentar), empty or the cards — and register management
 * (create / activate) lives in a separate «Administrar cajas» disclosure that
 * never offers opening, so a register is chosen in exactly one control.
 *
 * Busy registers (cash-picker-unreleased): a register whose session still holds
 * the drawer (`drawerReleasedAt: null`) is refused by the server, so its card is
 * disabled and says who holds it and since when, with «Ver la sesión» to reach
 * that session. `busyScope` says how much is known: `branch` (audit read, every
 * held drawer), `own` (only the user's own sessions) or `none` (no read): below
 * `branch` the server still confirms the register is free.
 *
 * Handoff 31: each register from GET /cash-registers carries `drawerHeld` (the
 * very rule behind the refusal) for every user, so it decides busy/disabled and
 * no hedge is needed. The label says the state and since when; the cashier's
 * name only when `heldBy` reveals it, «Tu sesión» for the user's own. «Ver la
 * sesión» is offered only with `heldBy` (the user may open that session). A
 * register without the field (older backend) falls back to `heldSessions`.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { HfRadioCards, type HfRadioCardItem } from '@/core/shared/components/selection'
import CashOpenSessionForm from './CashOpenSessionForm.vue'
import CashRegistersPanel from './CashRegistersPanel.vue'
import {
  cashRegisterBusyLabel,
  cashRegisterHeldLabel,
  cashRegisterHold,
  type CashRegisterHold,
} from '../utils/cash-display'
import type { CashEligibleFloatItem, CashRegister, CashSession } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    registers?: CashRegister[]
    selectedRegisterId?: string | null
    loading?: boolean
    error?: boolean
    canReadRegisters?: boolean
    canCreate?: boolean
    canUpdate?: boolean
    canOpen?: boolean
    creating?: boolean
    updating?: boolean
    eligibleFloat?: CashEligibleFloatItem[]
    custodyVisible?: boolean
    submitting?: boolean
    errorMessage?: string | null
    registersErrorMessage?: string | null
    /** registerId → its newest session still holding the drawer. */
    heldSessions?: Record<string, CashSession>
    /** The held-drawer read is still loading: no card is offered as free yet. */
    busyChecking?: boolean
    busyScope?: 'branch' | 'own' | 'none'
    currentUserId?: string | null
    /** A refused open names a session the user may open from the error. */
    errorSessionId?: string | null
  }>(),
  {
    registers: () => [],
    selectedRegisterId: null,
    loading: false,
    error: false,
    canReadRegisters: false,
    canCreate: false,
    canUpdate: false,
    canOpen: false,
    creating: false,
    updating: false,
    eligibleFloat: () => [],
    custodyVisible: false,
    submitting: false,
    errorMessage: null,
    registersErrorMessage: null,
    heldSessions: () => ({}),
    busyChecking: false,
    busyScope: 'none',
    currentUserId: null,
    errorSessionId: null,
  },
)

const floatId = defineModel<string | null>('floatId', { default: null })

const emit = defineEmits<{
  select: [registerId: string]
  create: [name: string]
  update: [id: string, payload: { name?: string; isActive?: boolean }]
  refresh: []
  submit: [payload: { openingCents: number; openingHandoverId?: string }]
  'view-session': [sessionId: string]
}>()

const INACTIVE = 'Inactiva: no se puede abrir'

/** Fallback (no `drawerHeld`): the description from the held-drawer sessions read. */
function fallbackDescription(register: CashRegister): string {
  if (!register.isActive) return INACTIVE
  const held = props.heldSessions[register.id]
  if (held) return cashRegisterBusyLabel(held, props.currentUserId)
  if (props.busyChecking) return 'Comprobando si está libre…'
  return 'Disponible para abrir'
}

function registerDescription(register: CashRegister, hold: CashRegisterHold): string {
  if (hold.state === 'unknown') return fallbackDescription(register)
  if (hold.state === 'held') {
    const label = cashRegisterHeldLabel(hold)
    return register.isActive ? label : `${INACTIVE} · ${label}`
  }
  return register.isActive ? 'Disponible para abrir' : INACTIVE
}

function isBusy(register: CashRegister, hold: CashRegisterHold): boolean {
  if (hold.state === 'unknown') {
    return Boolean(props.heldSessions[register.id]) || props.busyChecking
  }
  return hold.state === 'held'
}

const registerItems = computed<HfRadioCardItem[]>(() =>
  props.registers.map((register) => {
    const hold = cashRegisterHold(register)
    return {
      value: register.id,
      label: register.name,
      description: registerDescription(register, hold),
      disabled: !register.isActive || !props.canOpen || isBusy(register, hold),
    }
  }),
)

/**
 * Held registers whose session the user can open: `heldBy` (their own, or any
 * with the audit read) — inactive ones too, since releasing is the way out — or,
 * in the fallback, an active register's session from the user's visible list.
 */
const busyLinks = computed(() =>
  props.registers.flatMap((register) => {
    const hold = cashRegisterHold(register)
    let sessionId: string | undefined
    if (hold.state === 'held') sessionId = hold.heldBy?.sessionId
    else if (hold.state === 'unknown' && register.isActive) {
      sessionId = props.heldSessions[register.id]?.id
    }
    return sessionId ? [{ registerId: register.id, name: register.name, sessionId }] : []
  }),
)

/** Every register says whether its drawer is held: the list is the truth. */
const holdKnown = computed(() =>
  props.registers.every((register) => cashRegisterHold(register).state !== 'unknown'),
)

const notice = computed(() => {
  if (holdKnown.value || props.busyScope === 'branch') {
    return 'Las cajas inactivas u ocupadas no se pueden abrir.'
  }
  if (props.busyScope === 'own') {
    return 'Las cajas inactivas u ocupadas no se pueden abrir. Solo ves tus propias sesiones: el servidor confirma si la caja está libre.'
  }
  return 'Las cajas inactivas no se pueden abrir. El servidor confirma si la caja está libre.'
})

const selectedName = computed(
  () => props.registers.find((item) => item.id === props.selectedRegisterId)?.name ?? null,
)
const canManage = computed(() => props.canCreate || props.canUpdate)
const isEmpty = computed(() => !props.loading && !props.error && props.registers.length === 0)

function choose(registerId: string) {
  if (registerId !== props.selectedRegisterId) emit('select', registerId)
}
</script>

<template>
  <div class="cash-opening" data-testid="cash-opening-panel">
    <div v-if="!canOpen" class="cash-callout" data-testid="cash-opening-forbidden">
      <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
      <p>
        <strong>No tienes permiso para abrir caja</strong><br />
        <span class="cash-meta-wrap"
          >Pide a un encargado el permiso «Abrir caja». Lo demás de la caja sigue disponible.</span
        >
      </p>
    </div>

    <template v-else-if="canReadRegisters">
      <div
        v-if="loading"
        class="flex flex-col gap-3"
        aria-busy="true"
        data-testid="cash-opening-loading"
      >
        <span class="sr-only">Cargando cajas…</span>
        <div v-for="n in 2" :key="n" class="hf-skeleton h-16 w-full animate-pulse rounded-xl" aria-hidden="true" />
      </div>

      <EmptyState
        v-else-if="error"
        kind="error"
        title="No se pudieron cargar las cajas"
        :description="registersErrorMessage ?? 'Revisa la conexión e inténtalo de nuevo.'"
        action-label="Reintentar"
        data-testid="cash-opening-error"
        @action="emit('refresh')"
      />

      <EmptyState
        v-else-if="isEmpty && !canCreate"
        title="Aún no hay cajas"
        description="Pide a un encargado que cree la primera caja."
        data-testid="cash-opening-no-registers"
      />

      <fieldset v-else-if="!isEmpty" class="cash-fieldset">
        <legend id="cash-opening-register-legend" class="cash-legend">1. Caja</legend>
        <HfRadioCards
          :model-value="selectedRegisterId"
          :items="registerItems"
          labelledby="cash-opening-register-legend"
          selected-label=""
          data-testid="cash-opening-registers"
          @update:model-value="choose"
        />
        <ul v-if="busyLinks.length" class="cash-busy-links" data-testid="cash-opening-busy">
          <li v-for="link in busyLinks" :key="link.registerId">
            <span class="cash-meta-wrap">{{ link.name }} está ocupada.</span>
            <UButton
              type="button"
              color="neutral"
              variant="link"
              class="min-h-11 px-1"
              trailing-icon="i-lucide-arrow-right"
              :aria-label="`Ver la sesión que ocupa ${link.name}`"
              :data-testid="`cash-opening-busy-view-${link.registerId}`"
              @click="emit('view-session', link.sessionId)"
              >Ver la sesión</UButton
            >
          </li>
        </ul>
        <p class="cash-notice" data-testid="cash-opening-notice">
          <UIcon name="i-lucide-info" class="size-4 shrink-0" aria-hidden="true" />
          {{ notice }}
        </p>
      </fieldset>
    </template>

    <CashOpenSessionForm
      v-if="canOpen"
      :key="`open:${selectedRegisterId ?? 'none'}`"
      v-model:float-id="floatId"
      :register-id="selectedRegisterId"
      :register-name="selectedName"
      :eligible-float="eligibleFloat"
      :custody-visible="custodyVisible"
      :can-open="canOpen"
      :submitting="submitting"
      :error-message="errorMessage"
      :error-session-id="errorSessionId"
      @submit="emit('submit', $event)"
      @view-session="emit('view-session', $event)"
    />

    <!-- Register management: create and (de)activate; never a second way to open. -->
    <details
      v-if="canReadRegisters && canManage && !loading && !error"
      class="cash-manage"
      :open="isEmpty"
      data-testid="cash-opening-manage"
    >
      <summary class="cash-manage-summary">Administrar cajas</summary>
      <CashRegistersPanel
        :registers="registers"
        :selected-register-id="selectedRegisterId"
        :can-create="canCreate"
        :can-update="canUpdate"
        :can-open="false"
        :creating="creating"
        :updating="updating"
        @create="emit('create', $event)"
        @update="(id, payload) => emit('update', id, payload)"
        @refresh="emit('refresh')"
      />
    </details>
  </div>
</template>
