<script setup lang="ts">
/**
 * Scoped session list. Without `read:CashSessionAudit` the backend scopes the
 * list to the caller's own sessions, so the panel says so explicitly and never
 * offers a cashier filter it cannot honour.
 *
 * One layout: a table on desktop and cards on mobile. The whole row (and the
 * register name) selects the session; the ⋮ menu repeats that action.
 * Under the register name, «cashier · period» tells apart two closed sessions
 * of the same register and fund; a missing value shows nothing. It rides in the
 * name column, which has the room: a column of its own cut the period at 1440.
 *
 * Direction A puts the list in the side column: `variant="list"` always renders
 * the cards (the side is too narrow for a table). With `showFilters` (the
 * supervisor list, `read:CashSessionAudit`) it offers the status filter (S7,
 * handoff 25 §2: Todas / Abiertas / En conteo / Por verificar o cerrar /
 * Cerradas) and the register. Paging uses the real `total` from the backend.
 */
import { computed, useId } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { CashSession } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'
import { cashSessionPeriod } from '../utils/cash-display'

/** Supervisor status filter. `ALL` sends no `status`; the others send one exact lifecycle. */
export type CashSessionStatusFilter = 'ALL' | 'OPEN' | 'COUNTING' | 'SUBMITTED' | 'CLOSED'

const CASH_SESSION_STATUS_FILTERS: Array<{ value: CashSessionStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'COUNTING', label: 'En conteo' },
  { value: 'SUBMITTED', label: 'Por verificar o cerrar' },
  { value: 'CLOSED', label: 'Cerradas' },
]

const props = withDefaults(
  defineProps<{
    sessions?: CashSession[]
    /** Register names by id; a session whose register is unknown reads "Caja". */
    registerNames?: Record<string, string>
    selectedSessionId?: string | null
    loading?: boolean
    fetching?: boolean
    error?: boolean
    canFilterByCashier?: boolean
    canOpen?: boolean
    total?: number
    /** `list`: always cards (side column). `table`: table on desktop, cards on mobile. */
    variant?: 'table' | 'list'
    title?: string
    /** Offer the list filters (status, register). */
    showFilters?: boolean
    statusFilter?: CashSessionStatusFilter
    registerFilter?: string | null
    /** Current page (1-based) and page size of the backend list. */
    page?: number
    pageSize?: number
  }>(),
  {
    sessions: () => [],
    registerNames: () => ({}),
    selectedSessionId: null,
    loading: false,
    fetching: false,
    error: false,
    canFilterByCashier: false,
    canOpen: false,
    total: 0,
    variant: 'table',
    title: 'Sesiones de caja',
    showFilters: false,
    statusFilter: 'ALL',
    registerFilter: null,
    page: 1,
    pageSize: 25,
  },
)

const emit = defineEmits<{
  select: [sessionId: string]
  refresh: []
  'request-opening': []
  'update:statusFilter': [value: CashSessionStatusFilter]
  'update:registerFilter': [value: string | null]
  'update:page': [value: number]
}>()

const statusGroupName = `cash-sessions-status-${useId()}`
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const showPager = computed(() => props.total > props.pageSize || props.page > 1)

function goTo(next: number) {
  const target = Math.min(Math.max(1, next), totalPages.value)
  if (target !== props.page) emit('update:page', target)
}

const ALL_REGISTERS = '__all__'
const registerFilterItems = computed(() => [
  { label: 'Todas las cajas', value: ALL_REGISTERS },
  ...Object.entries(props.registerNames).map(([value, label]) => ({ label, value })),
])
const registerFilterModel = computed({
  get: () => props.registerFilter ?? ALL_REGISTERS,
  set: (value: string) => emit('update:registerFilter', value === ALL_REGISTERS ? null : value),
})

const right = { class: { th: 'text-right', td: 'text-right' } }
// Totals row (premium tables S5): the count of sessions only. Opening funds are not added up:
// each session reuses the same drawer money, so a sum would double count it.
const columns: TableColumn<CashSession, unknown>[] = [
  {
    id: 'register',
    header: 'Caja',
    enableSorting: false,
    meta: { total: { kind: 'count', label: (n) => `${n} ${n === 1 ? 'sesión' : 'sesiones'}` } },
  },
  { id: 'status', header: 'Estado', enableSorting: false },
  {
    id: 'opening',
    header: 'Fondo inicial',
    enableSorting: false,
    meta: right,
  },
  { id: 'count', header: 'Conteo', enableSorting: false },
  { id: 'drawer', header: 'Cajón', enableSorting: false },
  {
    id: 'actions',
    header: 'Acciones',
    enableSorting: false,
    meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
  },
]

// Column layout saved per user in this browser (order, pins, widths, visibility, density).
const layout = useTablePreferences({
  persistKey: 'pos-cash-sessions',
  columnIds: columns.map((column) => column.id ?? ''),
})
const { columnOrder, columnPinning, columnSizing, columnVisibility, density } = layout

const data = computed(() => [...props.sessions])
const filtered = computed(() => props.statusFilter !== 'ALL' || Boolean(props.registerFilter))
const emptyState = computed(() =>
  filtered.value
    ? { title: 'Ninguna sesión coincide', description: 'Quita un filtro para ver más sesiones.' }
    : {
        title: 'Aún no hay sesiones',
        description: 'Las sesiones que abras aparecerán aquí.',
        ...(props.canOpen ? { actionLabel: 'Abrir un turno' } : {}),
      },
)

const registerName = (session: CashSession) => props.registerNames[session.registerId] ?? 'Caja'
const statusLabel = (session: CashSession) => CASH_SESSION_STATUS_LABELS[session.status]
const isSelected = (session: CashSession) => props.selectedSessionId === session.id
const countLabel = (session: CashSession) => (session.blind ? 'Ciego' : 'Visible')
const drawerLabel = (session: CashSession) =>
  session.drawerReleasedAt ? 'Liberado' : 'Sin liberar'
const cashierName = (session: CashSession) => session.cashierDisplayName?.trim() ?? ''
const hasShift = (session: CashSession) =>
  Boolean(cashierName(session) || cashSessionPeriod(session))
const rowLabel = (session: CashSession) =>
  [
    `la sesión de ${registerName(session)}`,
    cashierName(session),
    cashSessionPeriod(session),
    statusLabel(session).toLowerCase(),
  ]
    .filter(Boolean)
    .join(', ')

function actionsFor(session: CashSession): RowAction[] {
  return [
    {
      key: 'open',
      label: 'Ver sesión',
      icon: 'i-lucide-eye',
      disabled: isSelected(session),
    },
  ]
}

function open(session: CashSession) {
  if (!isSelected(session)) emit('select', session.id)
}

const { rowProps } = useClickableRow<CashSession>(open, { focusable: false })
</script>

<template>
  <section class="cash-list-section" data-testid="cash-sessions-panel">
    <header class="cash-list-header">
      <h2 id="cash-sessions-title" class="cash-list-title" tabindex="-1" data-testid="cash-sessions-title">
        {{ title }}
      </h2>
      <p v-if="!canFilterByCashier" class="cash-list-subtitle" data-testid="cash-sessions-scope-own">
        Solo ves tus propias sesiones.
      </p>
    </header>

    <div v-if="showFilters" class="cash-session-filters" data-testid="cash-sessions-filters">
      <fieldset class="cash-status-filter" data-testid="cash-sessions-status-filter">
        <legend class="cash-meta">Estado</legend>
        <div class="cash-status-chips">
          <label
            v-for="option in CASH_SESSION_STATUS_FILTERS"
            :key="option.value"
            class="cash-status-chip"
            :class="{ 'is-selected': statusFilter === option.value }"
          >
            <input
              type="radio"
              class="sr-only"
              :name="statusGroupName"
              :value="option.value"
              :checked="statusFilter === option.value"
              :data-testid="`cash-sessions-status-${option.value}`"
              @change="emit('update:statusFilter', option.value)"
            />
            {{ option.label }}
          </label>
        </div>
      </fieldset>
      <USelect
        v-if="Object.keys(registerNames).length > 1"
        v-model="registerFilterModel"
        :items="registerFilterItems"
        aria-label="Filtrar por caja"
        class="w-full"
        data-testid="cash-sessions-register-filter"
      />
    </div>

    <AppDataTable
      v-model:column-order="columnOrder"
      v-model:column-pinning="columnPinning"
      v-model:column-sizing="columnSizing"
      v-model:column-visibility="columnVisibility"
      v-model:density="density"
      :persist-layout="true"
      :show-toolbar="false"
      :columns="columns"
      :data="data"
      :loading="loading"
      :fetching="fetching"
      :error="error"
      error-message="No se pudieron cargar las sesiones"
      :empty-state="emptyState"
      :row-open="open"
      :display-mode="variant === 'list' ? 'cards' : 'auto'"
      mobile-render="cards"
      class="hf-data-table cash-table-surface"
      @refresh="emit('refresh')"
      @empty-action="emit('request-opening')"
      @reset-columns="layout.reset"
    >
      <template #register-cell="{ row }">
        <button
          type="button"
          class="hf-row-primary cash-row-link"
          :data-testid="`cash-session-open-${row.original.id}`"
          @click="open(row.original)"
        >
          {{ registerName(row.original) }}
        </button>
        <span
          v-if="hasShift(row.original)"
          class="hf-row-secondary"
          :data-testid="`cash-session-shift-${row.original.id}`"
        >
          <span
            v-if="cashierName(row.original)"
            :data-testid="`cash-session-cashier-${row.original.id}`"
            >{{ cashierName(row.original) }}</span
          >
          <span v-if="cashierName(row.original) && cashSessionPeriod(row.original)"> · </span>
          <span
            v-if="cashSessionPeriod(row.original)"
            :data-testid="`cash-session-period-${row.original.id}`"
            >{{ cashSessionPeriod(row.original) }}</span
          >
        </span>
        <span v-if="isSelected(row.original)" class="hf-row-secondary">Seleccionada</span>
      </template>
      <template #status-cell="{ row }">
        <StatusBadge
          :label="statusLabel(row.original)"
          :tone="cashSessionStatusTone(row.original.status)"
          :data-testid="`cash-session-status-${row.original.id}`"
        />
      </template>
      <template #opening-cell="{ row }">
        <span class="hf-figure">{{ formatCentsMXN(row.original.openingCents) }}</span>
      </template>
      <template #count-cell="{ row }">
        <span class="cash-meta" :data-testid="`cash-session-blind-${row.original.id}`">{{
          countLabel(row.original)
        }}</span>
      </template>
      <template #drawer-cell="{ row }">
        <span class="cash-meta" :data-testid="`cash-session-drawer-${row.original.id}`">{{
          drawerLabel(row.original)
        }}</span>
      </template>
      <template #actions-header><span class="sr-only">Acciones</span></template>
      <template #actions-cell="{ row }">
        <RowActionsMenu
          :actions="actionsFor(row.original)"
          :row-label="rowLabel(row.original)"
          @select="open(row.original)"
        />
      </template>

      <template #mobile-card="{ row }">
        <article v-bind="rowProps(row)" class="cash-card">
          <div class="cash-card-heading">
            <div class="cash-card-title">
              <button
                type="button"
                class="hf-row-primary cash-row-link"
                :data-testid="`cash-session-open-${row.id}`"
                @click="open(row)"
              >
                {{ registerName(row) }}
              </button>
              <span v-if="isSelected(row)" class="hf-row-secondary">Seleccionada</span>
            </div>
            <RowActionsMenu
              class="cash-card-menu"
              :actions="actionsFor(row)"
              :row-label="rowLabel(row)"
              @select="open(row)"
            />
          </div>
          <p
            v-if="hasShift(row)"
            class="cash-meta cash-card-shift"
            :data-testid="`cash-session-shift-${row.id}`"
          >
            <span v-if="cashierName(row)" :data-testid="`cash-session-cashier-${row.id}`">{{
              cashierName(row)
            }}</span>
            <span v-if="cashierName(row) && cashSessionPeriod(row)"> · </span>
            <span
              v-if="cashSessionPeriod(row)"
              :data-testid="`cash-session-period-${row.id}`"
              >{{ cashSessionPeriod(row) }}</span
            >
          </p>
          <div class="cash-card-meta">
            <StatusBadge
              :label="statusLabel(row)"
              :tone="cashSessionStatusTone(row.status)"
              :data-testid="`cash-session-status-${row.id}`"
            />
            <span class="cash-meta">Conteo {{ countLabel(row).toLowerCase() }} · Cajón {{ drawerLabel(row).toLowerCase() }}</span>
          </div>
          <div class="cash-card-footer">
            <span>Fondo inicial</span>
            <span class="hf-figure">{{ formatCentsMXN(row.openingCents) }}</span>
          </div>
        </article>
      </template>
    </AppDataTable>

    <nav
      v-if="showPager"
      class="cash-sessions-pager"
      aria-label="Páginas de sesiones"
      data-testid="cash-sessions-pager"
    >
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="min-h-11"
        icon="i-lucide-chevron-left"
        aria-label="Página anterior"
        :disabled="page <= 1"
        data-testid="cash-sessions-prev"
        @click="goTo(page - 1)"
      />
      <span class="cash-meta" aria-live="polite" data-testid="cash-sessions-page"
        >Página {{ page }} de {{ totalPages }} · {{ total }} {{ total === 1 ? 'sesión' : 'sesiones' }}</span
      >
      <UButton
        type="button"
        color="neutral"
        variant="outline"
        class="min-h-11"
        icon="i-lucide-chevron-right"
        aria-label="Página siguiente"
        :disabled="page >= totalPages"
        data-testid="cash-sessions-next"
        @click="goTo(page + 1)"
      />
    </nav>
  </section>
</template>

<style scoped>
.cash-status-filter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 0;
}

.cash-status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cash-status-chip {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.875rem;
  cursor: pointer;
  border: 1px solid var(--hf-border);
  border-radius: 9999px;
  background-color: var(--hf-surface);
  color: var(--hf-heading);
  font-size: 0.8125rem;
  font-weight: 500;
}

.cash-status-chip:hover {
  border-color: var(--hf-action);
}

.cash-status-chip.is-selected {
  border-color: var(--hf-action);
  background-color: var(--hf-active-soft);
  font-weight: 600;
}

.cash-status-chip:focus-within {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}

.cash-sessions-pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
</style>
