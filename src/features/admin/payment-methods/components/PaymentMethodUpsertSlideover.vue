<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import {
  usePaymentMethodForm,
  type CreatePaymentMethodFormValues,
  type UpdatePaymentMethodFormValues,
} from '../composables/usePaymentMethodForm'
import type { PaymentMethodTableRow } from '../interfaces/payment-method.types'
import { PAYMENT_METHOD_CATEGORY_LABELS, PAYMENT_METHOD_CATEGORY_VALUES, type PaymentMethodCategory } from '@/core/shared/constants/payment-method-category'

/**
 * PaymentMethodUpsertSlideover — sdd custom-payment-methods S3B (design §10)
 *
 * Captures and validates the create/edit fields for a payment method.
 *
 * **`isActive` REVERSAL (REQ-PM-003, design §2.2 / §11).** Unlike
 * `PaymentDetailUpsertSlideover`, this slideover DOES render an `isActive`
 * switch in `edit` mode so the admin can reactivate a method without
 * re-creating it. The toggle forwards `isActive` through the emitted edit
 * payload; the wrapper's API boundary (REQ-PM-002) accepts it (see
 * `paymentMethodsApi.update`).
 *
 * Whitelist on submit: `name`, `category`, `subtitle`, and (edit only)
 * `isActive`. The wrapper API strips `id` / `tenantId` / `createdAt` /
 * `updatedAt` / `metadataJson` at the boundary so even a buggy caller
 * cannot smuggle them through.
 */
const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    paymentMethod?: PaymentMethodTableRow | null
  }>(),
  {
    loading: false,
    paymentMethod: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreatePaymentMethodFormValues]
  edit: [payload: UpdatePaymentMethodFormValues]
}>()

const { schema, createState, editState, resetForm, setValues, setCreateField, setEditField } =
  usePaymentMethodForm(props.mode)

const title = computed(() => (props.mode === 'create' ? 'Crear método de cobro' : 'Editar método de cobro'))
const description = computed(() =>
  props.mode === 'create'
    ? 'Define el nombre, categoría y subtítulo del método. Se crea como activo.'
    : 'Actualiza el nombre, categoría, subtítulo o estado activo/inactivo.',
)

const formId = computed(() =>
  props.mode === 'create' ? 'create-payment-method-form' : 'edit-payment-method-form',
)

const activeState = computed(() => (props.mode === 'create' ? createState : editState))

// Build category options from the shared enum + label map (single source).
const categoryOptions = computed(() =>
  PAYMENT_METHOD_CATEGORY_VALUES.map((value) => ({
    value: value as PaymentMethodCategory,
    label: PAYMENT_METHOD_CATEGORY_LABELS[value],
  })),
)

// Prefill edit mode from the current row. `setValues` filters out foreign keys
// (id / tenantId / createdAt / updatedAt) so they never leak into the reactive
// form state. `isActive` IS forwarded (REQ-PM-003 REVERSAL).
watch(
  () => props.paymentMethod,
  (paymentMethod) => {
    if (props.mode === 'edit' && paymentMethod) {
      setValues({
        name: paymentMethod.name,
        category: paymentMethod.category,
        subtitle: paymentMethod.subtitle ?? '',
        isActive: paymentMethod.isActive,
      })
    }
  },
  { immediate: true },
)

// Reset the form when the slideover closes (no stale fields on reopen).
// We watch `open` (immediate + sync) so a v-model flip to false wipes the
// reactive state immediately rather than waiting for the USlideover's
// `after-leave` event (which the tests stub and cannot reliably emit).
watch(
  () => props.open,
  (open) => {
    if (!open) {
      resetForm()
    }
  },
)

function handleClose() {
  resetForm()
  open.value = false
}

function handleName(value: string) {
  if (props.mode === 'create') setCreateField('name', value)
  else setEditField('name', value)
}

function handleCategory(value: PaymentMethodCategory | string | undefined) {
  if (props.mode === 'create') setCreateField('category', value as PaymentMethodCategory)
  else setEditField('category', value as PaymentMethodCategory)
}

function handleSubtitle(value: string) {
  if (props.mode === 'create') setCreateField('subtitle', value)
  else setEditField('subtitle', value)
}

function handleIsActive(value: boolean) {
  if (props.mode !== 'edit') return
  setEditField('isActive', value)
}

function onSubmit(event: FormSubmitEvent<CreatePaymentMethodFormValues | UpdatePaymentMethodFormValues>) {
  if (props.mode === 'create') {
    const payload: CreatePaymentMethodFormValues = {
      name: (event.data as CreatePaymentMethodFormValues).name,
      category: (event.data as CreatePaymentMethodFormValues).category,
      subtitle: (event.data as CreatePaymentMethodFormValues).subtitle,
    }
    emit('create', payload)
  } else {
    const raw = event.data as UpdatePaymentMethodFormValues
    const payload: UpdatePaymentMethodFormValues = {
      name: raw.name,
      category: raw.category,
      subtitle: raw.subtitle,
      isActive: raw.isActive,
    }
    emit('edit', payload)
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
        <UFormField label="Nombre" name="name">
          <UInput
            :model-value="activeState.name"
            class="w-full"
            size="lg"
            placeholder="Ej: Mercado Pago"
            @update:model-value="handleName"
          />
        </UFormField>

        <UFormField label="Categoría" name="category">
          <USelect
            :model-value="activeState.category"
            :items="categoryOptions"
            class="w-full"
            size="lg"
            @update:model-value="handleCategory"
          />
        </UFormField>

        <UFormField label="Subtítulo (opcional)" name="subtitle" help="Hasta 120 caracteres. Aparece debajo del nombre en la pantalla de cobro.">
          <UInput
            :model-value="activeState.subtitle ?? ''"
            class="w-full"
            size="lg"
            placeholder="Ej: Link de pago"
            @update:model-value="handleSubtitle"
          />
        </UFormField>

        <UFormField
          v-if="props.mode === 'edit'"
          label="Estado"
          name="isActive"
          help="Desactivar oculta el método al cobrar. Reactivar lo vuelve a mostrar."
        >
          <div class="flex items-center gap-3">
            <USwitch
              :model-value="Boolean(editState.isActive)"
              data-testid="isActive-switch"
              @update:model-value="handleIsActive"
            />
            <span class="text-sm" :class="editState.isActive ? 'text-success' : 'text-muted'">
              {{ editState.isActive ? 'Activo' : 'Inactivo' }}
            </span>
          </div>
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="mode === 'create' ? 'Crear método' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>