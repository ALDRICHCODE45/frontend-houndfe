<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { rolesApi } from '../api/roles.api'
import { useRolePermissions } from '../composables/useRolePermissions'
import {
  getPermissionDescriptionOrFallback,
  getPermissionLabel,
  getSubjectLabel,
} from '../i18n/permissions'
import type { GroupedPermissions, RoleTableRow } from '../interfaces/role.types'
import {
  HfSelectableRows,
  type HfSelectableRowItem,
} from '@/core/shared/components/selection'
import '../styles/roles-visual.css'

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

type SubjectPermissions = readonly { id: string; action: string }[]

function toRows(subject: string, permissions: SubjectPermissions): HfSelectableRowItem[] {
  return permissions.map((permission) => ({
    value: permission.id,
    label: getPermissionLabel(subject, permission.action),
    description: getPermissionDescriptionOrFallback(subject, permission.action),
  }))
}

function permissionAction(permissions: SubjectPermissions, id: string) {
  return permissions.find((permission) => permission.id === id)?.action ?? ''
}

function selectedIn(permissions: SubjectPermissions) {
  return permissions.filter((permission) => isPermissionSelected(permission.id)).map((p) => p.id)
}

/** Replace the selection of the listed (visible) permissions; every other id stays. */
function setSubjectSelection(permissions: SubjectPermissions, ids: string[]) {
  const next = new Set(selectedPermissionIds.value)
  for (const permission of permissions) next.delete(permission.id)
  for (const id of ids) next.add(id)
  setSelectedPermissions([...next])
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Asignar permisos"
    :description="`Selecciona permisos para el rol ${role?.name ?? ''}`"
    side="right"
    inset
    :ui="{ content: '!max-w-2xl hf-theme hf-ui hf-form-overlay roles-form-portal' }"
  >
    <template #body>
      <div class="roles-perm">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Buscar permisos…"
          aria-label="Buscar permisos"
          class="w-full"
        />

        <div class="roles-perm-toolbar">
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

        <div class="roles-perm-subjects">
          <section
            v-for="[subject, permissions] in filteredSubjects"
            :key="subject"
            class="roles-perm-subject"
          >
            <button
              :id="`roles-perm-head-${subject}`"
              type="button"
              class="roles-perm-subject__head"
              :aria-expanded="isSubjectExpanded(subject)"
              :aria-controls="`roles-perm-body-${subject}`"
              @click="toggleSubjectExpanded(subject)"
            >
              <span class="roles-perm-subject__title">{{ getSubjectLabel(subject) }}</span>
              <span
                class="roles-perm-subject__count hf-figure"
                :class="{ 'is-some': selectedIn(permissions).length > 0 }"
              >
                {{ selectedIn(permissions).length }} de {{ permissions.length }}
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="roles-perm-subject__chevron"
                aria-hidden="true"
              />
            </button>

            <div
              v-if="isSubjectExpanded(subject)"
              :id="`roles-perm-body-${subject}`"
              class="roles-perm-subject__body"
            >
              <HfSelectableRows
                :items="toRows(subject, permissions)"
                :model-value="selectedIn(permissions)"
                :label="`Permisos de ${getSubjectLabel(subject)}`"
                :group-label="`Todos los permisos de ${getSubjectLabel(subject)}`"
                :count-label="false"
                @update:model-value="setSubjectSelection(permissions, $event)"
              >
                <template #option="{ item }">
                  <span class="roles-perm-option__label">{{ item.label }}</span>
                  <span class="hf-selectable-rows__desc">{{ item.description }}</span>
                  <code class="roles-perm-option__code">{{ getCode(subject, permissionAction(permissions, item.value)) }}</code>
                </template>
              </HfSelectableRows>
            </div>
          </section>
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

<style scoped>
/* Permissions by subject: one quiet list of disclosure rows; an open subject
 * shows its permissions as selectable rows (HfSelectableRows) with the subject
 * header toggling them all. Colors only from `--hf-*`. */
.roles-perm {
  display: grid;
  gap: 1rem;
}

.roles-perm-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.roles-perm-subjects {
  display: grid;
  border: 1px solid var(--hf-border);
  border-radius: var(--hf-radius-card, 12px);
  background: var(--hf-surface);
  overflow: hidden;
}

.roles-perm-subject + .roles-perm-subject {
  border-top: 1px solid var(--hf-border);
}

.roles-perm-subject__head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 52px;
  padding: 0.625rem 1rem;
  border: 0;
  background: transparent;
  color: var(--hf-ink);
  text-align: left;
  cursor: pointer;
}

.roles-perm-subject__head:hover {
  background: color-mix(in srgb, var(--hf-surface-muted) 45%, var(--hf-surface));
}

.roles-perm-subject__head:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: -2px;
}

.roles-perm-subject__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--hf-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roles-perm-subject__count {
  flex: none;
  font-size: 0.8125rem;
  color: var(--hf-muted);
}

.roles-perm-subject__count.is-some {
  font-weight: 600;
  color: var(--hf-ink);
}

.roles-perm-subject__chevron {
  flex: none;
  width: 1rem;
  height: 1rem;
  color: var(--hf-muted);
  transition: transform 0.15s;
}

.roles-perm-subject__head[aria-expanded='true'] .roles-perm-subject__chevron {
  transform: rotate(180deg);
}

.roles-perm-subject__body {
  padding: 0 1rem 1rem;
}

.roles-perm-option__label {
  font-size: 0.875rem;
  color: var(--hf-ink);
}

.roles-perm-option__code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  color: var(--hf-muted);
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .roles-perm-subject__chevron {
    transition: none;
  }
}
</style>
