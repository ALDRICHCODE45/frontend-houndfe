<script setup lang="ts">
/**
 * Scoped session list. Without `read:CashSessionAudit` the backend scopes the
 * list to the caller's own sessions, so the panel says so explicitly and never
 * offers a cashier filter it cannot honour.
 *
 * One layout: a table on desktop and cards on mobile. The whole row (and the
 * register name) selects the session; the ⋮ menu repeats that action.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { CashSession } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'

const props = withDefaults(
  defineProps<{
    sessions?: CashSession[]
    /** Register names by id; a session whose register is unknown reads "Caja". */
    registerNames?: Record<string, string>
    selectedSessionId?: string | null
    loading?: boolean
    fetching?: boolean
    error?: boolean
    errorMessage?: string
    canFilterByCashier?: boolean
    canOpen?: boolean
    total?: number
  }>(),
  {
    sessions: () => [],
    registerNames: () => ({}),
    selectedSessionId: null,
    loading: false,
    fetching: false,
    error: false,
    errorMessage: 'No se pudieron cargar las sesiones. Reintenta.',
    canFilterByCashier: false,
    canOpen: false,
    total: 0,
  },
)

const emit = defineEmits<{
  select: [sessionId: string]
  refresh: []
  'request-opening': []
}>()

const right = { class: { th: 'text-right', td: 'text-right' } }
const columns: TableColumn<CashSession, unknown>[] = [
  { id: 'register', header: 'Caja', enableSorting: false },
  { id: 'status', header: 'Estado', enableSorting: false },
  { id: 'opening', header: 'Fondo inicial', enableSorting: false, meta: right },
  { id: 'count', header: 'Conteo', enableSorting: false },
  { id: 'drawer', header: 'Cajón', enableSorting: false },
  {
    id: 'actions',
    header: 'Acciones',
    enableSorting: false,
    meta: { class: { th: 'w-16', td: 'w-16 text-right' } },
  },
]

const data = computed(() => [...props.sessions])
const emptyState = computed(() => ({
  title: 'Aún no hay sesiones',
  description: 'Las sesiones que abras aparecerán aquí.',
  ...(props.canOpen ? { actionLabel: 'Abrir un turno' } : {}),
}))
const hiddenCount = computed(() => Math.max(props.total - props.sessions.length, 0))

const registerName = (session: CashSession) => props.registerNames[session.registerId] ?? 'Caja'
const statusLabel = (session: CashSession) => CASH_SESSION_STATUS_LABELS[session.status]
const isSelected = (session: CashSession) => props.selectedSessionId === session.id
const countLabel = (session: CashSession) => (session.blind ? 'Ciego' : 'Visible')
const drawerLabel = (session: CashSession) =>
  session.drawerReleasedAt ? 'Liberado' : 'Sin liberar'
const rowLabel = (session: CashSession) =>
  `la sesión de ${registerName(session)}, ${statusLabel(session).toLowerCase()}`

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
      <h2 class="cash-list-title">Sesiones de caja</h2>
      <p v-if="!canFilterByCashier" class="cash-list-subtitle" data-testid="cash-sessions-scope-own">
        Solo ves tus propias sesiones.
      </p>
    </header>

    <AppDataTable
      :show-toolbar="false"
      :columns="columns"
      :data="data"
      :loading="loading"
      :fetching="fetching"
      :error="error"
      :error-message="errorMessage"
      :empty-state="emptyState"
      :row-open="open"
      display-mode="auto"
      mobile-render="cards"
      class="hf-data-table"
      @refresh="emit('refresh')"
      @empty-action="emit('request-opening')"
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
          <div class="cash-card-meta">
            <StatusBadge
              :label="statusLabel(row)"
              :tone="cashSessionStatusTone(row.status)"
              :data-testid="`cash-session-status-${row.id}`"
            />
            <span class="cash-meta">{{ countLabel(row) }} · {{ drawerLabel(row) }}</span>
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
