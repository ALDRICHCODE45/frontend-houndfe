<script setup lang="ts">
/**
 * EmployeesListView — WU-03 (card view + toggle + manager name resolution)
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
 * Design: Claude "Colaboradores" adapted to warm-orange Nuxt UI 4 tokens.
 * Status tabs: Todos / Activos / Bajas
 * Table columns: Colaborador, Cargo, Departamento, Jefe directo, Fecha de ingreso, Modalidad, Estado
 * Salary: intentionally NOT shown in list or cards — belongs in Compensación detail tab (WU-06+)
 *
 * Permission gate: route-level meta.permission ['read', 'Employee'].
 * Create button gated by create:Employee.
 */

import { computed } from 'vue'
import { AppDataTable } from '@/core/shared/components/DataTable'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { EMPLOYEE_STATUS_LABELS, WORK_MODALITY_LABELS } from '../interfaces/employee.types'
import { useEmployeesList } from '../composables/useEmployeesList'
import {
  useEmployeeColumns,
  employeeStatusToBadgeTone,
  workModalityToBadgeTone,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { useEmployeeViewMode } from '../composables/useEmployeeViewMode'
import { useManagerResolution, resolveManagerName } from '../composables/useManagerResolution'
import EmployeeFilters from '../components/EmployeeFilters.vue'
import EmployeeViewToggle from '../components/EmployeeViewToggle.vue'
import EmployeeCardGrid from '../components/EmployeeCardGrid.vue'
import type { Employee } from '../interfaces/employee.types'

const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

// ── CASL guards ────────────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Employee'))

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

// ── Manager display (table view — reads from resolved map via pure helper) ─────
function getManagerDisplay(employee: Employee): string {
  return resolveManagerName(employee.managerId, managerMap.value)
}

// ── Pagination state forwarding ────────────────────────────────────────────────
const pagination = computed({
  get: () => ({ pageIndex: page.value - 1, pageSize: pageSize.value }),
  set: (val: { pageIndex: number; pageSize: number }) => {
    setPage(val.pageIndex + 1)
    setPageSize(val.pageSize)
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
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <AdminPageHeader
          title="Colaboradores"
          description="Equipo, lifecycle, organigrama y documentos del personal"
        />
      </template>

      <div class="flex flex-col gap-4 px-6 py-5">
        <!-- Filters + view toggle row -->
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- Filters (search + status tabs) -->
          <EmployeeFilters
            :search="search"
            :status-tab="statusTab"
            :is-loading="isFetching"
            @update:search="setSearch"
            @update:status-tab="setStatusTab"
          />

          <!-- Tabla / Tarjetas toggle -->
          <EmployeeViewToggle
            :model-value="viewMode"
            @update:model-value="setMode"
          />
        </div>

        <!-- Add button row (only in card view — table has its own) -->
        <div v-if="viewMode === 'card' && canCreate" class="flex justify-end">
          <UButton
            icon="i-lucide-user-plus"
            color="primary"
            size="sm"
            disabled
          >
            Nuevo colaborador
          </UButton>
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
          :show-add-button="canCreate"
          add-button-text="Nuevo colaborador"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron colaboradores"
          search-placeholder="Buscar colaborador..."
          @refresh="refresh"
        >
          <!-- Colaborador cell — avatar + name + email -->
          <template #colaborador-cell="{ row }">
            <div class="flex items-center gap-3">
              <UAvatar
                :alt="row.original.fullName"
                :text="getInitials(row.original.fullName)"
                size="sm"
              />
              <div class="min-w-0">
                <p class="truncate font-medium text-highlighted">{{ row.original.fullName }}</p>
                <p v-if="row.original.email" class="truncate text-sm text-muted">
                  {{ row.original.email }}
                </p>
                <p v-else class="text-sm text-muted">—</p>
              </div>
            </div>
          </template>

          <!-- Cargo cell -->
          <template #cargo-cell="{ row }">
            <span class="text-sm">{{ row.original.currentPosition ?? '—' }}</span>
          </template>

          <!-- Departamento cell -->
          <template #departamento-cell="{ row }">
            <span class="text-sm">{{ row.original.currentDepartment ?? '—' }}</span>
          </template>

          <!-- Jefe directo cell — resolved manager name or "—" -->
          <template #jefedirecto-cell="{ row }">
            <span class="text-sm text-muted">{{ getManagerDisplay(row.original) }}</span>
          </template>

          <!-- Fecha de ingreso cell -->
          <template #fechaIngreso-cell="{ row }">
            <span class="text-sm">{{ formatHireDate(row.original.hireDate) }}</span>
          </template>

          <!-- Modalidad cell — badge chip -->
          <template #modalidad-cell="{ row }">
            <AppBadge
              :label="WORK_MODALITY_LABELS[(row.original as Employee).workModality]"
              :tone="workModalityToBadgeTone((row.original as Employee).workModality)"
              :aria-label="`Modalidad: ${WORK_MODALITY_LABELS[(row.original as Employee).workModality]}`"
            />
          </template>

          <!-- Estado cell — badge chip -->
          <template #estado-cell="{ row }">
            <AppBadge
              :label="EMPLOYEE_STATUS_LABELS[(row.original as Employee).status]"
              :tone="employeeStatusToBadgeTone((row.original as Employee).status)"
              :aria-label="`Estado: ${EMPLOYEE_STATUS_LABELS[(row.original as Employee).status]}`"
            />
          </template>

          <!-- Actions cell — placeholder for WU-04+ mutations -->
          <template #actions-cell>
            <!-- Mutation actions (terminate/reactivate/edit) deferred to WU-04 -->
          </template>
        </AppDataTable>

        <!-- Card view -->
        <template v-else>
          <EmployeeCardGrid
            :employees="employees"
            :manager-map="managerMap"
            :loading="isLoading"
            empty="No se encontraron colaboradores"
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
    </UCard>
  </div>
</template>
