<script setup lang="ts">
/**
 * CreateEmployeeSlideover — WU-04C
 *
 * Slideover form for creating a new employee (Colaborador).
 * Uses Nuxt UI USlideover + UForm with Zod validation.
 *
 * Fields shown (v1 — clean scope):
 *   Required: employeeNumber, firstName, lastName, hireDate
 *   Optional: email, phone, contractType (select), workModality (select),
 *             currentPosition, currentDepartment, annualVacationDays, managerId
 *
 * Intentionally excluded from v1:
 *   - Address fields (too many fields for a clean slideover)
 *   - Salary fields (belong in Compensación detail tab — WU-06+)
 *   - CV / photo uploads (require file handling — WU-07+)
 *
 * Manager picker:
 *   Uses USelectMenu with async search (v-model:search-term + ignore-filter)
 *   following the same pattern as MembershipUpsertSlideover. The field is optional —
 *   if no manager is selected, managerId is omitted from the DTO.
 *
 * Contract:
 *   - Props: open (v-model:open)
 *   - Emits: success (Employee created and slideover should close)
 *   - On success: composable handles toast + query invalidation
 *   - On EMPLOYEE_NUMBER_CONFLICT: composable shows Spanish error toast
 */

import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { CONTRACT_TYPE_LABELS, WORK_MODALITY_LABELS } from '../interfaces/employee.types'
import type { ContractType, WorkModality } from '../interfaces/employee.types'
import { useCreateEmployeeForm, formStateToDto } from '../composables/useCreateEmployeeForm'
import { useCreateEmployee } from '../composables/useCreateEmployee'
import { useManagerPicker } from '../composables/useManagerPicker'

// ─── Props & emits ─────────────────────────────────────────────────────────────

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  success: []
}>()

// ─── Form composable ───────────────────────────────────────────────────────────

const { state, schema, resetForm } = useCreateEmployeeForm()
const { mutateAsync, isPending } = useCreateEmployee()

// ─── Manager picker ────────────────────────────────────────────────────────────
const { search: managerSearch, managers, isLoading: isLoadingManagers } = useManagerPicker()
const managerSearchTerm = ref('')

const managerOptions = computed(() =>
  managers.value.map((m) => ({
    label: m.label,
    value: m.id,
    description: [m.position, m.department].filter((s) => s !== '—').join(' · ') || undefined,
  })),
)

// Sync the external search term with the composable
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

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleClose(): void {
  resetForm()
  open.value = false
}

async function onSubmit(event: FormSubmitEvent<typeof state>): Promise<void> {
  // Build a clean DTO — strips empty optionals, casts types
  const dto = formStateToDto(event.data as typeof state)
  try {
    await mutateAsync(dto)
    // useCreateEmployee handles success toast + query invalidation
    resetForm()
    open.value = false
    emit('success')
  } catch {
    // useCreateEmployee.onError handles error toasts (EMPLOYEE_NUMBER_CONFLICT, fallback)
    // No need to handle here — the slideover stays open for the user to correct the input
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Nuevo colaborador"
    description="Completá los datos para registrar al colaborador en el sistema"
    side="right"
    inset
    @after-leave="resetForm"
  >
    <template #body>
      <UForm
        id="create-employee-form"
        :schema="schema"
        :state="state"
        class="flex flex-col gap-5"
        @submit="onSubmit"
      >
        <!-- ── Sección: Identificación ───────────────────────────────────── -->
        <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
          <p class="mb-4 text-sm font-semibold text-highlighted">Identificación</p>
          <div class="flex flex-col gap-4">
            <UFormField label="Número de empleado" name="employeeNumber" required>
              <UInput
                v-model="state.employeeNumber"
                class="w-full"
                size="lg"
                placeholder="Ej: EMP-001"
                :disabled="isPending"
              />
            </UFormField>

            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Nombre(s)" name="firstName" required>
                <UInput
                  v-model="state.firstName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: Juan"
                  :disabled="isPending"
                />
              </UFormField>

              <UFormField label="Apellido(s)" name="lastName" required>
                <UInput
                  v-model="state.lastName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: García"
                  :disabled="isPending"
                />
              </UFormField>
            </div>
          </div>
        </div>

        <!-- ── Sección: Datos de contacto ──────────────────────────────── -->
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

        <!-- ── Sección: Empleo ─────────────────────────────────────────── -->
        <div class="rounded-lg border border-default bg-elevated/30 px-4 py-4">
          <p class="mb-4 text-sm font-semibold text-highlighted">Datos de empleo</p>
          <div class="flex flex-col gap-4">
            <UFormField label="Fecha de ingreso" name="hireDate" required>
              <UInput
                v-model="state.hireDate"
                class="w-full"
                size="lg"
                type="date"
                :disabled="isPending"
              />
            </UFormField>

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
              <UInput
                v-model="state.annualVacationDays"
                class="w-full"
                size="lg"
                type="number"
                min="0"
                placeholder="Ej: 12"
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
          label="Crear colaborador"
          type="submit"
          form="create-employee-form"
          :loading="isPending"
        />
      </div>
    </template>
  </USlideover>
</template>
