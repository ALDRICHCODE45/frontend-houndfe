<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { rolesApi } from '../api/roles.api'
import { useRolePermissions } from '../composables/useRolePermissions'
import type { GroupedPermissions, RoleTableRow } from '../interfaces/role.types'

const props = withDefaults(
  defineProps<{
    role: RoleTableRow | null
    loading?: boolean
  }>(),
  {
    role: null,
    loading: false,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  save: [payload: { roleId: string; permissionIds: string[] }]
}>()

const groupedPermissions = ref<GroupedPermissions>({})

const permissionsQuery = useQuery({
  queryKey: adminRoleQueryKeys.permissions(),
  queryFn: () => rolesApi.getPermissionsGrouped(),
  enabled: computed(() => open.value),
})

const {
  search,
  filteredSubjects,
  selectedPermissionIds,
  selectedCount,
  totalPermissions,
  isSubjectExpanded,
  toggleSubjectExpanded,
  isPermissionSelected,
  togglePermission,
  isSubjectChecked,
  toggleSubject,
  setSelectedPermissions,
  selectAll,
  clearAll,
  expandAll,
} = useRolePermissions(() => groupedPermissions.value)

watch(
  () => permissionsQuery.data.value,
  (value) => {
    if (value) groupedPermissions.value = value
  },
  { immediate: true },
)

watch(
  () => open.value,
  async (isOpen) => {
    if (!isOpen || !props.role) return

    const [roleDetail, permissions] = await Promise.all([
      rolesApi.getById(props.role.id),
      permissionsQuery.refetch(),
    ])

    if (permissions.data) {
      groupedPermissions.value = permissions.data
    }

    const permissionCodeToId = new Map<string, string>()

    Object.entries(groupedPermissions.value).forEach(([subject, permissionsBySubject]) => {
      permissionsBySubject.forEach((permission) => {
        permissionCodeToId.set(`${subject}:${permission.action}`, permission.id)
      })
    })

    const selectedIds = roleDetail.permissions
      .map((permission) => permissionCodeToId.get(`${permission.subject}:${permission.action}`))
      .filter((value): value is string => Boolean(value))

    setSelectedPermissions(selectedIds)
    expandAll()
  },
)

function handleSave() {
  if (!props.role) return
  emit('save', {
    roleId: props.role.id,
    permissionIds: Array.from(selectedPermissionIds.value),
  })
}

function handleClose() {
  open.value = false
}

function getCode(subject: string, action: string) {
  return `${subject.toLowerCase()}:${action}`
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Asignar permisos"
    :description="`Seleccioná permisos para el rol ${role?.name ?? ''}`"
    side="right"
    inset
    :ui="{ content: '!max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar permisos..."
          class="w-full"
        />

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            label="Expandir todo"
            color="neutral"
            variant="outline"
            size="sm"
            @click="expandAll"
          />
          <UButton
            label="Seleccionar todo"
            color="neutral"
            variant="outline"
            size="sm"
            @click="selectAll"
          />
          <UButton
            label="Deseleccionar todo"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="clearAll"
          />
        </div>

        <div class="space-y-3 overflow-y-auto pr-1">
          <div
            v-for="[subject, permissions] in filteredSubjects"
            :key="subject"
            class="border border-default rounded-xl"
          >
            <button
              type="button"
              class="flex items-center justify-between w-full p-3 cursor-pointer"
              @click="toggleSubjectExpanded(subject)"
            >
              <div class="flex items-center gap-3">
                <UCheckbox
                  :model-value="isSubjectChecked(subject)"
                  @click.stop
                  @update:model-value="toggleSubject(subject)"
                />
                <span class="font-semibold">{{ subject }}</span>
                <UIcon
                  :name="
                    isSubjectExpanded(subject) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
                  "
                  class="size-4 text-muted"
                />
              </div>

              <UBadge
                :color="
                  permissions.filter((p) => isPermissionSelected(p.id)).length > 0
                    ? 'primary'
                    : 'neutral'
                "
                variant="subtle"
              >
                {{ permissions.filter((p) => isPermissionSelected(p.id)).length }}/{{
                  permissions.length
                }}
              </UBadge>
            </button>

            <div v-if="isSubjectExpanded(subject)" class="px-3 pb-3">
              <div class="border-l border-default pl-3 sm:pl-4 space-y-1.5">
                <label
                  v-for="permission in permissions"
                  :key="permission.id"
                  class="w-full rounded-lg border border-default p-2.5 sm:p-3 flex items-start gap-3 cursor-pointer hover:bg-elevated/50 transition-colors"
                >
                  <UCheckbox
                    :model-value="isPermissionSelected(permission.id)"
                    @update:model-value="togglePermission(permission.id)"
                  />

                  <div class="min-w-0">
                    <p class="font-mono text-sm text-primary truncate">
                      {{ getCode(subject, permission.action) }}
                    </p>
                    <p class="text-xs sm:text-sm text-muted">{{ permission.description }}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3"
      >
        <p class="text-sm text-muted">
          {{ selectedCount }} de {{ totalPermissions }} permisos seleccionados
        </p>
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <UButton
            label="Cancelar"
            color="neutral"
            variant="outline"
            class="flex-1 sm:flex-none"
            @click="handleClose"
          />
          <UButton
            label="Guardar permisos"
            class="flex-1 sm:flex-none"
            :loading="loading"
            @click="handleSave"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>
