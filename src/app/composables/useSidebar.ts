import { computed } from 'vue'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import { useColorMode } from '@vueuse/core'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useRouter } from 'vue-router'
import { mapTenantError } from '@/features/admin/tenants/api/tenants.api'
import { navigationGroups } from '@/app/navigation/navigation.registry'
import {
  buildCanAccess,
  filterAccessibleGroups,
  stripMeta,
} from '@/app/navigation/navigation.access'
import { DASHBOARD_NAV_ITEM } from '@/app/navigation/navigation.landing'
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
      const axiosError = error as {
        response?: { status?: number; data?: { code?: string; message?: string } }
      }
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

  // ── Branch switcher menu and shortcuts ─────────────────────────────────────────

  /**
   * Branches reachable by a single digit. The shortcut is the CHAINED `S` then
   * the list number: Ctrl/Cmd+digit is reserved by browsers for tab switching
   * and never reaches the page, which is why the old `CTRL N` hint never worked.
   */
  const MAX_TENANT_SHORTCUTS = 9

  function tenantShortcutKey(index: number): string | undefined {
    return index < MAX_TENANT_SHORTCUTS ? `s-${index + 1}` : undefined
  }

  /**
   * Branch switcher rows. The current branch is a checked row, so it keeps its
   * initial and the menu shows selection with a check instead of swapping the
   * avatar for an icon. Each row advertises exactly the shortcut that
   * `tenantShortcuts` registers.
   */
  const teamsItems = computed<DropdownMenuItem[][]>(() => {
    const tenantItems: DropdownMenuItem[] = tenants.value.map((tenant, index) => {
      const shortcut = tenantShortcutKey(index)

      return {
        label: tenant.name,
        description: tenant.slug || undefined,
        avatar: {
          alt: tenant.name,
          text: tenant.name.trim().charAt(0).toUpperCase() || 'S',
        },
        type: 'checkbox',
        checked: authStore.currentTenant?.id === tenant.id,
        kbds: shortcut ? shortcut.split('-') : undefined,
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
        type: 'checkbox',
        checked: !authStore.currentTenant,
        onSelect() {
          void switchTenant(null)
        },
      })
    }

    return [[{ type: 'label', label: 'Cambiar sucursal' }, ...tenantItems]]
  })

  /**
   * Keyboard map for `defineShortcuts`: `s-1` … `s-9` switch to the branch at
   * that list position, the same switch a click on that row performs. Empty
   * when no switcher is shown, so a single-branch user gets no dead shortcut.
   */
  const tenantShortcuts = computed<Record<string, () => void>>(() => {
    if (!showTenantSwitcher.value) return {}
    return Object.fromEntries(
      tenants.value.slice(0, MAX_TENANT_SHORTCUTS).map((tenant, index) => [
        tenantShortcutKey(index)!,
        () => void switchTenant(tenant.id),
      ]),
    )
  })

  // `collapsed` is part of the public call contract (the layout and its tests
  // pass the live rail state) but no longer changes the item tree: groups stay
  // closed for both the expanded rail and the compact popover (S6), and the
  // authorized children are always present so the popover can reach them (S2).
  function getNavigationItems(_collapsed: boolean): NavigationMenuItem[] {
    // Consumer-specific top-level extras (not part of the shared module tree).
    // ODD dashboard-analytics D1: Dashboard entry comes from the shared
    // navigation.landing definition so the sidebar and command palette stay
    // aligned. Nueva Venta keeps its pre-existing create-sale grant.
    const topLevelExtras: GuardedNavigationMenuItem[] = [
      {
        ...DASHBOARD_NAV_ITEM,
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
    //
    // S6: every group starts closed. The registry keeps its `defaultOpen` for
    // other consumers, but the sidebar no longer forwards it, so a freshly
    // mounted shell never auto-expands a group — not even the one containing
    // the active route. The user toggles groups through the native
    // NavigationMenu accordion.
    //
    // Children are kept even when `collapsed` is true: the collapsed rail
    // renders groups through the installed `UNavigationMenu` popover, so every
    // authorized destination must remain in the item tree (S2). The CASL
    // filter is unchanged — a group still disappears when it has no accessible
    // child.
    const groupItems: NavigationMenuItem[] = filterAccessibleGroups(
      navigationGroups,
      canAccess,
    ).map((group) => ({
      label: group.label,
      icon: group.icon,
      defaultOpen: false,
      children: group.children.map((child) => ({
        label: child.label,
        icon: child.icon,
        to: child.to,
      })),
    }))

    return [...visibleExtras, ...groupItems]
  }

  const user = computed(() => ({
    name: authStore.user?.name ?? 'Coco',
    avatar: {
      alt: authStore.user?.name ?? 'Coco',
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

  // Account menu: Mexican Spanish, and only actions that do something. The
  // former "Profile" and "Settings" entries had no destination.
  const userItems = computed<DropdownMenuItem[][]>(() => [
    [
      {
        label: 'Apariencia',
        icon: 'i-lucide-sun-moon',
        children: [
          {
            label: 'Claro',
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
            label: 'Oscuro',
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
    [{ label: 'Cerrar sesión', icon: 'i-lucide-log-out', onSelect: handleLogout }],
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
    teamsItems,
    tenantShortcuts,
    // user / navigation
    user,
    userItems,
    getNavigationItems,
    changeColorMode,
  }
}
