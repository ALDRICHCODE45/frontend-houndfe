<script setup lang="ts">
/**
 * EmployeesListView — the Colaboradores list.
 *
 * One layout: an AppDataTable on desktop and cards on mobile
 * (`mobile-render="cards"` + `#mobile-card`). Columns follow the work: the
 * person, the status, then the job fields; the ⋮ menu is last. A row opens the
 * detail for everyone who can read employees; Editar, Dar de baja… and
 * Reactivar… live in the ⋮ menu and need update:Employee.
 *
 * Composition surface: useEmployeesList (useServerTable + the status filter),
 * useEmployeeColumns, useManagerResolution (batch, no N+1) and the lifecycle
 * dialogs. Batch delete / terminate / reactivate keep the table's selection
 * column and bulk bar (desktop table only).
 *
 * Permission gate: route-level meta.permission ['read', 'Employee'].
 * Create is gated by create:Employee, edit/terminate/reactivate by update:Employee.
 */

import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import { AppDataTable } from '@/core/shared/components/DataTable'
import SelectColumn from '@/core/shared/components/DataTable/SelectColumn.vue'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import ConfirmModal, { type ConfirmModalItem } from '@/core/shared/components/ConfirmModal.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { BulkAction } from '@/core/shared/types/table.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { EMPLOYEE_STATUS_FILTER } from '../constants/employee.constants'
import type { EmployeeStatusFilter } from '../api/employees.api'
import { useEmployeesList } from '../composables/useEmployeesList'
import { useEmployeeColumns, formatHireDate } from '../composables/useEmployeeColumns'
import { useManagerResolution, resolveManagerName } from '../composables/useManagerResolution'
import { getEmployeeRowActions, type EmployeeRowActionKey } from '../composables/useEmployeeActions'
import { employeeStatusConfig } from '../utils/employeeBadgeConfig.utils'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import CreateEmployeeSlideover from '../components/CreateEmployeeSlideover.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import TerminateEmployeeDialog from '../components/TerminateEmployeeDialog.vue'
import ReactivateEmployeeDialog from '../components/ReactivateEmployeeDialog.vue'
import BatchTerminateModal from '../components/BatchTerminateModal.vue'
import { useBatchDeleteEmployee } from '../composables/useBatchDeleteEmployee'
import { useBatchTerminateEmployee } from '../composables/useBatchTerminateEmployee'
import { useBatchReactivateEmployee } from '../composables/useBatchReactivateEmployee'
import type { Employee } from '../interfaces/employee.types'
import '../styles/employees-visual.css'

const authStore = useAuthStore()
const router = useRouter()
const tenantId = computed(() => authStore.currentTenantId)

// ── Navigation to detail view ──────────────────────────────────────────────────
function navigateToDetail(employee: Employee): void {
  void router.push({ name: 'admin-employee-detail', params: { id: employee.id } })
}

// ── CASL guards ────────────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Employee'))
const canUpdate = computed(() => authStore.userCan('update', 'Employee'))
const canBatchDelete = computed(() => authStore.userCan('batch_delete', 'Employee'))
const canBatchTerminate = computed(() => authStore.userCan('update', 'Employee'))
const canBatchReactivate = computed(() => authStore.userCan('update', 'Employee'))
const canUseBatchActions = computed(
  () => canBatchDelete.value || canBatchTerminate.value || canBatchReactivate.value,
)

// ── Create slideover ───────────────────────────────────────────────────────────
const isCreateOpen = ref(false)

function openCreateSlideover(): void {
  isCreateOpen.value = true
}

// ── Edit slideover ─────────────────────────────────────────────────────────────
const isEditOpen = ref(false)
const selectedEmployee = ref<Employee | null>(null)

function openEditSlideover(employee: Employee): void {
  selectedEmployee.value = employee
  isEditOpen.value = true
}

// ── Terminate dialog ───────────────────────────────────────────────────────────
const isTerminateOpen = ref(false)
const terminateTarget = ref<Employee | null>(null)

function openTerminateDialog(employee: Employee): void {
  terminateTarget.value = employee
  isTerminateOpen.value = true
}

// ── Reactivate dialog ──────────────────────────────────────────────────────────
const isReactivateOpen = ref(false)
const reactivateTarget = ref<Employee | null>(null)

function openReactivateDialog(employee: Employee): void {
  reactivateTarget.value = employee
  isReactivateOpen.value = true
}

// ── Row actions (⋮ menu in the table and on the card) ─────────────────────────
function actionsFor(employee: Employee) {
  return getEmployeeRowActions(employee, canUpdate.value)
}

function handleRowAction(key: string, employee: Employee): void {
  const action = key as EmployeeRowActionKey
  if (action === 'edit') openEditSlideover(employee)
  else if (action === 'terminate') openTerminateDialog(employee)
  else if (action === 'reactivate') openReactivateDialog(employee)
}

// ── List composable (useServerTable-backed) ───────────────────────────────────
const {
  statusTab,
  setStatusTab,
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  employees,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  refresh,
  selectedEmployees,
  clearSelection,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useEmployeesList({ defaultPageSize: 10 })

// ── Column definitions ─────────────────────────────────────────────────────────
const { columns: employeeColumns } = useEmployeeColumns()
const columns = computed<TableColumn<Employee>[]>(() =>
  canUseBatchActions.value
    ? [{ id: 'select', enableSorting: false, enableHiding: false }, ...employeeColumns.value]
    : employeeColumns.value,
)

// ── Status filter (a named select inside the toolbar) ─────────────────────────
const statusModel = computed({
  get: () => statusTab.value,
  set: (value: string) => setStatusTab(value as EmployeeStatusFilter),
})
const statusItems = [
  { label: 'Todos', value: EMPLOYEE_STATUS_FILTER.ALL },
  { label: 'Activos', value: EMPLOYEE_STATUS_FILTER.ACTIVE },
  { label: 'Bajas', value: EMPLOYEE_STATUS_FILTER.TERMINATED },
]

// ── Four states (S10) ──────────────────────────────────────────────────────────
const employeesErrorMessage = 'No se pudieron cargar los colaboradores'

const searchTerm = computed(() => globalFilter.value.trim())
const isFiltered = computed(
  () => searchTerm.value !== '' || statusTab.value !== EMPLOYEE_STATUS_FILTER.ALL,
)
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay colaboradores',
  description: 'Aquí aparecerá tu equipo cuando lo registres.',
  ...(canCreate.value
    ? { actionLabel: 'Nuevo colaborador', actionIcon: 'i-lucide-user-plus' }
    : {}),
}))

function clearFilters(): void {
  globalFilter.value = ''
  setStatusTab(EMPLOYEE_STATUS_FILTER.ALL)
}

// ── Batch operations ───────────────────────────────────────────────────────────
const BATCH_OPS_CAP = 100
const isBatchDeleteOpen = ref(false)
const isBatchTerminateOpen = ref(false)
const isBatchReactivateOpen = ref(false)

const batchDeleteMutation = useBatchDeleteEmployee()
const batchTerminateMutation = useBatchTerminateEmployee()
const batchReactivateMutation = useBatchReactivateEmployee()

const isBatchPending = computed(
  () =>
    batchDeleteMutation.isPending.value ||
    batchTerminateMutation.isPending.value ||
    batchReactivateMutation.isPending.value,
)

// Selection-clear when the user changes page index.
watch(
  () => pagination.value.pageIndex,
  () => {
    clearSelection()
  },
)

function shouldClearAfterBatchError(error: unknown): boolean {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error === 'BATCH_DELETE_NOT_FOUND'
}

async function confirmBatchDelete(): Promise<void> {
  try {
    await batchDeleteMutation.mutateAsync(selectedEmployees.value.map((employee) => employee.id))
    clearSelection()
    isBatchDeleteOpen.value = false
  } catch (error) {
    if (shouldClearAfterBatchError(error)) {
      clearSelection()
      isBatchDeleteOpen.value = false
    }
  }
}

async function confirmBatchTerminate(reason: string): Promise<void> {
  try {
    await batchTerminateMutation.mutateAsync({
      ids: selectedEmployees.value.map((employee) => employee.id),
      reason,
    })
    clearSelection()
    isBatchTerminateOpen.value = false
  } catch (error) {
    if (shouldClearAfterBatchError(error)) {
      clearSelection()
      isBatchTerminateOpen.value = false
    }
  }
}

async function confirmBatchReactivate(): Promise<void> {
  try {
    await batchReactivateMutation.mutateAsync(selectedEmployees.value.map((employee) => employee.id))
    clearSelection()
    isBatchReactivateOpen.value = false
  } catch (error) {
    if (shouldClearAfterBatchError(error)) {
      clearSelection()
      isBatchReactivateOpen.value = false
    }
  }
}

const bulkActions = computed<BulkAction<Employee>[]>(() => {
  const count = selectedEmployees.value.length
  const disabled = count === 0 || count > BATCH_OPS_CAP
  const actions: BulkAction<Employee>[] = []

  if (canBatchDelete.value) {
    actions.push({
      id: 'batch-delete',
      label: count > 0 ? `Eliminar (${count})` : 'Eliminar',
      variant: 'destructive',
      disabled,
      onClick: () => { isBatchDeleteOpen.value = true },
    })
  }
  if (canBatchTerminate.value) {
    actions.push({
      id: 'batch-terminate',
      label: count > 0 ? `Dar de baja (${count})` : 'Dar de baja',
      variant: 'warning',
      disabled,
      onClick: () => { isBatchTerminateOpen.value = true },
    })
  }
  if (canBatchReactivate.value) {
    actions.push({
      id: 'batch-reactivate',
      label: count > 0 ? `Reactivar (${count})` : 'Reactivar',
      variant: 'primary',
      disabled,
      onClick: () => { isBatchReactivateOpen.value = true },
    })
  }

  return actions
})

// ── Manager name resolution (batch, no N+1) ───────────────────────────────────
const { managerMap } = useManagerResolution(
  () => employees.value,
  () => tenantId.value,
)

function getManagerDisplay(employee: Employee): string {
  return resolveManagerName(employee.managerId, managerMap.value)
}

function statusBadgeOf(employee: Employee) {
  return employeeStatusConfig[employee.status]
}

/** The card's footer line: what the person does, in one muted line. */
function jobLine(employee: Employee): string {
  return [employee.currentPosition, employee.currentDepartment].filter(Boolean).join(' · ') || '—'
}

// ── selectedEmployeeItems — used by ConfirmModal (bulk delete/reactivate) ──────
const selectedEmployeeItems = computed<ConfirmModalItem[]>(() =>
  selectedEmployees.value.map((employee) => ({
    id: employee.id,
    title: employee.fullName,
    status: employeeStatusConfig[employee.status].label,
  })),
)
</script>

<template>
  <div class="hf-theme hf-ui employees-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 class="hf-page-title">Colaboradores</h1>
    </header>

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm">
      <div class="hf-table-content flex w-full min-w-0 flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:row-selection="rowSelection"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          :columns="columns"
          :data="employees"
          :enable-row-selection="canUseBatchActions"
          :bulk-actions="bulkActions"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="employeesErrorMessage"
          :empty-state="emptyState"
          :filtered="isFiltered"
          :no-match-title="noMatchTitle"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :row-open="navigateToDetail"
          :show-add-button="canCreate"
          :active-filter-count="statusTab !== 'all' ? 1 : 0"
          display-mode="auto"
          mobile-render="cards"
          add-button-text="Nuevo colaborador"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron colaboradores"
          search-placeholder="Buscar colaborador..."
          enable-column-visibility
          class="hf-data-table"
          portal-class="hf-theme hf-ui employees-list-portal"
          pagination-portal-class="hf-theme hf-ui employees-list-portal"
          @refresh="refresh"
          @add="openCreateSlideover"
          @empty-action="openCreateSlideover"
          @clear-filters="clearFilters"
        >
          <template #filters>
            <ToolbarSelectFilter
              v-model="statusModel"
              :items="statusItems"
              label="Estado"
              portal-class="hf-theme hf-ui employees-list-portal"
              test-id="employee-status-filter"
            />
          </template>

          <template #select-header="{ table }">
            <SelectColumn :table="table" mode="header" />
          </template>
          <template #select-cell="{ row }">
            <SelectColumn :row="row" mode="cell" />
          </template>

          <template #colaborador-cell="{ row }">
            <div class="flex min-w-0 items-center gap-3">
              <EntityAvatar :name="row.original.fullName" aria-hidden="true" />
              <div class="min-w-0">
                <button
                  type="button"
                  class="hf-row-primary text-left"
                  data-testid="employee-name"
                  @click="navigateToDetail(row.original)"
                >
                  {{ row.original.fullName }}
                </button>
                <span class="hf-row-secondary">{{ row.original.email ?? row.original.employeeNumber }}</span>
              </div>
            </div>
          </template>

          <template #estado-cell="{ row }">
            <StatusBadge v-bind="statusBadgeOf(row.original)" />
          </template>

          <template #cargo-cell="{ row }">
            <span class="block max-w-56 truncate text-sm" :title="row.original.currentPosition ?? undefined">
              {{ row.original.currentPosition ?? '—' }}
            </span>
          </template>

          <template #departamento-cell="{ row }">
            <span class="block max-w-48 truncate text-sm" :title="row.original.currentDepartment ?? undefined">
              {{ row.original.currentDepartment ?? '—' }}
            </span>
          </template>

          <template #jefedirecto-cell="{ row }">
            <span class="block max-w-48 truncate text-sm">{{ getManagerDisplay(row.original) }}</span>
          </template>

          <template #fechaIngreso-cell="{ row }">
            <span class="text-sm text-muted">{{ formatHireDate(row.original.hireDate) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="actionsFor(row.original)"
              :row-label="row.original.fullName"
              portal-class="employees-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.fullName"
              :actions="actionsFor(row)"
              openable
              portal-class="employees-list-portal"
              test-id="employee-card"
              @open="navigateToDetail"
              @action="handleRowAction"
            >
              <template #leading>
                <EntityAvatar :name="row.fullName" aria-hidden="true" />
              </template>
              <template #secondary>{{ row.email ?? row.employeeNumber }}</template>
              <template #badges>
                <StatusBadge v-bind="statusBadgeOf(row)" />
              </template>
              <template #footer>
                <span class="min-w-0 truncate font-medium">{{ jobLine(row) }}</span>
                <span class="shrink-0">{{ formatHireDate(row.hireDate) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>

  <!-- Create Employee Slideover — gated by canCreate (create:Employee CASL) -->
  <CreateEmployeeSlideover
    v-if="canCreate"
    v-model:open="isCreateOpen"
    @success="refresh"
  />

  <ConfirmModal
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    v-if="canBatchDelete"
    v-model:open="isBatchDeleteOpen"
    title="Eliminar colaboradores"
    description="Esta acción es irreversible y eliminará salarios, cargos, documentos, ausencias y contactos de emergencia."
    confirm-label="Eliminar permanentemente"
    confirm-color="error"
    :items="selectedEmployeeItems"
    :loading="isBatchPending"
    @confirm="confirmBatchDelete"
  />

  <BatchTerminateModal
    v-if="canBatchTerminate"
    v-model:open="isBatchTerminateOpen"
    :employees="selectedEmployees"
    :loading="isBatchPending"
    @confirm="confirmBatchTerminate"
  />

  <ConfirmModal
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay employees-form-portal' }"
    v-if="canBatchReactivate"
    v-model:open="isBatchReactivateOpen"
    title="Reactivar colaboradores"
    description="Los colaboradores seleccionados volverán al estado activo."
    confirm-label="Reactivar seleccionados"
    confirm-color="success"
    :items="selectedEmployeeItems"
    :loading="isBatchPending"
    @confirm="confirmBatchReactivate"
  />

  <!-- Edit Employee Slideover — gated by canUpdate (update:Employee CASL) -->
  <EmployeeEditSlideover
    v-if="canUpdate"
    v-model:open="isEditOpen"
    :employee="selectedEmployee"
    @success="refresh"
  />

  <!-- Terminate Employee Dialog — gated by canUpdate (update:Employee CASL) -->
  <TerminateEmployeeDialog
    v-if="canUpdate"
    v-model:open="isTerminateOpen"
    :employee="terminateTarget"
    @success="refresh"
  />

  <!-- Reactivate Employee Dialog — gated by canUpdate (update:Employee CASL) -->
  <ReactivateEmployeeDialog
    v-if="canUpdate"
    v-model:open="isReactivateOpen"
    :employee="reactivateTarget"
    @success="refresh"
  />
</template>