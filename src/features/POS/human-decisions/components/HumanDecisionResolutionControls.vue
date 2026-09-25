<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { PendingHumanDecision } from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'

const props = withDefaults(
  defineProps<{
    decision: PendingHumanDecision
    canUpdate: boolean
    resolving?: boolean
    conflict?: boolean
  }>(),
  { resolving: false, conflict: false },
)
const emit = defineEmits<{ resolve: [input: HumanDecisionResolutionInput] }>()

const restockDaysInput = ref<string | number>('')
const validationMessage = ref('')
const confirmation = ref<'estimate' | 'unavailable' | null>(null)
const canProvideEstimate = computed(
  () =>
    props.canUpdate &&
    props.decision.allowedActions.some((action) => action === 'PROVIDE_RESTOCK_ESTIMATE'),
)
const canReportUnavailable = computed(
  () =>
    props.canUpdate &&
    props.decision.allowedActions.some(
      (action) => action === 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
    ),
)
const hasAllowedAction = computed(() => canProvideEstimate.value || canReportUnavailable.value)
const confirmationDescription = computed(() =>
  confirmation.value === 'estimate'
    ? `Registrar una estimación de ${Number(restockDaysInput.value)} días naturales.`
    : 'Por ahora no tenemos una fecha estimada de reposición.',
)

watch(
  () => props.decision.id,
  () => {
    restockDaysInput.value = ''
    validationMessage.value = ''
    confirmation.value = null
  },
)

function openEstimateConfirmation(): void {
  const value = Number(restockDaysInput.value)
  if (
    String(restockDaysInput.value).trim() === '' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 365
  ) {
    validationMessage.value = 'Ingresa un número entero entre 1 y 365.'
    return
  }
  validationMessage.value = ''
  confirmation.value = 'estimate'
}

function setConfirmationOpen(open: boolean): void {
  if (!open && !props.resolving) confirmation.value = null
}

function confirmResolution(): void {
  if (props.resolving || props.conflict || !props.canUpdate) return
  if (confirmation.value === 'estimate' && canProvideEstimate.value) {
    emit('resolve', {
      action: 'PROVIDE_RESTOCK_ESTIMATE',
      restockDays: Number(restockDaysInput.value),
      expectedVersion: props.decision.version,
    })
  } else if (confirmation.value === 'unavailable' && canReportUnavailable.value) {
    emit('resolve', {
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
      expectedVersion: props.decision.version,
    })
  }
  confirmation.value = null
}
</script>

<template>
  <section aria-labelledby="human-decision-actions-heading" class="space-y-3">
    <h2 id="human-decision-actions-heading" class="text-sm font-semibold text-highlighted">
      Registrar respuesta
    </h2>

    <p
      v-if="conflict"
      role="alert"
      class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning"
    >
      Esta decisión ya fue atendida. Revisa el detalle actualizado.
    </p>
    <p v-else-if="!canUpdate" role="status" class="text-sm text-muted">
      Solo lectura. No tienes permiso para registrar una respuesta.
    </p>
    <p v-else-if="!hasAllowedAction" role="status" class="text-sm text-muted">
      No hay acciones disponibles para esta decisión.
    </p>

    <div v-else class="space-y-4">
      <div v-if="canProvideEstimate" class="space-y-2">
        <label for="restock-days" class="text-sm font-medium text-highlighted">
          Días naturales estimados
        </label>
        <UInput
          id="restock-days"
          v-model="restockDaysInput"
          type="number"
          inputmode="numeric"
          :min="1"
          :max="365"
          :step="1"
          class="w-full"
          data-testid="restock-days-input"
          :disabled="resolving"
          :aria-invalid="Boolean(validationMessage)"
          aria-describedby="restock-days-error"
        />
        <p v-if="validationMessage" id="restock-days-error" role="alert" class="text-sm text-error">
          {{ validationMessage }}
        </p>
        <UButton
          type="button"
          class="min-h-11 w-full justify-center"
          :disabled="resolving"
          data-testid="provide-restock-estimate"
          @click="openEstimateConfirmation"
        >
          Registrar estimación
        </UButton>
      </div>

      <UButton
        v-if="canReportUnavailable"
        type="button"
        color="neutral"
        variant="outline"
        class="min-h-11 w-full justify-center"
        :disabled="resolving"
        data-testid="report-estimate-unavailable"
        @click="confirmation = 'unavailable'"
      >
        Sin fecha estimada por ahora
      </UButton>
    </div>

    <ConfirmModal
      :open="confirmation !== null"
      title="Confirmar respuesta"
      :description="confirmationDescription"
      confirm-label="Registrar respuesta"
      :loading="resolving"
      @update:open="setConfirmationOpen"
      @confirm="confirmResolution"
    />
  </section>
</template>
