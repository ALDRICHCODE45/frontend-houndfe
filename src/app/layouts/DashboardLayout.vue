<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useSidebar } from '@/app/composables/useSidebar'
import { useDashboard } from '@/app/composables/useDashboard'
import { defineShortcuts } from '@nuxt/ui/runtime/composables/defineShortcuts.js'

const {
  tenants,
  currentTenantLabel,
  showTenantSwitcher,
  switchTenant,
  teamsItems,
  user,
  userItems,
  getNavigationItems,
  changeColorMode,
} = useSidebar()

const { isSidebarOpen, isSidebarCollapsed, isSearchOpen, searchGroups, openSearch } = useDashboard()

defineShortcuts({
  o: () => (isSidebarCollapsed.value = !isSidebarCollapsed.value),
  t: () => changeColorMode(),
})

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
  <UDashboardGroup storage="local" storage-key="hound-dashboard">
    <!-- Sidebar -->
    <UDashboardSidebar
      v-model:open="isSidebarOpen"
      v-model:collapsed="isSidebarCollapsed"
      resizable
      collapsible
      :min-size="15"
      :default-size="20"
      :max-size="30"
      :ui="{
        root: 'transition-[width] duration-200 ease-out',
        body: 'py-2 bg-coco-neutral-50 dark:bg-coco-neutral-950',
      }"
    >
      <!-- Header: Tenant selector -->
      <template #header="{ collapsed }">
        <UDropdownMenu
          v-if="!collapsed && showTenantSwitcher"
          :items="teamsItems"
          :content="{ align: 'start', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }"
        >
          <UButton
            :avatar="{ alt: currentTenantLabel, text: currentTenantLabel.charAt(0).toUpperCase() || 'G' }"
            :label="currentTenantLabel"
            trailing-icon="i-lucide-chevrons-up-down"
            color="neutral"
            variant="ghost"
            class="w-full data-[state=open]:bg-elevated overflow-hidden"
            :ui="{ trailingIcon: 'text-dimmed ms-auto', leadingAvatar: 'size-5' }"
          />
        </UDropdownMenu>

        <!-- Single-tenant: label only, no dropdown -->
        <UButton
          v-else-if="!collapsed && !showTenantSwitcher"
          :avatar="{ alt: currentTenantLabel, text: currentTenantLabel.charAt(0).toUpperCase() || 'G' }"
          :label="currentTenantLabel"
          color="neutral"
          variant="ghost"
          class="w-full overflow-hidden cursor-default"
          :ui="{ leadingAvatar: 'size-5' }"
        />

        <!-- Collapsed: show first letter of tenant name as avatar-like button -->
        <UAvatar
          v-else
          :alt="currentTenantLabel"
          :text="currentTenantLabel.charAt(0).toUpperCase()"
          size="sm"
        />
      </template>

      <!-- Body: Navigation + Search button -->
      <template #default="{ collapsed }">
        <UDashboardSearchButton
          :collapsed="collapsed"
          :ui="{ base: 'hover:bg-coco-gold-500/10' }"
        />

        <UDivider class="my-2" />

        <UNavigationMenu
          :items="getNavigationItems(collapsed)"
          orientation="vertical"
          highlight
          :ui="{
            link: 'p-1.5 overflow-hidden',
            linkLeadingIcon: 'size-4',
            linkLabel: 'text-dimmed group-data-[active=true]:text-coco-gold-500',
            linkActive: 'bg-coco-gold-500/10',
            linkLeadingIconActive: 'text-coco-gold-500',
          }"
        />
      </template>

      <!-- Footer: User dropdown + Collapse button -->
      <template #footer="{ collapsed }">
        <UDashboardSidebarCollapse
          v-if="!collapsed"
          variant="ghost"
          :ui="{ leadingIcon: 'text-coco-gold-500' }"
          class="mr-auto"
        />

        <UDropdownMenu
          :items="userItems"
          :content="{ align: collapsed ? 'start' : 'end', collisionPadding: 12 }"
          :ui="{
            itemLeadingIcon:
              'size-4 group-data-[checked=true]:text-coco-gold-500',
            content: 'min-w-48',
          }"
        >
          <UButton
            :avatar="user.avatar"
            :label="collapsed ? undefined : user.name"
            :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
            color="neutral"
            variant="ghost"
            :square="collapsed"
            class="data-[state=open]:bg-elevated overflow-hidden"
            :class="collapsed ? '' : 'w-full'"
            :ui="{ trailingIcon: 'text-dimmed ms-auto size-4', leadingIcon: 'size-2' }"
          />
        </UDropdownMenu>
      </template>
    </UDashboardSidebar>

    <!-- Main Panel -->
    <UDashboardPanel id="main-panel">
      <template #header>
        <UDashboardNavbar
          title="Coco"
          icon="i-lucide-layout-dashboard"
          :ui="{ title: 'text-coco-gold-500', leading: 'text-coco-gold-500' }"
        >
          <template #leading>
            <UDashboardSidebarCollapse
              variant="ghost"
              :ui="{ leadingIcon: 'text-coco-gold-500' }"
            />
          </template>

          <template #right>
            <UButton
              icon="i-lucide-search"
              color="neutral"
              variant="ghost"
              :ui="{ leadingIcon: 'shrink-0 size-4.5' }"
              @click="openSearch"
            />
            <UButton
              icon="i-lucide-bell"
              color="neutral"
              variant="ghost"
              :ui="{ leadingIcon: 'shrink-0 size-4.5' }"
            />
            <UColorModeButton :ui="{ leadingIcon: 'shrink-0 size-4.5' }" />
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
      :ui="{
        input: 'focus-visible:ring-coco-gold-500',
        groupLabel: 'text-coco-gold-700 dark:text-coco-gold-400',
        itemActive: 'bg-coco-gold-500/10',
      }"
    />
  </UDashboardGroup>
</template>
