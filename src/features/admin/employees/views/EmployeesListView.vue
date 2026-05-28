<script setup lang="ts">
/**
 * EmployeesListView — WU-05B (action menu + edit/terminate/reactivate dialogs)
 *
 * Orchestrator view for the Colaboradores list page.
 * Composition surface: wires useEmployeesList + useEmployeeColumns +
 * useEmployeeViewMode + useManagerResolution + EmployeeFilters.
 *
 * WU-03 additions:
 * - Tabla / Tarjetas segmented toggle via EmployeeViewToggle
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
 * Design: Claude "Colaboradores" adapted to warm-orange Nuxt UI 4 tokens.
 * Status tabs: Todos / Activos / Bajas
 * Table columns: Colaborador, Cargo, Departamento, Jefe directo, Fecha de ingreso, Modalidad, Estado
 * Salary: intentionally NOT shown in list or cards — belongs in Compensación detail tab (WU-06+)
 *
 * Permission gate: route-level meta.permission ['read', 'Employee'].
 * Create button gated by create:Employee.
 * Edit/terminate/reactivate gated by update:Employee.
 */

import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppDataTable } from '@/core/shared/components/DataTable'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { EMPLOYEE_STATUS_LABELS, WORK_MODALITY_LABELS } from '../interfaces/employee.types'
import { useEmployeesList } from '../composables/useEmployeesList'
import {
  useEmployeeColumns,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { useEmployeeViewMode } from '../composables/useEmployeeViewMode'
import { useManagerResolution, resolveManagerName, resolveManagerEmail } from '../composables/useManagerResolution'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'
import EmployeeFilters from '../components/EmployeeFilters.vue'
import EmployeeViewToggle from '../components/EmployeeViewToggle.vue'
import EmployeeCardGrid from '../components/EmployeeCardGrid.vue'
import CreateEmployeeSlideover from '../components/CreateEmployeeSlideover.vue'
import EmployeeEditSlideover from '../components/EmployeeEditSlideover.vue'
import TerminateEmployeeDialog from '../components/TerminateEmployeeDialog.vue'
import ReactivateEmployeeDialog from '../components/ReactivateEmployeeDialog.vue'
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

// ── List composable ────────────────────────────────────────────────────────────
const {
  statusTab,
  search,
  employees,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  page,
  pageSize,
  setStatusTab,
  setSearch,
  setPage,
  setPageSize,
  refresh,
} = useEmployeesList({ defaultPageSize: 10 })

// ── Column definitions ─────────────────────────────────────────────────────────
const { columns } = useEmployeeColumns()

// ── View mode (Tabla / Tarjetas) ───────────────────────────────────────────────
const { viewMode, setMode } = useEmployeeViewMode()

// ── Manager name resolution (batch, no N+1) ───────────────────────────────────
const { managerMap } = useManagerResolution(
  () => employees.value,
  () => tenantId.value,
)

// ── Avatar helper ──────────────────────────────────────────────────────────────
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'C'
  )
}

function getAvatarClass(seedValue: string): string {
  const palettes = [
    'bg-amber-500 text-white',
    'bg-pink-500 text-white',
    'bg-violet-500 text-white',
    'bg-red-500 text-white',
    'bg-cyan-500 text-white',
    'bg-emerald-500 text-white',
    'bg-blue-500 text-white',
  ]
  const seed = seedValue.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[seed % palettes.length] ?? palettes[0]!
}

// Department badge is always neutral — only the dot carries color
const DEPARTMENT_BADGE_CLASS = 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'

function getDepartmentDotClass(department: string | null): string {
  const value = department?.toLowerCase() ?? ''
  if (value.includes('producto')) return 'bg-violet-500'
  if (value.includes('diseño')) return 'bg-pink-500'
  if (value.includes('finanzas')) return 'bg-blue-500'
  if (value.includes('recursos')) return 'bg-cyan-500'
  if (value.includes('operaciones')) return 'bg-amber-500'
  if (value.includes('legal')) return 'bg-slate-500'
  return 'bg-emerald-500'
}

function getModalityBadgeClass(modality: Employee['workModality']): string {
  switch (modality) {
    case 'REMOTE':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'HYBRID':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'ONSITE':
      return 'border-slate-200 bg-slate-100 text-slate-700'
  }
}

function getStatusBadgeClass(status: Employee['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'ON_LEAVE':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'TERMINATED':
      return 'border-red-200 bg-red-50 text-red-700'
  }
}

function getStatusDotClass(status: Employee['status']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500'
    case 'ON_LEAVE':
      return 'bg-amber-500'
    case 'TERMINATED':
      return 'bg-red-500'
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

// ── Pagination state forwarding ────────────────────────────────────────────────
// IMPORTANT: setPageSize resets page to 1 by design (filter-change semantics),
// so we must only invoke it when the size actually changes — otherwise the
// page-index update is immediately overridden and the user appears stuck on
// page 1 when clicking the next-page button.
const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (val: { pageIndex: number; pageSize: number }) => {
    const nextPage = val.pageIndex + 1
    const nextSize = val.pageSize
    if (nextSize !== pageSize.value) {
      setPageSize(nextSize)
    }
    if (nextPage !== page.value) {
      setPage(nextPage)
    }
  },
})

// ── Showing from/to for pagination display ─────────────────────────────────────
const showingFrom = computed(() => {
  if (totalCount.value === 0) return 0
  return (page.value - 1) * pageSize.value + 1
})
const showingTo = computed(() => {
  const to = page.value * pageSize.value
  return Math.min(to, totalCount.value)
})
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
    <section class="overflow-hidden rounded-2xl border border-default bg-default shadow-sm">
      <!-- Header: matches the dense Claude directory reference -->
      <div class="flex flex-col gap-4 border-b border-default px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-highlighted">Colaboradores</h1>
          <p class="mt-1 text-sm text-muted">Equipo, lifecycle, organigrama y documentos del personal</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UButton
            icon="i-lucide-upload"
            color="neutral"
            variant="outline"
            size="sm"
            disabled
          >
            Importar
          </UButton>
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            size="sm"
            disabled
          >
            Exportar
          </UButton>
          <UButton
            v-if="canCreate"
            icon="i-lucide-plus"
            color="primary"
            size="sm"
            class="shadow-sm"
            @click="openCreateSlideover"
          >
            Nuevo colaborador
          </UButton>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 border-b border-default px-5 py-3">
        <UButton icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" size="sm" disabled>
          Filtros
        </UButton>
        <UButton trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" size="sm" disabled>
          Todos los departamentos
        </UButton>
        <UButton trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" size="sm" disabled>
          Cualquier modalidad
        </UButton>
      </div>

      <div class="flex flex-col gap-4 px-5 py-4">
        <!-- Filters + view toggle row -->
        <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <!-- Filters (search + status tabs) -->
          <EmployeeFilters
            :search="search"
            :status-tab="statusTab"
            :is-loading="isFetching"
            @update:search="setSearch"
            @update:status-tab="setStatusTab"
          />

          <div class="flex items-center justify-end gap-2">
            <USelect
              model-value="recent"
              :items="[{ label: 'Más recientes', value: 'recent' }]"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-40"
              disabled
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="isFetching"
              aria-label="Actualizar colaboradores"
              @click="refresh"
            />
            <!-- Tabla / Tarjetas toggle -->
            <EmployeeViewToggle
              :model-value="viewMode"
              @update:model-value="setMode"
            />
          </div>
        </div>

        <!-- Table view -->
        <AppDataTable
          v-if="viewMode === 'table'"
          v-model:pagination="pagination"
          :columns="columns"
          :data="employees"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="[10, 20, 50]"
          :show-toolbar="false"
          :show-add-button="false"
          :show-refresh="false"
          add-button-text="Nuevo colaborador"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron colaboradores"
          search-placeholder="Buscar colaborador..."
          @refresh="refresh"
          @add="openCreateSlideover"
        >
          <!-- Colaborador cell — avatar + name + email (click → detail view) -->
          <template #colaborador-cell="{ row }">
            <div
              class="flex cursor-pointer items-center gap-3"
              @click="navigateToDetail(row.original)"
            >
              <div class="relative shrink-0">
                <div
                  class="flex size-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm"
                  :class="getAvatarClass(row.original.id)"
                  :aria-label="row.original.fullName"
                >
                  {{ getInitials(row.original.fullName) }}
                </div>
                <span
                  v-if="row.original.status === 'ACTIVE'"
                  class="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-default bg-emerald-500"
                  aria-label="Activo"
                />
              </div>
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
            <UBadge
              v-if="row.original.currentDepartment"
              variant="outline"
              size="md"
              :class="DEPARTMENT_BADGE_CLASS"
              :ui="{ base: 'gap-2 rounded-full px-3 py-1.5 shadow-none ring ring-inset ring-gray-200 dark:ring-gray-700', label: 'text-xs font-medium' }"
            >
              <template #leading>
                <span class="size-2 rounded-full" :class="getDepartmentDotClass(row.original.currentDepartment)" />
              </template>
              {{ row.original.currentDepartment }}
            </UBadge>
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <!-- Jefe directo cell — resolved manager name or "—" -->
          <template #jefedirecto-cell="{ row }">
            <div v-if="getManagerDisplay(row.original) !== '—'" class="flex items-center gap-2">
              <div
                class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm"
                :class="getAvatarClass(getManagerDisplay(row.original))"
              >
                {{ getInitials(getManagerDisplay(row.original)) }}
              </div>
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

          <!-- Estado cell — badge chip -->
          <template #estado-cell="{ row }">
            <UBadge
              variant="outline"
              size="md"
              :class="getStatusBadgeClass((row.original as Employee).status)"
              :ui="{ base: 'gap-2 rounded-full px-3 py-1.5 shadow-none ring-0', label: 'text-xs font-semibold' }"
            >
              <template #leading>
                <span class="size-2 rounded-full" :class="getStatusDotClass((row.original as Employee).status)" />
              </template>
              {{ EMPLOYEE_STATUS_LABELS[(row.original as Employee).status] }}
            </UBadge>
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
        </AppDataTable>

        <!-- Card view -->
        <template v-else>
          <EmployeeCardGrid
            :employees="employees"
            :manager-map="managerMap"
            :loading="isLoading"
            :can-update="canUpdate"
            empty="No se encontraron colaboradores"
            @edit="openEditSlideover"
            @terminate="openTerminateDialog"
            @reactivate="openReactivateDialog"
            @card-click="navigateToDetail"
          />

          <!-- Card view pagination — simple row count info + page navigation -->
          <div
            v-if="totalCount > 0"
            class="flex items-center justify-between border-t border-default pt-4 text-sm text-muted"
          >
            <span>Mostrando {{ showingFrom }}–{{ showingTo }} de {{ totalCount }}</span>
            <div class="flex items-center gap-2">
              <UButton
                variant="ghost"
                size="xs"
                icon="i-lucide-chevron-left"
                :disabled="page <= 1"
                aria-label="Página anterior"
                @click="setPage(page - 1)"
              />
              <span class="px-1">{{ page }} / {{ pageCount || 1 }}</span>
              <UButton
                variant="ghost"
                size="xs"
                icon="i-lucide-chevron-right"
                :disabled="page >= pageCount"
                aria-label="Página siguiente"
                @click="setPage(page + 1)"
              />
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>

  <!-- Create Employee Slideover — gated by canCreate (create:Employee CASL) -->
  <CreateEmployeeSlideover
    v-if="canCreate"
    v-model:open="isCreateOpen"
    @success="refresh"
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
