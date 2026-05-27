<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { rolesApi } from '../api/roles.api'
import { useRolePermissions } from '../composables/useRolePermissions'
import {
  getPermissionDescription,
  getPermissionLabel,
  getSubjectLabel,
} from '../i18n/permissions'
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
              <div class="flex items-center gap-3 min-w-0">
                <UCheckbox
                  :model-value="isSubjectChecked(subject)"
                  @click.stop
                  @update:model-value="toggleSubject(subject)"
                />
                <span class="font-semibold truncate">{{ getSubjectLabel(subject) }}</span>
                <UIcon
                  :name="
                    isSubjectExpanded(subject) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
                  "
                  class="size-4 text-muted shrink-0"
                />
              </div>

              <AppBadge
                :tone="
                  permissions.filter((p) => isPermissionSelected(p.id)).length > 0
                    ? 'info'
                    : 'neutral'
                "
              >
                {{ permissions.filter((p) => isPermissionSelected(p.id)).length }}/{{
                  permissions.length
                }}
              </AppBadge>
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
                    class="mt-0.5"
                  />

                  <div class="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-highlighted">
                        {{ getPermissionLabel(subject, permission.action) }}
                      </p>
                      <p class="text-xs sm:text-sm text-muted">
                        {{ getPermissionDescription(subject, permission.action) || permission.description }}
                      </p>
                    </div>
                    <code class="font-mono text-xs text-muted/70 sm:shrink-0 sm:text-right break-all">
                      {{ getCode(subject, permission.action) }}
                    </code>
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
