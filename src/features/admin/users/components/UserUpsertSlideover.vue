<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import {
  useUserForm,
  type CreateUserFormValues,
  type EditUserFormValues,
} from '../composables/useUserForm'
import { useAdminRolesQuery } from '../composables/useAdminRolesQuery'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { UserTableRow } from '../interfaces/user.types'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    user?: UserTableRow | null
  }>(),
  {
    loading: false,
    user: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateUserFormValues]
  edit: [payload: EditUserFormValues]
}>()

const { schema, createState, editState, resetForm, setEditName } = useUserForm(props.mode)

const authStore = useAuthStore()
const canReadRoles = computed(() => authStore.userCan('read', 'Role'))

const { roleOptions, isLoading: isLoadingRoles, isError: isRolesError } =
  useAdminRolesQuery(() => authStore.currentTenantId)

const title = computed(() => (props.mode === 'create' ? 'Crear usuario' : 'Editar usuario'))

const description = computed(() =>
  props.mode === 'create'
    ? 'Completá los datos para crear un nuevo usuario'
    : 'Actualizá el nombre del usuario',
)

const formId = computed(() => (props.mode === 'create' ? 'create-user-form' : 'edit-user-form'))

const activeState = computed(() => (props.mode === 'create' ? createState : editState))

watch(
  () => props.user,
  (user) => {
    if (props.mode === 'edit' && user) {
      setEditName(user.name)
    }
  },
  { immediate: true },
)

function handleClose() {
  resetForm()
  open.value = false
}

function onSubmit(event: FormSubmitEvent<CreateUserFormValues | EditUserFormValues>) {
  if (props.mode === 'create') {
    emit('create', event.data as CreateUserFormValues)
  } else {
    emit('edit', event.data as EditUserFormValues)
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
          <UInput v-model="activeState.name" class="w-full" size="lg" placeholder="Ej: Rodrigo" />
        </UFormField>

        <template v-if="mode === 'create'">
          <UFormField label="Email" name="email">
            <UInput
              v-model="createState.email"
              class="w-full"
              size="lg"
              type="email"
              placeholder="rodrigo@empresa.com"
            />
          </UFormField>

          <UFormField label="Contraseña" name="password">
            <UInput
              v-model="createState.password"
              class="w-full"
              size="lg"
              type="password"
              placeholder="********"
            />
          </UFormField>

          <UFormField label="Rol" name="roleId">
            <USelectMenu
              v-model="createState.roleId"
              :items="roleOptions"
              value-key="value"
              label-key="label"
              placeholder="Seleccioná un rol"
              :loading="isLoadingRoles"
              :disabled="!canReadRoles || isRolesError"
              class="w-full"
              size="lg"
            >
              <template #empty>
                <span v-if="!canReadRoles">No tenés permisos para listar roles.</span>
                <span v-else-if="isRolesError">No pudimos cargar los roles.</span>
                <span v-else>No hay roles disponibles.</span>
              </template>
            </USelectMenu>
          </UFormField>
        </template>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton
          :label="mode === 'create' ? 'Crear usuario' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>