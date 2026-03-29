import { computed, ref } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'

const colorMode = useColorMode()

export const useSidebar = () => {
  const teams = ref([
    {
      label: 'Hound',
      avatar: {
        src: 'https://github.com/nuxt.png',
        alt: 'Hound',
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
    ]
  }

  const user = ref({
    name: 'Hound Admin',
    avatar: {
      src: 'https://github.com/github.png',
      alt: 'Hound Admin',
    },
  })

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
    [{ label: 'Log out', icon: 'i-lucide-log-out' }],
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
