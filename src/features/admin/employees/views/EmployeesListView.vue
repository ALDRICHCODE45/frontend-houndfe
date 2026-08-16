<script setup lang="ts">
/**
 * EmployeesListView — WU-05B (action menu + edit/terminate/reactivate dialogs)
 *                       + WU-A (useServerTable migration, error surfacing,
 *                              AdminPageHeader, column visibility, dead-UI cleanup)
 *
 * Orchestrator view for the Colaboradores list page.
 * Composition surface: wires useEmployeesList + useEmployeeColumns +
 * useEmployeeViewMode + useManagerResolution + EmployeeFilters.
 *
 * WU-03 additions:
 * - Tabla / Tarjetas segmented toggle via shared ViewToggle (with displayMode bridge)
 * - Card grid view via EmployeeCardGrid (delegates to EmployeeCard per item)
 * - Manager name resolution via useManagerResolution (batch, no N+1)
 * - View mode persisted in localStorage via useEmployeeViewMode
 *
 * WU-04C additions:
 * - "Nuevo colaborador" button opens CreateEmployeeSlideover (gated by create:Employee)
 * - On success: slideover closes, list auto-refreshes via TanStack query invalidation
 *
 * WU-05B additions:
 * - Row action menu (table + card) — Editar, Dar de baja, Reactivar
 * - EmployeeEditSlideover — pre-fills form from selected employee
 * - TerminateEmployeeDialog — terminationDate + terminationReason fields
 * - ReactivateEmployeeDialog — simple confirm dialog
 * - All actions gated by update:Employee CASL permission
 *
 * WU-A additions:
 * - Migrate to useServerTable (shared composable) via Approach C (closure refs)
 * - Surface isError/error → employeesErrorMessage → AppDataTable :error/:error-message
 * - AdminPageHeader replaces the inline `<h1>Colaboradores</h1>`
 * - enable-column-visibility + 7 data columns marked enableHiding: true
 * - :display-mode bridge (card → cards) via useEmployeeViewMode.displayMode
 * - v-model:sorting/global-filter/column-pinning/column-visibility wired
 * - Dead UI removed: Importar / Exportar buttons, Filtros button, department select,
 *   modality select, "Más recientes" sort select
 * - viewMode → useEmployeeViewMode (with displayMode computed)
 * - selection-clear watcher: [viewMode, () => pagination.value.pageIndex]
 *
 * WU-B additions:
 * - EmployeeCardGrid rendered inside AppDataTable's #cards slot (kebab +
 *   card-click → admin-employee-detail preserved); the sibling v-else card
 *   branch and its duplicated prev/next pagination are gone — AppDataTable's
 *   pagination now governs both views
 * - EmployeeFilters (status tabs only) rendered inside AppDataTable's #filters
 *   slot; the toolbar owns the search box via globalFilter
 *
 * Design: Claude "Colaboradores" adapted to warm-orange Nuxt UI 4 tokens.
 * Status tabs: Todos / Activos / Bajas (EmployeeFilters, in the #filters slot)
 * Table columns: Colaborador, Cargo, Departamento, Jefe directo, Fecha de ingreso, Modalidad, Estado
 * Salary: intentionally NOT shown in list or cards — belongs in Compensación detail tab
 *
 * Permission gate: route-level meta.permission ['read', 'Employee'].
 * Create button gated by create:Employee (passed to :show-add-button on AppDataTable).
 * Edit/terminate/reactivate gated by update:Employee.
 */

import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AppDataTable } from '@/core/shared/components/DataTable'
import SelectColumn from '@/core/shared/components/DataTable/SelectColumn.vue'
import ConfirmModal, { type ConfirmModalItem } from '@/core/shared/components/ConfirmModal.vue'
import type { BulkAction } from '@/core/shared/types/table.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { EMPLOYEE_STATUS, WORK_MODALITY } from '../constants/employee.constants'
import { WORK_MODALITY_LABELS } from '../interfaces/employee.types'
import { useEmployeesList } from '../composables/useEmployeesList'
import {
  useEmployeeColumns,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { useEmployeeViewMode, isEmployeeViewMode } from '../composables/useEmployeeViewMode'
import { useManagerResolution, resolveManagerName, resolveManagerEmail } from '../composables/useManagerResolution'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'
import { employeeStatusConfig, getDepartmentDotClass } from '../utils/employeeBadgeConfig.utils'
import EmployeeCardGrid from '../components/EmployeeCardGrid.vue'
import EmployeeFilters from '../components/EmployeeFilters.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import DotBadge from '@/core/shared/components/DotBadge.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import CreateEmployeeSlideover from '../components/CreateEmployeeSlideover.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import TerminateEmployeeDialog from '../components/TerminateEmployeeDialog.vue'
import ReactivateEmployeeDialog from '../components/ReactivateEmployeeDialog.vue'
import BatchTerminateModal from '../components/BatchTerminateModal.vue'
import { useBatchDeleteEmployee } from '../composables/useBatchDeleteEmployee'
import { useBatchTerminateEmployee } from '../composables/useBatchTerminateEmployee'
import { useBatchReactivateEmployee } from '../composables/useBatchReactivateEmployee'
import type { Employee } from '../interfaces/employee.types'

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

// ── Table row action menu builder ──────────────────────────────────────────────
function getTableRowItems(employee: Employee) {
  const actions = getEmployeeRowActions(employee, canUpdate.value, {
    onEdit: () => openEditSlideover(employee),
    onTerminate: () => openTerminateDialog(employee),
    onReactivate: () => openReactivateDialog(employee),
  })
  return actions.length > 0 ? [actions] : []
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
  error,
  refresh,
  selectedEmployees,
  clearSelection,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useEmployeesList({ defaultPageSize: 10 })

// ── Column definitions ─────────────────────────────────────────────────────────
const { columns: employeeColumns } = useEmployeeColumns()
const columns = computed(() =>
  canUseBatchActions.value
    ? [{ id: 'select', enableSorting: false, enableHiding: false }, ...employeeColumns.value]
    : employeeColumns.value,
)

// ── View mode (Tabla / Tarjetas) + displayMode bridge ──────────────────────────
const { viewMode, setMode: setViewMode, displayMode } = useEmployeeViewMode()

function handleViewModeChange(mode: string) {
  if (!isEmployeeViewMode(mode)) return
  setViewMode(mode)
}

// ── Error message (REQ-1: backend.message > error.message > Spanish fallback) ──
const employeesErrorMessage = computed(() => {
  const err = error.value as
    | { response?: { data?: { message?: unknown } }; message?: string }
    | null
    | undefined
  const backendMessage = err?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage
  }
  if (Array.isArray(backendMessage) && backendMessage.length > 0) {
    const first = backendMessage[0]
    if (typeof first === 'string') return first
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message
  }
  return 'No se pudieron cargar los colaboradores. Reintenta.'
})

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

// Selection-clear when the user switches view mode OR changes page index.
watch(
  [viewMode, () => pagination.value.pageIndex],
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
  if (viewMode.value === 'card') return []

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

// ── Modality badge class — kept inline (out of scope for this migration) ─────
function getModalityBadgeClass(modality: Employee['workModality']): string {
  switch (modality) {
    case WORK_MODALITY.REMOTE:
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case WORK_MODALITY.HYBRID:
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case WORK_MODALITY.ONSITE:
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

function getPositionLevel(position: string | null): string {
  const value = position?.toLowerCase() ?? ''
  if (value.includes('senior') || value.includes('gerente') || value.includes('director')) return 'Senior'
  if (value.includes('junior') || value.includes('practicante')) return 'Junior'
  if (!position) return '—'
  return 'Mid'
}

// ── Manager display (table view — reads from resolved map via pure helper) ─────
function getManagerDisplay(employee: Employee): string {
  return resolveManagerName(employee.managerId, managerMap.value)
}

function getManagerEmail(employee: Employee): string | null {
  return resolveManagerEmail(employee.managerId, managerMap.value)
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
  <div class="flex flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
    <section class="overflow-hidden rounded-2xl border border-default bg-default shadow-sm">
      <!-- WU-A: AdminPageHeader replaces the inline <h1> (REQ-3) -->
      <div class="flex flex-col gap-4 border-b border-default px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
        <AdminPageHeader
          title="Colaboradores"
          description="Equipo, lifecycle, organigrama y documentos del personal"
        />

        <!-- Toolbar actions slot — ViewToggle (card/table switch) -->
        <div class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <div class="flex flex-col gap-4 px-5 py-4">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:row-selection="rowSelection"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          :columns="columns"
          :data="employees"
          :enable-row-selection="canUseBatchActions && viewMode === 'table'"
          :bulk-actions="bulkActions"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="employeesErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :display-mode="displayMode"
          :show-add-button="canCreate"
          :show-refresh="false"
          :active-filter-count="statusTab !== 'all' ? 1 : 0"
          add-button-text="Nuevo colaborador"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron colaboradores"
          search-placeholder="Buscar colaborador..."
          enable-column-visibility
          @refresh="refresh"
          @add="openCreateSlideover"
        >
          <template #actions>
            <ViewToggle
              :model-value="viewMode"
              aria-label="Seleccionar vista de empleados"
              @update:model-value="handleViewModeChange"
            />
          </template>

          <!-- WU-B: status tabs in #filters — toolbar keeps the globalFilter search box.
               WU-4 / polish-filters-bottom-sheet: the section wrapper carries
               data-section-id="status" so the mobile sheet wraps it in a card
               with a "Filtros" title (CreateEmployeeSlideover pattern). -->
          <template #filters>
            <div data-section-id="status">
              <EmployeeFilters
                :status-tab="statusTab"
                @update:status-tab="setStatusTab"
              />
            </div>
          </template>

          <template #select-header="{ table }">
            <SelectColumn :table="table" mode="header" />
          </template>
          <template #select-cell="{ row }">
            <SelectColumn :row="row" mode="cell" />
          </template>

          <!-- Colaborador cell — avatar + name + email (click → detail view) -->
          <template #colaborador-cell="{ row }">
            <div
              class="flex cursor-pointer items-center gap-3"
              @click="navigateToDetail(row.original)"
            >
              <EntityAvatar
                :name="row.original.fullName"
                :seed="row.original.id"
                :show-dot="row.original.status === EMPLOYEE_STATUS.ACTIVE"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-highlighted hover:text-primary hover:underline">
                  {{ row.original.fullName }}
                </p>
                <p v-if="row.original.email" class="truncate text-xs text-muted">
                  {{ row.original.email }}
                </p>
                <p v-else class="text-xs text-muted">{{ row.original.employeeNumber }}</p>
              </div>
            </div>
          </template>

          <!-- Cargo cell -->
          <template #cargo-cell="{ row }">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-highlighted">
                {{ row.original.currentPosition ?? '—' }}
              </p>
              <p class="text-xs text-muted">{{ getPositionLevel(row.original.currentPosition) }}</p>
            </div>
          </template>

          <!-- Departamento cell -->
          <template #departamento-cell="{ row }">
            <DotBadge
              v-if="row.original.currentDepartment"
              :label="row.original.currentDepartment"
              :dot-class="getDepartmentDotClass(row.original.currentDepartment)"
            />
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <!-- Jefe directo cell — resolved manager name or "—" -->
          <template #jefedirecto-cell="{ row }">
            <div v-if="getManagerDisplay(row.original) !== '—'" class="flex items-center gap-2">
              <EntityAvatar
                :name="getManagerDisplay(row.original)"
                :seed="getManagerDisplay(row.original)"
                size="sm"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">{{ getManagerDisplay(row.original) }}</p>
                <p v-if="getManagerEmail(row.original)" class="truncate text-xs text-muted">{{ getManagerEmail(row.original) }}</p>
              </div>
            </div>
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <!-- Fecha de ingreso cell -->
          <template #fechaIngreso-cell="{ row }">
            <span class="text-sm font-medium text-default">{{ formatHireDate(row.original.hireDate) }}</span>
          </template>

          <!-- Modalidad cell — badge chip -->
          <template #modalidad-cell="{ row }">
            <UBadge
              variant="outline"
              size="md"
              :class="getModalityBadgeClass((row.original as Employee).workModality)"
              :ui="{ base: 'rounded-full px-3 py-1.5 shadow-none ring-0', label: 'text-xs font-semibold' }"
            >
              {{ WORK_MODALITY_LABELS[(row.original as Employee).workModality] }}
            </UBadge>
          </template>

          <!-- Estado cell — semantic status badge (tone + dark mode from shared component) -->
          <template #estado-cell="{ row }">
            <StatusDotBadge
              :tone="employeeStatusConfig[(row.original as Employee).status].tone"
              :label="employeeStatusConfig[(row.original as Employee).status].label"
            />
          </template>

          <!-- Actions cell — row action dropdown (WU-05B) -->
          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="getTableRowItems(row.original).length > 0"
              :items="getTableRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-7"
                aria-label="Acciones del colaborador"
              />
            </UDropdownMenu>
          </template>

          <!-- WU-A: Card view in #cards slot — preserves kebab + card-click navigation -->
          <template #cards>
            <EmployeeCardGrid
              :employees="employees"
              :manager-map="managerMap"
              :loading="isLoading || isFetching"
              :can-update="canUpdate"
              empty="No se encontraron colaboradores"
              @edit="openEditSlideover"
              @terminate="openTerminateDialog"
              @reactivate="openReactivateDialog"
              @card-click="navigateToDetail"
            />
          </template>
        </AppDataTable>
      </div>
    </section>
  </div>

  <!-- Create Employee Slideover — gated by canCreate (create:Employee CASL) -->
  <CreateEmployeeSlideover
    v-if="canCreate"
    v-model:open="isCreateOpen"
    @success="refresh"
  />

  <ConfirmModal
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