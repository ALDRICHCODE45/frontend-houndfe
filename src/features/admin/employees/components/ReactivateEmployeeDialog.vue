<script setup lang="ts">
/**
 * ReactivateEmployeeDialog — WU-05B
 *
 * Simple confirm dialog for reactivating an employee.
 * No extra fields — just confirm the action.
 *
 * Only available when employee status is TERMINATED.
 * Backend error EMPLOYEE_NOT_TERMINATED is handled by useReactivateEmployee onError.
 *
 * Contract:
 *   - Props: open (v-model:open), employee (the Employee to reactivate)
 *   - Emits: success (employee reactivated, dialog should close)
 *   - On success: composable handles toast + query invalidation
 *   - On error: composable shows Spanish error toast
 */

import type { Employee } from '../interfaces/employee.types'
import { useReactivateEmployee } from '../composables/useReactivateEmployee'

// ─── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  success: []
}>()

// ─── Mutation ─────────────────────────────────────────────────────────────────

const { mutateAsync, isPending } = useReactivateEmployee()

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleClose(): void {
  open.value = false
}

async function handleConfirm(): Promise<void> {
  if (!props.employee) return

  try {
    await mutateAsync(props.employee.id)
    // useReactivateEmployee handles success toast + query invalidation
    open.value = false
    emit('success')
  } catch {
    // useReactivateEmployee.onError handles error toasts
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Reactivar colaborador"
    :dismissible="!isPending"
    :close="!isPending"
  >
    <template #body>
      <p class="text-sm text-muted">
        ¿Confirmás que querés reactivar a
        <span class="font-semibold text-highlighted">{{ employee?.fullName ?? 'este colaborador' }}</span>?
        Su estado volverá a <span class="font-medium text-success">Activo</span>.
      </p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isPending"
          @click="handleClose"
        />
        <UButton
          label="Reactivar"
          color="primary"
          :loading="isPending"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
