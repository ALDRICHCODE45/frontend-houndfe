<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import {
  usePaymentDetailForm,
  type CreatePaymentDetailFormValues,
  type UpdatePaymentDetailFormValues,
} from '../composables/usePaymentDetailForm'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'

/**
 * PaymentDetailUpsertSlideover — sdd payment-details-admin S4 (design.md §10.2)
 *
 * Captures and validates the four account fields (bankName, beneficiary, clabe,
 * accountNumber) for CREATE and EDIT modes. Emits `create` / `edit` payloads.
 *
 * `isActive` is NEVER rendered or emitted here — the backend forbids it
 * (forbidNonWhitelisted → 400) and deactivation is DELETE-only. There is NO
 * toggle, NO checkbox (REQ-PD-002/003).
 */
const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    paymentDetail?: PaymentDetailTableRow | null
  }>(),
  {
    loading: false,
    paymentDetail: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreatePaymentDetailFormValues]
  edit: [payload: UpdatePaymentDetailFormValues]
}>()

const { schema, createState, editState, resetForm, setValues, setCreateField, setEditField } =
  usePaymentDetailForm(props.mode)

const title = computed(() => (props.mode === 'create' ? 'Crear cuenta bancaria' : 'Editar cuenta bancaria'))
const description = computed(() =>
  props.mode === 'create'
    ? 'Completa los datos bancarios. La cuenta se crea como activa.'
    : 'Actualiza los datos bancarios de la cuenta.',
)

const formId = computed(() =>
  props.mode === 'create' ? 'create-payment-detail-form' : 'edit-payment-detail-form',
)

const activeState = computed(() => (props.mode === 'create' ? createState : editState))

// Prefill edit mode from the current row. `setValues` filters out foreign keys
// (isActive, tenantId) so they never leak into the reactive form state (REQ-PD-003).
watch(
  () => props.paymentDetail,
  (paymentDetail) => {
    if (props.mode === 'edit' && paymentDetail) {
      setValues({
        bankName: paymentDetail.bankName,
        beneficiary: paymentDetail.beneficiary,
        clabe: paymentDetail.clabe,
        accountNumber: paymentDetail.accountNumber,
      })
    }
  },
  { immediate: true },
)

function handleClose() {
  resetForm()
  open.value = false
}

function handleBankName(value: string) {
  if (props.mode === 'create') setCreateField('bankName', value)
  else setEditField('bankName', value)
}

function handleBeneficiary(value: string) {
  if (props.mode === 'create') setCreateField('beneficiary', value)
  else setEditField('beneficiary', value)
}

function handleClabe(value: string) {
  if (props.mode === 'create') setCreateField('clabe', value)
  else setEditField('clabe', value)
}

function handleAccountNumber(value: string) {
  if (props.mode === 'create') setCreateField('accountNumber', value)
  else setEditField('accountNumber', value)
}

function onSubmit(event: FormSubmitEvent<CreatePaymentDetailFormValues | UpdatePaymentDetailFormValues>) {
  if (props.mode === 'create') {
    emit('create', event.data as CreatePaymentDetailFormValues)
  } else {
    emit('edit', event.data as UpdatePaymentDetailFormValues)
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    :description="description"
    side="right"
    inset
    @after-leave="resetForm"
  >
    <template #body>
      <UForm
        :id="formId"
        :schema="schema"
        :state="activeState"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Banco" name="bankName">
          <UInput
            :model-value="activeState.bankName"
            class="w-full"
            size="lg"
            placeholder="Ej: AFIRME"
            @update:model-value="handleBankName"
          />
        </UFormField>

        <UFormField label="Beneficiario" name="beneficiary">
          <UInput
            :model-value="activeState.beneficiary"
            class="w-full"
            size="lg"
            placeholder="Ej: HUN F.E. COMERCIALIZADORA SA DE CV"
            @update:model-value="handleBeneficiary"
          />
        </UFormField>

        <UFormField label="CLABE" name="clabe">
          <UInput
            :model-value="activeState.clabe"
            class="w-full"
            size="lg"
            inputmode="numeric"
            maxlength="18"
            placeholder="Ej: 012345678901234567"
            @update:model-value="handleClabe"
          />
        </UFormField>

        <UFormField label="Número de cuenta" name="accountNumber">
          <UInput
            :model-value="activeState.accountNumber"
            class="w-full"
            size="lg"
            inputmode="numeric"
            placeholder="Ej: 1234567890"
            @update:model-value="handleAccountNumber"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="mode === 'create' ? 'Crear cuenta' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
