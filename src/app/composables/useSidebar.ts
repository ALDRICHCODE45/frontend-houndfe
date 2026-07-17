import { computed, ref } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useRouter } from 'vue-router'
import { mapTenantError } from '@/features/admin/tenants/api/tenants.api'
import { navigationGroups } from '@/app/navigation/navigation.registry'
import { buildCanAccess, filterAccessibleGroups, stripMeta } from '@/app/navigation/navigation.access'
import type { AccessMeta } from '@/app/navigation/navigation.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const colorMode = useColorMode()

interface GuardedNavigationMenuItem extends NavigationMenuItem, AccessMeta {
  children?: GuardedNavigationMenuItem[]
}

export const useSidebar = () => {
  const authStore = useAuthStore()
  const router = useRouter()
  const toast = useToast()

  // Access guard bound to this composable's auth store. buildCanAccess returns a
  // closure that reads isSuperAdmin/userCan live on each call, so hoisting it to
  // composable scope preserves the previous per-call reactive behavior.
  const canAccess = buildCanAccess(authStore)

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
    // Consumer-specific top-level extras (not part of the shared module tree).
    const topLevelExtras: GuardedNavigationMenuItem[] = [
      {
        label: 'Dashboard',
        icon: 'i-lucide-layout-dashboard',
        to: '/',
        exact: true,
      },
      {
        label: 'Nueva Venta',
        icon: 'i-lucide-plus-circle',
        to: '/pos/ventas/nueva',
        permission: ['update', 'Sale'],
      },
    ]

    const visibleExtras: NavigationMenuItem[] = topLevelExtras
      .filter((item) => canAccess(item.permission, item.requiresSuperAdmin))
      .map(stripMeta)

    // Shared module groups, derived from the registry through the access filter.
    const groupItems: NavigationMenuItem[] = filterAccessibleGroups(navigationGroups, canAccess).map(
      (group) => ({
        label: group.label,
        icon: group.icon,
        defaultOpen: group.defaultOpen,
        children: collapsed
          ? []
          : group.children.map((child) => ({
              label: child.label,
              icon: child.icon,
              to: child.to,
            })),
      }),
    )

    return [...visibleExtras, ...groupItems]
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
