<script setup lang="ts">
/**
 * EmployeeEditSlideover — WU-05B
 *
 * Slideover form for editing an existing employee (Colaborador).
 * Uses Nuxt UI USlideover + UForm with Zod validation.
 *
 * Key differences from CreateEmployeeSlideover:
 *   - hireDate is READ-ONLY (not editable) — shown as plain text, not a field.
 *   - employeeNumber is editable but may trigger EMPLOYEE_NUMBER_CONFLICT on PATCH.
 *   - Form is pre-filled from the existing employee data.
 *   - Uses UpdateEmployeeDtoSchema (no hireDate, all fields optional).
 *   - Manager field uses USelectMenu with async search (same pattern as memberships).
 *
 * Contract:
 *   - Props: open (v-model:open), employee (the Employee to edit)
 *   - Emits: success (Employee updated and slideover should close)
 *   - On success: composable handles toast + query invalidation
 *   - On error: composable shows Spanish error toast; slideover stays open
 */

import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { CONTRACT_TYPE_LABELS, WORK_MODALITY_LABELS } from '../interfaces/employee.types'
import type { ContractType, Employee, WorkModality } from '../interfaces/employee.types'
import { useEditEmployeeForm, editFormStateToDto } from '../composables/useEditEmployeeForm'
import { useUpdateEmployee } from '../composables/useUpdateEmployee'
import { formatHireDate } from '../composables/useEmployeeColumns'
import { useManagerPicker } from '../composables/useManagerPicker'

// ─── Props & emits ─────────────────────────────────────────────────────────────

const props = defineProps<{
  employee: Employee | null
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  success: []
}>()

// ─── Form composable ───────────────────────────────────────────────────────────

const { state, schema, resetForm } = useEditEmployeeForm(() => props.employee)
const { mutateAsync, isPending } = useUpdateEmployee()

// ─── Manager picker (exclude self) ─────────────────────────────────────────────
const { search: managerSearch, managers, isLoading: isLoadingManagers } = useManagerPicker({
  excludeId: props.employee?.id ?? null,
})
const managerSearchTerm = ref('')

const managerOptions = computed(() =>
  managers.value.map((m) => ({
    label: m.label,
    value: m.id,
    description: [m.position, m.department].filter((s) => s !== '—').join(' · ') || undefined,
  })),
)

watch(managerSearchTerm, (v) => {
  managerSearch.value = v
})

// ─── Select options ────────────────────────────────────────────────────────────

const CONTRACT_TYPE_OPTIONS = computed(() =>
  Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
    label,
    value: value as ContractType,
  })),
)

const WORK_MODALITY_OPTIONS = computed(() =>
  Object.entries(WORK_MODALITY_LABELS).map(([value, label]) => ({
    label,
    value: value as WorkModality,
  })),
)

// ─── Display helpers ───────────────────────────────────────────────────────────

const hireDateDisplay = computed(() =>
  props.employee ? formatHireDate(props.employee.hireDate) : '—',
)

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleClose(): void {
  resetForm()
  open.value = false
}

async function onSubmit(event: FormSubmitEvent<typeof state>): Promise<void> {
  if (!props.employee) return

  const dto = editFormStateToDto(event.data as typeof state)
  try {
    await mutateAsync({ id: props.employee.id, dto })
    // useUpdateEmployee handles success toast + query invalidation
    resetForm()
    open.value = false
    emit('success')
  } catch {
    // useUpdateEmployee.onError handles error toasts
    // Slideover stays open for the user to correct the input
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Editar colaborador"
    description="Modificá los datos del colaborador. La fecha de ingreso no es editable."
    side="right"
    inset
    @after-leave="resetForm"
  >
    <template #body>
      <UForm
        id="edit-employee-form"
        :schema="schema"
        :state="state"
        class="flex flex-col gap-5"
        @submit="onSubmit"
      >
        <!-- ── Sección: Identificación ───────────────────────────────────── -->
        <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
          <p class="mb-4 text-sm font-semibold text-highlighted">Identificación</p>
          <div class="flex flex-col gap-4">
            <UFormField label="Número de empleado" name="employeeNumber">
              <UInput
                v-model="state.employeeNumber"
                class="w-full"
                size="lg"
                placeholder="Ej: EMP-001"
                :disabled="isPending"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Nombre(s)" name="firstName">
                <UInput
                  v-model="state.firstName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: Juan"
                  :disabled="isPending"
                />
              </UFormField>

              <UFormField label="Apellido(s)" name="lastName">
                <UInput
                  v-model="state.lastName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: García"
                  :disabled="isPending"
                />
              </UFormField>
            </div>

            <!-- hireDate — read-only, displayed as plain text -->
            <div class="flex flex-col gap-1">
              <p class="text-sm font-medium text-default">Fecha de ingreso</p>
              <p class="rounded-lg border border-default bg-elevated/50 px-3 py-2.5 text-sm text-muted">
                {{ hireDateDisplay }}
                <span class="ml-2 text-xs text-muted/60">(no editable)</span>
              </p>
            </div>
          </div>
        </div>

        <!-- ── Sección: Contacto ──────────────────────────────────────────── -->
        <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
          <p class="mb-4 text-sm font-semibold text-highlighted">Contacto</p>
          <div class="flex flex-col gap-4">
            <UFormField label="Email" name="email">
              <UInput
                v-model="state.email"
                class="w-full"
                size="lg"
                type="email"
                placeholder="juan@empresa.com"
                :disabled="isPending"
              />
            </UFormField>

            <UFormField label="Teléfono" name="phone">
              <UInput
                v-model="state.phone"
                class="w-full"
                size="lg"
                placeholder="+52 55 1234 5678"
                inputmode="tel"
                :disabled="isPending"
              />
            </UFormField>
          </div>
        </div>

        <!-- ── Sección: Datos de empleo ───────────────────────────────────── -->
        <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
          <p class="mb-4 text-sm font-semibold text-highlighted">Datos de empleo</p>
          <div class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Tipo de contrato" name="contractType">
                <USelect
                  v-model="state.contractType"
                  :items="CONTRACT_TYPE_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar"
                  class="w-full"
                  size="lg"
                  :disabled="isPending"
                />
              </UFormField>

              <UFormField label="Modalidad" name="workModality">
                <USelect
                  v-model="state.workModality"
                  :items="WORK_MODALITY_OPTIONS"
                  value-key="value"
                  label-key="label"
                  placeholder="Seleccionar"
                  class="w-full"
                  size="lg"
                  :disabled="isPending"
                />
              </UFormField>
            </div>

            <UFormField label="Cargo / Puesto" name="currentPosition">
              <UInput
                v-model="state.currentPosition"
                class="w-full"
                size="lg"
                placeholder="Ej: Analista de RR.HH."
                :disabled="isPending"
              />
            </UFormField>

            <UFormField label="Departamento" name="currentDepartment">
              <UInput
                v-model="state.currentDepartment"
                class="w-full"
                size="lg"
                placeholder="Ej: Recursos Humanos"
                :disabled="isPending"
              />
            </UFormField>

            <UFormField label="Días de vacaciones anuales" name="annualVacationDays">
              <UInputNumber
                v-model="state.annualVacationDays"
                :min="0"
                :max="365"
                placeholder="Ej: 12"
                class="w-full"
                :disabled="isPending"
              />
            </UFormField>

            <UFormField label="Jefe directo" name="managerId">
              <USelectMenu
                v-model="state.managerId"
                :items="managerOptions"
                value-key="value"
                label-key="label"
                description-key="description"
                placeholder="Buscar jefe directo..."
                v-model:search-term="managerSearchTerm"
                :search-input="{ placeholder: 'Escribí para buscar colaboradores' }"
                :ignore-filter="true"
                :loading="isLoadingManagers"
                class="w-full"
                size="lg"
                :disabled="isPending"
              >
                <template #empty>
                  <span v-if="managerSearchTerm.length < 1">Escribí para buscar colaboradores</span>
                  <span v-else>No se encontraron colaboradores</span>
                </template>
              </USelectMenu>
            </UFormField>
          </div>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="isPending"
          @click="handleClose"
        />
        <UButton
          label="Guardar cambios"
          type="submit"
          form="edit-employee-form"
          :loading="isPending"
        />
      </div>
    </template>
  </USlideover>
</template>
