<script setup lang="ts">
/**
 * EmployeeProfileCard — WU-06A
 *
 * Left sidebar profile card for the Employee Detail View.
 * Displays:
 *   - Large avatar with initials (no photo in v1)
 *   - Full name + employee number (copyable via UButton icon)
 *   - Current position
 *   - Status, department, and modality chips
 *   - Email, phone, location (if available)
 *   - Hire date formatted
 *   - Birthday (if available)
 *   - Action buttons: Editar (guarded by update:Employee), action menu (terminate/reactivate)
 *
 * Design: warm-orange accented, dense HR card per Claude Design screenshots.
 * Light/dark compatible via Nuxt UI 4 tokens.
 */

import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import {
  employeeStatusToBadgeTone,
  workModalityToBadgeTone,
  formatHireDate,
} from '../composables/useEmployeeColumns'
import { buildProfileInitials } from '../composables/useEmployeeDetail'
import { getEmployeeRowActions } from '../composables/useEmployeeActions'
import {
  EMPLOYEE_STATUS_LABELS,
  WORK_MODALITY_LABELS,
  type Employee,
} from '../interfaces/employee.types'

const props = defineProps<{
  employee: Employee
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  edit: [employee: Employee]
  terminate: [employee: Employee]
  reactivate: [employee: Employee]
}>()

// ── Derived display ────────────────────────────────────────────────────────────
const initials = computed(() => buildProfileInitials(props.employee.fullName))
const statusTone = computed(() => employeeStatusToBadgeTone(props.employee.status))
const statusLabel = computed(() => EMPLOYEE_STATUS_LABELS[props.employee.status])
const modalityTone = computed(() => workModalityToBadgeTone(props.employee.workModality))
const modalityLabel = computed(() => WORK_MODALITY_LABELS[props.employee.workModality])
const hireDateFormatted = computed(() => formatHireDate(props.employee.hireDate))

// ── Address display ────────────────────────────────────────────────────────────
const locationDisplay = computed<string | null>(() => {
  const e = props.employee
  const parts = [e.neighborhood, e.city, e.state].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
})

// ── Date of birth display ──────────────────────────────────────────────────────
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
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <!-- Avatar + name section -->
    <div class="flex flex-col items-center gap-4 px-6 pb-5 pt-6 text-center">
      <!-- Avatar with initials -->
      <UAvatar
        :alt="employee.fullName"
        :text="initials"
        size="3xl"
        :ui="{ root: 'ring-4 ring-primary/20 shadow-sm' }"
      />

      <!-- Name -->
      <div class="space-y-1">
        <h2 class="text-xl font-bold text-highlighted leading-tight">
          {{ employee.fullName }}
        </h2>

        <!-- Employee number — copyable -->
        <button
          class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-default transition-colors group"
          :title="`Copiar número de empleado: ${employee.employeeNumber}`"
          @click="copyEmployeeNumber"
        >
          <UIcon name="i-lucide-hash" class="size-3.5" />
          <span class="font-mono">{{ employee.employeeNumber }}</span>
          <UIcon
            name="i-lucide-copy"
            class="size-3 opacity-0 group-hover:opacity-60 transition-opacity"
          />
        </button>
      </div>

      <!-- Current position -->
      <p
        v-if="employee.currentPosition"
        class="text-sm font-medium text-default"
      >
        {{ employee.currentPosition }}
      </p>

      <!-- Status + modality chips -->
      <div class="flex flex-wrap justify-center gap-2">
        <AppBadge
          :label="statusLabel"
          :tone="statusTone"
          :aria-label="`Estado: ${statusLabel}`"
        />
        <AppBadge
          v-if="employee.currentDepartment"
          :label="employee.currentDepartment"
          tone="neutral"
        />
        <AppBadge
          :label="modalityLabel"
          :tone="modalityTone"
          :aria-label="`Modalidad: ${modalityLabel}`"
        />
      </div>
    </div>

    <UDivider />

    <!-- Contact + info section -->
    <div class="flex flex-col gap-3 px-6 py-5">
      <!-- Email -->
      <div v-if="employee.email" class="flex items-start gap-3">
        <UIcon name="i-lucide-mail" class="mt-0.5 size-4 shrink-0 text-muted" />
        <a
          :href="`mailto:${employee.email}`"
          class="min-w-0 break-all text-sm text-default hover:text-primary hover:underline"
        >
          {{ employee.email }}
        </a>
      </div>

      <!-- Phone -->
      <div v-if="employee.phone" class="flex items-center gap-3">
        <UIcon name="i-lucide-phone" class="size-4 shrink-0 text-muted" />
        <a
          :href="`tel:${employee.phone}`"
          class="text-sm text-default hover:text-primary"
        >
          {{ employee.phone }}
        </a>
      </div>

      <!-- Location -->
      <div v-if="locationDisplay" class="flex items-start gap-3">
        <UIcon name="i-lucide-map-pin" class="mt-0.5 size-4 shrink-0 text-muted" />
        <span class="text-sm text-default">{{ locationDisplay }}</span>
      </div>

      <!-- Hire date -->
      <div class="flex items-center gap-3">
        <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-muted" />
        <div class="flex flex-col">
          <span class="text-xs text-muted">Fecha de ingreso</span>
          <span class="text-sm font-medium text-default">{{ hireDateFormatted }}</span>
        </div>
      </div>

      <!-- Birthday -->
      <div v-if="dobDisplay" class="flex items-center gap-3">
        <UIcon name="i-lucide-cake" class="size-4 shrink-0 text-muted" />
        <div class="flex flex-col">
          <span class="text-xs text-muted">Fecha de nacimiento</span>
          <span class="text-sm text-default">{{ dobDisplay }}</span>
        </div>
      </div>
    </div>

    <UDivider />

    <!-- Action buttons -->
    <div class="flex items-center justify-between gap-2 px-6 py-4">
      <!-- Edit button (gated by update:Employee) -->
      <UButton
        v-if="canUpdate"
        icon="i-lucide-pencil"
        color="primary"
        variant="soft"
        size="sm"
        class="flex-1"
        @click="emit('edit', employee)"
      >
        Editar
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
  </UCard>
</template>
