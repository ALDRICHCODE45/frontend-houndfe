<script setup lang="ts">
/**
 * BatchTerminateModal — WU-12 (employees-batch-operations)
 *
 * Dedicated confirmation modal for batch-terminating multiple employees.
 * Hosts a `UTextarea` + Zod `BatchTerminateDtoSchema` validation — ConfirmModal
 * cannot host input fields, so this is a separate concern (SRP).
 *
 * Contract:
 *   Props:  open (v-model:open), employees (id/fullName/status summary), loading
 *   Emits:  update:open(boolean), confirm(reason: string)
 *
 * Behavior:
 *  - The "Dar de baja" confirm button is DISABLED while reason.trim() === ''
 *    (matches the Zod schema's min(1) validation — the API layer also trims)
 *  - Clicking confirm emits `confirm(reason)` (untrimmed; caller/API handles
 *    trim) — actually we emit the TRIMMED reason so backend never sees whitespace
 *  - Loading disables BOTH action buttons + the textarea (prevents double submit)
 *  - Cancel button emits `update:open(false)` and clears the form
 *
 * Why dedicated (vs. ConfirmModal): per SDD-12 design rationale, extending
 * ConfirmModal with an input slot risks regression across its 26 existing
 * callers. A separate modal honors SRP: one modal, one concern.
 */

import { computed, reactive } from 'vue'
import { BatchTerminateDtoSchema } from '../interfaces/employee.types'
import { employeeStatusConfig } from '../utils/employeeBadgeConfig.utils'

// ─── Props & emits ─────────────────────────────────────────────────────────────

interface SelectedEmployeeSummary {
  id: string
  fullName: string
  status: string
}

const props = withDefaults(
  defineProps<{
    open: boolean
    employees: SelectedEmployeeSummary[]
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'confirm', reason: string): void
}>()

// ─── Form state ────────────────────────────────────────────────────────────────

const formState = reactive({
  reason: '',
})

const schema = BatchTerminateDtoSchema

// Confirm disabled while reason is empty (after trim). The Zod schema
// enforces min(1) — we mirror that here so the button doesn't enable before
// validation would pass.
const isReasonValid = computed(() => formState.reason.trim().length > 0)
const isConfirmDisabled = computed(() => props.loading || !isReasonValid.value)

function resetForm(): void {
  formState.reason = ''
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleClose(): void {
  resetForm()
  emit('update:open', false)
}

function handleConfirm(): void {
  if (isConfirmDisabled.value) return
  // Emit the TRIMMED reason so backend never sees surrounding whitespace.
  emit('confirm', formState.reason.trim())
  resetForm()
}

function statusLabel(status: string): string {
  // employeeStatusConfig maps UPPERCASE enum to { label, tone }
  const config = employeeStatusConfig[status as keyof typeof employeeStatusConfig]
  return config?.label ?? status
}
</script>

<template>
  <UModal
    :open="props.open"
    title="Dar de baja a varios colaboradores"
    :dismissible="!props.loading"
    :close="!props.loading"
    data-testid="batch-terminate-modal"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <!-- Warning context -->
        <p class="text-sm text-muted">
          Estás a punto de dar de baja a
          <span class="font-semibold text-highlighted">
            {{ props.employees.length }}
            {{ props.employees.length === 1 ? 'colaborador' : 'colaboradores' }}
          </span>.
          Esta acción cambiará su estado a <span class="font-medium text-error">Baja</span>.
        </p>

        <!-- Selected employees list (scrollable, mirrors ConfirmModal items) -->
        <ul
          v-if="props.employees.length > 0"
          class="max-h-60 overflow-y-auto rounded-lg border border-default"
          data-testid="batch-terminate-employees"
        >
          <li
            v-for="employee in props.employees"
            :key="employee.id"
            class="flex items-center justify-between gap-2 border-b border-default px-3 py-2 text-sm last:border-b-0"
            data-testid="batch-terminate-employee-row"
          >
            <span data-testid="batch-terminate-employee-name" class="font-medium text-default">
              {{ employee.fullName }}
            </span>
            <span class="text-xs text-muted">{{ statusLabel(employee.status) }}</span>
          </li>
        </ul>

        <!-- Reason form (Zod-validated) -->
        <UForm
          :schema="schema"
          :state="formState"
          class="flex flex-col gap-4"
          @submit="handleConfirm"
        >
          <UFormField label="Motivo de la baja" name="reason" required>
            <UTextarea
              v-model="formState.reason"
              class="w-full"
              size="lg"
              placeholder="Ej: Reorganización, recorte, etc."
              :rows="3"
              :disabled="props.loading"
              data-testid="reason-textarea"
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
          :disabled="props.loading"
          data-testid="btn-cancel"
          @click="handleClose"
        />
        <UButton
          label="Dar de baja"
          color="warning"
          :disabled="isConfirmDisabled"
          :loading="props.loading"
          data-testid="btn-confirm"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
