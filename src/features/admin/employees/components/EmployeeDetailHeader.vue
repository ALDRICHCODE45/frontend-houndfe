<script setup lang="ts">
/**
 * EmployeeDetailHeader — top of the Colaborador detail (Detail header rules).
 *
 * Meta line (status badge, then position · department), the name as the title,
 * and the actions on the right: ONE primary (Editar perfil, needs
 * update:Employee), the ⋮ menu for the rest (Reactivar… / Dar de baja…, the
 * destructive one last) and the back button. Contact, contract and hire date
 * live in their tabs, so they are not repeated here.
 */
import { computed } from 'vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { getEmployeeRowActions, type EmployeeRowActionKey } from '../composables/useEmployeeActions'
import { employeeStatusConfig } from '../utils/employeeBadgeConfig.utils'
import type { Employee } from '../interfaces/employee.types'

const props = defineProps<{
  employee: Employee
  canUpdate?: boolean
}>()

const emit = defineEmits<{
  back: []
  edit: [employee: Employee]
  terminate: [employee: Employee]
  reactivate: [employee: Employee]
}>()

const status = computed(() => employeeStatusConfig[props.employee.status])

const jobLine = computed(() =>
  [props.employee.currentPosition, props.employee.currentDepartment].filter(Boolean).join(' · '),
)

// Editar is the header's primary button, so the menu holds only the rest.
const menuActions = computed(() =>
  getEmployeeRowActions(props.employee, props.canUpdate ?? false).filter(
    (action) => action.key !== 'edit',
  ),
)

function handleAction(key: string): void {
  const action = key as Exclude<EmployeeRowActionKey, 'edit'>
  if (action === 'terminate') emit('terminate', props.employee)
  else if (action === 'reactivate') emit('reactivate', props.employee)
}
</script>

<template>
  <header class="employee-detail-header" data-testid="employee-detail-header">
    <UButton
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      aria-label="Volver a colaboradores"
      data-testid="employee-detail-back"
      @click="emit('back')"
    />

    <div class="employee-detail-heading">
      <p class="employee-detail-meta">
        <StatusBadge :tone="status.tone" :label="status.label" />
        <span v-if="jobLine" class="employee-detail-job" :title="jobLine">{{ jobLine }}</span>
      </p>
      <h1 class="employee-detail-title" :title="employee.fullName">{{ employee.fullName }}</h1>
    </div>

    <div class="employee-detail-actions">
      <UButton
        v-if="canUpdate"
        icon="i-lucide-pencil"
        class="hf-primary-control"
        data-testid="employee-detail-edit"
        @click="emit('edit', employee)"
      >
        Editar perfil
      </UButton>
      <RowActionsMenu
        :actions="menuActions"
        :row-label="employee.fullName"
        aria-label="Más acciones del colaborador"
        portal-class="employees-form-portal"
        @select="handleAction"
      />
    </div>
  </header>
</template>
