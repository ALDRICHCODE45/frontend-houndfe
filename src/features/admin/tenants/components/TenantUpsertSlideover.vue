<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import {
  useTenantForm,
  type CreateTenantFormValues,
  type EditTenantFormValues,
} from '../composables/useTenantForm'
import type { TenantTableRow } from '../interfaces/tenant.types'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    tenant?: TenantTableRow | null
  }>(),
  {
    loading: false,
    tenant: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateTenantFormValues]
  edit: [payload: EditTenantFormValues]
}>()

const { schema, createState, editState, resetForm, setValues, updateName, updateSlug } =
  useTenantForm(props.mode)

const title = computed(() => (props.mode === 'create' ? 'Crear sucursal' : 'Editar sucursal'))

const description = computed(() =>
  props.mode === 'create'
    ? 'Completá los datos para crear una nueva sucursal'
    : 'Actualizá los datos de la sucursal',
)

const formId = computed(() =>
  props.mode === 'create' ? 'create-tenant-form' : 'edit-tenant-form',
)

const activeState = computed(() => (props.mode === 'create' ? createState : editState))

watch(
  () => props.tenant,
  (tenant) => {
    if (props.mode === 'edit' && tenant) {
      setValues({
        name: tenant.name,
        slug: tenant.slug,
        address: tenant.address || '',
        phone: tenant.phone || '',
        isActive: tenant.isActive,
      })
    }
  },
  { immediate: true },
)

function handleClose() {
  resetForm()
  open.value = false
}

function onSubmit(event: FormSubmitEvent<CreateTenantFormValues | EditTenantFormValues>) {
  if (props.mode === 'create') {
    emit('create', event.data as CreateTenantFormValues)
  } else {
    emit('edit', event.data as EditTenantFormValues)
  }
}

function handleNameInput(value: string) {
  updateName(value)
}

function handleSlugInput(value: string) {
  updateSlug(value)
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
            placeholder="Ej: Sucursal Centro"
            @update:model-value="handleNameInput"
          />
        </UFormField>

        <UFormField label="Slug" name="slug">
          <UInput
            :model-value="activeState.slug"
            class="w-full"
            size="lg"
            placeholder="Ej: sucursal-centro"
            @update:model-value="handleSlugInput"
          />
        </UFormField>

        <UFormField label="Dirección" name="address">
          <UTextarea
            v-model="activeState.address"
            class="w-full"
            placeholder="Ej: Av. Principal 123"
            :rows="2"
          />
        </UFormField>

        <UFormField label="Teléfono" name="phone">
          <UInput
            v-model="activeState.phone"
            class="w-full"
            size="lg"
            placeholder="Ej: 555-1234"
          />
        </UFormField>

        <template v-if="mode === 'edit'">
          <UFormField label="Sucursal activa" name="isActive">
            <UToggle v-model="editState.isActive" />
          </UFormField>
        </template>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="mode === 'create' ? 'Crear sucursal' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
