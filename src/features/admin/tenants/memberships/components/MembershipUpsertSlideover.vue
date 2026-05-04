<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import {
  useMembershipForm,
  type CreateMembershipFormValues,
  type UpdateMembershipFormValues,
} from '../composables/useMembershipForm'
import type { MembershipTableRow } from '../interfaces/membership.types'
import { useMembershipOptions } from '../composables/useMembershipOptions'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    tenantId: string
    loading?: boolean
    membership?: MembershipTableRow | null
  }>(),
  {
    loading: false,
    membership: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateMembershipFormValues]
  edit: [payload: UpdateMembershipFormValues]
}>()

const { schema, createState, editState, resetForm, setValues } = useMembershipForm(props.mode)
const { userOptions, roleOptions, isLoadingOptions } = useMembershipOptions(() => props.tenantId)

const title = computed(() =>
  props.mode === 'create' ? 'Agregar miembro' : 'Editar rol del miembro',
)

const description = computed(() =>
  props.mode === 'create'
    ? 'Seleccioná el usuario y asignale un rol en esta sucursal'
    : 'Cambiá el rol del miembro en esta sucursal',
)

const formId = computed(() =>
  props.mode === 'create' ? 'create-membership-form' : 'edit-membership-form',
)

const activeState = computed(() => (props.mode === 'create' ? createState : editState))

watch(
  () => props.membership,
  (membership) => {
    if (props.mode === 'edit' && membership) {
      setValues({
        roleId: membership.roleId,
      })
    }
  },
  { immediate: true },
)

function handleClose() {
  resetForm()
  open.value = false
}

function onSubmit(
  event: FormSubmitEvent<CreateMembershipFormValues | UpdateMembershipFormValues>,
) {
  if (props.mode === 'create') {
    emit('create', event.data as CreateMembershipFormValues)
  } else {
    emit('edit', event.data as UpdateMembershipFormValues)
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
        <template v-if="mode === 'create'">
          <UFormField label="Usuario" name="userId">
            <USelectMenu
              v-model="createState.userId"
              :items="userOptions"
              value-key="value"
              label-key="label"
              placeholder="Seleccioná un usuario"
              searchable
              class="w-full"
              size="lg"
            />
          </UFormField>
        </template>

        <template v-else>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700">Usuario</label>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p class="font-medium text-gray-900">{{ membership?.userName }}</p>
              <p class="text-sm text-gray-500">{{ membership?.userEmail }}</p>
            </div>
          </div>
        </template>

        <UFormField label="Rol" name="roleId">
          <USelectMenu
            v-model="activeState.roleId"
            :items="roleOptions"
            value-key="value"
            label-key="label"
            placeholder="Seleccioná un rol"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <p v-if="mode === 'create' && !isLoadingOptions && userOptions.length === 0" class="text-sm text-muted">
          No hay usuarios activos disponibles para agregar.
        </p>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="mode === 'create' ? 'Agregar miembro' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
