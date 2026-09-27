<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import {
  useUserForm,
  sameRoleIds,
  type CreateUserFormValues,
  type EditUserFormValues,
} from '../composables/useUserForm'
import { useAdminRolesQuery } from '../composables/useAdminRolesQuery'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { UserTableRow } from '../interfaces/user.types'
import type { UserWithRolesResponse } from '../../shared/interfaces/rbac.types'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    user?: UserTableRow | null
    detail?: UserWithRolesResponse | null
    detailLoading?: boolean
    errorMessage?: string
    session?: number
  }>(),
  {
    loading: false,
    user: null,
    detail: null,
    detailLoading: false,
    errorMessage: '',
    session: 0,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateUserFormValues]
  edit: [payload: EditUserFormValues, session: number]
  retry: []
}>()

const { schema, createState, editState, resetForm } = useUserForm(props.mode)

const authStore = useAuthStore()
const canReadRoles = computed(() => authStore.userCan('read', 'Role'))

const {
  roleOptions,
  isLoading: isLoadingRoles,
  isError: isRolesError,
} = useAdminRolesQuery(() => authStore.currentTenantId)

const title = computed(() => (props.mode === 'create' ? 'Crear usuario' : 'Editar usuario'))

const description = computed(() =>
  props.mode === 'create'
    ? 'Completa los datos para crear un nuevo usuario'
    : 'Actualiza el nombre, email y roles del usuario',
)

const formId = computed(() => (props.mode === 'create' ? 'create-user-form' : 'edit-user-form'))

const initialDetail = ref<UserWithRolesResponse | null>(null)
const selectedRoleIds = ref<string[]>([])
const canUpdateUser = computed(() => authStore.userCan('update', 'User'))
const editReady = computed(
  () =>
    open.value &&
    canUpdateUser.value &&
    !!initialDetail.value &&
    props.detail?.user.id === props.user?.id,
)
const canEditRoles = computed(
  () =>
    editReady.value &&
    canReadRoles.value &&
    authStore.userCan('update', 'TenantMembership') &&
    !!authStore.currentTenantId &&
    !isLoadingRoles.value &&
    !isRolesError.value &&
    roleOptions.value.length > 0 &&
    (initialDetail.value?.roles ?? []).every((role) =>
      roleOptions.value.some((option) => option.value === role.id),
    ),
)
// Unavailable role editing must not make profile validation depend on a stale draft.
const activeState = computed(() =>
  props.mode === 'create'
    ? createState
    : {
        ...editState,
        roleIds: canEditRoles.value ? editState.roleIds : undefined,
      },
)

function resetEditor() {
  resetForm()
  initialDetail.value = null
  selectedRoleIds.value = []
}
watch(
  [open, () => props.user?.id, () => props.session, () => authStore.currentTenantId],
  resetEditor,
  { flush: 'sync' },
)
watch(
  () => props.detail,
  (detail) => {
    if (
      props.mode !== 'edit' ||
      !open.value ||
      initialDetail.value ||
      !detail ||
      detail.user.id !== props.user?.id
    )
      return
    // Keep the original baseline and dirty fields when a background refetch completes.
    initialDetail.value = {
      user: { ...detail.user },
      roles: detail.roles.map((role) => ({ ...role })),
    }
    editState.name = detail.user.name
    editState.email = detail.user.email
    selectedRoleIds.value = detail.roles.map((role) => role.id)
  },
  { immediate: true },
)

function updateRoles(ids: string[]) {
  if (!canEditRoles.value) return
  selectedRoleIds.value = [...ids]
  const originalIds = initialDetail.value?.roles.map((role) => role.id) ?? []
  editState.roleIds = sameRoleIds(ids, originalIds) ? undefined : [...ids]
}

function handleClose() {
  resetEditor()
  open.value = false
}

function onSubmit(event: FormSubmitEvent<CreateUserFormValues | EditUserFormValues>) {
  if (props.mode === 'create') {
    emit('create', event.data as CreateUserFormValues)
    return
  }
  if (!editReady.value || props.loading) return
  const result = schema.safeParse(activeState.value)
  if (!result.success) return
  const payload: EditUserFormValues = { name: editState.name }
  if (editState.email !== initialDetail.value?.user.email) payload.email = editState.email?.trim()
  if (canEditRoles.value && editState.roleIds) {
    if (!editState.roleIds.every((id) => roleOptions.value.some((option) => option.value === id)))
      return
    payload.roleIds = [...editState.roleIds]
  }
  emit('edit', payload, props.session)
}
</script>

<template>
  <USlideover v-model:open="open" :title="title" :description="description" side="right" inset>
    <template #body>
      <p v-if="mode === 'edit' && detailLoading" role="status">Cargando usuario…</p>
      <div v-if="errorMessage" role="alert" class="mb-4 text-error">
        <p>{{ errorMessage }}</p>
        <UButton
          v-if="!detail && !detailLoading"
          label="Reintentar"
          variant="link"
          @click="emit('retry')"
        />
      </div>
      <UForm
        :id="formId"
        :schema="schema"
        :state="activeState"
        :disabled="loading || (mode === 'edit' && !editReady)"
        class="space-y-4"
        @submit="onSubmit"
      >
        <UFormField label="Nombre" name="name">
          <UInput
            :model-value="activeState.name"
            @update:model-value="
              mode === 'create' ? (createState.name = $event) : (editState.name = $event)
            "
            class="w-full"
            size="lg"
            placeholder="Ej: Rodrigo"
          />
        </UFormField>

        <template v-if="mode === 'edit'">
          <UFormField label="Email" name="email">
            <UInput v-model="editState.email" type="email" class="w-full" size="lg" />
          </UFormField>
          <UFormField
            v-if="canReadRoles && authStore.userCan('update', 'TenantMembership')"
            label="Roles"
            name="roleIds"
          >
            <USelectMenu
              :model-value="selectedRoleIds"
              :items="roleOptions"
              multiple
              value-key="value"
              label-key="label"
              placeholder="Selecciona roles"
              :loading="isLoadingRoles"
              :disabled="!canEditRoles || loading"
              class="w-full"
              size="lg"
              @update:model-value="updateRoles"
            />
          </UFormField>
          <p v-if="initialDetail" class="text-sm text-muted">
            Roles actuales:
            {{ initialDetail.roles.map((role) => role.name).join(', ') || 'Sin roles' }}
          </p>
          <p v-if="editReady && !canEditRoles" class="text-sm text-muted">
            No se pueden editar los roles ahora. Los cambios de perfil conservarán los roles
            actuales.
          </p>
        </template>

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
              placeholder="Selecciona un rol"
              :loading="isLoadingRoles"
              :disabled="!canReadRoles || isRolesError"
              class="w-full"
              size="lg"
            >
              <template #empty>
                <span v-if="!canReadRoles">No tienes permisos para listar roles.</span>
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
          :disabled="loading || (mode === 'edit' && !editReady)"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
