<script setup lang="ts">
import { computed, ref } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { KardexFilterOption, StockMovement } from '../interfaces/inventory.types'
import { buildKardexRows, type KardexRow } from '../utils/kardex'

const props = defineProps<{
  items: readonly StockMovement[]
  loading?: boolean
  fetching?: boolean
  error?: boolean
  hasMore?: boolean
  loadingMore?: boolean
  loadMoreError?: boolean
  filters?: readonly KardexFilterOption[]
}>()
const emit = defineEmits<{ 'load-more': []; refresh: [] }>()
const filter = defineModel<{ kind: 'lot' | 'variant'; id: string } | null>('filter', { default: null })

const expanded = ref<ReadonlySet<string>>(new Set())
const rows = computed(() => buildKardexRows(props.items, expanded.value))
function toggle(row: KardexRow) {
  if (row.kind !== 'group') return
  const next = new Set(expanded.value)
  if (!next.delete(row.key)) next.add(row.key)
  expanded.value = next
}
const isOpen = (row: KardexRow) => expanded.value.has(row.key)

const emptyState = { title: 'Aún no hay movimientos', description: 'Cada cambio de stock quedará registrado aquí.' }
const filtered = computed(() => filter.value !== null)
const right = { class: { th: 'text-right', td: 'text-right' } }
const columns: TableColumn<KardexRow, unknown>[] = [
  { id: 'movement', header: 'Movimiento', enableSorting: false },
  { id: 'createdAt', header: 'Fecha', enableSorting: false },
  { id: 'location', header: 'Ubicación', enableSorting: false },
  { id: 'delta', header: 'Cambio', enableSorting: false, meta: right },
  { id: 'balance', header: 'Saldo', enableSorting: false, meta: right },
  { id: 'total', header: 'Total del producto', enableSorting: false, meta: right },
  { id: 'actor', header: 'Responsable', enableSorting: false },
]
const number = (value: number) => value.toLocaleString('es-MX')
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${number(Math.abs(value))}`
const isActive = (option: KardexFilterOption | null) =>
  option === null ? filter.value === null : filter.value?.kind === option.kind && filter.value.id === option.id
function choose(option: KardexFilterOption | null) {
  filter.value = option && { kind: option.kind, id: option.id }
}
const toggleLabel = (row: KardexRow) => `${isOpen(row) ? 'Ocultar' : 'Ver'} el detalle de ${row.typeLabel.toLowerCase()}: ${row.location}`
</script>

<template>
  <div class="kardex">
    <div v-if="filters?.length" data-testid="kardex-filters" role="group" aria-label="Filtrar por ubicación" class="kardex-filters">
      <button type="button" class="kardex-chip" :aria-pressed="isActive(null)" @click="choose(null)">Todos</button>
      <button
        v-for="option in filters" :key="option.kind + option.id" type="button" class="kardex-chip"
        :aria-pressed="isActive(option)" @click="choose(option)"
      >{{ option.label }}</button>
    </div>
    <AppDataTable
      :show-toolbar="false" :columns="columns" :data="rows" :loading="loading" :fetching="fetching" :error="error"
      error-message="No se pudieron cargar los movimientos" :empty-state="emptyState" :filtered="filtered"
      no-match-title="Ningún movimiento en esta ubicación" display-mode="auto" mobile-render="cards"
      class="hf-data-table" @refresh="emit('refresh')" @clear-filters="choose(null)"
    >
      <template #movement-cell="{ row }">
        <div class="kardex-movement" :class="{ 'is-child': row.original.kind === 'child' }">
          <button
            v-if="row.original.kind === 'group'" type="button" data-testid="kardex-toggle"
            class="hf-row-primary kardex-toggle" :aria-expanded="isOpen(row.original)"
            :aria-label="toggleLabel(row.original)" @click="toggle(row.original)"
          >
            <UIcon :name="isOpen(row.original) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" aria-hidden="true" />
            {{ row.original.typeLabel }}
          </button>
          <span v-else class="hf-row-primary">{{ row.original.kind === 'child' ? '' : row.original.typeLabel }}</span>
          <span v-if="row.original.detail" class="hf-row-secondary">{{ row.original.detail }}</span>
        </div>
      </template>
      <template #createdAt-cell="{ row }"><span class="kardex-when">{{ formatShortDateTime(row.original.createdAt) }}</span></template>
      <template #location-cell="{ row }">{{ row.original.location }}</template>
      <template #delta-cell="{ row }"><span class="hf-figure" data-testid="kardex-delta">{{ signed(row.original.delta) }}</span></template>
      <template #balance-cell="{ row }">
        <span class="hf-figure">{{ row.original.balanceAfter === null ? '—' : number(row.original.balanceAfter) }}</span>
      </template>
      <template #total-cell="{ row }"><span class="hf-figure">{{ number(row.original.productBalanceAfter) }}</span></template>
      <template #actor-cell="{ row }">{{ row.original.actor }}</template>
      <template #mobile-card="{ row }">
        <article data-testid="kardex-card" class="kardex-card" :class="{ 'is-child': row.kind === 'child' }">
          <div class="kardex-card-head">
            <button
              v-if="row.kind === 'group'" type="button" data-testid="kardex-toggle" class="hf-row-primary kardex-toggle"
              :aria-expanded="isOpen(row)" :aria-label="toggleLabel(row)" @click="toggle(row)"
            >
              <UIcon :name="isOpen(row) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" aria-hidden="true" />
              {{ row.typeLabel }}
            </button>
            <span v-else class="hf-row-primary">{{ row.kind === 'child' ? row.location : row.typeLabel }}</span>
            <span class="hf-figure kardex-card-delta">{{ signed(row.delta) }}</span>
          </div>
          <span v-if="row.detail" class="hf-row-secondary">{{ row.detail }}</span>
          <span v-if="row.kind !== 'child'" class="hf-row-secondary">{{ row.location }}</span>
          <div class="kardex-card-footer">
            <span class="hf-figure">Saldo {{ row.balanceAfter === null ? '—' : number(row.balanceAfter) }} · Total {{ number(row.productBalanceAfter) }}</span>
            <span>{{ formatShortDateTime(row.createdAt) }} · {{ row.actor }}</span>
          </div>
        </article>
      </template>
    </AppDataTable>
    <div v-if="hasMore" class="kardex-more">
      <p v-if="loadMoreError" data-testid="kardex-load-more-error" role="alert" class="kardex-more-error">No se pudieron cargar más movimientos.</p>
      <UButton
        data-testid="kardex-load-more" color="neutral" variant="outline" label="Cargar más"
        :loading="loadingMore" :disabled="loadingMore" @click="emit('load-more')"
      />
    </div>
  </div>
</template>

<style scoped>
.kardex { display: grid; gap: 12px; min-width: 0; }
.kardex-filters { display: flex; flex-wrap: wrap; gap: 8px; }
.kardex-chip { min-height: 32px; padding: 0 12px; border: 1px solid var(--hf-border); border-radius: 999px; background: var(--hf-surface); color: var(--hf-text); font-size: 13px; font-weight: 500; cursor: pointer; }
.kardex-chip[aria-pressed='true'] { border-color: var(--hf-action); background: var(--hf-active-soft); color: var(--hf-heading); font-weight: 600; }
.kardex-chip:focus-visible, .kardex-toggle:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.kardex-movement { min-width: 0; }
.kardex-movement.is-child { padding-left: 24px; }
.kardex-toggle { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; font-size: 14px; cursor: pointer; }
.kardex-when { color: var(--hf-muted); white-space: nowrap; }
.kardex-card { display: grid; gap: 4px; min-width: 0; padding: 16px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
.kardex-card.is-child { margin-left: 16px; background: var(--hf-surface-muted); }
.kardex-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.kardex-card-delta { font-weight: 600; color: var(--hf-heading); }
.kardex-card-footer { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
.kardex-more { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
.kardex-more-error { margin: 0; color: var(--hf-danger); font-size: 13px; }
</style>
