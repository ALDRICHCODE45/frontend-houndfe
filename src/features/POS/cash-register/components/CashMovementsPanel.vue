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
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import { pesosToCents } from '../utils/cash-input'
import { blindSafeDetail, isCashSessionWritable } from '../composables/cashRules'
import type { CashMovementKind, CashSessionDetail } from '../interfaces/cash.types'

type CashMovement = CashSessionDetail['movements'][number]

const props = withDefaults(
  defineProps<{
    detail?: CashSessionDetail | null
    /** Authenticated caller id — ownership of the session is enforced against it. */
    currentUserId?: string | null
    canCashIn?: boolean
    canCashOut?: boolean
    submitting?: boolean
    errorMessage?: string | null
    /** The session detail is loading or failed: the history shows its skeleton or error. */
    loading?: boolean
    error?: boolean
  }>(),
  {
    detail: null,
    currentUserId: null,
    canCashIn: false,
    canCashOut: false,
    submitting: false,
    errorMessage: null,
    loading: false,
    error: false,
  },
)

const emit = defineEmits<{
  submit: [payload: { kind: 'CASH_IN' | 'CASH_OUT'; amountCents: number; reason: string }]
  refresh: []
}>()

const MOVEMENT_LABELS: Record<CashMovementKind, string> = {
  CASH_IN: 'Ingreso manual',
  CASH_OUT: 'Retiro manual',
  SALE_PAYMENT: 'Cobro de venta',
  SALE_CHANGE: 'Cambio de venta',
  REFUND_SETTLEMENT: 'Liquidación de reembolso',
}

const right = { class: { th: 'text-right', td: 'text-right' } }
const columns: TableColumn<CashMovement, unknown>[] = [
  { id: 'kind', header: 'Tipo', enableSorting: false },
  { id: 'channel', header: 'Canal', enableSorting: false },
  { id: 'amount', header: 'Importe', enableSorting: false, meta: right },
  { id: 'reason', header: 'Motivo', enableSorting: false },
]
const emptyState = {
  title: 'Aún no hay movimientos',
  description: 'Los ingresos y retiros de esta sesión aparecerán aquí.',
}

const movementLabel = (movement: CashMovement) => MOVEMENT_LABELS[movement.kind]

const safeDetail = computed(() => blindSafeDetail(props.detail))
const session = computed(() => safeDetail.value?.session ?? null)
const blind = computed(() => session.value?.blind === true)
const writable = computed(() => isCashSessionWritable(session.value))
const movements = computed(() => [...(safeDetail.value?.movements ?? [])])
/** The history area is a table state of its own while loading, failing or open. */
const showHistory = computed(
  () => props.loading || props.error || (Boolean(safeDetail.value) && !blind.value),
)

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
  <section class="cash-list-section" data-testid="cash-movements">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Movimientos de efectivo</h2>
    </header>

    <p
      v-if="!showHistory && !safeDetail"
      class="text-sm text-muted"
      data-testid="cash-movements-empty-detail"
    >
      Selecciona una sesión para ver sus movimientos.
    </p>

    <template v-else>
      <!-- HISTORY: hidden in the blind window, independent of the status. -->
      <p
        v-if="!showHistory && blind"
        class="text-sm text-muted"
        data-testid="cash-movements-history-hidden"
      >
        Conteo ciego: el historial de movimientos no se muestra hasta enviar la declaración.
      </p>
      <div
        v-else-if="showHistory"
        data-testid="cash-movements-table"
        role="region"
        aria-label="Historial de movimientos de efectivo"
      >
        <AppDataTable
          :show-toolbar="false"
          :columns="columns"
          :data="movements"
          :loading="loading"
          :error="error"
          error-message="No se pudieron cargar los movimientos"
          :empty-state="emptyState"
          display-mode="auto"
          mobile-render="cards"
          class="hf-data-table"
          @refresh="emit('refresh')"
        >
          <template #kind-cell="{ row }">
            <span
              class="hf-row-primary cash-row-link"
              :data-testid="`cash-movement-${row.original.id}`"
              >{{ movementLabel(row.original) }}</span
            >
          </template>
          <template #channel-cell="{ row }">
            <span class="cash-meta">{{ row.original.channelLabel }}</span>
          </template>
          <template #amount-cell="{ row }">
            <span class="hf-figure">{{ formatCentsMXN(row.original.deltaCents) }}</span>
          </template>
          <template #reason-cell="{ row }">
            <span class="movement-history-reason">{{ row.original.reason ?? '—' }}</span>
          </template>

          <template #mobile-card="{ row }">
            <article class="cash-card" :data-testid="`cash-movement-card-${row.id}`">
              <div class="cash-card-heading">
                <span class="hf-row-primary cash-row-link">{{ movementLabel(row) }}</span>
                <span class="hf-figure font-semibold text-highlighted">{{
                  formatCentsMXN(row.deltaCents)
                }}</span>
              </div>
              <span v-if="row.reason" class="hf-row-secondary movement-history-reason">{{
                row.reason
              }}</span>
              <div class="cash-card-footer">
                <span>{{ row.channelLabel }}</span>
              </div>
            </article>
          </template>
        </AppDataTable>
        <p
          v-if="!loading && !error && movements.length === 0"
          class="sr-only"
          data-testid="cash-movements-empty"
        >
          Todavía no hay movimientos en esta sesión.
        </p>
      </div>

      <!-- COMMANDS: writable AND owned by the caller. -->
      <p v-if="!writable" class="cash-note cash-note--warning" data-testid="cash-movements-frozen">
        La sesión está congelada: no se pueden registrar movimientos.
      </p>

      <p v-else-if="!isOwner" class="cash-note" data-testid="cash-movements-owner-denied">
        Esta sesión pertenece a otra persona: solo su responsable registra movimientos manuales.
      </p>

      <form
        v-else-if="canCashIn || canCashOut"
        class="flex flex-col gap-4"
        data-testid="cash-movement-form"
        @submit.prevent
      >
        <div class="cash-form-content grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
          <UFormField label="Importe (pesos)">
            <UInput
              v-model="amountInput"
              inputmode="decimal"
              class="w-full"
              placeholder="25.00"
              data-testid="cash-movement-amount"
            />
          </UFormField>
          <UFormField label="Motivo">
            <UInput
              v-model="reasonInput"
              class="w-full"
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

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="canCashIn"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-down-left"
            class="min-h-11"
            :disabled="submitting"
            data-testid="cash-in-submit"
            @click="submit('CASH_IN')"
          >
            Registrar ingreso
          </UButton>
          <UButton
            v-if="canCashOut"
            type="button"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-up-right"
            class="min-h-11"
            :disabled="submitting"
            data-testid="cash-out-submit"
            @click="submit('CASH_OUT')"
          >
            Registrar retiro
          </UButton>
        </div>
      </form>

      <p v-else class="text-xs text-muted" data-testid="cash-movements-forbidden">
        No tienes permiso para registrar movimientos manuales.
      </p>
    </template>
  </section>
</template>

<style scoped>
.movement-history-reason {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}
</style>
