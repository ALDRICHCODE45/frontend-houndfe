<script setup lang="ts">
import './styles/unified-shell.css'

import { computed, nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createReusableTemplate } from '@vueuse/core'
import type { NavigationMenuItem } from '@nuxt/ui'
import { useSidebar } from '@/app/composables/useSidebar'
import { useDashboard } from '@/app/composables/useDashboard'
import { useBreadcrumb } from '@/app/composables/useBreadcrumb'
import { defineShortcuts } from '@nuxt/ui/runtime/composables/defineShortcuts.js'

const {
  currentTenantLabel,
  currentTenantSlug,
  showTenantSwitcher,
  teamsItems,
  tenantShortcuts,
  user,
  userItems,
  getNavigationItems,
  changeColorMode,
} = useSidebar()

const { isSidebarOpen, isSidebarCollapsed, isSearchOpen, searchGroups, openSearch } = useDashboard()

const { breadcrumb } = useBreadcrumb()

const route = useRoute()

// First LETTER of the label: the super-admin scope is "(Global)", whose first
// character is a parenthesis.
const tenantInitial = computed(
  () => currentTenantLabel.value.match(/\p{L}/u)?.[0]?.toUpperCase() ?? 'G',
)

const tenantTriggerLabel = computed(() => `Seleccionar sucursal: ${currentTenantLabel.value}`)

/**
 * The sidebar content is shared between the desktop rail and the mobile
 * drawer. The drawer always renders expanded (`collapsed = false`) so a
 * collapsed desktop rail never leaks an inaccessible icon-only drawer (S2/S4).
 */
const [DefineSidebarContent, ReuseSidebarContent] = createReusableTemplate({
  props: { collapsed: Boolean, inDrawer: Boolean },
})

/**
 * Route-aware active state. The shell CSS owns the visual treatment through
 * `.hf-shell-nav-active` on both group headings and child links. Kept local to
 * the layout so the composition layer decorates items and `useSidebar` keeps
 * only the unchanged CASL/permissioned item tree.
 */
function isActivePath(to: unknown, path: string): boolean {
  if (typeof to !== 'string') return false
  return path === to || path.startsWith(`${to}/`)
}

function navigationFor(collapsed: boolean): NavigationMenuItem[] {
  const path = route.path

  return getNavigationItems(collapsed).map((item) => {
    const children = item.children ?? []
    const childActive = children.some((child) => isActivePath(child.to, path))
    const selfActive = isActivePath(item.to, path)

    return {
      ...item,
      class: childActive || selfActive ? 'hf-shell-nav-active' : item.class,
      children: children.map((child) => ({
        ...child,
        class: isActivePath(child.to, path) ? 'hf-shell-nav-active' : child.class,
      })),
    }
  })
}

// `s-1` … `s-9` are chained: S, then the branch's list number. Like `o` and
// `t`, they are ignored while focus is in a text field.
defineShortcuts(
  computed(() => ({
    o: () => (isSidebarCollapsed.value = !isSidebarCollapsed.value),
    t: () => changeColorMode(),
    ...tenantShortcuts.value,
  })),
)

watch(isSearchOpen, async (open) => {
  if (open) return

  await nextTick()

  const activeElement = document.activeElement
  if (activeElement instanceof HTMLElement) {
    activeElement.blur()
  }
})
</script>

<template>
  <UDashboardGroup class="hf-shell" unit="px" storage="local" storage-key="hound-dashboard">
    <!--
      Shared sidebar content. One definition drives the desktop rail, the
      collapsed rail and the mobile drawer so the trio never drifts.
    -->
    <DefineSidebarContent v-slot="{ collapsed, inDrawer }">
      <!--
        S7: the brand row reuses the real login logo asset
        (`/hounfeLogos/primary.png`, the same file LoginHero renders) instead of
        the v0 text imitation. The CSS unit owns `.hf-shell-brand-logo` sizing,
        including the compact-rail rule.
      -->
      <div class="hf-shell-brand">
        <img src="/hounfeLogos/primary.png" alt="HounFe" class="hf-shell-brand-logo" />
      </div>

      <!-- Tenant switcher: real tenant data, existing dropdown behavior -->
      <div class="px-4 py-3">
        <UDropdownMenu
          v-if="showTenantSwitcher"
          :items="teamsItems"
          :content="{ align: 'start', collisionPadding: 12 }"
          :ui="{ content: 'hf-shell-portal hf-shell-menu hf-shell-tenant-menu' }"
        >
          <button type="button" class="hf-shell-tenant" :aria-label="tenantTriggerLabel">
            <span class="hf-shell-tenant-tile" aria-hidden="true">{{ tenantInitial }}</span>
            <span v-if="!collapsed" class="min-w-0 flex-1">
              <strong class="block truncate">{{ currentTenantLabel }}</strong>
              <small v-if="currentTenantSlug" class="block truncate text-muted">
                {{ currentTenantSlug }}
              </small>
            </span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 shrink-0" />
          </button>
        </UDropdownMenu>

        <!-- Single-tenant: label only, no switcher (existing behavior) -->
        <div v-else class="hf-shell-tenant">
          <span class="hf-shell-tenant-tile" aria-hidden="true">{{ tenantInitial }}</span>
          <span v-if="!collapsed" class="min-w-0 flex-1">
            <strong class="block truncate">{{ currentTenantLabel }}</strong>
            <small v-if="currentTenantSlug" class="block truncate text-muted">
              {{ currentTenantSlug }}
            </small>
          </span>
        </div>
      </div>

      <!-- Shell search trigger: opens the shared dashboard search -->
      <div class="px-4 pb-3">
        <UDashboardSearchButton :collapsed="collapsed" label="Buscar..." class="hf-shell-search" />
      </div>

      <UNavigationMenu
        class="hf-shell-nav"
        :items="navigationFor(collapsed)"
        :collapsed="collapsed"
        orientation="vertical"
        popover
        :ui="{ content: 'hf-shell-portal hf-shell-nav-portal' }"
      />

      <div class="hf-shell-footer">
        <UDashboardSidebarCollapse
          v-if="!collapsed && !inDrawer"
          variant="ghost"
          class="hf-shell-icon-button mr-auto"
        />

        <UDropdownMenu
          :items="userItems"
          :content="{ align: collapsed ? 'start' : 'end', collisionPadding: 12 }"
          :ui="{ content: 'min-w-48 hf-shell-portal hf-shell-menu' }"
        >
          <button type="button" class="hf-shell-user" aria-label="Abrir menú de usuario">
            <UAvatar :alt="user.avatar.alt" :text="user.avatar.text" size="sm" />
            <span v-if="!collapsed" class="min-w-0 flex-1 truncate">{{ user.name }}</span>
            <UIcon v-if="!collapsed" name="i-lucide-chevrons-up-down" class="size-4 shrink-0" />
          </button>
        </UDropdownMenu>
      </div>
    </DefineSidebarContent>

    <!-- Sidebar (desktop rail + mobile drawer) -->
    <UDashboardSidebar
      id="shell"
      v-model:open="isSidebarOpen"
      v-model:collapsed="isSidebarCollapsed"
      resizable
      collapsible
      :min-size="232"
      :default-size="256"
      :max-size="320"
      :collapsed-size="76"
      class="hf-shell-sidebar"
    >
      <template #default="{ collapsed }">
        <ReuseSidebarContent :collapsed="collapsed" :in-drawer="false" />
      </template>

      <!--
        Native mobile drawer. Overriding `#content` keeps the drawer expanded
        regardless of the desktop rail state, while the `hf-shell-portal`
        boundary repeats the shell palette for the teleported surface.
      -->
      <template #content="{ close }">
        <div
          class="hf-shell-sidebar hf-shell-portal hf-shell-drawer relative flex h-full flex-col"
          data-hf-shell-drawer
        >
          <ReuseSidebarContent :collapsed="false" :in-drawer="true" />

          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            aria-label="Cerrar navegación"
            class="hf-shell-drawer-close absolute end-2 top-2"
            @click="close"
          />
        </div>
      </template>
    </UDashboardSidebar>

    <!-- Main panel: workspace plane on the body, routed content untouched -->
    <UDashboardPanel id="main-panel" :ui="{ body: 'overflow-x-hidden hf-shell-workspace' }">
      <template #header>
        <!--
          The installed native UDashboardSidebarToggle stays enabled (`toggle`
          defaults to true) as the accessible mobile trigger below `lg`; the
          separate UDashboardSidebarCollapse in `#left` remains the desktop
          collapse control.
        -->
        <UDashboardNavbar
          class="hf-shell-navbar"
          :ui="{ left: 'gap-3', right: 'hf-shell-actions', toggle: 'size-11' }"
        >
          <template #left>
            <UDashboardSidebarCollapse
              variant="ghost"
              class="hf-shell-icon-button shrink-0"
            />

            <nav aria-label="breadcrumb" class="hf-shell-breadcrumb">
              <template v-for="(item, index) in breadcrumb" :key="index">
                <UIcon v-if="index > 0" name="i-lucide-chevron-right" class="size-3.5 shrink-0" />
                <span
                  :class="
                    index === breadcrumb.length - 1 ? 'hf-shell-breadcrumb-current' : undefined
                  "
                  :aria-current="index === breadcrumb.length - 1 ? 'page' : undefined"
                >
                  {{ item.label }}
                </span>
              </template>
            </nav>
          </template>

          <template #right>
            <UButton
              icon="i-lucide-search"
              color="neutral"
              variant="ghost"
              aria-label="Buscar"
              class="hf-shell-icon-button"
              :ui="{ leadingIcon: 'shrink-0 size-4.5' }"
              @click="openSearch"
            />
            <!--
              Notifications bell hidden: it had no action. Restore it here when
              a real notification center exists.
            -->
            <UColorModeButton
              class="hf-shell-icon-button"
              :ui="{ leadingIcon: 'shrink-0 size-4.5' }"
            />
            <UDropdownMenu
              :items="userItems"
              :content="{ align: 'end', collisionPadding: 12 }"
              :ui="{ content: 'min-w-48 hf-shell-portal hf-shell-menu' }"
            >
              <UButton
                :avatar="user.avatar"
                color="neutral"
                variant="ghost"
                square
                class="hf-shell-avatar-button"
                aria-label="Abrir menú de usuario"
              />
            </UDropdownMenu>
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <slot />
      </template>
    </UDashboardPanel>

    <!-- Global Search Modal -->
    <UDashboardSearch
      v-model:open="isSearchOpen"
      :groups="searchGroups"
      placeholder="Buscar páginas, acciones..."
      class="hf-shell-portal"
    />
  </UDashboardGroup>
</template>
