<script setup lang="ts">
/**
 * ResumenPanel — WU-06A
 *
 * "Vista rápida" panel for the Employee Detail View — Resumen tab.
 *
 * Displays:
 *   - Key stats cards: antigüedad, sueldo actual (if hasSalary), vacaciones (placeholder), reportes directos (placeholder)
 *   - "Reporta a" section — manager info (resolved via useManagerResolution or prop)
 *
 * Design: warm-orange accented stat cards, per Claude Design screenshots.
 * Salary display guarded by hasSalary() — never renders undefined as "0".
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { computeSeniority } from '../composables/useEmployeeViewMode'
import { formatCurrencyMXN } from '../composables/useEmployeeDetail'
import { hasSalary } from '../interfaces/employee.types'
import { employeeStatusToBadgeTone, formatHireDate } from '../composables/useEmployeeColumns'
import { EMPLOYEE_STATUS_LABELS } from '../interfaces/employee.types'
import type { Employee } from '../interfaces/employee.types'

const props = defineProps<{
  employee: Employee
  /** Resolved manager display name (or "—") */
  managerDisplay: string
  /** Manager Employee object for linking (optional) */
  manager?: Employee | null
  canReadSalary?: boolean
}>()

// ── Derived stats ──────────────────────────────────────────────────────────────
const seniority = computed(() => computeSeniority(props.employee.hireDate))
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const salaryDisplay = computed<string>(() => {
  if (!hasSalary(props.employee)) return '—'
  return formatCurrencyMXN(props.employee.currentSalaryCents, props.employee.currentSalaryCurrency)
})
const managerStatusTone = computed(() =>
  props.manager ? employeeStatusToBadgeTone(props.manager.status) : 'neutral',
)
const managerStatusLabel = computed(() =>
  props.manager ? EMPLOYEE_STATUS_LABELS[props.manager.status] : '',
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Stats cards row -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <!-- Antigüedad -->
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-clock" class="size-3.5 text-primary" />
            Antigüedad
          </div>
          <p class="text-2xl font-bold text-highlighted">{{ seniority }}</p>
          <p class="text-xs text-muted">Desde {{ hireDateFormatted }}</p>
        </div>
      </UCard>

      <!-- Sueldo actual — only when canReadSalary and hasSalary -->
      <UCard
        v-if="canReadSalary && hasSalary(employee)"
        :ui="{ body: 'p-4 sm:p-4' }"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-wallet" class="size-3.5 text-primary" />
            Sueldo actual
          </div>
          <p class="text-xl font-bold text-highlighted">{{ salaryDisplay }}</p>
          <p class="text-xs text-muted">{{ employee.currentSalaryCurrency }}</p>
        </div>
      </UCard>

      <!-- Vacaciones (placeholder) -->
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-palmtree" class="size-3.5 text-primary" />
            Vacaciones
          </div>
          <p class="text-2xl font-bold text-highlighted">
            {{ employee.annualVacationDays ?? '—' }}
          </p>
          <p class="text-xs text-muted">días anuales asignados</p>
        </div>
      </UCard>

      <!-- Departamento -->
      <UCard :ui="{ body: 'p-4 sm:p-4' }">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 text-xs text-muted">
            <UIcon name="i-lucide-building-2" class="size-3.5 text-primary" />
            Departamento
          </div>
          <p class="truncate text-base font-bold text-highlighted">
            {{ employee.currentDepartment ?? '—' }}
          </p>
          <p class="text-xs text-muted">área actual</p>
        </div>
      </UCard>
    </div>

    <!-- Manager section -->
    <UCard :ui="{ body: 'p-5 sm:p-5' }">
      <h3 class="mb-4 text-sm font-semibold text-highlighted">Reporta a</h3>

      <template v-if="managerDisplay !== '—' && managerDisplay">
        <div class="flex items-center gap-4">
          <!-- Manager avatar -->
          <UAvatar
            :alt="managerDisplay"
            :text="managerDisplay.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')"
            size="lg"
            :ui="{ root: 'ring-2 ring-primary/20' }"
          />

          <!-- Manager info -->
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ managerDisplay }}</p>
            <p v-if="manager?.currentPosition" class="text-sm text-muted">
              {{ manager.currentPosition }}
            </p>
            <div v-if="manager" class="mt-1">
              <AppBadge
                :label="managerStatusLabel"
                :tone="managerStatusTone"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="flex items-center gap-3 text-sm text-muted">
          <UIcon name="i-lucide-user-x" class="size-4" />
          <span>Sin jefe directo asignado</span>
        </div>
      </template>
    </UCard>

    <!-- Responsibilities -->
    <UCard
      v-if="employee.currentResponsibilities"
      :ui="{ body: 'p-5 sm:p-5' }"
    >
      <h3 class="mb-3 text-sm font-semibold text-highlighted">Responsabilidades</h3>
      <p class="whitespace-pre-wrap text-sm text-default leading-relaxed">
        {{ employee.currentResponsibilities }}
      </p>
    </UCard>
  </div>
</template>
