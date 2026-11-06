<script setup lang="ts">
/**
 * ShippingOriginForm — the pickup address for carriers (handoff §6): one
 * section card, a calm save bar. Client rules run on Guardar; backend field
 * errors arrive through `serverErrors` (S6). Every PUT replaces the whole record.
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import {
  validateOriginDraft,
  type OriginDraft,
  type OriginErrors,
  type OriginField,
} from '../utils/shippingOriginForm'

const props = defineProps<{
  initial: OriginDraft
  /** A new origin (configured false) counts every filled field as a change. */
  creating: boolean
  saving?: boolean
  savedAt?: string | null
  serverErrors?: OriginErrors
  message?: string | null
}>()

const emit = defineEmits<{ save: [draft: OriginDraft]; dirty: [dirty: boolean]; discard: [] }>()

const draft = reactive<OriginDraft>({ ...props.initial })
const clientErrors = shallowRef<OriginErrors>({})
const errors = computed<OriginErrors>(() => ({ ...clientErrors.value, ...props.serverErrors }))

const FIELDS: ReadonlyArray<{
  field: OriginField
  label: string
  autocomplete: string
  inputmode?: 'numeric' | 'tel'
  required?: boolean
  full?: boolean
  help?: string
}> = [
  { field: 'addressLine1', label: 'Calle y número', autocomplete: 'address-line1', required: true, full: true },
  { field: 'addressLine2', label: 'Interior o referencia (opcional)', autocomplete: 'address-line2', full: true },
  { field: 'neighborhood', label: 'Colonia', autocomplete: 'off', required: true },
  { field: 'municipality', label: 'Alcaldía o municipio', autocomplete: 'address-level2', required: true },
  { field: 'state', label: 'Estado', autocomplete: 'address-level1', required: true },
  { field: 'postalCode', label: 'Código postal', autocomplete: 'postal-code', inputmode: 'numeric', required: true },
  {
    field: 'contactPhone',
    label: 'Teléfono de contacto',
    autocomplete: 'tel',
    inputmode: 'tel',
    required: true,
    help: 'La paquetería llama a este número para recoger.',
  },
]

const dirtyCount = computed(
  () => FIELDS.filter(({ field }) => draft[field] !== props.initial[field]).length + (props.creating ? 1 : 0),
)
watch(() => dirtyCount.value > 0, (dirty) => emit('dirty', dirty), { immediate: true })

const id = (field: OriginField) => `origin-${field}`

function save() {
  if (props.saving) return
  clientErrors.value = validateOriginDraft(draft)
  if (Object.keys(clientErrors.value).length > 0) return
  emit('save', { ...draft })
}

function discard() {
  Object.assign(draft, props.initial)
  clientErrors.value = {}
  emit('discard')
}
</script>

<template>
  <form class="origin-form" novalidate @submit.prevent="save">
    <HfSectionCard title="Dirección de recolección" :heading-level="3">
      <HfFieldGrid>
        <HfFormField
          v-for="item in FIELDS"
          :key="item.field"
          :span="item.full ? 'full' : undefined"
          :label="item.label"
          :for="id(item.field)"
          :help="item.help"
          :error="errors[item.field]"
          :required="item.required"
          required-label="Obligatorio"
        >
          <UInput
            :id="id(item.field)"
            v-model="draft[item.field]"
            :name="item.field"
            class="w-full"
            :class="{ 'hf-figure': item.inputmode }"
            :autocomplete="item.autocomplete"
            :inputmode="item.inputmode"
            :maxlength="item.field === 'postalCode' ? 5 : undefined"
            :disabled="saving"
            :aria-describedby="`${id(item.field)}-message`"
            :aria-invalid="errors[item.field] ? 'true' : 'false'"
            :color="errors[item.field] ? 'error' : undefined"
          />
        </HfFormField>
      </HfFieldGrid>
    </HfSectionCard>
    <HfSaveBar
      :dirty-count="dirtyCount"
      :saving="saving"
      :saved-at="savedAt ?? null"
      :error="message ?? null"
      :save-label="creating ? 'Guardar origen' : 'Guardar'"
      @save="save"
      @discard="discard"
    />
  </form>
</template>

<style scoped>
.origin-form { display: grid; gap: 16px; min-width: 0; }
</style>
