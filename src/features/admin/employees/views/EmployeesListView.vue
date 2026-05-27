<script setup lang="ts">
/**
 * EmployeesListView — WU-02 (warning fixes applied)
 *
 * Orchestrator view for the Colaboradores list page.
 * Composition surface: wires useEmployeesList + useEmployeeColumns + EmployeeFilters.
 *
 * Design direction: Claude "Colaboradores" adapted to warm-orange Nuxt UI 4 tokens.
 * - Title: Colaboradores
 * - Subtitle: Equipo, lifecycle, organigrama y documentos del personal
 * - Status tabs: Todos / Activos / Bajas (on_leave removed — not a backend list param)
 * - Table columns: Colaborador, Cargo, Departamento, Jefe directo, Fecha de ingreso, Modalidad, Estado
 *   (Salary column removed from list — belongs in Compensación detail tab WU-06+)
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
import { useEmployeeColumns, employeeStatusToBadgeTone, workModalityToBadgeTone, formatHireDate, getManagerDisplay } from '../composables/useEmployeeColumns'
import EmployeeFilters from '../components/EmployeeFilters.vue'
import type { Employee } from '../interfaces/employee.types'

const authStore = useAuthStore()

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

// ── Avatar helper ──────────────────────────────────────────────────────────────
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'C'
}

// ── Manager display ────────────────────────────────────────────────────────────
// Delegated to the pure helper getManagerDisplay() in useEmployeeColumns.
// Returns "—" for null and for non-null UUIDs until WU-03 adds name resolution.
// The pure helper is tested independently in __tests__/useEmployeesList.spec.ts.

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
        <!-- Filters row -->
        <EmployeeFilters
          :search="search"
          :status-tab="statusTab"
          :is-loading="isFetching"
          @update:search="setSearch"
          @update:status-tab="setStatusTab"
        />

        <!-- Table -->
        <AppDataTable
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

          <!-- Jefe directo cell — graceful fallback for WU-02 -->
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

          <!-- Actions cell — placeholder for WU-03+ mutations -->
          <template #actions-cell>
            <!-- Mutation actions (terminate/reactivate/edit) deferred to WU-03 -->
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
