<script setup lang="ts">
/**
 * TerminateEmployeeDialog — WU-05B
 *
 * Confirm dialog for terminating an employee (Dar de baja).
 * Shows terminationDate + terminationReason fields before confirming.
 *
 * Only available when employee status is ACTIVE or ON_LEAVE.
 * Backend error EMPLOYEE_ALREADY_TERMINATED is handled by useTerminateEmployee onError.
 *
 * Contract:
 *   - Props: open (v-model:open), employee (the Employee to terminate)
 *   - Emits: success (employee terminated, dialog should close)
 *   - On success: composable handles toast + query invalidation
 *   - On error: composable shows Spanish error toast
 */

import { reactive } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'
import { TerminateEmployeeDtoSchema } from '../interfaces/employee.types'
import type { Employee } from '../interfaces/employee.types'
import { useTerminateEmployee } from '../composables/useTerminateEmployee'

// ─── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  success: []
}>()

// ─── Form state ────────────────────────────────────────────────────────────────

const formId = 'terminate-employee-form'

const state = reactive({
  terminationDate: '',
  terminationReason: '',
})

const schema = TerminateEmployeeDtoSchema

function resetForm(): void {
  state.terminationDate = ''
  state.terminationReason = ''
}

// ─── Mutation ─────────────────────────────────────────────────────────────────

const { mutateAsync, isPending } = useTerminateEmployee()

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleClose(): void {
  resetForm()
  open.value = false
}

async function onSubmit(event: FormSubmitEvent<typeof state>): Promise<void> {
  if (!props.employee) return

  try {
    await mutateAsync({
      id: props.employee.id,
      dto: {
        terminationDate: event.data.terminationDate,
        terminationReason: event.data.terminationReason,
      },
    })
    // useTerminateEmployee handles success toast + query invalidation
    resetForm()
    open.value = false
    emit('success')
  } catch {
    // useTerminateEmployee.onError handles error toasts
    // Dialog stays open so the user can see the error
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Dar de baja al colaborador"
    :dismissible="!isPending"
    :close="!isPending"
    @after-leave="resetForm"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Warning context -->
        <p class="text-sm text-muted">
          Estás a punto de dar de baja a
          <span class="font-semibold text-highlighted">{{ employee?.fullName ?? 'este colaborador' }}</span>.
          Esta acción cambiará su estado a <span class="font-medium text-error">Baja</span>.
        </p>

        <!-- Form with terminationDate + terminationReason -->
        <UForm
          :id="formId"
          :schema="schema"
          :state="state"
          class="flex flex-col gap-4"
          @submit="onSubmit"
        >
          <UFormField label="Fecha de baja" name="terminationDate" required>
            <DateFieldPopover
              v-model="state.terminationDate"
              placeholder="Elegir fecha de baja"
              :min-iso="null"
              :disabled="isPending"
            />
          </UFormField>

          <UFormField label="Motivo de la baja" name="terminationReason" required>
            <UTextarea
              v-model="state.terminationReason"
              class="w-full"
              size="lg"
              placeholder="Ej: Renuncia voluntaria, vencimiento de contrato, etc."
              :rows="3"
              :disabled="isPending"
            />
          </UFormField>
        </UForm>
      </div>
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
          label="Dar de baja"
          color="error"
          type="submit"
          :form="formId"
          :loading="isPending"
        />
      </div>
    </template>
  </UModal>
</template>
