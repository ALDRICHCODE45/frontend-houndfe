/**
 * useEditEmployeeForm — WU-05B
 *
 * Pure form state factory + DTO mapper for the Edit Employee Slideover form.
 *
 * Design decisions:
 * - Pre-fills from an existing Employee object (unlike create which starts blank).
 * - hireDate is NOT included — it is read-only and cannot be patched.
 * - fullName is split into firstName + lastName: first word → firstName, rest → lastName.
 * - Null fields (email, currentPosition, managerId) become '' so UInput renders placeholder.
 * - managerId is kept as string ('' for no manager) — consistent with UInput UUID entry.
 * - annualVacationDays not stored on Employee (only on CreateDto/UpdateDto) — starts as ''.
 * - editFormStateToDto() strips empty optional strings and validates enum selects.
 * - editFormStateToDto() NEVER includes hireDate or tenantId.
 *
 * Pure helpers (exported for unit testing — no mocks needed):
 * - buildEditEmployeeFormState(employee) — returns a pre-filled form state object
 * - editFormStateToDto(state)            — maps form state to a valid UpdateEmployeeDto
 *
 * The composable useEditEmployeeForm() wraps these with reactive state for use inside
 * EmployeeUpsertSlideover.vue (edit mode).
 */

import { reactive, watch } from 'vue'
import {
  UpdateEmployeeDtoSchema,
  ContractTypeSchema,
  WorkModalitySchema,
} from '../interfaces/employee.types'
import type { Employee, UpdateEmployeeDto, ContractType, WorkModality } from '../interfaces/employee.types'

// ─── Form state shape ─────────────────────────────────────────────────────────

/**
 * The reactive form state managed inside EditEmployeeSlideover.
 *
 * No hireDate — not editable.
 * Optional selects use '' for "no selection" / preserves current value.
 * managerId uses '' for "no manager" (vs null in create — UInput consistency).
 * annualVacationDays is '' (string) — cast to number in editFormStateToDto.
 */
export interface EditEmployeeFormState {
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  phone: string
  contractType: string
  workModality: string
  currentPosition: string
  currentDepartment: string
  annualVacationDays: string
  managerId: string
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Split a fullName into [firstName, lastName].
 * Rule: first word → firstName; remaining words joined → lastName.
 *
 * PURE — deterministic, no side effects.
 */
function splitFullName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ['', '']
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ')
  return [firstName, lastName]
}

/**
 * Factory function — returns a form state pre-filled from an existing Employee.
 *
 * PURE — returns a new object on every call (no shared state).
 */
export function buildEditEmployeeFormState(employee: Employee): EditEmployeeFormState {
  const [firstName, lastName] = splitFullName(employee.fullName)
  return {
    employeeNumber: employee.employeeNumber,
    firstName,
    lastName,
    email: employee.email ?? '',
    phone: '',
    contractType: employee.contractType,
    workModality: employee.workModality,
    currentPosition: employee.currentPosition ?? '',
    currentDepartment: employee.currentDepartment ?? '',
    annualVacationDays: '',
    managerId: employee.managerId ?? '',
  }
}

/**
 * Map edit form state to an UpdateEmployeeDto suitable for PATCH /admin/employees/:id.
 *
 * Rules:
 * - Trims all string fields before including them.
 * - Omits optional fields when the form value is '' or null.
 * - Validates enum selects via Zod safeParse (rejects '' or invalid values).
 * - Casts annualVacationDays from string to integer.
 * - Never includes hireDate (not patchable).
 * - Never includes tenantId.
 *
 * PURE — no side effects, deterministic output.
 */
export function editFormStateToDto(state: EditEmployeeFormState): UpdateEmployeeDto {
  const dto: UpdateEmployeeDto = {}

  // ── Always-included editable text fields ─────────────────────────────────
  if (state.employeeNumber.trim()) dto.employeeNumber = state.employeeNumber.trim()
  if (state.firstName.trim()) dto.firstName = state.firstName.trim()
  if (state.lastName.trim()) dto.lastName = state.lastName.trim()

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

  // ── managerId — include only when a UUID is provided ─────────────────────
  if (state.managerId.trim()) dto.managerId = state.managerId.trim()

  return dto
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * Reactive form state + reset for use inside EmployeeEditSlideover.vue.
 * Accepts the employee to edit as a getter (MaybeRefOrGetter pattern).
 */
export function useEditEmployeeForm(employeeGetter: () => Employee | null) {
  const state = reactive<EditEmployeeFormState>({
    employeeNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    contractType: '',
    workModality: '',
    currentPosition: '',
    currentDepartment: '',
    annualVacationDays: '',
    managerId: '',
  })

  /** The Zod schema passed to Nuxt UI UForm :schema for validation */
  const schema = UpdateEmployeeDtoSchema

  /** Pre-fill the form from the current employee */
  function fillFromEmployee(employee: Employee): void {
    const fresh = buildEditEmployeeFormState(employee)
    Object.assign(state, fresh)
  }

  /** Reset to blank (called when slideover closes) */
  function resetForm(): void {
    Object.assign(state, {
      employeeNumber: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      contractType: '',
      workModality: '',
      currentPosition: '',
      currentDepartment: '',
      annualVacationDays: '',
      managerId: '',
    })
  }

  // Auto-fill when the employee reference changes (e.g. user selects different row)
  watch(employeeGetter, (employee) => {
    if (employee) fillFromEmployee(employee)
    else resetForm()
  }, { immediate: true })

  return {
    state,
    schema,
    resetForm,
    fillFromEmployee,
  }
}
