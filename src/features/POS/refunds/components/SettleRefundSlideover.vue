<script setup lang="ts">
/**
 * SettleRefundSlideover — «Liquidar reembolso» (design/refund-settlements/01-pending-inbox.html).
 *
 * Records one devolución against the refund: the summary (total, devuelto, pendiente and a
 * progress bar), then the amount (prefilled with what is pending, «Devolver todo»), the return
 * method, an optional reference, the date («Ahora · Cambiar») and, when the user has exactly one
 * open cash session, «Registrar como salida de mi caja» (never for credit,
 * CASH_SESSION_CREDIT_NOT_ALLOWED).
 *
 * The idempotency rules live in `useSettleRefund`. Here: a partial return keeps the panel open
 * with the new balance, a full one closes it; 422 and 404/409 show in place while the list
 * refetches. A dirty form asks before closing (`confirmLeave`) and before leaving the route.
 */
import { computed, reactive, ref, watch } from 'vue'
import HfCombobox from '@/core/shared/components/form/HfCombobox.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import { confirmLeave, useLeaveGuard } from '@/core/shared/composables/useLeaveGuard'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useCashSaleSession } from '@/features/POS/cash-register/composables/useCashSaleSession'
import type { RefundSettlementMethod } from '@/features/POS/sales/interfaces/refund-settlement.types'
import type { PendingRefundListRow } from '../composables/usePendingRefundsList'
import { useSettleRefund } from '../composables/useSettleRefund'
import { refundMethodLabel, refundReasonLabel, SETTLEMENT_METHOD_ITEMS } from '../utils/refundLabels'
import {
  centsToAmountInput,
  parseAmountInput,
  toZonedIso,
  validateSettlementForm,
  type SettlementFormValues,
} from '../utils/settlementForm'
import type { SettlementField } from '../utils/settlementErrors'
import '../styles/refunds-visual.css'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  refund: PendingRefundListRow | null
}>()

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const settleRefund = useSettleRefund()
const cashSessions = useCashSaleSession()

/** The balance shown: the response of our last settlement until the refetched row lands. */
const balanceOverride = ref<{ settledCents: number; outstandingCents: number } | null>(null)
const balance = computed(() => {
  const row = props.refund
  if (!row) return { amountCents: 0, settledCents: 0, outstandingCents: 0 }
  return { amountCents: row.amountCents, ...(balanceOverride.value ?? row) }
})
const progress = computed(() =>
  balance.value.amountCents > 0
    ? Math.round((balance.value.settledCents / balance.value.amountCents) * 100)
    : 0,
)

const form = reactive<SettlementFormValues>({
  amount: '',
  method: 'cash',
  reference: '',
  settledAt: null,
  useCashSession: false,
})
const initial = ref('')
const tried = ref(false)
const serverFieldErrors = ref<Partial<Record<SettlementField, string>>>({})
const alert = ref<{ tone: 'danger' | 'success'; message: string } | null>(null)
/** The refund can take no more returns (already finished or gone): only «Cerrar» remains. */
const gone = ref(false)

const snapshot = () => JSON.stringify({ ...form })

function resetForm(outstandingCents: number) {
  form.amount = centsToAmountInput(outstandingCents)
  form.method = props.refund?.method ?? 'cash'
  form.reference = ''
  form.settledAt = null
  form.useCashSession = false
  tried.value = false
  serverFieldErrors.value = {}
  initial.value = snapshot()
}

watch(
  [open, () => props.refund?.id],
  ([isOpen]) => {
    if (!isOpen || !props.refund) return
    balanceOverride.value = null
    alert.value = null
    gone.value = false
    settleRefund.reset()
    resetForm(props.refund.outstandingCents)
  },
  { immediate: true },
)

// A refetched row is the truth again (also after a 422 lowered the balance).
watch(
  () => [props.refund?.settledCents, props.refund?.outstandingCents],
  () => {
    balanceOverride.value = null
  },
)

const isDirty = computed(() => open.value && !gone.value && snapshot() !== initial.value)
useLeaveGuard(isDirty)

/** The user's one open session; with none or several the option is not offered. */
const cashSessionId = computed(() => {
  const sessions = cashSessions.availableSessions.value
  return sessions.length === 1 ? sessions[0]!.id : null
})
const showCashOption = computed(() => cashSessionId.value !== null && form.method !== 'credit')

const now = () => new Date()
const localNow = () => toZonedIso(now()).slice(0, 16)

const errors = computed(() => {
  if (!props.refund) return {}
  const local = validateSettlementForm(form, {
    outstandingCents: balance.value.outstandingCents,
    now: now(),
  })
  return {
    amount: local.amount ?? serverFieldErrors.value.amount,
    settledAt: local.settledAt ?? serverFieldErrors.value.settledAt,
    method: serverFieldErrors.value.method,
    reference: serverFieldErrors.value.reference,
  }
})
// Field errors show once the user tried to send. The amount also speaks live while typed, so
// «Liquidar $X» never promises an amount that would be refused.
const shownErrors = computed(() => (tried.value ? errors.value : {}))
const amountError = computed(() =>
  errors.value.amount && (tried.value || form.amount.trim() !== '') ? errors.value.amount : undefined,
)

const amountCents = computed(() => {
  const parsed = parseAmountInput(form.amount)
  return 'cents' in parsed && parsed.cents <= balance.value.outstandingCents ? parsed.cents : null
})
const primaryLabel = computed(() =>
  amountCents.value === null ? 'Liquidar' : `Liquidar ${formatCentsMXN(amountCents.value)}`,
)
const isSubmitting = computed(() => settleRefund.isSubmitting.value)

const methodItems = SETTLEMENT_METHOD_ITEMS
const methodModel = computed({
  get: () => form.method,
  set: (value: string | string[] | null) => {
    if (typeof value === 'string') form.method = value as RefundSettlementMethod
  },
})

// Editing after a failure starts a clean message; the composable already keys the new attempt.
watch(
  () => snapshot(),
  () => {
    serverFieldErrors.value = {}
  },
)

function returnAll() {
  form.amount = centsToAmountInput(balance.value.outstandingCents)
}

function normalizeAmount() {
  const parsed = parseAmountInput(form.amount)
  if ('cents' in parsed) form.amount = centsToAmountInput(parsed.cents)
}

function changeDate() {
  form.settledAt = localNow()
}

const metaLine = computed(() =>
  props.refund ? `${props.refund.folioLabel} · ${props.refund.customerLabel}` : '',
)
const canceledAt = computed(() =>
  props.refund ? formatShortDateTime(props.refund.createdAt) : '',
)

async function submit() {
  const refund = props.refund
  if (!refund || gone.value || isSubmitting.value) return
  tried.value = true
  const local = validateSettlementForm(form, {
    outstandingCents: balance.value.outstandingCents,
    now: now(),
  })
  if (local.amount || local.settledAt) return

  alert.value = null
  const outcome = await settleRefund.submit(refund.id, { ...form }, {
    cashSessionId: cashSessionId.value,
    saleId: refund.saleId,
  })
  if (outcome.status === 'ignored') return

  if (outcome.status === 'settled') {
    const { outstandingCents, settledCents } = outcome.response
    if (outstandingCents === 0) {
      toast.add({ title: 'Devolución completada.', color: 'success' })
      gone.value = true
      open.value = false
      return
    }
    const message = `Devolución parcial registrada. Quedan ${formatCentsMXN(outstandingCents)} por devolver.`
    toast.add({ title: message, color: 'success' })
    balanceOverride.value = { settledCents, outstandingCents }
    resetForm(outstandingCents)
    return
  }

  const { error } = outcome
  alert.value = { tone: 'danger', message: error.message }
  serverFieldErrors.value = error.fieldErrors
  if (error.code === 'REFUND_ALREADY_SETTLED' || error.code === 'REFUND_NOT_FOUND') {
    gone.value = true
  }
}

async function requestClose() {
  if (isSubmitting.value) return
  if (isDirty.value && !(await confirmLeave())) return
  open.value = false
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    :dismissible="false"
    :ui="{ content: 'hf-theme hf-ui w-full max-w-none sm:max-w-md' }"
    @update:open="(value: boolean) => (value ? (open = true) : requestClose())"
    @close:prevent="requestClose"
  >
    <template #content>
      <div
        v-if="refund"
        class="refund-settle"
        role="document"
        aria-labelledby="settle-title"
      >
        <header class="refund-settle__head">
          <div class="min-w-0">
            <p class="refund-settle__meta">{{ metaLine }}</p>
            <h2 id="settle-title" class="refund-settle__title">Liquidar reembolso</h2>
          </div>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            class="refund-settle__close"
            aria-label="Cerrar panel"
            data-testid="settle-close"
            @click="requestClose"
          />
        </header>

        <div class="refund-settle__body">
          <p class="refund-settle__facts">
            <span><UIcon name="i-lucide-calendar" aria-hidden="true" />Cancelada el {{ canceledAt }}</span>
            <span>{{ refundReasonLabel(refund.reason) }}</span>
            <span>Pagó con {{ refundMethodLabel(refund.method).toLocaleLowerCase('es-MX') }}</span>
          </p>

          <section class="refund-settle__summary" data-testid="settle-summary" aria-label="Saldo del reembolso">
            <dl>
              <div>
                <dt>Total a devolver</dt>
                <dd class="hf-figure">{{ formatCentsMXN(balance.amountCents) }}</dd>
              </div>
              <div>
                <dt>Devuelto</dt>
                <dd class="hf-figure">{{ balance.settledCents ? formatCentsMXN(balance.settledCents) : '—' }}</dd>
              </div>
              <div>
                <dt>Pendiente</dt>
                <dd class="hf-figure refund-owe">{{ gone ? '—' : formatCentsMXN(balance.outstandingCents) }}</dd>
              </div>
            </dl>
            <div
              class="refund-settle__bar"
              role="progressbar"
              aria-label="Devuelto del total"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="gone ? 100 : progress"
            >
              <span :style="{ width: `${gone ? 100 : progress}%` }" />
            </div>
            <p class="refund-settle__bar-caption">
              {{
                gone
                  ? 'Ya no queda nada por devolver'
                  : balance.settledCents
                    ? `Devuelto ${progress}% del total`
                    : 'Aún no se devuelve nada'
              }}
            </p>
          </section>

          <div
            v-if="alert"
            class="refund-settle__alert"
            :data-tone="alert.tone"
            role="alert"
          >
            <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" aria-hidden="true" />
            <span>{{ alert.message }}</span>
          </div>

          <form
            v-if="!gone"
            id="settle-form"
            class="refund-settle__form"
            novalidate
            @submit.prevent="submit"
          >
            <h3 class="refund-settle__section">Datos de la devolución</h3>

            <HfFormField
              label="Monto a devolver"
              for="settle-amount"
              :help="`Pendiente: ${formatCentsMXN(balance.outstandingCents)}. Puedes devolver solo una parte.`"
              :error="amountError"
            >
              <div class="refund-amount" :data-invalid="amountError ? 'true' : undefined">
                <span class="refund-amount__prefix" aria-hidden="true">$</span>
                <input
                  id="settle-amount"
                  v-model="form.amount"
                  class="refund-amount__input hf-figure"
                  type="text"
                  inputmode="decimal"
                  autocomplete="off"
                  aria-describedby="settle-amount-message"
                  :aria-invalid="amountError ? 'true' : 'false'"
                  @blur="normalizeAmount"
                >
                <button
                  type="button"
                  class="refund-amount__all"
                  data-testid="settle-all"
                  :disabled="isSubmitting || amountCents === balance.outstandingCents"
                  @click="returnAll"
                >
                  Devolver todo
                </button>
              </div>
            </HfFormField>

            <HfFormField
              label="Método de devolución"
              label-id="settle-method-label"
              :help="`El pago original fue con ${refundMethodLabel(refund.method).toLocaleLowerCase('es-MX')}. Puedes devolver por otro método.`"
              :error="shownErrors.method"
            >
              <HfCombobox
                id="settle-method"
                v-model="methodModel"
                :items="methodItems"
                label="Método de devolución"
                describedby="settle-method-label-message"
                :invalid="Boolean(shownErrors.method)"
              />
            </HfFormField>

            <HfFormField
              label="Referencia (opcional)"
              for="settle-reference"
              help="Ej. folio de transferencia o de la terminal"
              :error="shownErrors.reference"
            >
              <UInput
                id="settle-reference"
                v-model="form.reference"
                class="w-full"
                autocomplete="off"
                aria-describedby="settle-reference-message"
              />
            </HfFormField>

            <HfFormField
              label="Fecha y hora en que se devolvió el dinero"
              :for="form.settledAt === null ? undefined : 'settle-date'"
              :label-id="form.settledAt === null ? 'settle-date-label' : undefined"
              :error="shownErrors.settledAt"
            >
              <div v-if="form.settledAt === null" class="refund-date-now">
                <span>Ahora</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  class="refund-link"
                  aria-describedby="settle-date-label"
                  data-testid="settle-date-change"
                  @click="changeDate"
                >
                  Cambiar
                </button>
              </div>
              <div v-else class="refund-date-custom">
                <UInput
                  id="settle-date"
                  v-model="form.settledAt"
                  type="datetime-local"
                  class="min-w-0 flex-1 hf-figure"
                  :max="localNow()"
                  aria-describedby="settle-date-message"
                  :aria-invalid="shownErrors.settledAt ? 'true' : 'false'"
                />
                <button type="button" class="refund-link" @click="form.settledAt = null">
                  Usar ahora
                </button>
              </div>
            </HfFormField>

            <div v-if="showCashOption" data-testid="settle-cash-session">
              <UCheckbox
                v-model="form.useCashSession"
                label="Registrar como salida de mi caja"
                description="La devolución aparece como salida de efectivo en tu caja abierta."
              />
            </div>
          </form>
        </div>

        <footer class="refund-settle__foot">
          <template v-if="gone">
            <UButton color="neutral" variant="outline" label="Cerrar" class="refund-settle__btn" @click="open = false" />
          </template>
          <template v-else>
            <UButton
              color="neutral"
              variant="ghost"
              label="Cancelar"
              class="refund-settle__btn"
              :disabled="isSubmitting"
              @click="requestClose"
            />
            <UButton
              type="submit"
              form="settle-form"
              class="refund-settle__btn hf-primary-control"
              data-testid="settle-submit"
              :loading="isSubmitting"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Liquidando…' : primaryLabel }}
            </UButton>
          </template>
        </footer>
      </div>
    </template>
  </USlideover>
</template>
