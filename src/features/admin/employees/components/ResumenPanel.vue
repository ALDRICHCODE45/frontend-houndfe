<script setup lang="ts">
/**
 * ResumenPanel — WU-06A (redesigned)
 *
 * "Vista rapida" panel for the Employee Detail View — Resumen tab.
 *
 * Displays:
 *   - Key stats cards: seniority, current salary (if hasSalary), vacations, department
 *   - "Reporta a" section — manager with colorful avatar, name, position + department subtitle
 *
 * Design: matches Claude Design reference with dot-badge pattern.
 * Salary display guarded by hasSalary() — never renders undefined as "0".
 */

import { computed } from 'vue'
import { computeSeniority } from '../composables/useEmployeeViewMode'
import { formatCurrencyMXN } from '../composables/useEmployeeDetail'
import { hasSalary } from '../interfaces/employee.types'
import { formatHireDate } from '../composables/useEmployeeColumns'
import type { Employee } from '../interfaces/employee.types'
import type { ManagerInfo } from '../composables/useManagerResolution'

const props = defineProps<{
  employee: Employee
  /** Resolved manager display name (or "---") */
  managerDisplay: string
  /** Full manager info from the expanded ManagerInfo map */
  managerInfo?: ManagerInfo | null
  canReadSalary?: boolean
}>()

// ── Derived stats ──────────────────────────────────────────────────────────────
const seniority = computed(() => computeSeniority(props.employee.hireDate))
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const salaryDisplay = computed<string>(() => {
  if (!hasSalary(props.employee)) return '—'
  return formatCurrencyMXN(props.employee.currentSalaryCents, props.employee.currentSalaryCurrency)
})

// ── Manager avatar helpers ─────────────────────────────────────────────────────
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

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || 'C'
}

const managerSubtitle = computed(() => {
  const parts: string[] = []
  if (props.managerInfo?.currentPosition) parts.push(props.managerInfo.currentPosition)
  if (props.managerInfo?.currentDepartment) parts.push(props.managerInfo.currentDepartment)
  return parts.length > 0 ? parts.join(' \u00B7 ') : null
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Stats cards row -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <!-- Seniority -->
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

      <!-- Current salary — only when canReadSalary and hasSalary -->
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

      <!-- Vacations (placeholder) -->
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

      <!-- Department -->
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
          <!-- Colorful manager avatar -->
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold shadow-sm"
            :class="getAvatarClass(managerDisplay)"
          >
            {{ getInitials(managerDisplay) }}
          </div>

          <!-- Manager info -->
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-highlighted">{{ managerDisplay }}</p>
            <p v-if="managerSubtitle" class="text-sm text-muted">
              {{ managerSubtitle }}
            </p>
            <p v-if="managerInfo?.email" class="text-xs text-muted">
              {{ managerInfo.email }}
            </p>
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
