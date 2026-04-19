<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { reactive, watch } from 'vue'
import { z } from 'zod'
import { MEXICO_STATE_OPTIONS } from '../composables/useCustomerForm'
import type { CustomerAddress, CreateCustomerAddressPayload } from '../interfaces/customer.types'

const addressSchema = z.object({
  street: z
    .string({ required_error: 'La calle es obligatoria' })
    .trim()
    .min(1, 'La calle es obligatoria')
    .max(200, 'Máximo 200 caracteres'),
  exteriorNumber: z.string().trim().max(30, 'Máximo 30 caracteres'),
  interiorNumber: z.string().trim().max(30, 'Máximo 30 caracteres'),
  zipCode: z.string().trim().max(10, 'Máximo 10 caracteres'),
  neighborhood: z.string().trim().max(100, 'Máximo 100 caracteres'),
  municipality: z.string().trim().max(100, 'Máximo 100 caracteres'),
  city: z.string().trim().max(100, 'Máximo 100 caracteres'),
  state: z.string().trim(),
})

type AddressFormValues = z.infer<typeof addressSchema>

const props = withDefaults(
  defineProps<{
    open: boolean
    address?: CustomerAddress | null
    loading?: boolean
  }>(),
  {
    address: null,
    loading: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: CreateCustomerAddressPayload]
  close: []
}>()

const formState = reactive<AddressFormValues>({
  street: '',
  exteriorNumber: '',
  interiorNumber: '',
  zipCode: '',
  neighborhood: '',
  municipality: '',
  city: '',
  state: '',
})

function resetState() {
  Object.assign(formState, {
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    zipCode: '',
    neighborhood: '',
    municipality: '',
    city: '',
    state: '',
  })
}

watch(
  () => [props.open, props.address] as const,
  ([isOpen, address]) => {
    if (!isOpen) return

    if (address) {
      Object.assign(formState, {
        street: address.street,
        exteriorNumber: address.exteriorNumber ?? '',
        interiorNumber: address.interiorNumber ?? '',
        zipCode: address.zipCode ?? '',
        neighborhood: address.neighborhood ?? '',
        municipality: address.municipality ?? '',
        city: address.city ?? '',
        state: address.state ?? '',
      })
      return
    }

    resetState()
  },
  { immediate: true },
)

function handleSubmit(event: FormSubmitEvent<AddressFormValues>) {
  const payload: CreateCustomerAddressPayload = {
    street: event.data.street,
    ...(event.data.exteriorNumber ? { exteriorNumber: event.data.exteriorNumber } : {}),
    ...(event.data.interiorNumber ? { interiorNumber: event.data.interiorNumber } : {}),
    ...(event.data.zipCode ? { zipCode: event.data.zipCode } : {}),
    ...(event.data.neighborhood ? { neighborhood: event.data.neighborhood } : {}),
    ...(event.data.municipality ? { municipality: event.data.municipality } : {}),
    ...(event.data.city ? { city: event.data.city } : {}),
    ...(event.data.state ? { state: event.data.state } : {}),
  }
  emit('save', payload)
}

function handleClose() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <UModal
    :open="open"
    :title="address ? 'Editar dirección' : 'Añadir dirección'"
    :content="{ class: 'sm:max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        id="address-modal-form"
        :schema="addressSchema"
        :state="formState"
        class="space-y-4"
        @submit="handleSubmit"
      >
        <UFormField label="Calle" name="street" required>
          <UInput
            v-model="formState.street"
            class="w-full"
            size="lg"
            placeholder="Ej: Av. Insurgentes Sur"
            :disabled="loading"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Número Exterior" name="exteriorNumber">
            <UInput
              v-model="formState.exteriorNumber"
              class="w-full"
              size="lg"
              placeholder="Ej: 123"
              :disabled="loading"
            />
          </UFormField>

          <UFormField label="Número Interior" name="interiorNumber">
            <UInput
              v-model="formState.interiorNumber"
              class="w-full"
              size="lg"
              placeholder="Ej: 4B"
              :disabled="loading"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Código Postal" name="zipCode">
            <UInput
              v-model="formState.zipCode"
              class="w-full"
              size="lg"
              placeholder="Ej: 03100"
              :disabled="loading"
            />
          </UFormField>

          <UFormField label="Colonia" name="neighborhood">
            <UInput
              v-model="formState.neighborhood"
              class="w-full"
              size="lg"
              placeholder="Ej: Del Valle"
              :disabled="loading"
            />
          </UFormField>
        </div>

        <UFormField label="Municipio / Delegación" name="municipality">
          <UInput
            v-model="formState.municipality"
            class="w-full"
            size="lg"
            placeholder="Ej: Benito Juárez"
            :disabled="loading"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Ciudad" name="city">
            <UInput
              v-model="formState.city"
              class="w-full"
              size="lg"
              placeholder="Ej: Ciudad de México"
              :disabled="loading"
            />
          </UFormField>

          <UFormField label="Estado" name="state">
            <USelect
              v-model="formState.state"
              :items="MEXICO_STATE_OPTIONS"
              placeholder="Seleccionar"
              class="w-full"
              size="lg"
              :disabled="loading"
            />
          </UFormField>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="loading"
          @click="handleClose"
        />
        <UButton
          :label="address ? 'Guardar cambios' : 'Añadir dirección'"
          type="submit"
          form="address-modal-form"
          :loading="loading"
        />
      </div>
    </template>
  </UModal>
</template>
