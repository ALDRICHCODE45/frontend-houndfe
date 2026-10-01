<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { PendingExpirationDecision } from '../interfaces/expiration-decision.types'
import { validateExpirationText } from '../utils/expirationText'
import type { ExpirationTextValidationReason } from '../utils/expirationText'
import type { ExpirationDecisionResolutionInput } from '../utils/expirationResolutionAttempt'
const props = withDefaults(
  defineProps<{
    decision: PendingExpirationDecision
    canUpdate: boolean
    resolving?: boolean
    conflict?: boolean
  }>(),
  { resolving: false, conflict: false },
)
const emit = defineEmits<{ resolve: [input: ExpirationDecisionResolutionInput] }>()
const VALIDATION_MESSAGES: Record<ExpirationTextValidationReason, string> = {
  NOT_A_STRING: 'El texto de vencimiento no es válido.',
  EMPTY: 'Escribe la información de vencimiento.',
  CONTROL_CHARACTER: 'El texto contiene caracteres no permitidos.',
  TOO_LONG: 'La información no puede superar los 500 caracteres.',
}
/** The reviewed action/text/version, kept verbatim until the draft or context changes. */
const textInput = ref('')
const validationMessage = ref('')
const confirmation = ref<ExpirationDecisionResolutionInput | null>(null)
const has = (action: string) => props.decision.allowedActions.some((a) => a === action)
const canProvideText = computed(() => props.canUpdate && has('PROVIDE_EXPIRATION_TEXT'))
const canReportUnavailable = computed(() => props.canUpdate && has('REPORT_EXPIRATION_UNAVAILABLE'))
const canAct = computed(() => canProvideText.value || canReportUnavailable.value)
const confirmationDescription = computed(() =>
  confirmation.value?.action === 'PROVIDE_EXPIRATION_TEXT'
    ? `Registrar la información de vencimiento: «${confirmation.value.expirationText}».`
    : 'Registrar que por ahora no tenemos información de vencimiento.',
)
function revokeIneligibleConfirmation(): void {
  const confirmed = confirmation.value
  if (confirmed === null) return
  const lostAction =
    confirmed.action === 'PROVIDE_EXPIRATION_TEXT'
      ? !canProvideText.value
      : !canReportUnavailable.value
  if (props.conflict || !props.canUpdate || lostAction) confirmation.value = null
}
function openProvideConfirmation(): void {
  const result = validateExpirationText(textInput.value)
  if (!result.ok) {
    validationMessage.value = VALIDATION_MESSAGES[result.reason]
    confirmation.value = null
    return
  }
  validationMessage.value = ''
  confirmation.value = {
    action: 'PROVIDE_EXPIRATION_TEXT',
    expirationText: result.value,
    expectedVersion: props.decision.version,
  }
}
function openUnavailableConfirmation(): void {
  validationMessage.value = ''
  confirmation.value = {
    action: 'REPORT_EXPIRATION_UNAVAILABLE',
    expectedVersion: props.decision.version,
  }
}
function setConfirmationOpen(open: boolean): void {
  if (!open && !props.resolving) confirmation.value = null
}
function confirmResolution(): void {
  const confirmed = confirmation.value
  if (confirmed === null || props.resolving) return
  const eligible =
    confirmed.expectedVersion === props.decision.version &&
    !props.conflict &&
    props.canUpdate &&
    (confirmed.action === 'PROVIDE_EXPIRATION_TEXT'
      ? canProvideText.value
      : canReportUnavailable.value)
  if (eligible) emit('resolve', confirmed)
  confirmation.value = null
}
watch(
  () => [props.decision.id, props.decision.version] as const,
  () => {
    textInput.value = ''
    validationMessage.value = ''
    confirmation.value = null
  },
)
watch(textInput, () => {
  validationMessage.value = ''
  confirmation.value = null
})
watch([() => props.canUpdate, () => props.conflict, canProvideText, canReportUnavailable], () =>
  revokeIneligibleConfirmation(),
)
</script>

<template>
  <section aria-labelledby="expiration-actions-heading" class="space-y-3">
    <h2 id="expiration-actions-heading" class="text-sm font-semibold text-highlighted">
      Registrar respuesta
    </h2>
    <p v-if="conflict" role="alert" class="rounded-lg bg-warning/5 p-3 text-sm text-warning">
      Esta decisión ya fue atendida. Revisa el detalle actualizado.
    </p>
    <p v-else-if="!canUpdate" role="status" class="text-sm text-muted">
      Solo lectura. No tienes permiso para registrar una respuesta.
    </p>
    <p v-else-if="!canAct" role="status" class="text-sm text-muted">
      No hay acciones disponibles para esta decisión.
    </p>

    <div v-else class="space-y-4">
      <div v-if="canProvideText" class="space-y-2">
        <label for="expiration-text" class="text-sm font-medium text-highlighted">
          Información de vencimiento
        </label>
        <UTextarea
          id="expiration-text"
          v-model="textInput"
          :rows="3"
          class="w-full"
          data-testid="expiration-text-input"
          :disabled="resolving"
          :aria-invalid="Boolean(validationMessage)"
          aria-describedby="expiration-text-error"
        />
        <p
          v-if="validationMessage"
          id="expiration-text-error"
          role="alert"
          class="text-sm text-error"
        >
          {{ validationMessage }}
        </p>
        <UButton
          type="button"
          class="min-h-11 w-full justify-center"
          :disabled="resolving"
          data-testid="provide-expiration-text"
          @click="openProvideConfirmation"
        >
          Registrar información
        </UButton>
      </div>
      <UButton
        v-if="canReportUnavailable"
        type="button"
        color="neutral"
        variant="outline"
        class="min-h-11 w-full justify-center"
        :disabled="resolving"
        data-testid="report-expiration-unavailable"
        @click="openUnavailableConfirmation"
      >
        Sin información por ahora
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
