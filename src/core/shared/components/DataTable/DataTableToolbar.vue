<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, ref, useSlots } from 'vue'
import DataTableColumnsPanel from './DataTableColumnsPanel.vue'
import type { ColumnGroup, ColumnsPanelGroups } from './columnArrange.utils'
import { DEFAULT_TABLE_DENSITY, type TableDensity } from './tableLayout'
import './mobile-list.css'

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
    /** Optional content class; existing consumers retain their current portal theme. */
    portalClass?: string
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
     * to the "Filtros" trigger on mobile and inside the sheet header so users
     * see how many filters are applied without scrolling. Default `0` → no
     * badge and no "Limpiar todo" action. Computed by the consuming view from
     * its existing filter state (status-tab, threshold, includeInactive, etc.)
     * — the toolbar itself does NOT derive the number (REQ-2 phase-1).
     */
    activeFilterCount?: number
    /**
     * Rows of the «Columnas» panel per group (AppDataTable builds them from its layout). Without them
     * a visible «Columnas» control stays in place, disabled.
     */
    columns?: ColumnsPanelGroups
    /** Keeps «Columnas» in place but disabled (no table to configure: first load, error). */
    columnsDisabled?: boolean
    /** «Columnas» opens the visibility-only sheet even at md+ (card mode). */
    columnsSheet?: boolean
    /**
     * The «Densidad» section at the top of the «Columnas» panel. The panel only opens at md+ outside
     * card mode, so the visibility sheet never shows it.
     */
    showDensity?: boolean
    density?: TableDensity
    densityDisabled?: boolean
    /** Shows «Guardado en tu vista» for a moment (AppDataTable owns the timing and the live region). */
    saved?: boolean
    /**
     * The server total of the current search and filters, for the phone «Filtros» sheet: its title
     * line and «Ver N resultados» (mobile-tables S4). The filters apply as they change, so the
     * number follows them.
     */
    resultCount?: number
    /** Noun of the records («cliente» / «clientes»). Default: «resultado» / «resultados». */
    itemLabel?: { one: string; other: string }
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
    columns: undefined,
    columnsDisabled: false,
    columnsSheet: false,
    showDensity: false,
    density: DEFAULT_TABLE_DENSITY,
    densityDisabled: false,
    saved: false,
    resultCount: 0,
    itemLabel: () => ({ one: 'resultado', other: 'resultados' }),
  },
)

const emit = defineEmits<{
  'update:globalFilter': [value: string]
  add: []
  refresh: []
  'clear-filters': []
  'column-place': [id: string, group: ColumnGroup, index: number]
  'column-step': [id: string, delta: number]
  'column-pin': [id: string, side: 'left' | 'right' | false]
  'column-visibility': [id: string, visible: boolean]
  'reset-columns': []
  'update:density': [density: TableDensity]
}>()

// ─── Mobile / desktop detection ──────────────────────────────────────────────
// `useBreakpoints(breakpointsTailwind).smaller('md')` evaluates to `true` for
// viewports strictly below Tailwind's `md` breakpoint (768px). At `md`+ the
// toolbar keeps the historical horizontal layout (inline filters beside search,
// actions right) — only mobile gets the two-row treatment.
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')

// ─── Filters slot detection ────────────────────────────────────────────────
// Detect whether the `#filters` slot has content. AppDataTable forwards the slot
// only when the screen provides it, and we still probe it once and count the
// returned vnodes so a slot that renders nothing (a v-if that is false) hides the
// "Filtros" trigger on mobile too.
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
const count = (n: number, one: string, other: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : other}`
const resultText = computed(() => count(props.resultCount, props.itemLabel.one, props.itemLabel.other))
const filtersSummary = computed(() =>
  props.activeFilterCount > 0
    ? `${count(props.activeFilterCount, 'filtro activo', 'filtros activos')} · ${resultText.value}`
    : resultText.value,
)
const filtrosName = computed(() =>
  props.activeFilterCount > 0
    ? `Filtros, ${count(props.activeFilterCount, 'activo', 'activos')}`
    : 'Filtros',
)
const filtersSheetClass = computed(() => [props.portalClass, 'hf-filters-sheet'].filter(Boolean).join(' '))
const hasActions = computed(() => props.showAddButton || props.showRefresh || !!slots.actions)

// ─── «Columnas»: popover panel at md+, visibility-only sheet below md or in card mode ──
const columnsEnabled = computed(() => !!props.columns && !props.columnsDisabled)
const useColumnsSheet = computed(() => isMobile.value || props.columnsSheet)
const columnRows = computed(() =>
  props.columns ? [...props.columns.left, ...props.columns.center, ...props.columns.right] : [],
)
const hiddenCount = computed(() => columnRows.value.filter(column => !column.visible).length)
const columnsName = computed(() => {
  const count = hiddenCount.value
  if (count === 0) return 'Columnas'
  return `Columnas · ${count} ${count === 1 ? 'oculta' : 'ocultas'}`
})
// The panel and the sheet render outside the app root, so they carry the theme themselves.
const columnsContentClass = computed(() =>
  [...new Set(['hf-theme', 'hf-ui', ...(props.portalClass?.split(/\s+/) ?? [])])].filter(Boolean).join(' '),
)
const isColumnsOpen = ref(false)
function openColumnsSheet() {
  if (columnsEnabled.value) isColumnsOpen.value = true
}
</script>

<template>
  <div
    class="hf-toolbar flex w-full min-w-0 max-w-full flex-col gap-3 md:flex-row md:items-center md:justify-between"
    :class="{ 'hf-toolbar--mobile': isMobile }"
  >
    <!-- ─── Desktop layout (md+) — historical horizontal layout ───────── -->
    <template v-if="!isMobile">
      <div
        class="hf-toolbar-search-region flex min-w-0 flex-1 flex-col items-stretch gap-2 sm:flex-row sm:items-center"
      >
        <!-- Search Input -->
        <UInput
          :model-value="props.globalFilter"
          :placeholder="props.searchPlaceholder"
          icon="i-lucide-search"
          class="hf-toolbar-search w-full min-w-48 shrink sm:max-w-sm"
          @update:model-value="emit('update:globalFilter', $event as string)"
        />

        <!-- Inline filter slots (desktop only) -->
        <div class="hf-toolbar-filters min-w-0 flex flex-1 shrink-0 basis-auto items-center gap-2">
          <slot name="filters" />
        </div>
      </div>

      <!-- shrink-0: when space runs out the search gives way first; actions never slide over the filters. -->
      <div class="hf-toolbar-actions flex shrink-0 items-center gap-2">
        <!-- «Guardado en tu vista»: a quiet visual echo; the words are read from AppDataTable's status -->
        <Transition name="hf-table-saved">
          <span v-if="props.saved" class="hf-table-saved" aria-hidden="true" data-testid="table-saved">
            <UIcon name="i-lucide-check" class="hf-table-saved__icon" />Guardado en tu vista
          </span>
        </Transition>

        <!-- Refresh Button -->
        <UTooltip v-if="showRefresh" text="Refrescar" :ui="{ content: props.portalClass }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="fetching"
            :data-testid="refreshButtonTestId"
            @click="emit('refresh')"
          />
        </UTooltip>

        <!-- «Columnas»: the artboard-01 panel (sections, drag, pin, visibility, reset) -->
        <template v-if="showColumnVisibility">
          <UPopover
            v-if="columnsEnabled && !useColumnsSheet"
            v-model:open="isColumnsOpen"
            :content="{ align: 'end', sideOffset: 6 }"
            :ui="{ content: columnsContentClass }"
          >
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-columns-3"
              :aria-label="columnsName"
              data-testid="toolbar-columns-button"
            >
              Columnas
              <UBadge
                v-if="hiddenCount > 0"
                :label="String(hiddenCount)"
                color="neutral"
                variant="soft"
                size="sm"
                aria-hidden="true"
                data-testid="toolbar-columns-badge"
              />
            </UButton>
            <template #content>
              <DataTableColumnsPanel
                :groups="props.columns!"
                :density="props.showDensity ? props.density : undefined"
                :density-disabled="props.densityDisabled"
                @place="(id, group, index) => emit('column-place', id, group, index)"
                @step="(id, delta) => emit('column-step', id, delta)"
                @pin="(id, side) => emit('column-pin', id, side)"
                @visibility="(id, visible) => emit('column-visibility', id, visible)"
                @reset="emit('reset-columns')"
                @close="isColumnsOpen = false"
                @density="emit('update:density', $event)"
              />
            </template>
          </UPopover>
          <UButton
            v-else
            color="neutral"
            variant="outline"
            icon="i-lucide-columns-3"
            :aria-label="columnsName"
            :disabled="!columnsEnabled"
            data-testid="toolbar-columns-button"
            @click="openColumnsSheet"
          >
            Columnas
            <UBadge
              v-if="hiddenCount > 0"
              :label="String(hiddenCount)"
              color="neutral"
              variant="soft"
              size="sm"
              aria-hidden="true"
              data-testid="toolbar-columns-badge"
            />
          </UButton>
        </template>

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

    <!-- ─── Phone layout (< md, design/mobile-tables 01) ────────────────────
         The root is `display: contents` (hf-toolbar--mobile) so these blocks sit in AppDataTable's
         column: the actions row scrolls away like a page header's primary, while the search,
         «Filtros (N)» and the result line (#mobile-status) stay stuck under the app bar. -->
    <template v-else>
      <div
        v-if="hasActions"
        class="hf-toolbar-actions hf-mtool-actions flex w-full min-w-0 max-w-full items-center justify-end gap-2"
        data-testid="toolbar-mobile-actions-row"
      >
        <UTooltip v-if="showRefresh" text="Refrescar" :ui="{ content: props.portalClass }">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="fetching"
            :data-testid="refreshButtonTestId"
            @click="emit('refresh')"
          />
        </UTooltip>

        <slot name="actions" />

        <UButton
          v-if="showAddButton"
          :label="addButtonText"
          :icon="addButtonIcon"
          :data-testid="addButtonTestId"
          @click="emit('add')"
        />
      </div>

      <div class="hf-mtool" data-testid="toolbar-mobile-sticky">
        <div class="hf-mtool__r1" data-testid="toolbar-mobile-controls-row">
          <div class="hf-toolbar-search-region hf-mtool__search" data-testid="toolbar-mobile-search-row">
            <UInput
              :model-value="props.globalFilter"
              :placeholder="props.searchPlaceholder"
              icon="i-lucide-search"
              class="hf-toolbar-search w-full"
              @update:model-value="emit('update:globalFilter', $event as string)"
            />
          </div>

          <div v-if="hasFiltersSlot" class="hf-toolbar-filters shrink-0" data-testid="toolbar-mobile-filters-row">
            <UButton
              color="neutral"
              variant="outline"
              class="hf-mtool__filtros"
              :class="{ 'has-filters': activeFilterCount > 0 }"
              :aria-label="filtrosName"
              data-testid="toolbar-filtros-button"
              @click="openFilters"
            >
              <template #leading>
                <UIcon name="i-lucide-sliders-horizontal" />
              </template>
              Filtros
              <span
                v-if="activeFilterCount > 0"
                class="hf-mtool__count"
                aria-hidden="true"
                data-testid="toolbar-filtros-badge"
              >{{ activeFilterCount }}</span>
            </UButton>
          </div>

          <UButton
            v-if="showColumnVisibility"
            color="neutral"
            variant="outline"
            icon="i-lucide-columns-3"
            class="hf-mtool__columns"
            :aria-label="columnsName"
            title="Columnas"
            :disabled="!columnsEnabled"
            data-testid="toolbar-mobile-columns-button"
            @click="openColumnsSheet"
          >
            <UBadge
              v-if="hiddenCount > 0"
              :label="String(hiddenCount)"
              color="neutral"
              variant="soft"
              size="sm"
              aria-hidden="true"
              data-testid="toolbar-columns-badge"
            />
          </UButton>
        </div>

        <slot name="mobile-status" />
      </div>

      <!-- Filtros sheet (board 03): full height with 16px top corners, a handle, the title with the
           active filters and the server total, ✕; the views' filter sections scroll in the body;
           the sticky footer clears («Limpiar (N)») or closes on the result («Ver N resultados»).
           The filters apply as they change, so «Ver…» only closes. Sort is not here on phones: the
           result line has its own short menu. -->
      <USlideover
        v-if="hasFiltersSlot"
        v-model:open="isFiltersOpen"
        side="bottom"
        :dismissible="true"
        :ui="{ content: filtersSheetClass }"
      >
        <template #content>
          <div class="hf-filters-sheet__layout flex h-full min-h-0 flex-col" data-testid="toolbar-filters-layout">
            <span class="hf-filters-sheet__handle" aria-hidden="true" />
            <header class="hf-filters-sheet__head" data-testid="toolbar-filters-header">
              <h2 class="hf-filters-sheet__title">
                <slot name="filters-title">Filtros</slot>
                <small data-testid="toolbar-filters-summary">{{ filtersSummary }}</small>
              </h2>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                class="hf-filters-sheet__close"
                aria-label="Cerrar filtros"
                data-testid="toolbar-filters-close"
                @click="closeFilters"
              />
            </header>

            <!-- Renders the #filters slot DIRECTLY so leaf components relying on provide/inject +
                 Teleport (e.g. USelect's Reka UI popover) keep their parentage. `hf-filters-sheet__body`
                 (houndfe-ui.css) stacks the views' desktop row so each region gets the sheet width. -->
            <div
              class="hf-filters-sheet__body min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
              data-testid="toolbar-filters-body"
            >
              <slot name="filters" />
            </div>

            <footer class="hf-filters-sheet__foot shrink-0" data-testid="toolbar-filters-footer">
              <UButton
                color="neutral"
                variant="outline"
                block
                :disabled="activeFilterCount === 0"
                data-testid="toolbar-filters-clear-all"
                @click="emit('clear-filters')"
              >{{ activeFilterCount > 0 ? `Limpiar (${activeFilterCount})` : 'Limpiar' }}</UButton>
              <UButton block data-testid="toolbar-filters-apply" @click="closeFilters">Ver {{ resultText }}</UButton>
            </footer>
          </div>
        </template>
      </USlideover>
    </template>

    <!-- «Columnas» sheet (below md or in card mode): visibility switches only, no drag or pin. The
         same visibility reaches the card slots, so the switches choose the card fields. -->
    <USlideover
      v-if="showColumnVisibility && columnsEnabled && useColumnsSheet"
      v-model:open="isColumnsOpen"
      side="bottom"
      inset
      :dismissible="true"
      title="Columnas"
      :ui="{ content: columnsContentClass }"
    >
      <template #content>
        <div class="hf-columns-sheet" data-testid="columns-sheet">
          <span class="hf-columns-sheet__grab" aria-hidden="true" />
          <div class="hf-columns-panel__head">
            <h2 class="hf-columns-panel__title">Columnas</h2>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              aria-label="Cerrar"
              @click="isColumnsOpen = false"
            />
          </div>
          <p class="hf-columns-panel__sub">Elige qué campos ves en cada tarjeta.</p>
          <ul class="hf-columns-sheet__body">
            <li v-for="column in columnRows" :key="column.id" class="hf-columns-sheet__row">
              <span class="hf-columns-row__label">{{ column.label }}</span>
              <span v-if="column.primary" class="hf-columns-sheet__note">Siempre visible</span>
              <USwitch
                :model-value="column.visible"
                :disabled="column.primary"
                :aria-label="`Mostrar ${column.label} en la tarjeta`"
                @update:model-value="emit('column-visibility', column.id, $event as boolean)"
              />
            </li>
          </ul>
          <div class="hf-columns-sheet__foot">
            <UButton color="neutral" variant="outline" icon="i-lucide-rotate-ccw" block @click="emit('reset-columns')">
              Restablecer
            </UButton>
            <UButton block @click="isColumnsOpen = false">Listo</UButton>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
