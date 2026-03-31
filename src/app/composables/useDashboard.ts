import { ref, computed } from 'vue'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'

// Shared state (singleton pattern)
const isSidebarOpen = ref(false)
const isSidebarCollapsed = ref(false)
const isSearchOpen = ref(false)

export const useDashboard = () => {
  const toggleSidebarOpen = () => {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  const toggleSidebarCollapse = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }

  const openSearch = () => {
    isSearchOpen.value = true
  }

  const searchGroups = computed<CommandPaletteGroup<CommandPaletteItem>[]>(() => [
    {
      id: 'pages',
      label: 'Pages',
      items: [
        { id: 'home', label: 'Home', icon: 'i-lucide-home', to: '/' },
        {
          id: 'admin-users',
          label: 'Admin / Usuarios',
          icon: 'i-lucide-users',
          to: '/admin/users',
        },
        {
          id: 'admin-roles',
          label: 'Admin / Roles',
          icon: 'i-lucide-user-cog',
          to: '/admin/roles',
        },
      ],
    },
    {
      id: 'actions',
      label: 'Actions',
      items: [
        {
          id: 'new-order',
          label: 'New Order',
          icon: 'i-lucide-plus',
          onSelect: () => console.log('New order'),
        },
      ],
    },
  ])

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
