<script setup lang="ts">
import { useCatalogStore } from '../composables/useCatalogStore'

const catalog = useCatalogStore()
</script>

<template>
  <div class="border-b border-default bg-default/50">
    <div class="mx-auto max-w-7xl px-4 sm:px-6">
      <div class="flex items-center justify-between gap-4 py-3">
        <!-- Category chips -->
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
          <button
            v-for="cat in catalog.categoriesWithCounts"
            :key="cat.id ?? 'all'"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150"
            :class="
              catalog.selectedCategoryId === cat.id
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-200 dark:shadow-orange-900/50'
                : 'bg-default text-muted ring-1 ring-default hover:bg-orange-50 hover:text-orange-700 hover:ring-orange-200 dark:hover:bg-orange-950 dark:hover:text-orange-300 dark:hover:ring-orange-800'
            "
            @click="catalog.setCategory(cat.id)"
          >
            <span class="text-sm">{{ cat.emoji }}</span>
            <span>{{ cat.name }}</span>
            <span
              class="text-xs"
              :class="catalog.selectedCategoryId === cat.id ? 'text-orange-100' : 'text-dimmed'"
            >
              {{ cat.count }}
            </span>
          </button>
        </div>

        <!-- Sort dropdown -->
        <UDropdownMenu
          :items="[
            catalog.sortOptions.map((o) => ({
              label: o.label,
              icon: catalog.sortOption === o.value ? 'i-lucide-check' : undefined,
              onSelect: () => catalog.setSort(o.value),
            })),
          ]"
          :content="{ align: 'end' as const }"
          :ui="{ itemLeadingIcon: 'size-4 text-primary' }"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            class="shrink-0"
          >
            <template #leading>
              <UIcon name="i-lucide-arrow-up-down" class="size-3.5" />
            </template>
            <span class="hidden sm:inline">{{ catalog.selectedSortLabel }}</span>
            <template #trailing>
              <UIcon name="i-lucide-chevron-down" class="size-3" />
            </template>
          </UButton>
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
