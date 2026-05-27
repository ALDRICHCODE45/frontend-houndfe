<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { refDebounced } from '@vueuse/core'
import type { AxiosError } from 'axios'
import {
  useMembershipForm,
  type CreateMembershipFormValues,
  type UpdateMembershipFormValues,
} from '../composables/useMembershipForm'
import type { MembershipTableRow } from '../interfaces/membership.types'
import { mapEligibleUsersError } from '../api/memberships.api'
import { useEligibleUsersQuery } from '../composables/useEligibleUsersQuery'
import { useTenantRolesQuery } from '../composables/useTenantRolesQuery'

declare const useToast: () => {
  add: (options: {
    title?: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface UserSelectOption {
  label: string
  value: string
  email: string
  avatar: {
    alt: string
  }
}

interface RoleSelectOption {
  label: string
  value: string
}

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
const toast =
  typeof useToast === 'function'
    ? useToast()
    : (globalThis as unknown as { useToast?: () => ReturnType<typeof useToast> }).useToast?.() ?? {
        add: () => undefined,
      }

const emit = defineEmits<{
  create: [payload: CreateMembershipFormValues]
  edit: [payload: UpdateMembershipFormValues]
}>()

const { schema, createState, editState, resetForm, setValues } = useMembershipForm(props.mode)
const userSearchTerm = ref('')
const debouncedUserSearchTerm = refDebounced(userSearchTerm, 300)

const { users, isLoading: isLoadingUsers, isError: isEligibleUsersError, error: eligibleUsersError } =
  useEligibleUsersQuery(() => props.tenantId, debouncedUserSearchTerm)
const { roles, isLoading: isLoadingRoles } = useTenantRolesQuery(() => props.tenantId)

const userOptions = computed<UserSelectOption[]>(() =>
  users.value.map((user) => ({
    value: user.id,
    label: user.name,
    email: user.email,
    avatar: {
      alt: user.name,
    },
  })),
)

const roleOptions = computed<RoleSelectOption[]>(() => {
  const fetched = roles.value.map((role) => ({
    value: role.id,
    label: role.name,
  }))

  // In edit mode, seed the options with the membership's current role so that
  // USelectMenu can resolve its label immediately — even before
  // useTenantRolesQuery resolves, or if the role is no longer in the tenant's
  // role catalog. Prevents the raw UUID from leaking into the trigger.
  if (props.mode === 'edit' && props.membership) {
    const alreadyPresent = fetched.some((opt) => opt.value === props.membership!.roleId)
    if (!alreadyPresent) {
      return [
        { value: props.membership.roleId, label: props.membership.roleName },
        ...fetched,
      ]
    }
  }

  return fetched
})

const isLoadingOptions = computed(() => isLoadingUsers.value || isLoadingRoles.value)
const trimmedSearchTerm = computed(() => userSearchTerm.value.trim())
const isSingleCharSearch = computed(() => trimmedSearchTerm.value.length === 1)

function notifyEligibleUsersSearchError(error: AxiosError<{ message?: string; code?: string }> | null) {
  if (error?.response?.status !== 400) return

  const responseData = error.response.data
  const mappedMessage = mapEligibleUsersError(
    responseData?.code ?? responseData?.message ?? error.message ?? '',
  )
  toast.add({
    color: 'warning',
    description: mappedMessage,
  })
}

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

const selectedUserAvatar = computed(() => {
  const user = userOptions.value.find((u) => u.value === createState.userId)
  return user?.avatar
})

watch(isEligibleUsersError, (isError) => {
  if (!isError) return

  const axiosError = eligibleUsersError.value as AxiosError<{ message?: string; code?: string }> | null
  notifyEligibleUsersSearchError(axiosError)
}, { immediate: true })

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
  userSearchTerm.value = ''
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
              description-key="email"
              placeholder="Seleccioná un usuario"
              v-model:search-term="userSearchTerm"
              :search-input="{ placeholder: 'Escribí para buscar usuarios' }"
              :ignore-filter="true"
              :loading="isLoadingUsers"
              :avatar="selectedUserAvatar"
              class="w-full"
              size="lg"
            >
              <template #empty>
                <span v-if="isSingleCharSearch">Escribí al menos 2 caracteres para buscar usuarios</span>
                <span v-else>No hay usuarios activos disponibles para agregar.</span>
              </template>
            </USelectMenu>
          </UFormField>
        </template>

        <template v-else>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-highlighted">Usuario</label>
            <div class="rounded-lg border border-default bg-elevated/30 p-3">
              <p class="font-medium text-highlighted">{{ membership?.userName }}</p>
              <p class="text-sm text-muted">{{ membership?.userEmail }}</p>
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

        <p
          v-if="mode === 'create' && !isLoadingOptions && userOptions.length === 0 && !isSingleCharSearch"
          class="text-sm text-muted"
        >
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
