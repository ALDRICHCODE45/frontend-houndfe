<script setup lang="ts">
/**
 * Open a cash session with an explicitly confirmed opening fund.
 *
 * Rules enforced here (the backend re-checks all of them authoritatively):
 *   - `openingConfirmed` must be literally `true` before the command is sent;
 *     it is set only by the explicit «Confirmar fondo de $X» action (never a
 *     checkbox) and is bound to that amount: editing the amount drops it;
 *   - the opening amount must equal the RECEIVED amount of the chosen FLOAT
 *     (a received amount different from the declared one is valid);
 *   - a FLOAT whose source drawer is still unreleased blocks only the SAME
 *     register until release;
 *   - `eligibleFloat` is a hint, never a reservation.
 *
 * Layout (direction A, «opening in one place»): the register is chosen right
 * above this form (CashOpeningPanel); here come «2. Fondo inicial» (origin as
 * radio cards: a received fund or a new one, then the amount in pesos) and
 * «3. Confirma lo que cuentas» (the button names the amount). A failed attempt
 * shows one error summary (role="alert", focused, linking to the field) plus
 * the same message next to the field.
 */
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { HfRadioCards, type HfRadioCardItem } from '@/core/shared/components/selection'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { centsToPesosInput, pesosToCents } from '../utils/cash-input'
import { floatOpeningMismatch, floatSourceDrawerAdvisory } from '../composables/cashRules'
import type { CashEligibleFloatItem } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    registerId?: string | null
    registerName?: string | null
    eligibleFloat?: CashEligibleFloatItem[]
    canOpen?: boolean
    custodyVisible?: boolean
    submitting?: boolean
    errorMessage?: string | null
    /** The session behind a refused open, offered as «Ver la sesión» when reachable. */
    errorSessionId?: string | null
  }>(),
  {
    registerId: null,
    registerName: null,
    eligibleFloat: () => [],
    canOpen: false,
    custodyVisible: false,
    submitting: false,
    errorMessage: null,
    errorSessionId: null,
  },
)

const emit = defineEmits<{
  submit: [payload: { openingCents: number; openingHandoverId?: string }]
  'view-session': [sessionId: string]
}>()

const openingCentsInput = ref('')
const openingConfirmed = ref(false)
// Explicit two-way contract: the parent owns the selection (and can reset it
// when the register changes) while the form owns the entry it drives.
const selectedFloatId = defineModel<string | null>('floatId', { default: null })
const localError = ref<string | null>(null)

const selectedFloat = computed<CashEligibleFloatItem | null>(
  () => props.eligibleFloat.find((item) => item.id === selectedFloatId.value) ?? null,
)

const drawerAdvisory = computed(() =>
  floatSourceDrawerAdvisory(selectedFloat.value, props.registerId ?? null),
)

/**
 * Selecting a FLOAT seeds the opening with its RECEIVED amount (the received
 * amount IS the opening fund; a difference from the declared amount is valid).
 * Runs immediately so a preselected FLOAT is seeded on mount as well.
 */
watch(
  selectedFloatId,
  (id) => {
    const float = props.eligibleFloat.find((item) => item.id === id)
    if (float && typeof float.receivedCents === 'number') {
      openingCentsInput.value = centsToPesosInput(float.receivedCents)
    }
    localError.value = null
  },
  { immediate: true },
)

const parsedOpeningCents = computed<number | null>(() => {
  try {
    return pesosToCents(openingCentsInput.value)
  } catch {
    return null
  }
})

const floatMismatch = computed(() =>
  floatOpeningMismatch(selectedFloat.value?.receivedCents ?? null, parsedOpeningCents.value),
)

const openingLabel = computed(() =>
  parsedOpeningCents.value === null ? null : formatCentsMXN(parsedOpeningCents.value),
)

// The confirmation belongs to the amount that was on screen when it was given.
watch(parsedOpeningCents, () => {
  openingConfirmed.value = false
})

function confirmOpening() {
  if (parsedOpeningCents.value === null) {
    localError.value = 'Ingresa el fondo inicial en pesos (por ejemplo 350.00).'
    return
  }
  localError.value = null
  openingConfirmed.value = true
}

function unconfirmOpening() {
  openingConfirmed.value = false
}

const NEW_FUND = '__new__'
const formId = useId()
const amountId = `${formId}-amount`
const confirmId = `${formId}-confirm`
const summary = useTemplateRef<HTMLElement>('summary')

const floatItems = computed<HfRadioCardItem[]>(() => [
  ...props.eligibleFloat.map((item) => ({
    value: item.id,
    label: `Fondo recibido · ${formatCentsMXN(item.receivedCents ?? item.declaredCents)}`,
    description: [
      item.senderDisplayName?.trim() ? `De ${item.senderDisplayName.trim()}` : null,
      formatShortDateTime(item.receivedAt ?? item.declaredAt),
    ]
      .filter(Boolean)
      .join(' · '),
  })),
  { value: NEW_FUND, label: 'Fondo nuevo', description: 'Lo cuentas tú desde la caja fuerte' },
])

const floatChoice = computed({
  get: () => selectedFloatId.value ?? NEW_FUND,
  set: (value: string) => {
    selectedFloatId.value = value === NEW_FUND ? null : value
  },
})

/** Which field the local error belongs to, for the summary link. */
const localErrorField = computed(() =>
  localError.value && /confirma/i.test(localError.value) ? confirmId : amountId,
)

const hasErrors = computed(() => Boolean(localError.value || props.errorMessage))

async function focusSummary() {
  await nextTick()
  summary.value?.focus()
}

watch(
  () => props.errorMessage,
  (message) => {
    if (message) void focusSummary()
  },
)

const blocked = computed(
  () => !props.canOpen || !props.registerId || drawerAdvisory.value?.blocked === true,
)

function submit() {
  submitChecked()
  if (localError.value) void focusSummary()
}

function submitChecked() {
  if (!props.registerId) {
    localError.value = 'Elige una caja antes de abrir la sesión.'
    return
  }
  if (!openingConfirmed.value) {
    localError.value = openingLabel.value
      ? `Confirma el fondo de ${openingLabel.value} antes de abrir la caja.`
      : 'Confirma explícitamente el fondo inicial.'
    return
  }
  if (parsedOpeningCents.value === null) {
    localError.value = 'Ingresa el fondo inicial en pesos (por ejemplo 350.00).'
    return
  }
  if (floatMismatch.value) {
    localError.value = 'El monto debe coincidir con el fondo recibido.'
    return
  }
  if (drawerAdvisory.value?.blocked) {
    localError.value = drawerAdvisory.value.message
    return
  }
  localError.value = null
  emit('submit', {
    openingCents: parsedOpeningCents.value,
    ...(selectedFloatId.value ? { openingHandoverId: selectedFloatId.value } : {}),
  })
}
</script>

<template>
  <section v-if="registerId" class="cash-open-form" data-testid="cash-open-session">
    <p class="cash-meta-wrap">
      Abrirás <strong class="cash-strong" data-testid="cash-open-register">{{ registerName ?? registerId }}</strong>
    </p>

    <!-- One summary for every problem, focused on a failed attempt (GOV.UK pattern). -->
    <div
      v-if="hasErrors"
      ref="summary"
      class="cash-err-summary"
      role="alert"
      tabindex="-1"
      data-testid="cash-open-error-summary"
    >
      <p class="cash-err-summary-title">
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        Revisa antes de abrir
      </p>
      <ul>
        <li v-if="localError">
          <a :href="`#${localErrorField}`">{{ localError }}</a>
        </li>
        <li v-if="errorMessage" data-testid="cash-open-error">
          {{ errorMessage }}
          <button
            v-if="errorSessionId"
            type="button"
            class="cash-err-summary-action"
            data-testid="cash-open-error-view-session"
            @click="emit('view-session', errorSessionId)"
          >
            Ver la sesión
          </button>
        </li>
      </ul>
    </div>

    <fieldset class="cash-fieldset">
      <legend class="cash-legend">2. Fondo inicial</legend>

      <div v-if="custodyVisible" data-testid="cash-open-float-select">
        <HfRadioCards
          v-model="floatChoice"
          :items="floatItems"
          label="Origen del fondo"
          selected-label=""
        />
      </div>
      <p v-else class="cash-meta-wrap" data-testid="cash-open-float-unavailable">
        Sin permiso de custodia no se listan tus fondos recibidos; puedes abrir con fondo nuevo.
      </p>

      <div v-if="selectedFloat" class="cash-note" data-testid="cash-open-float-facts">
        <p data-testid="cash-open-float-received">
          Recibido: {{ formatCentsMXN(selectedFloat.receivedCents ?? 0) }} (declarado
          {{ formatCentsMXN(selectedFloat.declaredCents) }}).
        </p>
        <p data-testid="cash-open-float-hint">Es una referencia, no una reserva.</p>
      </div>

      <UAlert
        v-if="drawerAdvisory"
        :color="drawerAdvisory.blocked ? 'error' : 'warning'"
        variant="subtle"
        :description="drawerAdvisory.message"
        data-testid="cash-open-drawer-advisory"
      />

      <div class="cash-field">
        <label :for="amountId" class="cash-label">Fondo inicial (pesos)</label>
        <UInput
          :id="amountId"
          v-model="openingCentsInput"
          inputmode="decimal"
          autocomplete="off"
          size="xl"
          class="cash-money-input w-full max-w-xs"
          placeholder="350.00"
          :aria-invalid="localError && localErrorField === amountId ? 'true' : undefined"
          :aria-describedby="`${amountId}-hint`"
          data-testid="cash-opening-cents"
        >
          <template #leading><span aria-hidden="true">$</span></template>
          <template #trailing><span class="cash-meta" aria-hidden="true">MXN</span></template>
        </UInput>
        <p :id="`${amountId}-hint`" class="cash-hint">
          {{ selectedFloat ? 'Debe coincidir con el fondo recibido.' : 'En pesos con hasta dos decimales, por ejemplo 350.00. El cero también vale.' }}
        </p>
      </div>
    </fieldset>

    <div class="cash-fieldset">
      <span class="cash-legend">3. Confirma lo que cuentas en el cajón</span>
      <!-- Explicit confirmation of the amount (Selección sin checkboxes): a
           button that names the fund, then a confirmed line with «Cambiar». -->
      <div
        v-if="openingConfirmed && openingLabel"
        class="cash-confirmed"
        role="status"
        data-testid="cash-opening-confirmation"
      >
        <UIcon name="i-lucide-circle-check" class="size-5 shrink-0 text-success" aria-hidden="true" />
        <span class="flex-1 font-semibold">Fondo de {{ openingLabel }} confirmado</span>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          data-testid="cash-opening-unconfirm"
          @click="unconfirmOpening"
        >
          Cambiar
        </UButton>
      </div>
      <UButton
        v-else
        :id="confirmId"
        type="button"
        color="neutral"
        variant="outline"
        icon="i-lucide-check"
        class="min-h-11 self-start"
        :disabled="blocked"
        data-testid="cash-opening-confirmed"
        @click="confirmOpening"
      >
        {{ openingLabel ? `Confirmar fondo de ${openingLabel}` : 'Confirmar fondo inicial' }}
      </UButton>
    </div>

    <UAlert
      v-if="floatMismatch"
      color="error"
      variant="subtle"
      description="El fondo inicial debe coincidir con el monto recibido del fondo."
      data-testid="cash-open-float-mismatch"
    />

    <p v-if="localError" class="cash-inline-error" data-testid="cash-open-local-error">
      <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
      {{ localError }}
    </p>

    <div class="cash-form-footer">
      <span class="cash-meta-wrap" aria-live="polite">
        {{ openingConfirmed ? 'Todo listo para abrir.' : 'Falta confirmar el fondo.' }}
      </span>
      <UButton
        type="button"
        class="min-h-11"
        :loading="submitting"
        :disabled="blocked || submitting"
        data-testid="cash-open-submit"
        @click="submit"
      >
        {{ openingConfirmed && openingLabel ? `Abrir caja con ${openingLabel}` : 'Abrir sesión' }}
      </UButton>
    </div>
  </section>
</template>
