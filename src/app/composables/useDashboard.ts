import { ref, computed } from 'vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { navigationGroups, quickActions } from '@/app/navigation/navigation.registry'
import {
  buildCanAccess,
  filterAccessibleActions,
  filterAccessibleGroups,
  stripMeta,
  toPaletteItems,
} from '@/app/navigation/navigation.access'
import { DASHBOARD_NAV_ITEM } from '@/app/navigation/navigation.landing'

// Shared state (singleton pattern)
const isSidebarOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isSearchOpen = ref(false)

export const useDashboard = () => {
  const authStore = useAuthStore()

  const canAccess = buildCanAccess(authStore)

  const toggleSidebarOpen = () => {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  const toggleSidebarCollapse = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  const openSearch = () => {
    isSearchOpen.value = true
  }

  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => {
    // ODD dashboard-analytics D1: shared permissioned Dashboard item sits at
    // the top of the pages list; the previous hardcoded "/" Home entry is
    // gone. Hidden without exact read:Analytics (same gate as sidebar).
    const dashboardItem: CommandPaletteItem | null = canAccess(
      DASHBOARD_NAV_ITEM.permission,
      DASHBOARD_NAV_ITEM.requiresSuperAdmin,
    )
      ? stripMeta({ ...DASHBOARD_NAV_ITEM })
      : null

    const paletteFromRegistry = toPaletteItems(filterAccessibleGroups(navigationGroups, canAccess))

    const pageItems: CommandPaletteItem[] = dashboardItem
      ? [dashboardItem, ...paletteFromRegistry]
      : paletteFromRegistry

    const actionItems: CommandPaletteItem[] = filterAccessibleActions(quickActions, canAccess)

    const groups: CommandPaletteGroup<CommandPaletteItem>[] = []

    if (pageItems.length > 0) {
      groups.push({
        id: 'pages',
        label: 'Páginas',
        items: pageItems,
      })
    }

    if (actionItems.length > 0) {
      groups.push({
        id: 'actions',
        label: 'Acciones',
        items: actionItems,
      })
    }

    return groups
  })

  return {
    isSidebarOpen,
    isSidebarCollapsed,
    isSearchOpen,
    searchGroups,
    toggleSidebarOpen,
    toggleSidebarCollapse,
    openSearch,
  }
}
