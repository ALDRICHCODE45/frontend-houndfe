<script setup lang="ts">
/**
 * ShippingBoxForm — create or edit one box (handoff §5). Sizes in cm with one
 * decimal, weights in kg (S4); the panel converts and sends. Client rules run
 * on submit; `serverErrors` come back on the field that caused them (S6).
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import type { BoxDraft, BoxErrors, BoxField } from '../utils/shippingBoxForm'
import { validateBoxDraft } from '../utils/shippingBoxForm'

const props = defineProps<{
  initial: BoxDraft
  editing: boolean
  saving?: boolean
  serverErrors?: BoxErrors
}>()

const emit = defineEmits<{ save: [draft: BoxDraft]; dirty: [dirty: boolean] }>()

const draft = reactive<BoxDraft>({ ...props.initial })
const clientErrors = shallowRef<BoxErrors>({})
const errors = computed<BoxErrors>(() => ({ ...clientErrors.value, ...props.serverErrors }))
const dirty = computed(() => (Object.keys(draft) as BoxField[]).some((field) => draft[field] !== props.initial[field]))
watch(dirty, (value) => emit('dirty', value), { immediate: true })

const SIZES: ReadonlyArray<{ field: BoxField; label: string }> = [
  { field: 'length', label: 'Largo' },
  { field: 'width', label: 'Ancho' },
  { field: 'height', label: 'Alto' },
]

const id = (field: BoxField) => `box-${field}`
const describedby = (field: BoxField) => `${id(field)}-message`
const invalid = (field: BoxField) => (errors.value[field] ? 'true' : 'false')

function submit() {
  if (props.saving) return
  clientErrors.value = validateBoxDraft(draft)
  if (Object.keys(clientErrors.value).length > 0) return
  emit('save', { ...draft })
}
</script>

<template>
  <form id="box-form" data-testid="box-form" class="box-form" novalidate @submit.prevent="submit">
    <HfFormField label="Nombre" :for="id('name')" :error="errors.name" required required-label="Obligatorio">
      <UInput
        :id="id('name')"
        v-model="draft.name"
        name="name"
        class="w-full"
        autocomplete="off"
        maxlength="80"
        :disabled="saving"
        :aria-describedby="describedby('name')"
        :aria-invalid="invalid('name')"
        :color="errors.name ? 'error' : undefined"
      />
    </HfFormField>

    <fieldset class="box-form__group">
      <legend class="box-form__legend">Medidas interiores</legend>
      <div class="box-form__sizes">
        <HfFormField v-for="size in SIZES" :key="size.field" :label="size.label" :for="id(size.field)" :error="errors[size.field]">
          <UInput
            :id="id(size.field)"
            v-model="draft[size.field]"
            :name="size.field"
            class="w-full hf-figure"
            inputmode="decimal"
            autocomplete="off"
            :disabled="saving"
            :aria-describedby="describedby(size.field)"
            :aria-invalid="invalid(size.field)"
            :color="errors[size.field] ? 'error' : undefined"
          >
            <template #trailing><span class="box-form__unit">cm</span></template>
          </UInput>
        </HfFormField>
      </div>
    </fieldset>

    <div class="box-form__weights">
      <HfFormField label="Peso de la caja vacía" :for="id('weightKg')" :error="errors.weightKg">
        <UInput
          :id="id('weightKg')"
          v-model="draft.weightKg"
          name="weightKg"
          class="w-full hf-figure"
          inputmode="decimal"
          autocomplete="off"
          :disabled="saving"
          :aria-describedby="describedby('weightKg')"
          :aria-invalid="invalid('weightKg')"
          :color="errors.weightKg ? 'error' : undefined"
        >
          <template #trailing><span class="box-form__unit">kg</span></template>
        </UInput>
      </HfFormField>
      <!-- No focus-only help here: it collapsed on blur and moved the submit button under the pointer. -->
      <HfFormField label="Carga máxima, sin contar la caja" :for="id('maxContentKg')" :error="errors.maxContentKg">
        <UInput
          :id="id('maxContentKg')"
          v-model="draft.maxContentKg"
          name="maxContentKg"
          class="w-full hf-figure"
          inputmode="decimal"
          autocomplete="off"
          :disabled="saving"
          :aria-describedby="describedby('maxContentKg')"
          :aria-invalid="invalid('maxContentKg')"
          :color="errors.maxContentKg ? 'error' : undefined"
        >
          <template #trailing><span class="box-form__unit">kg</span></template>
        </UInput>
      </HfFormField>
    </div>

    <div class="box-form__actions">
      <UButton type="submit" class="hf-primary-control min-h-11 justify-center" :loading="saving" :disabled="editing && !dirty">
        {{ editing ? 'Guardar cambios' : 'Crear caja' }}
      </UButton>
    </div>
  </form>
</template>

<style scoped>
.box-form { display: grid; gap: 20px; color: var(--hf-ink); }
.box-form__group { display: grid; gap: 8px; min-width: 0; border: 0; margin: 0; padding: 0; }
.box-form__legend { margin-bottom: 8px; color: var(--hf-heading); font-size: 14px; font-weight: 600; }
.box-form__sizes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.box-form__weights { display: grid; gap: 20px; }
.box-form__unit { color: var(--hf-muted); font-size: 13px; }
.box-form__actions { display: flex; justify-content: flex-end; border-top: 1px solid var(--hf-border); padding-top: 20px; }
@media (max-width: 767px) {
  .box-form__actions > * { width: 100%; }
}
</style>
