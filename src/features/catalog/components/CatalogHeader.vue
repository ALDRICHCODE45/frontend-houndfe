<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useColorMode } from '@vueuse/core'
import { useCatalogStore } from '../composables/useCatalogStore'
import { useCatalogCart } from '../composables/useCatalogCart'
import type { PublicBranchDto } from '../interfaces/catalog.types'

const catalog = useCatalogStore()
const cart = useCatalogCart()
const colorMode = useColorMode()

const isDark = computed(() => colorMode.value === 'dark')

function toggleDarkMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}

const localSearch = ref(catalog.searchQuery)

let debounceTimer: ReturnType<typeof setTimeout> | undefined

function onSearchInput(value: string) {
  localSearch.value = value
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    catalog.setSearch(value)
  }, 300)
}

function handleBranchSelect(branch: PublicBranchDto) {
  catalog.selectBranch(branch)
  cart.setBranchName(branch.name)
}

const branchMenuItems = computed(() => [
  catalog.branches.map((b) => ({
    label: b.name,
    suffix: b.address ?? undefined,
    icon: catalog.selectedBranch?.id === b.id ? 'i-lucide-check' : undefined,
    onSelect: () => handleBranchSelect(b),
  })),
])
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6">
      <div class="flex items-center gap-3 sm:gap-4">
        <!-- Logo -->
        <div class="flex shrink-0 items-center gap-2">
          <div class="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
            <UIcon name="i-lucide-paw-print" class="size-5" />
          </div>
          <span class="hidden text-lg font-bold tracking-tight text-highlighted sm:block">HoundFe</span>
        </div>

        <!-- Branch selector -->
        <UDropdownMenu
          :items="branchMenuItems"
          :content="{ align: 'start' }"
          :ui="{ itemLeadingIcon: 'size-4 text-primary' }"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="shrink-0"
          >
            <template #leading>
              <UIcon name="i-lucide-map-pin" class="size-3.5 text-orange-500" />
            </template>
            <span class="hidden text-xs font-medium uppercase tracking-wide sm:inline">
              {{ catalog.selectedBranch?.name ?? 'Sucursal' }}
            </span>
            <span class="text-xs font-medium uppercase tracking-wide sm:hidden">
              {{ catalog.selectedBranch?.name?.replace('Sucursal ', '') ?? '...' }}
            </span>
            <template #trailing>
              <UIcon name="i-lucide-chevron-down" class="size-3.5" />
            </template>
          </UButton>
        </UDropdownMenu>

        <!-- Search -->
        <div class="relative min-w-0 flex-1">
          <UInput
            :model-value="localSearch"
            placeholder="Buscar croquetas, juguetes, marcas..."
            icon="i-lucide-search"
            size="sm"
            class="w-full"
            :ui="{ root: 'w-full' }"
            @update:model-value="onSearchInput($event as string)"
          />
        </div>

        <!-- Dark mode toggle -->
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          @click="toggleDarkMode"
        >
          <UIcon
            :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="size-4"
          />
        </UButton>

        <!-- Cart button -->
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="relative shrink-0"
          @click="cart.openCart()"
        >
          <template #leading>
            <UIcon name="i-lucide-shopping-bag" class="size-5" />
          </template>
          <UBadge
            v-if="cart.itemCount > 0"
            color="primary"
            size="xs"
            class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full p-0 text-[10px] font-bold"
          >
            {{ cart.itemCount }}
          </UBadge>
        </UButton>
      </div>
    </div>
  </header>
</template>
