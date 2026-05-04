import { computed, ref } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { useRouter } from 'vue-router'
import { mapTenantError } from '@/features/admin/tenants/api/tenants.api'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const colorMode = useColorMode()

type PermissionTuple = [AppAction, AppSubject]

interface GuardedNavigationMenuItem extends NavigationMenuItem {
  permission?: PermissionTuple
  requiresSuperAdmin?: boolean
  children?: GuardedNavigationMenuItem[]
}

export const useSidebar = () => {
  const authStore = useAuthStore()
  const router = useRouter()
  const toast = useToast()

  // ── Tenant switcher ─────────────────────────────────────────────────────────

  /** Real tenant list from auth store (replaces hardcoded teams) */
  const tenants = computed(() => authStore.memberships)

  /** Display label for the currently active tenant */
  const currentTenantLabel = computed(() => {
    if (authStore.isSuperAdmin && !authStore.currentTenant) {
      return '(Global)'
    }
    return authStore.currentTenant?.name ?? ''
  })

  /** Slug of the active tenant (for secondary display) */
  const currentTenantSlug = computed(() => authStore.currentTenant?.slug ?? '')

  /** Whether to render the tenant switcher dropdown */
  const showTenantSwitcher = computed(
    () => authStore.isSuperAdmin || authStore.memberships.length > 1,
  )

  /** Switch the active tenant — delegates to authStore which calls the API */
  async function switchTenant(tenantId: string | null) {
    try {
      await authStore.switchTenant(tenantId)
    } catch (error: unknown) {
      // Extract error code and map to user-facing message
      const axiosError = error as { response?: { status?: number; data?: { code?: string; message?: string } } }
      const errorCode = axiosError?.response?.data?.code
      const errorMessage = axiosError?.response?.data?.message

      const message = mapTenantError(errorCode || errorMessage || '')

      toast.add({
        title: 'Error al cambiar sucursal',
        description: message,
        color: 'error',
      })

      // User stays logged in — error is handled via toast
    }
  }

  // ── Legacy team dropdown items (kept for layout backwards-compat) ────────────
  /** @deprecated – kept for template compatibility while layout migrates */
  const teamsItems = computed<DropdownMenuItem[][]>(() => {
    const tenantItems: DropdownMenuItem[] = tenants.value.map((tenant, index) => {
      const isCurrentTenant = authStore.currentTenant?.id === tenant.id

      return {
        label: tenant.name,
        avatar: {
          alt: tenant.name,
          text: tenant.name.trim().charAt(0).toUpperCase() || 'S',
        },
        icon: isCurrentTenant ? 'i-lucide-check' : undefined,
        kbds: ['meta', String(index + 1)],
        onSelect() {
          void switchTenant(tenant.id)
        },
      }
    })

    if (authStore.isSuperAdmin) {
      tenantItems.unshift({
        label: '(Global)',
        avatar: {
          alt: 'Global',
          text: 'G',
        },
        icon: authStore.currentTenant ? undefined : 'i-lucide-check',
        onSelect() {
          void switchTenant(null)
        },
      })
    }

    return [tenantItems]
  })

  // Keep selectedTeam as a derived ref for legacy template compatibility
  const selectedTeam = ref({
    label: currentTenantLabel.value,
    avatar: {
      src: '/hounfeLogos/primary.png',
      alt: currentTenantLabel.value,
    },
  })

  function getNavigationItems(collapsed: boolean): NavigationMenuItem[] {
    const canAccess = (permission?: PermissionTuple, requiresSuperAdmin?: boolean) => {
      if (requiresSuperAdmin && !authStore.isSuperAdmin) return false
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
            label: 'Ventas',
            icon: 'i-lucide-shopping-cart',
            to: '/pos/ventas',
            permission: ['read', 'Sale'],
          },
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
            permission: ['read', 'Customer'],
          },
          {
            label: 'Promociones',
            icon: 'i-lucide-tag',
            to: '/pos/promociones',
            permission: ['read', 'Promotion'],
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
          {
            label: 'Sucursales',
            icon: 'i-lucide-building-2',
            to: '/admin/tenants',
            requiresSuperAdmin: true,
          },
        ],
      },
    ]

    return items
      .map((item) => {
        if (item.children && item.children.length > 0) {
          const visibleChildren = item.children
            .filter((child) => canAccess(child.permission, child.requiresSuperAdmin))
            .map(({ permission: _permission, requiresSuperAdmin: _requiresSuperAdmin, ...child }) => child)

          if (visibleChildren.length === 0) return null

          return {
            ...item,
            children: collapsed ? [] : visibleChildren,
          }
        }

        if (!canAccess(item.permission, item.requiresSuperAdmin)) return null

        const { permission: _permission, requiresSuperAdmin: _requiresSuperAdmin, ...visibleItem } = item
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
    // tenant switcher (new)
    tenants,
    currentTenantLabel,
    currentTenantSlug,
    showTenantSwitcher,
    switchTenant,
    // legacy
    selectedTeam,
    teamsItems,
    // user / navigation
    user,
    userItems,
    getNavigationItems,
    changeColorMode,
  }
}
