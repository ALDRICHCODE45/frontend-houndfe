import { computed, ref } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useRouter } from 'vue-router'

const colorMode = useColorMode()

export const useSidebar = () => {
  const authStore = useAuthStore()
  const router = useRouter()

  const teams = ref([
    {
      label: 'HoundFe',
      avatar: {
        src: 'https://github.com/nuxt.png',
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
    return [
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
        children: collapsed
          ? []
          : [
              { label: 'Products', icon: 'i-lucide-package', to: '/pos/products' },
              { label: 'Orders', icon: 'i-lucide-receipt', to: '/pos/orders' },
            ],
      },
      {
        label: 'Admin',
        icon: 'i-lucide-shield-check',
        defaultOpen: true,
        children: collapsed
          ? []
          : [
              { label: 'Usuarios', icon: 'i-lucide-users', to: '/admin/users' },
              { label: 'Roles', icon: 'i-lucide-user-cog', to: '/admin/roles' },
            ],
      },
    ]
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
