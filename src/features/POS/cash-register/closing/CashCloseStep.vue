<script setup lang="ts">
/**
 * «Cerrar caja» (T4, S5) — supervisor stage of design A
 * (design/cash-redesign/01-turno-linea-de-tiempo.html `panelCierre`, 390 in 04).
 *
 * - Requirement checklist in the backend check order (§5): status rows with a
 *   round mark, never checkboxes; pending rows say what is missing and who acts.
 * - The cashier never gets the action (closer ≠ cashier); without
 *   `create:CashClosing` the missing permission is named.
 * - Closing note: always optional (handoff 25 §5). A difference only needs the
 *   declaration/verification notes, which the «Diferencia explicada» row checks.
 * - «Cerrar caja» disabled with the reason (aria-describedby), ConfirmModal,
 *   success → `closed` with the closing; any server error → one summary near the
 *   action in an alert region. The backend stays authoritative.
 */
import { computed, ref, useId } from 'vue'
import { displayClosingFolio } from './closingView'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { CashClosing, CashSessionDetail } from '../interfaces/cash.types'
import { CASH_CLOSE_NOTES_MAX_LENGTH } from '../api/cash.api'
import { cashCloseErrorInfo } from '../composables/cashErrorCopy'
import { closeReadiness } from './closeRequirements'
import { useCashClose } from './useCashClosing'

const props = defineProps<{
  detail: CashSessionDetail
  currentUserId: string | null
  /** `create:CashClosing` (useCashAccess().canClose). */
  canClose: boolean
}>()

const emit = defineEmits<{
  closed: [closing: CashClosing]
  'view-closing': [closingId: string]
}>()

const { close, isClosing } = useCashClose()
const uid = useId()
const notesId = `cash-close-notes-${uid}`
const reasonId = `cash-close-reason-${uid}`

const notes = ref('')
const confirmOpen = ref(false)
const serverError = ref<string | null>(null)
const statusMessage = ref('')

const readiness = computed(() => closeReadiness(props.detail, props.currentUserId))
const registerName = computed(() => props.detail.register?.name?.trim() || 'la caja')
const cashierName = computed(
  () => props.detail.session.cashierDisplayName?.trim() || 'la persona que abrió la caja',
)

const notesTooLong = computed(() => notes.value.trim().length > CASH_CLOSE_NOTES_MAX_LENGTH)

const notesHint = computed(() => {
  const cents = readiness.value.differenceCents
  if (cents === null || cents === 0) return '(opcional)'
  const kind = cents < 0 ? 'un faltante' : 'un sobrante'
  return `(opcional · hay ${kind} de ${formatCentsMXN(Math.abs(cents))})`
})

/** The single explanation of a disabled «Cerrar caja». */
const disabledReason = computed<string | null>(() => {
  if (readiness.value.mode === 'blocked') return readiness.value.blockingReason
  if (notesTooLong.value) {
    return `La nota de cierre admite hasta ${CASH_CLOSE_NOTES_MAX_LENGTH} caracteres.`
  }
  return null
})

const canSubmit = computed(
  () => readiness.value.mode === 'ready' && !disabledReason.value && !isClosing.value,
)

const closedFolio = computed(() => props.detail.closing?.folio ? displayClosingFolio(props.detail.closing.folio) : null)

function openConfirm() {
  if (!canSubmit.value) return
  serverError.value = null
  confirmOpen.value = true
}

async function confirmClose() {
  serverError.value = null
  statusMessage.value = 'Cerrando la caja…'
  try {
    const closing = await close(props.detail.session.id, notes.value.trim() || undefined)
    confirmOpen.value = false
    statusMessage.value = `Caja cerrada. Corte ${displayClosingFolio(closing.folio)}.`
    emit('closed', closing)
  } catch (error) {
    confirmOpen.value = false
    statusMessage.value = ''
    serverError.value = cashCloseErrorInfo(error).message
  }
}
</script>

<template>
  <section class="cc-step" data-testid="cash-close-step" aria-labelledby="cash-close-title">
    <h3 id="cash-close-title" class="sr-only">Cerrar caja</h3>
    <p class="sr-only" role="status" aria-live="polite">{{ statusMessage }}</p>

    <!-- Closed: the corte exists. -->
    <div v-if="readiness.mode === 'closed'" class="cc-callout cc-callout--ok" data-testid="cash-close-closed">
      <UIcon name="i-lucide-lock" class="cc-callout__icon" aria-hidden="true" />
      <div class="cc-callout__body">
        <p class="cc-callout__title">Caja cerrada</p>
        <p v-if="closedFolio" class="cc-meta">Corte {{ closedFolio }}</p>
      </div>
      <UButton
        v-if="detail.closing"
        color="neutral"
        variant="outline"
        class="min-h-11"
        icon="i-lucide-file-text"
        data-testid="cash-close-view-closing"
        @click="emit('view-closing', detail.closing.id)"
      >
        Ver corte
      </UButton>
    </div>

    <!-- The cashier never closes their own session. -->
    <div v-else-if="readiness.mode === 'cashier'" class="cc-callout" data-testid="cash-close-cashier">
      <UIcon name="i-lucide-user-round" class="cc-callout__icon" aria-hidden="true" />
      <div class="cc-callout__body">
        <p class="cc-callout__title">La cierra un supervisor</p>
        <p class="cc-meta">
          Con permiso de cierre y distinto de quien abrió la caja. Al cerrar se genera el corte con folio.
        </p>
      </div>
    </div>

    <div v-else-if="!canClose" class="cc-callout" data-testid="cash-close-forbidden">
      <UIcon name="i-lucide-lock" class="cc-callout__icon" aria-hidden="true" />
      <div class="cc-callout__body">
        <p class="cc-callout__title">No puedes cerrar cajas</p>
        <p class="cc-meta">Necesitas el permiso «Cerrar caja». Pídelo a un administrador.</p>
      </div>
    </div>

    <form v-else class="cc-form" novalidate @submit.prevent="openConfirm">
      <ul class="cc-checklist" aria-label="Requisitos para cerrar">
        <li
          v-for="requirement in readiness.requirements"
          :key="requirement.id"
          class="cc-check"
          :data-state="requirement.state"
          :data-testid="`cash-close-requirement-${requirement.id}`"
        >
          <span class="cc-mark" :class="`cc-mark--${requirement.state}`" aria-hidden="true">
            <UIcon
              :name="requirement.state === 'met' ? 'i-lucide-check' : requirement.state === 'pending' ? 'i-lucide-clock' : 'i-lucide-minus'"
              class="size-3.5"
            />
          </span>
          <span class="cc-check__text">
            <span class="cc-check__label">
              {{ requirement.label }}
              <span class="sr-only">
                — {{ requirement.state === 'met' ? 'listo' : requirement.state === 'pending' ? 'falta' : 'se confirma al cerrar' }}
              </span>
            </span>
            <span class="cc-check__detail">{{ requirement.detail }}</span>
          </span>
        </li>
      </ul>

      <div class="cc-field">
        <label :for="notesId" class="cc-label" data-testid="cash-close-notes-label">
          Nota de cierre <span class="cc-meta">{{ notesHint }}</span>
        </label>
        <UTextarea
          :id="notesId"
          v-model="notes"
          :rows="3"
          autoresize
          class="w-full"
          :maxlength="CASH_CLOSE_NOTES_MAX_LENGTH"
          placeholder="Por ejemplo: faltante de $20.00 explicado por la cajera en su declaración"
          data-testid="cash-close-notes"
        />
      </div>

      <div
        v-if="serverError"
        class="cc-error"
        role="alert"
        data-testid="cash-close-error"
      >
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        <div>
          <p class="cc-error__title">No se pudo cerrar la caja</p>
          <p>{{ serverError }}</p>
        </div>
      </div>

      <div class="cc-footer">
        <p
          :id="reasonId"
          class="cc-meta"
          :class="{ 'cc-reason--pending': disabledReason }"
          data-testid="cash-close-reason"
        >
          {{ disabledReason ?? 'Al cerrar se genera el corte con folio. No se puede deshacer.' }}
        </p>
        <UButton
          type="button"
          :color="canSubmit ? 'primary' : 'neutral'"
          :variant="canSubmit ? 'solid' : 'outline'"
          class="min-h-11 cc-submit"
          icon="i-lucide-lock"
          :loading="isClosing"
          :disabled="!canSubmit"
          :aria-describedby="reasonId"
          data-testid="cash-close-submit"
          @click="openConfirm"
        >
          Cerrar {{ registerName }}
        </UButton>
      </div>
    </form>

    <ConfirmModal
      v-model:open="confirmOpen"
      :title="`¿Cerrar ${registerName}?`"
      :description="`Se genera el corte con folio del turno de ${cashierName}. No se puede deshacer.`"
      confirm-label="Cerrar caja"
      :loading="isClosing"
      @confirm="confirmClose"
    />
  </section>
</template>

<style scoped>
.cc-step {
  display: grid;
  gap: 16px;
  color: var(--hf-ink);
  font-size: 14px;
}
.cc-meta {
  color: var(--hf-muted);
  font-size: 13px;
}
.cc-callout {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface-muted);
  font-size: 13px;
}
.cc-callout--ok {
  border-color: color-mix(in srgb, var(--hf-success) 35%, var(--hf-surface));
  background: color-mix(in srgb, var(--hf-success) 12%, var(--hf-surface));
}
.cc-callout__icon {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  color: var(--hf-heading);
}
.cc-callout--ok .cc-callout__icon {
  color: var(--hf-success);
}
.cc-callout__body {
  flex: 1 1 14rem;
  min-width: 0;
}
.cc-callout__title {
  color: var(--hf-heading);
  font-weight: 600;
}
.cc-form {
  display: grid;
  gap: 16px;
}
.cc-checklist {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 4px 16px;
  list-style: none;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface-muted);
}
.cc-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
}
.cc-mark {
  flex: none;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
}
.cc-mark--met {
  background: var(--hf-success);
  color: var(--hf-surface);
}
.cc-mark--pending {
  box-shadow: inset 0 0 0 1.5px var(--hf-warning);
  color: var(--hf-warning);
}
.cc-mark--unknown {
  box-shadow: inset 0 0 0 1.5px var(--hf-muted);
  color: var(--hf-muted);
}
.cc-check__text {
  min-width: 0;
}
.cc-check__label {
  display: block;
  font-weight: 500;
}
.cc-check__detail {
  display: block;
  color: var(--hf-muted);
  font-size: 13px;
}
.cc-check[data-state='pending'] .cc-check__detail {
  color: var(--hf-warning);
  font-weight: 600;
}
.cc-field {
  display: grid;
  gap: 6px;
}
.cc-label {
  font-weight: 500;
}
.cc-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--hf-danger-border);
  border-radius: 12px;
  background: var(--hf-danger-soft);
  color: var(--hf-danger);
  font-size: 13px;
}
.cc-error__title {
  font-weight: 600;
}
.cc-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--hf-border);
}
.cc-footer .cc-meta {
  flex: 1 1 16rem;
  min-width: 0;
}
.cc-reason--pending {
  color: var(--hf-warning);
  font-weight: 600;
}
@media (max-width: 480px) {
  .cc-submit {
    flex: 1 1 100%;
    justify-content: center;
  }
}
</style>
