<script setup lang="ts">
/**
 * ProductQuickCreateModal — One-field modal that creates a category or a brand
 * from the product form. Presentational: the owner validates the result,
 * runs the mutation and closes it.
 *
 * Props:
 *   title, label, placeholder — wording of the modal and its field
 *   formId       — id linking the footer submit button to the form
 *   schema       — zod schema of `{ name }`
 *   error        — server error shown under the field
 *   pending      — the create request is running
 *
 * Models:  open, name
 * Events:  submit(name) — the form validated; cancel — the user dismissed it
 */
import { reactive } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ZodType } from 'zod'

defineProps<{
  title: string
  label: string
  placeholder: string
  formId: string
  schema: ZodType<{ name: string }>
  error?: string
  pending?: boolean
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [name: string]
  cancel: []
}>()

const open = defineModel<boolean>('open', { required: true })
const name = defineModel<string>('name', { required: true })

// UForm needs one state object; this one reads and writes the `name` model.
const state = reactive({
  get name() {
    return name.value
  },
  set name(value: string) {
    name.value = value
  },
})

function onSubmit(event: FormSubmitEvent<{ name: string }>) {
  emit('submit', event.data.name)
}
</script>

<template>
  <UModal v-model:open="open" :title="title" :content="{ class: 'hf-theme hf-ui sm:max-w-lg' }">
    <template #body>
      <UForm :id="formId" :schema="schema" :state="state" class="space-y-3" @submit="onSubmit">
        <UFormField :label="label" name="name">
          <UInput v-model="state.name" :placeholder="placeholder" :disabled="pending" />
        </UFormField>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          type="button"
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="pending"
          @click="emit('cancel')"
        />
        <UButton
          :label="submitLabel ?? 'Guardar'"
          type="submit"
          :form="formId"
          color="primary"
          class="hf-primary-control"
          :loading="pending"
        />
      </div>
    </template>
  </UModal>
</template>
