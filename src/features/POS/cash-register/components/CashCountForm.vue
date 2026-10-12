<script setup lang="ts">
/**
 * Blind first count.
 *
 * The form is built ONLY from the frozen `requiredChannels` identities (never
 * the live payment catalog), sends only `lines`/`denominations`/`notes`, and:
 *   - reads HUMAN money in PESOS and converts it exactly once to wire cents;
 *   - treats a blank channel as MISSING, never as a counted zero;
 *   - accepts an explicit `0` as a counted zero;
 *   - keeps denominations optional, and when supplied converts their money once
 *     (`denominationCents >= 1`) while keeping `quantity` an integer piece count
 *     (`>= 0`, a zero quantity is valid and contributes `0`) with the sum exactly
 *     equal to the `CASH` line.
 */
import { computed, ref } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { countQuantity, denominationCentsFromPesos, pesosToCents } from '../utils/cash-input'
import {
  buildCountPayloadPesos,
  countEntryErrorsPesos,
  denominationError,
  sumDenominations,
} from '../composables/cashRules'
import type { CashChannelIdentity, CashCountPayload } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    channels?: CashChannelIdentity[]
    submitting?: boolean
    errorMessage?: string | null
    submitLabel?: string
    /** Verification only: a non-zero difference requires a written explanation. */
    notesRequired?: boolean
    /** Presentational only: the recount form is reused for independent verification. */
    heading?: string
    lede?: string
    /** `card` is the standalone panel; `flat` nests cleanly inside another panel. */
    variant?: 'card' | 'flat'
  }>(),
  {
    channels: () => [],
    submitting: false,
    errorMessage: null,
    submitLabel: 'Enviar conteo ciego',
    notesRequired: false,
    heading: 'Conteo ciego',
    lede: 'Ingresa los importes en pesos y declara cada canal congelado. Dejar un canal vacío lo marca como faltante: el cero debe ser explícito.',
    variant: 'card',
  },
)

const emit = defineEmits<{
  submit: [payload: CashCountPayload]
}>()

const values = ref<Record<string, string>>({})
const notes = ref('')
// Human denomination money is entered in PESOS, not cents. There are no default
// denomination rows, so nothing is seeded here and nothing needs re-formatting;
// a future seeded row of wire cents must be formatted once with
// `centsToPesosInput` rather than prefilled with its cent digits.
const denominationRows = ref<{ amount: string; quantity: string }[]>([])
const localError = ref<string | null>(null)

// Channel money is read in PESOS and validated with the accepted per-field
// bounds (0..MAX_CASH_MONEY_CENTS); a quantity is a count of pieces, not money.
const entryErrors = computed(() => countEntryErrorsPesos(props.channels, values.value))

const cashCents = computed<number | null>(() => {
  const raw = values.value.CASH
  if (raw === undefined || String(raw).trim() === '') return null
  try {
    return pesosToCents(String(raw).trim())
  } catch {
    return null
  }
})

/**
 * Denomination rows converted once to wire cents/pieces. Money keeps its one
 * cent minimum and the piece count stays an integer; a malformed row short-
 * circuits with the helper's own unit-correct copy (pesos for money, pieces
 * for quantities).
 */
const parsedDenominations = computed<{
  rows: { denominationCents: number; quantity: number }[]
  error: string | null
}>(() => {
  const rows: { denominationCents: number; quantity: number }[] = []
  for (const row of denominationRows.value) {
    try {
      rows.push({
        denominationCents: denominationCentsFromPesos(row.amount),
        quantity: countQuantity(row.quantity),
      })
    } catch (error) {
      return { rows: [], error: error instanceof Error ? error.message : 'Denominación inválida.' }
    }
  }
  return { rows, error: null }
})

// Derived from the SAME converted rows that are sent, so the displayed sum and
// the denominations-equality check never disagree with the wire payload.
const denominationSum = computed(() => sumDenominations(parsedDenominations.value.rows))

const denominationProblem = computed(() => {
  if (denominationRows.value.length === 0) return null
  if (parsedDenominations.value.error) return parsedDenominations.value.error
  return denominationError(parsedDenominations.value.rows, cashCents.value)
})

const canSubmit = computed(
  () =>
    props.channels.length > 0 &&
    Object.keys(entryErrors.value).length === 0 &&
    denominationProblem.value === null &&
    !(props.notesRequired && notes.value.trim().length === 0),
)

const notesProblem = computed(() =>
  props.notesRequired && notes.value.trim().length === 0
    ? 'Hay una diferencia: agrega una nota que la explique.'
    : null,
)

function addDenomination() {
  denominationRows.value.push({ amount: '', quantity: '' })
}

function removeDenomination(index: number) {
  denominationRows.value.splice(index, 1)
}

function submit() {
  if (notesProblem.value) {
    localError.value = notesProblem.value
    return
  }
  if (denominationProblem.value) {
    localError.value = denominationProblem.value
    return
  }
  const payload = buildCountPayloadPesos(
    props.channels,
    values.value,
    notes.value,
    parsedDenominations.value.rows.length > 0 ? parsedDenominations.value.rows : undefined,
  )
  if (!payload) {
    localError.value = Object.values(entryErrors.value)[0] ?? 'Revisa el conteo antes de enviarlo.'
    return
  }
  localError.value = null
  emit('submit', payload)
}
</script>

<template>
  <section
    :class="variant === 'card' ? 'cash-panel' : 'flex flex-col'"
    data-testid="cash-count-form"
  >
    <header v-if="variant === 'card'" class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-calculator" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">{{ heading }}</h2>
        <p class="cash-panel-subtitle">{{ lede }}</p>
      </div>
    </header>
    <header v-else class="flex items-start gap-3 border-t border-default pt-4">
      <span class="cash-icon-tile cash-icon-tile-sm" aria-hidden="true">
        <UIcon name="i-lucide-calculator" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">{{ heading }}</h2>
        <p class="cash-panel-subtitle">{{ lede }}</p>
      </div>
    </header>

    <div :class="variant === 'card' ? 'cash-panel-body' : 'flex flex-col gap-4'">
      <div
        v-if="channels.length === 0"
        class="text-sm text-muted"
        data-testid="cash-count-no-channels"
      >
        No hay canales congelados para contar. Inicia el conteo para congelar la sesión.
      </div>

      <form
        v-else
        class="flex flex-col gap-4"
        data-testid="cash-count-form-element"
        @submit.prevent="submit"
      >
        <div
          v-for="channel in channels"
          :key="channel.channelKey"
          class="flex flex-col gap-1"
          :data-testid="`cash-count-row-${channel.channelKey}`"
        >
          <UFormField :label="`${channel.channelLabel} (${channel.channelKey})`">
            <UInput
              v-model="values[channel.channelKey]"
              inputmode="decimal"
              class="cash-control w-full"
              placeholder="0.00"
              :data-testid="`cash-count-input-${channel.channelKey}`"
            />
          </UFormField>
          <p
            v-if="entryErrors[channel.channelKey]"
            class="text-xs text-error"
            :data-testid="`cash-count-error-${channel.channelKey}`"
          >
            {{ entryErrors[channel.channelKey] }}
          </p>
        </div>

        <div class="flex flex-col gap-2 border-t border-default pt-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm font-medium text-highlighted">Detalle de denominaciones (opcional)</p>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="min-h-11"
              data-testid="cash-count-add-denomination"
              @click="addDenomination"
            >
              Agregar denominación
            </UButton>
          </div>

          <div
            v-for="(row, index) in denominationRows"
            :key="index"
            class="flex flex-wrap items-end gap-2"
            :data-testid="`cash-count-denomination-${index}`"
          >
            <UFormField label="Denominación (pesos)">
              <UInput
                v-model="row.amount"
                inputmode="decimal"
                placeholder="0.00"
                :data-testid="`cash-count-denomination-amount-${index}`"
              />
            </UFormField>
            <UFormField label="Cantidad (piezas)">
              <UInput
                v-model="row.quantity"
                inputmode="numeric"
                placeholder="0"
                :data-testid="`cash-count-denomination-quantity-${index}`"
              />
            </UFormField>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="min-h-11"
              :data-testid="`cash-count-remove-denomination-${index}`"
              @click="removeDenomination(index)"
            >
              Quitar
            </UButton>
          </div>

          <p
            v-if="denominationRows.length > 0"
            class="text-xs text-muted"
            data-testid="cash-count-denomination-sum"
          >
            Suma del detalle: {{ formatCentsMXN(denominationSum) }} — debe coincidir con Efectivo.
          </p>
          <p
            v-if="denominationProblem"
            class="text-xs text-error"
            data-testid="cash-count-denomination-error"
          >
            {{ denominationProblem }}
          </p>
        </div>

        <UFormField label="Notas (opcional)" :required="notesRequired">
          <UInput
            v-model="notes"
            class="w-full"
            placeholder="Conteo sin novedad"
            data-testid="cash-count-notes"
          />
        </UFormField>
        <p v-if="notesProblem" class="text-xs text-error" data-testid="cash-count-notes-error">
          {{ notesProblem }}
        </p>

        <p v-if="errorMessage" class="text-sm text-error" data-testid="cash-count-error">
          {{ errorMessage }}
        </p>
        <p v-if="localError" class="text-sm text-error" data-testid="cash-count-local-error">
          {{ localError }}
        </p>

        <UButton
          type="submit"
          class="cash-control self-start"
          :loading="submitting"
          :disabled="!canSubmit || submitting"
          data-testid="cash-count-submit"
        >
          {{ submitLabel }}
        </UButton>
      </form>
    </div>
  </section>
</template>
