<script setup lang="ts">
/**
 * Manual cash movements (cash-in / cash-out) plus the movement history.
 *
 * Two INDEPENDENT gates, per the backend contract:
 *
 *   1. HISTORY (blind window). Pre-submission the backend returns
 *      `movements: []` and discloses no movement metadata, so the history is
 *      never rendered while `blind` is true — even if a stale/malformed payload
 *      still carries movements. This does NOT depend on the session status: the
 *      contract's example A is an OWNER session with `status: OPEN` and
 *      `blind: true`.
 *
 *   2. COMMANDS (ownership + writability). Because example A is still OPEN it is
 *      WRITABLE, so its owner keeps the manual command forms even while blind.
 *      Commands therefore require BOTH a writable session and the caller being
 *      the session's cashier; a non-owner never gets them, and a frozen session
 *      (`COUNTING`+) rejects them server-side (`CASH_SESSION_NOT_WRITABLE`).
 */
import { computed, ref } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { pesosToCents } from '../utils/cash-input'
import { blindSafeDetail, isCashSessionWritable } from '../composables/cashRules'
import type { CashMovementKind, CashSessionDetail } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    detail?: CashSessionDetail | null
    /** Authenticated caller id — ownership of the session is enforced against it. */
    currentUserId?: string | null
    canCashIn?: boolean
    canCashOut?: boolean
    submitting?: boolean
    errorMessage?: string | null
  }>(),
  {
    detail: null,
    currentUserId: null,
    canCashIn: false,
    canCashOut: false,
    submitting: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  submit: [payload: { kind: 'CASH_IN' | 'CASH_OUT'; amountCents: number; reason: string }]
}>()

const MOVEMENT_LABELS: Record<CashMovementKind, string> = {
  CASH_IN: 'Ingreso manual',
  CASH_OUT: 'Retiro manual',
  SALE_PAYMENT: 'Cobro de venta',
  SALE_CHANGE: 'Cambio de venta',
  REFUND_SETTLEMENT: 'Liquidación de reembolso',
}

const safeDetail = computed(() => blindSafeDetail(props.detail))
const session = computed(() => safeDetail.value?.session ?? null)
const blind = computed(() => session.value?.blind === true)
const writable = computed(() => isCashSessionWritable(session.value))
const movements = computed(() => safeDetail.value?.movements ?? [])

/** Only the session's own cashier may register manual movements. */
const isOwner = computed(
  () => Boolean(props.currentUserId) && session.value?.cashierUserId === props.currentUserId,
)

const amountInput = ref('')
const reasonInput = ref('')
const localError = ref<string | null>(null)

const parsedAmount = computed<number | null>(() => {
  try {
    return pesosToCents(amountInput.value)
  } catch {
    return null
  }
})

function submit(kind: 'CASH_IN' | 'CASH_OUT') {
  if (!writable.value) {
    localError.value = 'La sesión está congelada: no admite movimientos.'
    return
  }
  if (!isOwner.value) {
    localError.value = 'Solo la persona responsable de la sesión registra movimientos.'
    return
  }
  const amountCents = parsedAmount.value
  if (amountCents === null) {
    localError.value = 'Ingresa un importe en pesos con hasta dos decimales.'
    return
  }
  if (amountCents === 0) {
    localError.value = 'El movimiento debe ser mayor a cero.'
    return
  }
  const reason = reasonInput.value.trim()
  if (!reason) {
    localError.value = 'El motivo es obligatorio para un movimiento manual.'
    return
  }
  localError.value = null
  emit('submit', { kind, amountCents, reason })
  amountInput.value = ''
  reasonInput.value = ''
}
</script>

<template>
  <section class="cash-panel" data-testid="cash-movements">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-banknote" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Movimientos de efectivo</h2>
        <p class="cash-panel-subtitle">
          El cajón físico es solo el canal Efectivo; los demás canales se informan aparte.
        </p>
      </div>
    </header>

    <div class="cash-panel-body">
      <p v-if="!safeDetail" class="text-sm text-muted" data-testid="cash-movements-empty-detail">
        Selecciona una sesión para ver sus movimientos.
      </p>

      <template v-else>
        <!-- HISTORY: hidden in the blind window, independent of the status. -->
        <p v-if="blind" class="text-sm text-muted" data-testid="cash-movements-history-hidden">
          Conteo ciego: el historial de movimientos no se muestra hasta enviar la declaración.
        </p>
        <template v-else>
          <p
            v-if="movements.length === 0"
            class="text-sm text-muted"
            data-testid="cash-movements-empty"
          >
            Todavía no hay movimientos en esta sesión.
          </p>

          <div
            v-else
            class="movement-history"
            role="region"
            aria-label="Historial de movimientos de efectivo"
            tabindex="0"
          >
            <table
              class="movement-history-table w-full text-left text-sm"
              data-testid="cash-movements-table"
            >
              <colgroup>
                <col class="movement-history-type" />
                <col class="movement-history-channel" />
                <col class="movement-history-amount" />
                <col />
              </colgroup>
              <thead>
                <tr class="text-xs text-muted">
                  <th scope="col" class="font-medium">Tipo</th>
                  <th scope="col" class="font-medium">Canal</th>
                  <th scope="col" class="text-right font-medium">Importe</th>
                  <th scope="col" class="font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="movement in movements"
                  :key="movement.id"
                  class="border-t border-default"
                  :data-testid="`cash-movement-${movement.id}`"
                >
                  <td class="text-highlighted">{{ MOVEMENT_LABELS[movement.kind] }}</td>
                  <td>
                    <UBadge color="neutral" variant="subtle">{{ movement.channelLabel }}</UBadge>
                  </td>
                  <td
                    class="movement-history-money text-right font-semibold"
                    :class="movement.deltaCents < 0 ? 'text-error' : 'text-success'"
                  >
                    {{ formatCentsMXN(movement.deltaCents) }}
                  </td>
                  <td class="movement-history-reason text-muted">{{ movement.reason ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- COMMANDS: writable AND owned by the caller. -->
        <p
          v-if="!writable"
          class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
          data-testid="cash-movements-frozen"
        >
          La sesión está congelada: no se pueden registrar movimientos.
        </p>

        <p
          v-else-if="!isOwner"
          class="rounded-lg border border-default p-3 text-sm text-muted"
          data-testid="cash-movements-owner-denied"
        >
          Esta sesión pertenece a otra persona: solo su responsable registra movimientos manuales.
        </p>

        <form
          v-else-if="canCashIn || canCashOut"
          class="flex flex-col gap-4 border-t border-default pt-4"
          data-testid="cash-movement-form"
          @submit.prevent
        >
          <div class="cash-form-content grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <UFormField label="Importe (pesos)">
              <UInput
                v-model="amountInput"
                inputmode="decimal"
                class="cash-control w-full"
                placeholder="25.00"
                data-testid="cash-movement-amount"
              />
            </UFormField>
            <UFormField label="Motivo">
              <UInput
                v-model="reasonInput"
                class="cash-control w-full"
                placeholder="Compra de bolsas"
                data-testid="cash-movement-reason"
              />
            </UFormField>
          </div>

          <p v-if="localError" class="text-sm text-error" data-testid="cash-movement-local-error">
            {{ localError }}
          </p>
          <p v-if="errorMessage" class="text-sm text-error" data-testid="cash-movement-error">
            {{ errorMessage }}
          </p>

          <!-- Purpose, amount and action stay together; each row shows its direction. -->
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-if="canCashIn"
              type="button"
              class="movement-action"
              :disabled="submitting"
              data-testid="cash-in-submit"
              @click="submit('CASH_IN')"
            >
              <span class="movement-action-tile is-in text-success">
                <UIcon name="i-lucide-arrow-down-left" aria-hidden="true" class="size-5" />
              </span>
              <span class="movement-action-copy">
                <strong>Registrar ingreso</strong>
                <small>Dinero que entra al cajón</small>
              </span>
              <UIcon
                name="i-lucide-arrow-right"
                aria-hidden="true"
                class="movement-action-arrow size-4"
              />
            </button>
            <button
              v-if="canCashOut"
              type="button"
              class="movement-action"
              :disabled="submitting"
              data-testid="cash-out-submit"
              @click="submit('CASH_OUT')"
            >
              <span class="movement-action-tile is-out text-warning">
                <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" class="size-5" />
              </span>
              <span class="movement-action-copy">
                <strong>Registrar retiro</strong>
                <small>Dinero que sale del cajón</small>
              </span>
              <UIcon
                name="i-lucide-arrow-right"
                aria-hidden="true"
                class="movement-action-arrow size-4"
              />
            </button>
          </div>
        </form>

        <p v-else class="text-xs text-muted" data-testid="cash-movements-forbidden">
          No tienes permiso para registrar movimientos manuales.
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.movement-history {
  max-width: 100%;
  overflow-x: auto;
}

.movement-history:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}

.movement-history-table {
  min-width: 38rem;
  table-layout: fixed;
}

.movement-history-type {
  width: 25%;
}

.movement-history-channel {
  width: 17%;
}

.movement-history-amount {
  width: 12rem;
}

.movement-history-table :is(th, td) {
  padding: 0.75rem 0.625rem;
  vertical-align: top;
}

.movement-history-table :is(th, td):first-child {
  padding-inline-start: 0;
}

.movement-history-table :is(th, td):last-child {
  padding-inline-end: 0;
}

.movement-history-money {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.movement-history-reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.movement-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem;
  text-align: left;
  border: 1px solid var(--cash-border, var(--ui-border));
  border-radius: var(--cash-radius-control, 0.5rem);
  background-color: var(--cash-surface, var(--ui-bg));
  color: var(--cash-ink, var(--ui-text));
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.movement-action:hover:not(:disabled) {
  border-color: var(--cash-primary, var(--ui-primary));
  background-color: var(--cash-surface-muted, var(--ui-bg-elevated));
}

.movement-action:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.movement-action-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--cash-border, var(--ui-border));
  background-color: var(--cash-surface-muted, var(--ui-bg-elevated));
}

.movement-action-copy {
  flex: 1;
  min-width: 0;
}

.movement-action-copy strong {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cash-ink, var(--ui-text-highlighted));
}

.movement-action-copy small {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--cash-muted, var(--ui-text-muted));
}

.movement-action-arrow {
  color: var(--cash-muted, var(--ui-text-muted));
}
</style>
