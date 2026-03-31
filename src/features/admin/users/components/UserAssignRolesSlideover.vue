<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { rolesApi } from '@/features/admin/roles/api/roles.api'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { usersApi } from '../api/users.api'
import type { UserTableRow } from '../interfaces/user.types'

const props = defineProps<{
  user: UserTableRow | null
  loading?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  save: [payload: { userId: string; roleIds: string[] }]
}>()

const selectedRoleIds = ref<string[]>([])

const rolesQuery = useQuery({
  queryKey: adminRoleQueryKeys.paginated(),
  queryFn: () =>
    rolesApi.getPaginated({ pageIndex: 0, pageSize: 100, sorting: [], globalFilter: '' }),
  enabled: computed(() => open.value),
})

const roleOptions = computed(() => rolesQuery.data.value?.data ?? [])

watch(
  () => open.value,
  async (isOpen) => {
    if (!isOpen || !props.user) return

    const detail = await usersApi.getById(props.user.id)
    selectedRoleIds.value = detail.roles.map((role) => role.id)
  },
)

function handleClose() {
  open.value = false
}

function toggleRole(roleId: string) {
  if (selectedRoleIds.value.includes(roleId)) {
    selectedRoleIds.value = selectedRoleIds.value.filter((id) => id !== roleId)
  } else {
    selectedRoleIds.value = [...selectedRoleIds.value, roleId]
  }
}

function handleSave() {
  if (!props.user) return
  emit('save', { userId: props.user.id, roleIds: selectedRoleIds.value })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Asignar roles"
    :description="`Seleccioná los roles para ${user?.name ?? ''}`"
    side="right"
    inset
  >
    <template #body>
      <div class="space-y-3">
        <template v-if="roleOptions.length">
          <div
            v-for="role in roleOptions"
            :key="role.id"
            class="border border-default rounded-lg px-4 py-3 flex items-center justify-between"
          >
            <div>
              <p class="font-medium">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted">{{ role.description }}</p>
            </div>

            <UCheckbox
              :model-value="selectedRoleIds.includes(role.id)"
              @update:model-value="toggleRole(role.id)"
            />
          </div>
        </template>

        <UAlert
          v-else
          title="Sin roles disponibles"
          description="Creá roles primero desde la sección de roles."
          color="neutral"
          variant="subtle"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleClose" />
        <UButton label="Guardar roles" :loading="loading" @click="handleSave" />
      </div>
    </template>
  </USlideover>
</template>
