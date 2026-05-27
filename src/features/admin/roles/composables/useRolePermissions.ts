import { computed, ref } from 'vue'
import type { GroupedPermissions } from '../interfaces/role.types'
import {
  getPermissionDescription,
  getPermissionLabel,
  getSubjectLabel,
  isSubjectHidden,
} from '../i18n/permissions'

export function useRolePermissions(groupedPermissions: () => GroupedPermissions) {
  const search = ref('')
  const expandedSubjects = ref<Set<string>>(new Set())
  const selectedPermissionIds = ref<Set<string>>(new Set())

  /**
   * Visible source = backend payload minus subjects we never want users
   * to interact with from this slideover (super-admin wildcards,
   * deprecated modules). See src/features/admin/roles/i18n/permissions.ts.
   */
  const visibleGrouped = computed<GroupedPermissions>(() => {
    const source = groupedPermissions()
    const visible: GroupedPermissions = {}
    for (const [subject, permissions] of Object.entries(source)) {
      if (isSubjectHidden(subject)) continue
      visible[subject] = permissions
    }
    return visible
  })

  const subjects = computed(() => Object.keys(visibleGrouped.value))

  const filteredSubjects = computed(() => {
    const searchTerm = search.value.trim().toLowerCase()
    const source = visibleGrouped.value

    if (!searchTerm) {
      return Object.entries(source)
    }

    return Object.entries(source)
      .map(([subject, permissions]) => {
        const subjectLabel = getSubjectLabel(subject).toLowerCase()
        const subjectMatches = subjectLabel.includes(searchTerm)

        const filteredPermissions = permissions.filter((permission) => {
          const code = `${subject}:${permission.action}`.toLowerCase()
          const backendDescription = (permission.description ?? '').toLowerCase()
          const humanLabel = getPermissionLabel(subject, permission.action).toLowerCase()
          const humanDescription = getPermissionDescription(subject, permission.action).toLowerCase()

          return (
            subjectMatches ||
            code.includes(searchTerm) ||
            backendDescription.includes(searchTerm) ||
            humanLabel.includes(searchTerm) ||
            humanDescription.includes(searchTerm)
          )
        })

        return [subject, filteredPermissions] as const
      })
      .filter(([, permissions]) => permissions.length > 0)
  })

  const totalPermissions = computed(() =>
    Object.values(visibleGrouped.value).reduce((acc, permissions) => acc + permissions.length, 0),
  )

  const selectedCount = computed(() => selectedPermissionIds.value.size)

  function isSubjectExpanded(subject: string) {
    return expandedSubjects.value.has(subject)
  }

  function toggleSubjectExpanded(subject: string) {
    const next = new Set(expandedSubjects.value)
    if (next.has(subject)) next.delete(subject)
    else next.add(subject)
    expandedSubjects.value = next
  }

  function isPermissionSelected(permissionId: string) {
    return selectedPermissionIds.value.has(permissionId)
  }

  function togglePermission(permissionId: string) {
    const next = new Set(selectedPermissionIds.value)
    if (next.has(permissionId)) next.delete(permissionId)
    else next.add(permissionId)
    selectedPermissionIds.value = next
  }

  function isSubjectChecked(subject: string) {
    const permissions = visibleGrouped.value[subject] ?? []
    if (permissions.length === 0) return false
    return permissions.every((permission) => selectedPermissionIds.value.has(permission.id))
  }

  function toggleSubject(subject: string) {
    const next = new Set(selectedPermissionIds.value)
    const permissions = visibleGrouped.value[subject] ?? []
    const allChecked = permissions.every((permission) => next.has(permission.id))

    permissions.forEach((permission) => {
      if (allChecked) next.delete(permission.id)
      else next.add(permission.id)
    })

    selectedPermissionIds.value = next
  }

  function setSelectedPermissions(permissionIds: string[]) {
    selectedPermissionIds.value = new Set(permissionIds)
  }

  function selectAll() {
    const next = new Set<string>()
    Object.values(visibleGrouped.value).forEach((permissions) => {
      permissions.forEach((permission) => next.add(permission.id))
    })
    selectedPermissionIds.value = next
  }

  function clearAll() {
    selectedPermissionIds.value = new Set()
  }

  function expandAll() {
    expandedSubjects.value = new Set(subjects.value)
  }

  return {
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
  }
}
