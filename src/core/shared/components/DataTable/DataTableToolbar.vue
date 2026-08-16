<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref, useSlots } from 'vue'

const props = withDefaults(
  defineProps<{
    globalFilter: string
    searchPlaceholder?: string
    showAddButton?: boolean
    addButtonText?: string
    addButtonIcon?: string
    showColumnVisibility?: boolean
    showRefresh?: boolean
    fetching?: boolean
    /**
     * Optional `data-testid` for the refresh button. Default `undefined` —
     * no `data-testid` attribute is rendered. Forwarded by `AppDataTable`
     * so feature consumers can preserve legacy testids (REQ-QAF-016).
     */
    refreshButtonTestId?: string
    /**
     * Optional `data-testid` for the add button. Default `undefined` —
     * no `data-testid` attribute is rendered. Forwarded by `AppDataTable`
     * so feature consumers can preserve legacy testids (REQ-QAF-016).
     */
    addButtonTestId?: string
    /**
     * Number of active filters the view applies. Rendered as a `UBadge` next
     * to the "Filtros" trigger on mobile. Default `0` → no badge. Computed by
     * the consuming view from its existing filter state (status-tab, threshold,
     * includeInactive, etc.) — the toolbar itself does NOT derive the number.
     */
    activeFilterCount?: number
  }>(),
  {
    searchPlaceholder: 'Buscar...',
    addButtonText: 'Agregar',
    addButtonIcon: 'i-lucide-plus',
    showColumnVisibility: false,
    showRefresh: false,
    fetching: false,
    refreshButtonTestId: undefined,
    addButtonTestId: undefined,
    activeFilterCount: 0,
  },
)

const emit = defineEmits<{
  'update:globalFilter': [value: string]
  add: []
  refresh: []
}>()

// Table API injection for column visibility — provided by parent
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableApi = defineModel<any>('tableApi')

// ─── Mobile / desktop detection ──────────────────────────────────────────────
// `useBreakpoints(breakpointsTailwind).smaller('md')` evaluates to `true` for
// viewports strictly below Tailwind's `md` breakpoint (768px). At `md`+ the
// toolbar keeps the historical horizontal layout (inline filters beside search,
// actions right) — only mobile gets the three-region treatment.
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

// ─── Filters slot detection ────────────────────────────────────────────────
// Detect whether the `#filters` slot has content. AppDataTable always wraps the
// toolbar's `<template #filters>` so the wrapper here is non-null in
// integration; we therefore probe the slot by calling it once and counting
// the returned vnodes. When the slot vnodes are empty (e.g. Users / Roles /
// TenantMembers / Products — no `enableColumnVisibility` content) the
// "Filtros" trigger is hidden on mobile.
const slots = useSlots()
const hasFiltersSlot = computed(() => {
  const slotFn = slots.filters
  if (!slotFn) return false
  const vnodes = slotFn()
  return Array.isArray(vnodes) && vnodes.length > 0
})

// ─── Filters sheet (mobile only) ────────────────────────────────────────────
const isFiltersOpen = ref(false)
function openFilters() {
  if (!isMobile.value) return
  isFiltersOpen.value = true
}
function closeFilters() {
  isFiltersOpen.value = false
}

/** Capitalize first letter of a string (column-header fallback). */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <!-- ─── Desktop layout (md+) — historical horizontal layout ───────── -->
    <template v-if="!isMobile">
      <div class="flex flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <!-- Search Input -->
        <UInput
          :model-value="props.globalFilter"
          :placeholder="props.searchPlaceholder"
          icon="i-lucide-search"
          class="w-full sm:max-w-sm"
          @update:model-value="emit('update:globalFilter', $event as string)"
        />

        <!-- Inline filter slots (desktop only) -->
        <div class="min-w-0 flex flex-1 items-center gap-2">
          <slot name="filters" />
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Refresh Button -->
        <UTooltip v-if="showRefresh" text="Refrescar">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="fetching"
            :data-testid="refreshButtonTestId"
            @click="emit('refresh')"
          />
        </UTooltip>

        <!-- Column Visibility Dropdown -->
        <UDropdownMenu
          v-if="showColumnVisibility && tableApi"
          :items="
            tableApi
              .getAllColumns()
              .filter((col: any) => col.getCanHide())
              .map((col: any) => ({
                label:
                  typeof col.columnDef.header === 'string'
                    ? col.columnDef.header
                    : typeof col.columnDef.header === 'function'
                      ? col.columnDef.header() || capitalize(col.id)
                      : capitalize(col.id),
                icon: col.getIsVisible() ? 'i-lucide-circle-check-big' : 'i-lucide-circle',
                onSelect: (e: Event) => {
                  e.preventDefault()
                  col.toggleVisibility(!col.getIsVisible())
                },
              }))
          "
          :content="{ align: 'end' as const }"
          :ui="{
            itemLeadingIcon: 'size-4 text-primary',
          }"
        >
          <UButton
            color="neutral"
            variant="outline"
            label="Columnas"
            trailing-icon="i-lucide-chevron-down"
          />
        </UDropdownMenu>

        <!-- Add Button (kept last on desktop per historical layout) -->
        <UButton
          v-if="showAddButton"
          :label="addButtonText"
          :icon="addButtonIcon"
          :data-testid="addButtonTestId"
          @click="emit('add')"
        />

        <!-- Extra action slots -->
        <slot name="actions" />
      </div>
    </template>

    <!-- ─── Mobile layout (< md) — three fixed regions ─────────────────── -->
    <template v-else>
      <!-- Row 1 — search full-width -->
      <div
        class="flex w-full flex-col gap-2"
        data-testid="toolbar-mobile-search-row"
      >
        <UInput
          :model-value="props.globalFilter"
          :placeholder="props.searchPlaceholder"
          icon="i-lucide-search"
          class="w-full"
          @update:model-value="emit('update:globalFilter', $event as string)"
        />
      </div>

      <!-- Row 2 — actions cluster (flex-wrap, fixed order) -->
      <div
        v-if="showAddButton || showRefresh || showColumnVisibility || !!slots.actions"
        class="flex w-full flex-wrap items-center gap-2"
        data-testid="toolbar-mobile-actions-row"
      >
        <!-- Mobile order: add → refresh → Columnas → actions slot -->
        <UButton
          v-if="showAddButton"
          :icon="addButtonIcon"
          :aria-label="addButtonText"
          :title="addButtonText"
          :data-testid="addButtonTestId"
          @click="emit('add')"
        />

        <UTooltip v-if="showRefresh" text="Refrescar">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="fetching"
            :data-testid="refreshButtonTestId"
            @click="emit('refresh')"
          />
        </UTooltip>

        <UDropdownMenu
          v-if="showColumnVisibility && tableApi"
          :items="
            tableApi
              .getAllColumns()
              .filter((col: any) => col.getCanHide())
              .map((col: any) => ({
                label:
                  typeof col.columnDef.header === 'string'
                    ? col.columnDef.header
                    : typeof col.columnDef.header === 'function'
                      ? col.columnDef.header() || capitalize(col.id)
                      : capitalize(col.id),
                icon: col.getIsVisible() ? 'i-lucide-circle-check-big' : 'i-lucide-circle',
                onSelect: (e: Event) => {
                  e.preventDefault()
                  col.toggleVisibility(!col.getIsVisible())
                },
              }))
          "
          :content="{ align: 'end' as const }"
          :ui="{
            itemLeadingIcon: 'size-4 text-primary',
          }"
        >
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-columns-3"
            :aria-label="'Columnas'"
            :title="'Columnas'"
            trailing-icon="i-lucide-chevron-down"
            data-testid="toolbar-mobile-columns-button"
          />
        </UDropdownMenu>

        <slot name="actions" />
      </div>

      <!-- Row 3 — Filtros button + (optional) active-count badge -->
      <div
        v-if="hasFiltersSlot"
        class="flex w-full items-center gap-2"
        data-testid="toolbar-mobile-filters-row"
      >
        <UButton
          color="neutral"
          variant="outline"
          data-testid="toolbar-filtros-button"
          @click="openFilters"
        >
          <template #leading>
            <UIcon name="i-lucide-sliders-horizontal" />
          </template>
          Filtros
          <UBadge
            v-if="activeFilterCount > 0"
            :label="String(activeFilterCount)"
            color="primary"
            data-testid="toolbar-filtros-badge"
          />
        </UButton>
      </div>

      <!-- Filters bottom-sheet — scrollable ~85vh so landscape overflow
           doesn't clip controls (REQ: Landscape overflow). -->
      <USlideover
        v-if="hasFiltersSlot"
        v-model:open="isFiltersOpen"
        side="bottom"
        :dismissible="true"
      >
        <template #content>
          <div
            class="h-[85vh] max-h-[85vh] space-y-4 overflow-y-auto p-4"
            data-testid="toolbar-filters-content"
          >
            <slot name="filters" />
          </div>
        </template>
      </USlideover>
    </template>
  </div>
</template>
