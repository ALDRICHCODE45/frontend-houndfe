/**
 * useCreateEmployeeForm — WU-04C
 *
 * Pure form state factory + DTO mapper for the Create Employee Slideover form.
 *
 * Design decisions:
 * - All optional fields use '' (empty string) as the initial value so Nuxt UI's
 *   UInput / USelect renders the placeholder correctly without controlled/uncontrolled conflicts.
 * - managerId uses null (not '') because ManagerPicker emits null for "no selection".
 * - annualVacationDays is kept as string in the form (type="number" UInput returns string).
 *   formStateToDto() casts it to integer before sending to the backend.
 * - formStateToDto() strips empty optional strings — the backend treats their absence
 *   as "not provided" (undefined). Sending '' would fail backend validation.
 *
 * Pure helpers (exported for unit testing — no mocks needed):
 * - buildCreateEmployeeFormState() — returns a fresh form state object
 * - formStateToDto(state)          — maps form state to a valid CreateEmployeeDto
 *
 * The composable useCreateEmployeeForm() wraps these helpers with reactive state
 * for use inside CreateEmployeeSlideover.vue.
 */

import { reactive } from 'vue'
import {
  CreateEmployeeDtoSchema,
  ContractTypeSchema,
  WorkModalitySchema,
} from '../interfaces/employee.types'
import type { CreateEmployeeDto, ContractType, WorkModality } from '../interfaces/employee.types'

// ─── Form state shape ─────────────────────────────────────────────────────────

/**
 * The reactive form state managed inside CreateEmployeeSlideover.
 *
 * Required fields are '' (will fail Zod min(1) if left empty — shows UForm error).
 * Optional selects are '' so USelect renders its placeholder.
 * managerId is null — ManagerPicker emits null for "no selection".
 * annualVacationDays is '' (string) — cast to number in formStateToDto.
 */
export interface CreateEmployeeFormState {
  // Required
  employeeNumber: string
  firstName: string
  lastName: string
  hireDate: string
  // Optional strings
  email: string
  phone: string
  // Optional selects ('' = no selection)
  contractType: string
  workModality: string
  // Optional text fields
  currentPosition: string
  currentDepartment: string
  // Optional number field (kept as string for UInput)
  annualVacationDays: string
  // Optional reference (null = no manager selected)
  managerId: string | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Factory function — returns a fresh CreateEmployeeFormState with default values.
 *
 * PURE — returns a new object on every call (no shared state).
 */
export function buildCreateEmployeeFormState(): CreateEmployeeFormState {
  return {
    employeeNumber: '',
    firstName: '',
    lastName: '',
    hireDate: '',
    email: '',
    phone: '',
    contractType: '',
    workModality: '',
    currentPosition: '',
    currentDepartment: '',
    annualVacationDays: '',
    managerId: null,
  }
}

/**
 * Map form state to a CreateEmployeeDto suitable for the API.
 *
 * Rules:
 * - Trims all string fields before including them.
 * - Omits optional fields when the form value is '' or null.
 * - Casts annualVacationDays from string to integer (parseInt base-10).
 * - Never includes tenantId.
 *
 * PURE — no side effects, deterministic output.
 */
export function formStateToDto(state: CreateEmployeeFormState): CreateEmployeeDto {
  const dto: CreateEmployeeDto = {
    employeeNumber: state.employeeNumber.trim(),
    firstName: state.firstName.trim(),
    lastName: state.lastName.trim(),
    hireDate: state.hireDate.trim(),
  }

  // ── Optional string fields — omit when empty ──────────────────────────────
  if (state.email.trim()) dto.email = state.email.trim()
  if (state.phone.trim()) dto.phone = state.phone.trim()
  if (state.currentPosition.trim()) dto.currentPosition = state.currentPosition.trim()
  if (state.currentDepartment.trim()) dto.currentDepartment = state.currentDepartment.trim()

  // ── Optional selects — validate against enums before including ────────────
  const contractParsed = ContractTypeSchema.safeParse(state.contractType)
  if (contractParsed.success) dto.contractType = contractParsed.data as ContractType

  const modalityParsed = WorkModalitySchema.safeParse(state.workModality)
  if (modalityParsed.success) dto.workModality = modalityParsed.data as WorkModality

  // ── annualVacationDays — cast string → integer ────────────────────────────
  if (state.annualVacationDays !== '') {
    const parsed = parseInt(state.annualVacationDays, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      dto.annualVacationDays = parsed
    }
  }

  // ── managerId — include only when a UUID is selected ─────────────────────
  if (state.managerId) dto.managerId = state.managerId

  return dto
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Reactive form state + reset for use inside CreateEmployeeSlideover.vue.
 */
export function useCreateEmployeeForm() {
  const state = reactive<CreateEmployeeFormState>(buildCreateEmployeeFormState())

  /** The Zod schema passed to Nuxt UI UForm :schema for validation */
  const schema = CreateEmployeeDtoSchema

  /** Reset all fields to their initial values */
  function resetForm(): void {
    const fresh = buildCreateEmployeeFormState()
    Object.assign(state, fresh)
  }

  return {
    state,
    schema,
    resetForm,
  }
}
