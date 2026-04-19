import { computed, ref } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { useRouter } from 'vue-router'

const colorMode = useColorMode()

type PermissionTuple = [AppAction, AppSubject]

interface GuardedNavigationMenuItem extends NavigationMenuItem {
  permission?: PermissionTuple
  children?: GuardedNavigationMenuItem[]
}

export const useSidebar = () => {
  const authStore = useAuthStore()
  const router = useRouter()

  const teams = ref([
    {
      label: 'HoundFe',
      avatar: {
        src: '/hounfeLogos/primary.png',
        alt: 'HoundFe',
      },
    },
  ])
  const selectedTeam = ref(teams.value[0])

  const teamsItems = computed<DropdownMenuItem[][]>(() => {
    return [
      teams.value.map((team, index) => ({
        ...team,
        kbds: ['meta', String(index + 1)],
        onSelect() {
          selectedTeam.value = team
        },
      })),
      [
        {
          label: 'Create team',
          icon: 'i-lucide-circle-plus',
        },
      ],
    ]
  })

  function getNavigationItems(collapsed: boolean): NavigationMenuItem[] {
    const canAccess = (permission?: PermissionTuple) => {
      if (!permission) return true
      return authStore.userCan(permission[0], permission[1])
    }

    const items: GuardedNavigationMenuItem[] = [
      {
        label: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        to: '/',
        exact: true,
      },
      {
        label: 'POS',
        icon: 'i-lucide-shopping-cart',
        defaultOpen: true,
        children: [
          {
            label: 'Productos',
            icon: 'i-lucide-package',
            to: '/pos/products',
            permission: ['read', 'Product'],
          },
          {
            label: 'Órdenes',
            icon: 'i-lucide-receipt',
            to: '/pos/orders',
            permission: ['read', 'Order'],
          },
          {
            label: 'Clientes',
            icon: 'i-lucide-users',
            to: '/pos/customers',
            // TODO: permission: ['read', 'Customer'],
          },
        ],
      },
      {
        label: 'Admin',
        icon: 'i-lucide-shield-check',
        defaultOpen: true,
        children: [
          {
            label: 'Usuarios',
            icon: 'i-lucide-users',
            to: '/admin/users',
            permission: ['read', 'User'],
          },
          {
            label: 'Roles',
            icon: 'i-lucide-user-cog',
            to: '/admin/roles',
            permission: ['read', 'Role'],
          },
        ],
      },
    ]

    return items
      .map((item) => {
        if (item.children && item.children.length > 0) {
          const visibleChildren = item.children
            .filter((child) => canAccess(child.permission))
            .map(({ permission: _permission, ...child }) => child)

          if (visibleChildren.length === 0) return null

          return {
            ...item,
            children: collapsed ? [] : visibleChildren,
          }
        }

        if (!canAccess(item.permission)) return null

        const { permission: _permission, ...visibleItem } = item
        return visibleItem
      })
      .filter((item): item is NavigationMenuItem => item !== null)
  }

  const user = computed(() => ({
    name: authStore.user?.name ?? 'HoundFe Admin',
    avatar: {
      alt: authStore.user?.name ?? 'HoundFe Admin',
      text: (authStore.user?.name ?? 'HA')
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join(''),
    },
  }))

  async function handleLogout() {
    await authStore.logout()
    await router.push('/login')
  }

  const userItems = computed<DropdownMenuItem[][]>(() => [
    [
      { label: 'Profile', icon: 'i-lucide-user' },
      { label: 'Settings', icon: 'i-lucide-settings' },
    ],
    [
      {
        label: 'Appearance',
        icon: 'i-lucide-sun-moon',
        children: [
          {
            label: 'Light',
            icon: 'i-lucide-sun',
            type: 'checkbox',
            checked: colorMode.value === 'light',
            onUpdateChecked(checked: boolean) {
              if (checked) colorMode.value = 'light'
            },
            onSelect(e: Event) {
              e.preventDefault()
            },
          },
          {
            label: 'Dark',
            icon: 'i-lucide-moon',
            type: 'checkbox',
            checked: colorMode.value === 'dark',
            onUpdateChecked(checked: boolean) {
              if (checked) colorMode.value = 'dark'
            },
            onSelect(e: Event) {
              e.preventDefault()
            },
          },
        ],
      },
    ],
    [{ label: 'Log out', icon: 'i-lucide-log-out', onSelect: handleLogout }],
  ])

  const changeColorMode = () => {
    colorMode.value = colorMode.value === 'light' ? 'dark' : 'light'
  }

  return {
    selectedTeam,
    teamsItems,
    user,
    userItems,
    getNavigationItems,
    changeColorMode,
  }
}
