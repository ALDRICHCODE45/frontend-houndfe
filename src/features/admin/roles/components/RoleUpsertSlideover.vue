<script setup lang="ts">
import { computed, watch } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useRoleForm, type RoleFormValues } from '../composables/useRoleForm'
import type { RoleTableRow } from '../interfaces/role.types'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    role?: RoleTableRow | null
    loading?: boolean
  }>(),
  {
    role: null,
    loading: false,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: RoleFormValues]
  edit: [payload: RoleFormValues]
}>()

const { schema, state, resetForm, setValues } = useRoleForm()

const title = computed(() => (props.mode === 'create' ? 'Crear rol' : 'Editar rol'))
const submitText = computed(() => (props.mode === 'create' ? 'Crear rol' : 'Guardar cambios'))

watch(
  () => props.role,
  (role) => {
    if (props.mode === 'edit' && role) {
      setValues({
        name: role.name,
        description: role.description ?? '',
      })
    }
  },
  { immediate: true },
)

function handleClose() {
  resetForm()
  open.value = false
}

function onSubmit(event: FormSubmitEvent<RoleFormValues>) {
  if (props.mode === 'create') emit('create', event.data)
  else emit('edit', event.data)
}
</script>

<template>
  <USlideover v-model:open="open" :title="title" side="right" inset @after-leave="resetForm">
    <template #body>
      <UForm id="role-form" :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Nombre" name="name">
          <UInput v-model="state.name" size="lg" class="w-full" placeholder="Ej: Reclutador" />
        </UFormField>

        <UFormField label="Descripción" name="description">
          <UTextarea
            v-model="state.description"
            class="w-full"
            :rows="4"
            placeholder="Descripción opcional del rol"
          />
        </UFormField>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton :label="submitText" type="submit" form="role-form" :loading="loading" />
      </div>
    </template>
  </USlideover>
</template>
