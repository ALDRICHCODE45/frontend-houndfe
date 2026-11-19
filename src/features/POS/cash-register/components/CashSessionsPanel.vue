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
 * supervisor list, `read:CashSessionAudit`) it offers the existing list
 * filters: «Solo por verificar» (`pendingOnly`) and the register.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { HfSwitchRow } from '@/core/shared/components/selection'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { CashSession } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'
import { cashSessionPeriod } from '../utils/cash-display'

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
    /** Offer the list filters (pendingOnly, register). */
    showFilters?: boolean
    pendingOnly?: boolean
    registerFilter?: string | null
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
    pendingOnly: false,
    registerFilter: null,
  },
)

const emit = defineEmits<{
  select: [sessionId: string]
  refresh: []
  'request-opening': []
  'update:pendingOnly': [value: boolean]
  'update:registerFilter': [value: string | null]
}>()

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
const filtered = computed(() => props.pendingOnly || Boolean(props.registerFilter))
const emptyState = computed(() =>
  filtered.value
    ? { title: 'Ninguna sesión coincide', description: 'Quita un filtro para ver más sesiones.' }
    : {
        title: 'Aún no hay sesiones',
        description: 'Las sesiones que abras aparecerán aquí.',
        ...(props.canOpen ? { actionLabel: 'Abrir un turno' } : {}),
      },
)
const hiddenCount = computed(() => Math.max(props.total - props.sessions.length, 0))

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
      <h2 class="cash-list-title" data-testid="cash-sessions-title">{{ title }}</h2>
      <p v-if="!canFilterByCashier" class="cash-list-subtitle" data-testid="cash-sessions-scope-own">
        Solo ves tus propias sesiones.
      </p>
    </header>

    <div v-if="showFilters" class="cash-session-filters" data-testid="cash-sessions-filters">
      <HfSwitchRow
        :model-value="pendingOnly"
        label="Solo por verificar"
        description="Sesiones congeladas o declaradas"
        :show-state="false"
        test-id="cash-sessions-pending-only"
        @update:model-value="emit('update:pendingOnly', $event)"
      />
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

    <p v-if="hiddenCount > 0" class="cash-list-note" data-testid="cash-sessions-total">
      Mostrando {{ sessions.length }} de {{ total }} sesiones
    </p>
  </section>
</template>
