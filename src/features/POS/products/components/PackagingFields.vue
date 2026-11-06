<script setup lang="ts">
/**
 * PackagingFields — The four packaging inputs (S4): weight in kg, length,
 * width and height in cm. Presentational: the owner keeps the text values,
 * validates them and shows each error under its field.
 *
 * Props:
 *   idPrefix — ids are `${idPrefix}-weight|length|width|height`
 *   errors   — messages by request field (weightG, lengthCm, …)
 *   disabled
 */
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import type { PackagingField } from '../interfaces/product-packaging.types'
import type { PackagingFieldErrors, PackagingFormInput } from '../utils/product-packaging-form'

const props = defineProps<{
  idPrefix: string
  errors: PackagingFieldErrors
  disabled?: boolean
}>()

const form = defineModel<PackagingFormInput>({ required: true })

interface FieldConfig {
  key: keyof PackagingFormInput
  field: PackagingField
  id: string
  label: string
  unit: string
  placeholder: string
  help?: string
}

const FIELDS: readonly Omit<FieldConfig, 'id'>[] = [
  { key: 'weightKg', field: 'weightG', label: 'Peso', unit: 'kg', placeholder: '1.25', help: 'Del paquete listo para enviar.' },
  { key: 'lengthCm', field: 'lengthCm', label: 'Largo', unit: 'cm', placeholder: '20.5' },
  { key: 'widthCm', field: 'widthCm', label: 'Ancho', unit: 'cm', placeholder: '12' },
  { key: 'heightCm', field: 'heightCm', label: 'Alto', unit: 'cm', placeholder: '8.5' },
]
const ID_SUFFIX: Record<PackagingField, string> = {
  weightG: 'weight',
  lengthCm: 'length',
  widthCm: 'width',
  heightCm: 'height',
}

const fields: FieldConfig[] = FIELDS.map((config) => ({
  ...config,
  id: `${props.idPrefix}-${ID_SUFFIX[config.field]}`,
}))

function update(key: keyof PackagingFormInput, value: string | number | null | undefined) {
  form.value = { ...form.value, [key]: value == null ? '' : String(value) }
}
</script>

<template>
  <HfFieldGrid>
    <HfFormField
      v-for="config in fields"
      :key="config.key"
      :label="config.label"
      :for="config.id"
      :help="config.help"
      :error="errors[config.field]"
      required
      required-label="Obligatorio"
    >
      <UInput
        :id="config.id"
        :model-value="form[config.key]"
        inputmode="decimal"
        autocomplete="off"
        class="w-full"
        :placeholder="config.placeholder"
        :disabled="disabled"
        :color="errors[config.field] ? 'error' : undefined"
        :aria-invalid="errors[config.field] ? 'true' : undefined"
        :aria-describedby="errors[config.field] || config.help ? `${config.id}-message` : undefined"
        :ui="{ trailing: 'pointer-events-none' }"
        @update:model-value="update(config.key, $event)"
      >
        <template #trailing>
          <span class="text-xs text-muted" aria-hidden="true">{{ config.unit }}</span>
        </template>
      </UInput>
    </HfFormField>
  </HfFieldGrid>
</template>
