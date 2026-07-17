import { ref, computed } from 'vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { navigationGroups, quickActions } from '@/app/navigation/navigation.registry'
import {
  buildCanAccess,
  filterAccessibleActions,
  filterAccessibleGroups,
  toPaletteItems,
} from '@/app/navigation/navigation.access'

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
    const homeItem: CommandPaletteItem = { id: 'home', label: 'Home', icon: 'i-lucide-home', to: '/' }

    const pageItems: CommandPaletteItem[] = [
      homeItem,
      ...toPaletteItems(filterAccessibleGroups(navigationGroups, canAccess)),
    ]

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
