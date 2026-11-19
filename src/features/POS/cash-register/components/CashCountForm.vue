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
 *
 * Direction A: per-channel money fields ($ … MXN, right-aligned), a
 * denomination counter (pieces per standard bill and coin, with subtotals, plus
 * «Otra denominación» rows) whose total must equal Efectivo, and the GOV.UK
 * error pattern: a failed attempt shows ONE summary (role="alert", focused)
 * linking to each field, and the same message next to the field. A settled
 * submit without error is announced in a polite status.
 */
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
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
    /** `data-testid` of the server error line inside the summary. */
    errorTestId?: string
    submitLabel?: string
    /** Polite status once a submit settles without error. */
    successLabel?: string
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
    errorTestId: 'cash-count-error',
    submitLabel: 'Enviar conteo ciego',
    successLabel: 'Conteo enviado.',
    notesRequired: false,
    heading: 'Conteo ciego',
    lede: 'Ingresa los importes en pesos y declara cada canal congelado. Dejar un canal vacío lo marca como faltante: el cero debe ser explícito.',
    variant: 'card',
  },
)

const emit = defineEmits<{
  submit: [payload: CashCountPayload]
}>()

/** Standard Mexican bills and coins (cents); the $20 exists as both. */
const STANDARD_DENOMINATIONS = [
  { cents: 100000, kind: 'billete' },
  { cents: 50000, kind: 'billete' },
  { cents: 20000, kind: 'billete' },
  { cents: 10000, kind: 'billete' },
  { cents: 5000, kind: 'billete' },
  { cents: 2000, kind: 'billete' },
  { cents: 2000, kind: 'moneda' },
  { cents: 1000, kind: 'moneda' },
  { cents: 500, kind: 'moneda' },
  { cents: 200, kind: 'moneda' },
  { cents: 100, kind: 'moneda' },
  { cents: 50, kind: 'moneda' },
] as const

const denomKey = (row: (typeof STANDARD_DENOMINATIONS)[number]) =>
  row.cents === 2000 ? `${row.cents}-${row.kind}` : String(row.cents)
const denomLabel = (cents: number) => formatCentsMXN(cents).replace(/\.00$/, '')

const uid = useId()
const channelId = (index: number) => `${uid}-ch-${index}`
const gridId = (key: string) => `${uid}-dn-${key}`
const extraId = (index: number) => `${uid}-dx-${index}`
const notesId = `${uid}-notes`
const summary = useTemplateRef<HTMLElement>('summary')

const values = ref<Record<string, string>>({})
const notes = ref('')
/** Piece counts per standard denomination; blank means «not counted by piece». */
const gridQuantities = ref<Record<string, string>>({})
// Extra denomination money is entered in PESOS, not cents; nothing is seeded.
const denominationRows = ref<{ amount: string; quantity: string }[]>([])
const attempted = ref(false)
const status = ref('')

// Channel money is read in PESOS and validated with the accepted per-field
// bounds (0..MAX_CASH_MONEY_CENTS); a quantity is a count of pieces, not money.
const entryErrors = computed(() => countEntryErrorsPesos(props.channels, values.value))

const gridUsed = computed(() =>
  Object.values(gridQuantities.value).some((value) => String(value ?? '').trim() !== ''),
)

/** Counting has started once any channel, note or denomination holds something. */
const started = computed(
  () =>
    Object.values(values.value).some((value) => String(value ?? '').trim() !== '') ||
    notes.value.trim() !== '' ||
    gridUsed.value ||
    denominationRows.value.length > 0,
)

/**
 * What the form says per channel. A blank channel is still missing (and still
 * blocks the submit), but it is not called an error before the person starts
 * counting or tries to send: an untouched form shows no red.
 */
const shownEntryErrors = computed(() =>
  started.value || attempted.value ? entryErrors.value : {},
)

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
 * Denomination rows converted once to wire cents/pieces: the standard grid
 * first (blank rows skipped, an explicit 0 kept), then «Otra denominación».
 * Rows with the same value (the $20 bill and coin) merge into one entry. A
 * malformed row short-circuits with the helper's own unit-correct copy and the
 * id of the field it belongs to.
 */
const parsedDenominations = computed<{
  rows: { denominationCents: number; quantity: number }[]
  error: string | null
  fieldId: string | null
}>(() => {
  const merged = new Map<number, number>()
  const add = (cents: number, quantity: number) =>
    merged.set(cents, (merged.get(cents) ?? 0) + quantity)
  for (const row of STANDARD_DENOMINATIONS) {
    const raw = String(gridQuantities.value[denomKey(row)] ?? '').trim()
    if (raw === '') continue
    try {
      add(row.cents, countQuantity(raw))
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : 'Cantidad inválida.',
        fieldId: gridId(denomKey(row)),
      }
    }
  }
  for (const [index, row] of denominationRows.value.entries()) {
    try {
      add(denominationCentsFromPesos(row.amount), countQuantity(row.quantity))
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : 'Denominación inválida.',
        fieldId: extraId(index),
      }
    }
  }
  return {
    rows: [...merged].map(([denominationCents, quantity]) => ({ denominationCents, quantity })),
    error: null,
    fieldId: null,
  }
})

const denominationsUsed = computed(() => gridUsed.value || denominationRows.value.length > 0)

// Derived from the SAME converted rows that are sent, so the displayed sum and
// the denominations-equality check never disagree with the wire payload.
const denominationSum = computed(() => sumDenominations(parsedDenominations.value.rows))

const denominationProblem = computed(() => {
  if (!denominationsUsed.value) return null
  if (parsedDenominations.value.error) return parsedDenominations.value.error
  return denominationError(parsedDenominations.value.rows, cashCents.value)
})

const denominationProblemField = computed(
  () =>
    parsedDenominations.value.fieldId ??
    gridId(denomKey(STANDARD_DENOMINATIONS[0])),
)

const denominationMatches = computed(
  () =>
    denominationsUsed.value &&
    !parsedDenominations.value.error &&
    cashCents.value !== null &&
    denominationSum.value === cashCents.value,
)

const notesProblem = computed(() =>
  props.notesRequired && notes.value.trim().length === 0
    ? 'Hay una diferencia: agrega una nota que la explique.'
    : null,
)

/** Every field problem, in screen order, for the summary. */
const fieldErrors = computed(() => {
  const list: { id: string; message: string }[] = []
  props.channels.forEach((channel, index) => {
    const message = entryErrors.value[channel.channelKey]
    if (message) list.push({ id: channelId(index), message })
  })
  if (denominationProblem.value) {
    list.push({ id: denominationProblemField.value, message: denominationProblem.value })
  }
  if (notesProblem.value) list.push({ id: notesId, message: notesProblem.value })
  return list
})

/** The counter reports its own problem as soon as it is used (it has no blank state). */
const shownDenominationProblem = denominationProblem
const shownNotesProblem = computed(() => (attempted.value ? notesProblem.value : null))
const showSummary = computed(
  () => Boolean(props.errorMessage) || (attempted.value && fieldErrors.value.length > 0),
)

function describedBy(hint: string | null, error: string | null | undefined, id: string) {
  return [hint, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

function addDenomination() {
  denominationRows.value.push({ amount: '', quantity: '' })
}

function removeDenomination(index: number) {
  denominationRows.value.splice(index, 1)
}

async function focusSummary() {
  await nextTick()
  summary.value?.focus()
}

function submit() {
  attempted.value = true
  status.value = ''
  if (fieldErrors.value.length > 0) {
    void focusSummary()
    return
  }
  const payload = buildCountPayloadPesos(
    props.channels,
    values.value,
    notes.value,
    parsedDenominations.value.rows.length > 0 ? parsedDenominations.value.rows : undefined,
  )
  if (!payload) {
    void focusSummary()
    return
  }
  attempted.value = false
  emit('submit', payload)
}

watch(
  () => props.errorMessage,
  (message) => {
    if (message) {
      status.value = ''
      void focusSummary()
    }
  },
)

// A settled submit is a success only if no error landed meanwhile: the command
// error is published a few microtasks after `submitting` drops.
watch(
  () => props.submitting,
  (now, before) => {
    if (!before || now) return
    setTimeout(() => {
      if (!props.errorMessage) status.value = props.successLabel
    }, 0)
  },
)
</script>

<template>
  <section
    class="cash-count"
    :class="variant === 'card' ? 'cash-list-section' : 'flex flex-col gap-4'"
    data-testid="cash-count-form"
  >
    <header
      class="cash-list-header"
      :class="{ 'border-t border-[var(--hf-border)] pt-4': variant !== 'card' }"
    >
      <h2 class="cash-list-title">{{ heading }}</h2>
      <p class="cash-list-subtitle cash-meta-wrap">{{ lede }}</p>
    </header>

    <p class="sr-only" role="status" aria-live="polite" data-testid="cash-count-status">{{ status }}</p>

    <div
      v-if="channels.length === 0"
      class="cash-callout"
      data-testid="cash-count-no-channels"
    >
      <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
      <p>No hay canales congelados para contar. Inicia el conteo para congelar la sesión.</p>
    </div>

    <form
      v-else
      class="cash-count-body"
      novalidate
      data-testid="cash-count-form-element"
      @submit.prevent="submit"
    >
      <div
        v-if="showSummary"
        ref="summary"
        class="cash-err-summary"
        role="alert"
        tabindex="-1"
        data-testid="cash-count-error-summary"
      >
        <p class="cash-err-summary-title">
          <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
          {{ fieldErrors.length > 0 && attempted ? `Revisa ${fieldErrors.length === 1 ? '1 dato' : `${fieldErrors.length} datos`} antes de enviar` : 'No se pudo enviar' }}
        </p>
        <ul>
          <template v-if="attempted">
            <li v-for="item in fieldErrors" :key="item.id">
              <a :href="`#${item.id}`">{{ item.message }}</a>
            </li>
          </template>
          <li v-if="errorMessage" :data-testid="errorTestId">{{ errorMessage }}</li>
        </ul>
      </div>

      <fieldset class="cash-fieldset">
        <legend class="cash-legend">Canales a declarar · {{ channels.length }}</legend>
        <div class="cash-channel-grid">
          <div
            v-for="(channel, index) in channels"
            :key="channel.channelKey"
            class="cash-field"
            :data-testid="`cash-count-row-${channel.channelKey}`"
          >
            <label :for="channelId(index)" class="cash-label">{{ channel.channelLabel }}</label>
            <UInput
              :id="channelId(index)"
              v-model="values[channel.channelKey]"
              inputmode="decimal"
              autocomplete="off"
              class="cash-money-input w-full"
              placeholder="0.00"
              :aria-invalid="shownEntryErrors[channel.channelKey] ? 'true' : undefined"
              :aria-describedby="describedBy(null, shownEntryErrors[channel.channelKey], channelId(index))"
              :data-testid="`cash-count-input-${channel.channelKey}`"
            >
              <template #leading><span aria-hidden="true">$</span></template>
              <template #trailing><span class="cash-meta" aria-hidden="true">MXN</span></template>
            </UInput>
            <p
              v-if="shownEntryErrors[channel.channelKey]"
              :id="`${channelId(index)}-error`"
              class="cash-inline-error"
              :data-testid="`cash-count-error-${channel.channelKey}`"
            >{{ shownEntryErrors[channel.channelKey] }}</p>
          </div>
        </div>
      </fieldset>

      <details class="cash-denoms" open>
        <summary class="cash-denoms-summary">
          <span class="cash-legend">Denominaciones de Efectivo <span class="cash-meta">(opcional)</span></span>
          <span class="cash-meta-wrap">Deben sumar el total de Efectivo</span>
        </summary>

        <div class="cash-denom-grid" role="group" aria-label="Piezas por denominación">
          <div v-for="row in STANDARD_DENOMINATIONS" :key="denomKey(row)" class="cash-denom">
            <label :for="gridId(denomKey(row))" class="cash-denom-value">
              {{ denomLabel(row.cents) }} <small>{{ row.kind }}</small>
            </label>
            <UInput
              :id="gridId(denomKey(row))"
              v-model="gridQuantities[denomKey(row)]"
              inputmode="numeric"
              autocomplete="off"
              placeholder="0"
              class="cash-denom-input"
              :aria-label="`Piezas de ${row.kind} de ${denomLabel(row.cents)}`"
              :data-testid="row.cents === 2000 ? `cash-count-denom-${denomKey(row)}` : `cash-count-denom-${row.cents}`"
            />
            <span class="cash-denom-sub hf-figure" :data-testid="`cash-count-denom-subtotal-${denomKey(row)}`">
              {{
                /^(0|[1-9]\d*)$/.test(String(gridQuantities[denomKey(row)] ?? '').trim())
                  ? formatCentsMXN(row.cents * Number(gridQuantities[denomKey(row)]))
                  : ''
              }}
            </span>
          </div>
        </div>

        <div
          v-for="(row, index) in denominationRows"
          :key="index"
          class="cash-denom-extra"
          :data-testid="`cash-count-denomination-${index}`"
        >
          <div class="cash-field">
            <label :for="extraId(index)" class="cash-label">Otra denominación (pesos)</label>
            <UInput
              :id="extraId(index)"
              v-model="row.amount"
              inputmode="decimal"
              placeholder="0.00"
              :data-testid="`cash-count-denomination-amount-${index}`"
            />
          </div>
          <div class="cash-field">
            <label :for="`${extraId(index)}-q`" class="cash-label">Cantidad (piezas)</label>
            <UInput
              :id="`${extraId(index)}-q`"
              v-model="row.quantity"
              inputmode="numeric"
              placeholder="0"
              :data-testid="`cash-count-denomination-quantity-${index}`"
            />
          </div>
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

        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-lucide-plus"
          class="min-h-11 self-start"
          data-testid="cash-count-add-denomination"
          @click="addDenomination"
        >
          Otra denominación
        </UButton>

        <div v-if="denominationsUsed" class="cash-denom-total">
          <span class="cash-strong">Total contado</span>
          <span class="flex flex-wrap items-center gap-2">
            <span
              v-if="denominationMatches"
              class="cash-match"
              data-testid="cash-count-denomination-match"
            >
              <UIcon name="i-lucide-check" class="size-4" aria-hidden="true" />
              Coincide con Efectivo
            </span>
            <span class="cash-big-money hf-figure" data-testid="cash-count-denomination-sum">
              {{ formatCentsMXN(denominationSum) }}
            </span>
          </span>
        </div>
        <p
          v-if="shownDenominationProblem"
          :id="`${denominationProblemField}-error`"
          class="cash-inline-error"
          data-testid="cash-count-denomination-error"
        >{{ shownDenominationProblem }}</p>
      </details>

      <div class="cash-field">
        <label :for="notesId" class="cash-label">
          {{ notesRequired ? 'Nota' : 'Notas' }}
          <span class="cash-meta">{{ notesRequired ? '(obligatoria por la diferencia)' : '(opcional)' }}</span>
        </label>
        <UTextarea
          :id="notesId"
          v-model="notes"
          :rows="2"
          autoresize
          class="w-full"
          placeholder="Por ejemplo: un billete de $200 dañado aparte"
          :aria-invalid="shownNotesProblem ? 'true' : undefined"
          :aria-describedby="describedBy(null, shownNotesProblem, notesId)"
          data-testid="cash-count-notes"
        />
        <p
          v-if="shownNotesProblem"
          :id="`${notesId}-error`"
          class="cash-inline-error"
          data-testid="cash-count-notes-error"
        >{{ shownNotesProblem }}</p>
      </div>

      <div class="cash-form-footer">
        <span class="cash-meta-wrap">
          {{ variant === 'card' ? 'Al enviar ya no podrás cambiar los importes; solo agregar notas.' : 'Queda registrado como tu verificación.' }}
        </span>
        <UButton
          type="submit"
          class="hf-primary-control min-h-11"
          :loading="submitting"
          :disabled="submitting"
          data-testid="cash-count-submit"
        >
          {{ submitLabel }}
        </UButton>
      </div>
    </form>
  </section>
</template>
