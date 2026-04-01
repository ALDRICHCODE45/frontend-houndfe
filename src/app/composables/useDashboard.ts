import { ref, computed } from 'vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'

// Shared state (singleton pattern)
const isSidebarOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isSearchOpen = ref(false)

type PermissionTuple = [AppAction, AppSubject]

interface GuardedCommandPaletteItem extends CommandPaletteItem {
  permission?: PermissionTuple
}

export const useDashboard = () => {
  const authStore = useAuthStore()

  const canAccess = (permission?: PermissionTuple) => {
    if (!permission) return true
    return authStore.userCan(permission[0], permission[1])
  }

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
    const pageItems: GuardedCommandPaletteItem[] = [
      { id: 'home', label: 'Home', icon: 'i-lucide-home', to: '/' },
      {
        id: 'pos-products',
        label: 'POS / Productos',
        icon: 'i-lucide-package',
        to: '/pos/products',
        permission: ['read', 'Product'],
      },
      {
        id: 'pos-orders',
        label: 'POS / Órdenes',
        icon: 'i-lucide-receipt',
        to: '/pos/orders',
        permission: ['read', 'Order'],
      },
      {
        id: 'admin-users',
        label: 'Admin / Usuarios',
        icon: 'i-lucide-users',
        to: '/admin/users',
        permission: ['read', 'User'],
      },
      {
        id: 'admin-roles',
        label: 'Admin / Roles',
        icon: 'i-lucide-user-cog',
        to: '/admin/roles',
        permission: ['read', 'Role'],
      },
    ]

    const actionItems: GuardedCommandPaletteItem[] = [
      {
        id: 'new-order',
        label: 'New Order',
        icon: 'i-lucide-plus',
        onSelect: () => console.log('New order'),
        permission: ['create', 'Order'],
      },
    ]

    const visiblePages = pageItems
      .filter((item) => canAccess(item.permission))
      .map(({ permission: _permission, ...item }) => item)

    const visibleActions = actionItems
      .filter((item) => canAccess(item.permission))
      .map(({ permission: _permission, ...item }) => item)

    const groups: CommandPaletteGroup<CommandPaletteItem>[] = []

    if (visiblePages.length > 0) {
      groups.push({
        id: 'pages',
        label: 'Pages',
        items: visiblePages,
      })
    }

    if (visibleActions.length > 0) {
      groups.push({
        id: 'actions',
        label: 'Actions',
        items: visibleActions,
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
