<script setup lang="ts">
/**
 * Open a cash session with an explicitly confirmed opening fund.
 *
 * Rules enforced here (the backend re-checks all of them authoritatively):
 *   - `openingConfirmed` must be literally `true` before the command is sent;
 *   - the opening amount must equal the RECEIVED amount of the chosen FLOAT
 *     (a received amount different from the declared one is valid);
 *   - a FLOAT whose source drawer is still unreleased blocks only the SAME
 *     register until release;
 *   - `eligibleFloat` is a hint, never a reservation.
 */
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
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
  }>(),
  {
    registerId: null,
    registerName: null,
    eligibleFloat: () => [],
    canOpen: false,
    custodyVisible: false,
    submitting: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  submit: [payload: { openingCents: number; openingHandoverId?: string }]
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

const blocked = computed(
  () => !props.canOpen || !props.registerId || drawerAdvisory.value?.blocked === true,
)

function submit() {
  if (!props.registerId) {
    localError.value = 'Elige una caja antes de abrir la sesión.'
    return
  }
  if (!openingConfirmed.value) {
    localError.value = 'Confirma explícitamente el fondo inicial.'
    return
  }
  if (parsedOpeningCents.value === null) {
    localError.value = 'Ingresa el fondo inicial en pesos (por ejemplo 350.00).'
    return
  }
  if (floatMismatch.value) {
    localError.value = 'El monto debe coincidir con el FLOAT recibido (monto recibido).'
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
  <section class="cash-panel" data-testid="cash-open-session">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-door-open" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Apertura de sesión</h2>
        <p class="cash-panel-subtitle">
          El fondo inicial se cuenta una sola vez y no se descuenta contra retiros.
        </p>
      </div>
    </header>

    <div class="cash-panel-body">
      <p v-if="!registerId" class="text-sm text-muted" data-testid="cash-open-no-register">
        Elige una caja activa para abrir su sesión.
      </p>
      <template v-else>
        <div class="cash-note">
          <dl class="flex flex-wrap items-center justify-between gap-2">
            <dt>Caja seleccionada</dt>
            <dd class="cash-fact-value" data-testid="cash-open-register">
              {{ registerName ?? registerId }}
            </dd>
          </dl>
        </div>

        <UFormField v-if="custodyVisible" label="FLOAT recibido (opcional)">
          <USelect
            v-model="selectedFloatId"
            :items="[
              { label: 'Sin FLOAT: fondo nuevo', value: null },
              ...eligibleFloat.map((item) => ({
                label: `${formatCentsMXN(item.receivedCents ?? item.declaredCents)} · ${item.id.slice(0, 8)}`,
                value: item.id,
              })),
            ]"
            class="cash-control w-full"
            data-testid="cash-open-float-select"
          />
        </UFormField>
        <p v-else class="text-xs text-muted" data-testid="cash-open-float-unavailable">
          Sin permiso de custodia no podemos listar tus FLOAT; puedes abrir con fondo nuevo.
        </p>

        <div
          v-if="selectedFloat"
          class="rounded-lg border border-default p-3 text-xs text-muted"
          data-testid="cash-open-float-facts"
        >
          <p data-testid="cash-open-float-received">
            Recibido: {{ formatCentsMXN(selectedFloat.receivedCents ?? 0) }} (el FLOAT vale el monto
            recibido, no el declarado de {{ formatCentsMXN(selectedFloat.declaredCents) }}).
          </p>
          <p data-testid="cash-open-float-hint">
            Es una referencia, no una reserva: los controles definitivos se aplican al abrir.
          </p>
        </div>

        <UAlert
          v-if="drawerAdvisory"
          :color="drawerAdvisory.blocked ? 'error' : 'warning'"
          variant="subtle"
          :description="drawerAdvisory.message"
          data-testid="cash-open-drawer-advisory"
        />

        <UFormField label="Fondo inicial (pesos)">
          <UInput
            v-model="openingCentsInput"
            inputmode="decimal"
            class="cash-control w-full"
            placeholder="350.00"
            data-testid="cash-opening-cents"
          />
        </UFormField>

        <label class="flex items-center gap-2 text-sm text-default">
          <UCheckbox v-model="openingConfirmed" data-testid="cash-opening-confirmed" />
          Confirmo el fondo inicial declarado
        </label>

        <UAlert
          v-if="floatMismatch"
          color="error"
          variant="subtle"
          description="El fondo inicial debe coincidir con el monto recibido del FLOAT."
          data-testid="cash-open-float-mismatch"
        />

        <p v-if="errorMessage" class="text-sm text-error" data-testid="cash-open-error">
          {{ errorMessage }}
        </p>
        <p v-if="localError" class="text-sm text-error" data-testid="cash-open-local-error">
          {{ localError }}
        </p>

        <UButton
          type="button"
          class="cash-control self-start"
          :loading="submitting"
          :disabled="blocked || submitting"
          data-testid="cash-open-submit"
          @click="submit"
        >
          Abrir sesión
        </UButton>
      </template>
    </div>
  </section>
</template>
