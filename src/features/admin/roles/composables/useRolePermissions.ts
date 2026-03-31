import { computed, ref } from 'vue'
import type { GroupedPermissions } from '../interfaces/role.types'

export function useRolePermissions(groupedPermissions: () => GroupedPermissions) {
  const search = ref('')
  const expandedSubjects = ref<Set<string>>(new Set())
  const selectedPermissionIds = ref<Set<string>>(new Set())

  const subjects = computed(() => Object.keys(groupedPermissions()))

  const filteredSubjects = computed(() => {
    const searchTerm = search.value.trim().toLowerCase()
    const source = groupedPermissions()

    if (!searchTerm) {
      return Object.entries(source)
    }

    return Object.entries(source)
      .map(([subject, permissions]) => {
        const filteredPermissions = permissions.filter((permission) => {
          const code = `${subject}:${permission.action}`.toLowerCase()
          const description = (permission.description ?? '').toLowerCase()
          return code.includes(searchTerm) || description.includes(searchTerm)
        })

        return [subject, filteredPermissions] as const
      })
      .filter(([, permissions]) => permissions.length > 0)
  })

  const totalPermissions = computed(() =>
    Object.values(groupedPermissions()).reduce((acc, permissions) => acc + permissions.length, 0),
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
    const permissions = groupedPermissions()[subject] ?? []
    if (permissions.length === 0) return false
    return permissions.every((permission) => selectedPermissionIds.value.has(permission.id))
  }

  function toggleSubject(subject: string) {
    const next = new Set(selectedPermissionIds.value)
    const permissions = groupedPermissions()[subject] ?? []
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
    Object.values(groupedPermissions()).forEach((permissions) => {
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
