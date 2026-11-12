<script setup lang="ts">
/**
 * RequestCommandResolveForm — resolve a decision with the answers of its subtype (handoff 12):
 * RESTOCK days or «No hay fecha estimada», EXPIRATION text or «No disponible», DELIVERY_ZONE
 * approve or reject with its impact, TRANSFER_RECEIPT confirm with an amount or reject with an
 * internal reason and a customer message. Validation runs here; the host builds the body.
 */
import { computed, reactive, ref } from 'vue'
import type { ChatbotRequestSubtype, ChatbotRequestZoneImpact } from '../interfaces/chatbot-request.types'
import {
  EXPIRATION_TEXT_MAX,
  RECEIPT_CUSTOMER_REASON_MAX,
  RECEIPT_REASON_MAX,
  defaultResolveOption,
  emptyResolveDraft,
  validateResolve,
  type ResolveDraft,
} from '../utils/command-forms'
import { formatMoney } from '../utils/detail-format'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup, { type RadioItem } from './RequestCommandRadioGroup.vue'
import RequestCommandZoneFields from './RequestCommandZoneFields.vue'

const props = defineProps<{
  subtype: ChatbotRequestSubtype
  /** The request is `NEW`: resolving also takes it. */
  claimsOnResolve?: boolean
  zipCode?: string
  declaredAmountCents?: number | null
  impact?: ChatbotRequestZoneImpact | null
  impactLoading?: boolean
  impactFailed?: boolean
  reconfirm?: boolean
  pending?: boolean
  serverErrors?: Record<string, string>
}>()
const emit = defineEmits<{ submit: [draft: ResolveDraft]; back: []; reloadImpact: [] }>()

const draft = reactive<ResolveDraft>({ ...emptyResolveDraft(), option: defaultResolveOption(props.subtype) })
const submitted = ref(false)
const errors = computed(() => ({
  ...(props.serverErrors ?? {}),
  ...(submitted.value ? validateResolve(props.subtype, draft) : {}),
}))

const CHOICES: Partial<Record<ChatbotRequestSubtype, RadioItem[]>> = {
  RESTOCK: [
    { value: 'GIVE', label: 'Dar un estimado de reposición', hint: 'El bot le avisa cuántos días tardará.' },
    { value: 'NONE', label: 'No hay fecha estimada', hint: 'El bot le avisa que no hay fecha.' },
  ],
  EXPIRATION: [
    { value: 'GIVE', label: 'Indicar la caducidad', hint: 'Escribe la fecha o el texto que verá el cliente.' },
    { value: 'NONE', label: 'No disponible', hint: 'El bot le avisa que no está disponible.' },
  ],
  TRANSFER_RECEIPT: [
    { value: 'CONFIRM', label: 'Confirmar comprobante', hint: 'Registra el pago de la transferencia en la venta.' },
    { value: 'REJECT', label: 'Rechazar comprobante', hint: 'El cliente recibe el motivo.' },
  ],
}
const choices = computed(() => CHOICES[props.subtype] ?? [])
const isZone = computed(() => props.subtype === 'DELIVERY_ZONE')

const submitLabel = computed(() => {
  if (isZone.value) {
    if (props.reconfirm) return 'Confirmar con los datos nuevos'
    return draft.option === 'REJECT' ? 'Rechazar zona' : 'Aprobar zona'
  }
  if (props.subtype === 'TRANSFER_RECEIPT') return draft.option === 'REJECT' ? 'Rechazar comprobante' : 'Confirmar comprobante'
  return 'Resolver'
})
// A zone decision is never sent without the impact it was confirmed against.
const blocked = computed(() => isZone.value && !props.impact)

function submit(): void {
  submitted.value = true
  if (blocked.value) return
  if (Object.keys(validateResolve(props.subtype, draft)).length > 0) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="rc-form" data-testid="resolve-form" novalidate @submit.prevent="submit">
    <p v-if="claimsOnResolve" class="rc-lead" data-testid="resolve-claims">Al resolver también la tomas.</p>

    <template v-if="isZone">
      <RequestCommandZoneFields
        :draft="draft"
        :errors="errors"
        :zip-code="zipCode ?? ''"
        :impact="impact ?? null"
        :impact-loading="impactLoading"
        :impact-failed="impactFailed"
        :reconfirm="reconfirm"
        :disabled="pending"
        @reload-impact="emit('reloadImpact')"
        @change="Object.assign(draft, $event)"
      />
    </template>

    <template v-else>
      <p class="rc-label" data-testid="resolve-question">¿Qué le respondemos al cliente?</p>
      <RequestCommandRadioGroup
        :model-value="draft.option"
        :items="choices"
        label="Respuesta"
        :disabled="pending"
        @update:model-value="draft.option = $event"
      />

      <RequestCommandField
        v-if="subtype === 'RESTOCK' && draft.option === 'GIVE'"
        v-model="draft.restockDays"
        label="Días para reponer"
        inputmode="numeric"
        :maxlength="3"
        help="Entre 1 y 365 días."
        :error="errors.restockDays"
        :disabled="pending"
        test-id="restock-days"
      />

      <RequestCommandField
        v-if="subtype === 'EXPIRATION' && draft.option === 'GIVE'"
        v-model="draft.expirationText"
        label="Caducidad"
        multiline
        :maxlength="EXPIRATION_TEXT_MAX"
        help="Ej. marzo de 2027."
        :error="errors.expirationText"
        :disabled="pending"
        test-id="expiration-text"
      />

      <template v-if="subtype === 'TRANSFER_RECEIPT'">
        <RequestCommandField
          v-if="draft.option === 'CONFIRM'"
          v-model="draft.amount"
          label="Monto recibido (MXN)"
          inputmode="decimal"
          prefix="$"
          :help="
            declaredAmountCents != null
              ? `El cliente declaró ${formatMoney(declaredAmountCents)}. Debe ser mayor que $0.00.`
              : 'Debe ser mayor que $0.00.'
          "
          :error="errors.amountCents"
          :disabled="pending"
          test-id="receipt-amount"
        />
        <template v-else>
          <RequestCommandField
            v-model="draft.reason"
            label="Motivo interno"
            multiline
            :maxlength="RECEIPT_REASON_MAX"
            help="Solo lo ve el personal."
            :error="errors.reason"
            :disabled="pending"
            test-id="receipt-reason"
          />
          <RequestCommandField
            v-model="draft.customerReason"
            label="Mensaje para el cliente"
            multiline
            :maxlength="RECEIPT_CUSTOMER_REASON_MAX"
            help="Obligatorio: el bot se lo envía tal cual."
            :error="errors.customerReason"
            :disabled="pending"
            test-id="receipt-customer-reason"
          />
        </template>
      </template>
    </template>

    <RequestCommandFooter :label="submitLabel" :pending="pending" :disabled="blocked" @back="emit('back')" />
  </form>
</template>
