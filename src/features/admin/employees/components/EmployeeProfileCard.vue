<script setup lang="ts">
/**
 * EmployeeProfileCard — WU-06A (redesigned)
 *
 * Left sidebar profile card for the Employee Detail View.
 * Displays:
 *   - Large colorful avatar (deterministic palette based on id) with active status dot
 *   - Full name prominently displayed
 *   - Employee number with copy icon
 *   - Current position title
 *   - Row of UBadge chips: department (neutral bg + colored dot), status (colored bg + dot), modality (colored bg)
 *   - Action buttons: Exportar, Editar
 *   - Contact section: Email, Phone, Location — label-value pairs separated by dividers
 *   - Personal section: Birthday, Contract type, Hire date
 *
 * Design: matches Claude Design reference with dot-badge pattern from list view.
 * Light/dark compatible via Nuxt UI 4 tokens.
 */

import { computed } from 'vue'
import {
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { buildProfileInitials } from '../composables/useEmployeeDetail'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'
import {
  WORK_MODALITY_LABELS,
  CONTRACT_TYPE_LABELS,
  type Employee,
} from '../interfaces/employee.types'
import {
  employeeStatusConfig,
  getDepartmentDotClass,
} from '../utils/employeeBadgeConfig.utils'
import DotBadge from '@/core/shared/components/DotBadge.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'

const props = defineProps<{
  employee: Employee
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
  terminate: [employee: Employee]
  reactivate: [employee: Employee]
}>()

// ── Avatar ─────────────────────────────────────────────────────────────────────
const initials = computed(() => buildProfileInitials(props.employee.fullName))

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

// ── Badge config lookups (status + modality) ──────────────────────────────────
const statusConfig = computed(() => employeeStatusConfig[props.employee.status])
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])

function getModalityBadgeClass(modality: Employee['workModality']): string {
  switch (modality) {
    case 'REMOTE':
      return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300'
    case 'HYBRID':
      return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-300'
    case 'ONSITE':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300'
  }
}

// ── Derived display ────────────────────────────────────────────────────────────
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))
const contractLabel = computed(() => CONTRACT_TYPE_LABELS[props.employee.contractType])

const locationDisplay = computed<string | null>(() => {
  const e = props.employee
  const parts = [e.neighborhood, e.city, e.state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
})

const dobDisplay = computed<string | null>(() => {
  if (!props.employee.dateOfBirth) return null
  try {
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(props.employee.dateOfBirth))
  } catch {
    return props.employee.dateOfBirth
  }
})

// ── Employee number copy ───────────────────────────────────────────────────────
async function copyEmployeeNumber(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.employee.employeeNumber)
  } catch {
    // Clipboard not available in all contexts — fail silently
  }
}

// ── Action menu ───────────────────────────────────────────────────────────────
const rowActions = computed(() =>
  getEmployeeRowActions(props.employee, props.canUpdate ?? false, {
    onEdit: () => emit('edit', props.employee),
    onTerminate: () => emit('terminate', props.employee),
    onReactivate: () => emit('reactivate', props.employee),
  }),
)
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }" class="overflow-hidden">
    <!-- Decorative header band: soft gradient + bottom border -->
    <div
      class="relative h-20 bg-gradient-to-br from-primary-500/15 via-primary-500/5 to-transparent dark:from-primary-400/15 dark:via-primary-400/5"
      aria-hidden="true"
    >
      <div class="absolute inset-x-0 bottom-0 h-px bg-default" />
    </div>

    <!-- Avatar + identity section -->
    <div class="flex flex-col items-center gap-3 px-6 pb-5 text-center -mt-12">
      <!-- Colorful avatar with active dot -->
      <div class="relative">
        <div
          class="flex size-24 items-center justify-center rounded-full text-2xl font-bold shadow-lg ring-4 ring-white dark:ring-gray-900"
          :class="getAvatarClass(employee.id)"
          :aria-label="employee.fullName"
        >
          {{ initials }}
        </div>
        <!-- Active status green dot -->
        <span
          v-if="employee.status === 'ACTIVE'"
          class="absolute bottom-1 right-1 size-4 rounded-full border-[3px] border-white bg-emerald-500 dark:border-gray-900"
          aria-label="Activo"
        />
      </div>

      <!-- Name -->
      <h2 class="text-lg font-bold text-highlighted leading-tight">
        {{ employee.fullName }}
      </h2>

      <!-- Employee number — copyable -->
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-0.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
        :title="`Copiar: ${employee.employeeNumber}`"
        @click="copyEmployeeNumber"
      >
        <UIcon name="i-lucide-hash" class="size-3.5" />
        <span class="font-mono text-xs">{{ employee.employeeNumber }}</span>
        <UIcon
          name="i-lucide-copy"
          class="size-3 opacity-0 group-hover:opacity-70 transition-opacity"
        />
      </button>

      <!-- Current position -->
      <p
        v-if="employee.currentPosition"
        class="text-sm text-muted"
      >
        {{ employee.currentPosition }}
      </p>

      <!-- Badges: department, status, modality -->
      <div class="flex flex-wrap justify-center gap-1.5">
        <!-- Department badge (neutral bg, colored dot) -->
        <DotBadge
          v-if="employee.currentDepartment"
          :label="employee.currentDepartment"
          :dot-class="getDepartmentDotClass(employee.currentDepartment)"
        />

        <!-- Status badge (semantic tone + dark mode from shared component) -->
        <StatusDotBadge
          :tone="statusConfig.tone"
          :label="statusConfig.label"
        />

        <!-- Modality badge (colored bg, no dot) -->
        <UBadge
          variant="outline"
          size="md"
          :class="getModalityBadgeClass(employee.workModality)"
          :ui="{ base: 'gap-1.5 rounded-full px-3 py-1.5 shadow-none ring-0', label: 'text-xs font-semibold' }"
          :aria-label="`Modalidad: ${modalityLabel}`"
        >
          {{ modalityLabel }}
        </UBadge>
      </div>
    </div>

    <UDivider />

    <!-- Action buttons row -->
    <div v-if="canUpdate" class="flex items-center gap-2 px-6 py-3">
      <UButton
        icon="i-lucide-pencil"
        color="primary"
        variant="soft"
        size="sm"
        block
        class="flex-1 min-w-0"
        :ui="{ label: 'truncate' }"
        @click="emit('edit', employee)"
      >
        Editar perfil
      </UButton>

      <!-- Action menu (terminate / reactivate) -->
      <UDropdownMenu
        v-if="rowActions.length > 1"
        :items="rowActions.filter(a => a.label !== 'Editar')"
        :content="{ align: 'end' }"
      >
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Más acciones"
        />
      </UDropdownMenu>
    </div>

    <UDivider v-if="canUpdate" />

    <!-- Contact section -->
    <div class="px-6 py-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Contacto
      </h3>
      <div class="flex flex-col divide-y divide-default">
        <!-- Email -->
        <div v-if="employee.email" class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-xs text-muted">Email</span>
          <a
            :href="`mailto:${employee.email}`"
            class="min-w-0 truncate text-sm font-medium text-default hover:text-primary"
          >
            {{ employee.email }}
          </a>
        </div>

        <!-- Phone -->
        <div v-if="employee.phone" class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-xs text-muted">Teléfono</span>
          <a
            :href="`tel:${employee.phone}`"
            class="text-sm font-medium text-default hover:text-primary"
          >
            {{ employee.phone }}
          </a>
        </div>

        <!-- Location -->
        <div v-if="locationDisplay" class="flex items-center justify-between gap-3 py-2.5">
          <span class="shrink-0 text-xs text-muted">Ubicación</span>
          <span class="min-w-0 truncate text-sm font-medium text-default text-right">{{ locationDisplay }}</span>
        </div>
      </div>
    </div>

    <UDivider />

    <!-- Personal section -->
    <div class="px-6 py-4">
      <h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
        Personal
      </h3>
      <div class="flex flex-col divide-y divide-default">
        <!-- Birthday -->
        <div v-if="dobDisplay" class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-xs text-muted">Cumpleaños</span>
          <span class="text-sm font-medium text-default">{{ dobDisplay }}</span>
        </div>

        <!-- Contract type -->
        <div class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-xs text-muted">Contrato</span>
          <span class="text-sm font-medium text-default">{{ contractLabel }}</span>
        </div>

        <!-- Hire date -->
        <div class="flex items-center justify-between gap-3 py-2.5">
          <span class="text-xs text-muted">Fecha de ingreso</span>
          <span class="text-sm font-medium text-default">{{ hireDateFormatted }}</span>
        </div>
      </div>
    </div>
  </UCard>
</template>
