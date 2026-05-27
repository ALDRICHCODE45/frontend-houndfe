import { z } from 'zod'

// ─── Enums — pinned to backend v1 values ─────────────────────────────────────

export const IdentityDocumentTypeSchema = z.enum([
  'INE',
  'PASSPORT',
  'DRIVER_LICENSE',
  'MILITARY_ID',
  'OTHER',
])
export type IdentityDocumentType = z.infer<typeof IdentityDocumentTypeSchema>

export const EmployeeStatusSchema = z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED'])
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>

/**
 * ContractType — backend v1 canonical values.
 * IMPORTANT: NOT 'INDEFINIDO' or 'CONTRACTOR' (old design values).
 */
export const ContractTypeSchema = z.enum(['PERMANENT', 'TEMPORARY', 'FREELANCE', 'INTERNSHIP'])
export type ContractType = z.infer<typeof ContractTypeSchema>

/**
 * WorkModality — backend v1 canonical values.
 * IMPORTANT: 'ONSITE' (not 'ON_SITE').
 */
export const WorkModalitySchema = z.enum(['ONSITE', 'REMOTE', 'HYBRID'])
export type WorkModality = z.infer<typeof WorkModalitySchema>

export const GenderSchema = z.enum(['MALE', 'FEMALE'])
export type Gender = z.infer<typeof GenderSchema>

export const MaritalStatusSchema = z.enum(['SINGLE', 'MARRIED', 'WIDOWED'])
export type MaritalStatus = z.infer<typeof MaritalStatusSchema>

/**
 * EmployeeDocumentCategory — backend v1 canonical values (9 categories).
 * IMPORTANT: NOT the old 'DocumentType { ID, CONTRACT... }' design values.
 */
export const EmployeeDocumentCategorySchema = z.enum([
  'CONTRACT',
  'NDA',
  'EVALUATION',
  'CERTIFICATE',
  'WARNING',
  'ID_DOCUMENT',
  'CV',
  'MEDICAL',
  'OTHER',
])
export type EmployeeDocumentCategory = z.infer<typeof EmployeeDocumentCategorySchema>

/**
 * TimeOffType — backend v1 canonical values.
 * IMPORTANT: 'UNPAID' (not 'MATERNITY' — V2 only).
 */
export const TimeOffTypeSchema = z.enum(['VACATION', 'SICK', 'PERSONAL', 'UNPAID'])
export type TimeOffType = z.infer<typeof TimeOffTypeSchema>

export const TimeOffStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
export type TimeOffStatus = z.infer<typeof TimeOffStatusSchema>

// ─── Employee DTO ─────────────────────────────────────────────────────────────

/**
 * Employee schema.
 *
 * Includes all backend v1 fields (§2.1 of the implementation guide).
 *
 * Salary fields are OPTIONAL (not nullable!) because the backend DELETE-strips
 * them when the caller lacks read:EmployeeSalary. Use hasSalary() to check
 * key presence — never use ?. or ?? to fallback to 0.
 *
 * WU-06A: Extended with personal, address, schedule, responsibilities, and
 * annualVacationDays fields needed for the detail view panels.
 */
export const EmployeeSchema = z.object({
  id: z.string(),
  employeeNumber: z.string(),
  fullName: z.string(),
  // ── Personal info ──────────────────────────────────────────────────────────
  email: z.string().email().nullable(),
  phone: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),       // YYYY-MM-DD
  nationalId: z.string().nullable().optional(),
  nationalIdType: IdentityDocumentTypeSchema.nullable().optional(),
  // ── Address fields ─────────────────────────────────────────────────────────
  street: z.string().nullable().optional(),
  exteriorNumber: z.string().nullable().optional(),
  interiorNumber: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  neighborhood: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  // ── Status / lifecycle ──────────────────────────────────────────────────────
  status: EmployeeStatusSchema,
  terminationDate: z.string().nullable(),
  terminationReason: z.string().nullable().optional(),
  // ── Employment ─────────────────────────────────────────────────────────────
  contractType: ContractTypeSchema,
  workModality: WorkModalitySchema,
  currentPosition: z.string().nullable(),
  currentDepartment: z.string().nullable(),
  currentSchedule: z.string().nullable().optional(),
  currentResponsibilities: z.string().nullable().optional(),
  annualVacationDays: z.number().int().nonnegative().optional(),
  // ── References ─────────────────────────────────────────────────────────────
  managerId: z.string().nullable(),
  hireDate: z.string(),
  photoFileId: z.string().nullable(),
  cvFileId: z.string().nullable(),
  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // ── Tier 2 Financial — OPTIONAL (DELETE-stripped if no read:EmployeeSalary)
  currentSalaryCents: z.number().int().optional(),
  currentSalaryCurrency: z.string().optional(),
})

export type Employee = z.infer<typeof EmployeeSchema>

// ─── Salary guard ─────────────────────────────────────────────────────────────

/**
 * Key-presence guard for salary fields.
 *
 * Backend delete-strips currentSalaryCents when caller lacks read:EmployeeSalary.
 * This guard checks key PRESENCE — not value truthiness.
 * NEVER use `employee.currentSalaryCents ?? 0` — that hides the delete-strip.
 */
export function hasSalary(
  e: Employee,
): e is Employee & { currentSalaryCents: number; currentSalaryCurrency: string } {
  return 'currentSalaryCents' in e
}

// ─── UTC inclusive day helper ─────────────────────────────────────────────────

/**
 * Compute inclusive UTC day count between two ISO date strings.
 *
 * Formula: (end - start) / 86_400_000 + 1
 * This is UTC-safe — no timezone offset interference.
 * Backend desviación #5: days are inclusive UTC.
 */
export function computeDays(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return (end - start) / 86_400_000 + 1
}

// ─── Label maps ───────────────────────────────────────────────────────────────

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVE: 'Activo',
  ON_LEAVE: 'Licencia',
  TERMINATED: 'Baja',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  PERMANENT: 'Indefinido',
  TEMPORARY: 'Temporal',
  FREELANCE: 'Freelance',
  INTERNSHIP: 'Prácticas',
}

export const WORK_MODALITY_LABELS: Record<WorkModality, string> = {
  ONSITE: 'Presencial',
  REMOTE: 'Remoto',
  HYBRID: 'Híbrido',
}

export const TIME_OFF_TYPE_LABELS: Record<TimeOffType, string> = {
  VACATION: 'Vacaciones',
  SICK: 'Enfermedad',
  PERSONAL: 'Personal',
  UNPAID: 'Sin goce de sueldo',
}

export const TIME_OFF_STATUS_LABELS: Record<TimeOffStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
}

export const DOCUMENT_CATEGORY_LABELS: Record<EmployeeDocumentCategory, string> = {
  CONTRACT: 'Contrato',
  NDA: 'Acuerdo de confidencialidad',
  EVALUATION: 'Evaluación',
  CERTIFICATE: 'Certificado',
  WARNING: 'Amonestación',
  ID_DOCUMENT: 'Identificación',
  CV: 'Currículum',
  MEDICAL: 'Médico',
  OTHER: 'Otro',
}

// ─── Additional DTOs ──────────────────────────────────────────────────────────

/** Backend paginated list response shape for employees */
export interface EmployeesBackendList {
  data: Employee[]
  total: number
  page: number
  limit: number
  pageSize: number
}

export const SalaryChangeSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  amountCents: z.number().int(),
  currency: z.string().default('MXN'),
  effectiveFrom: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})
export type SalaryChange = z.infer<typeof SalaryChangeSchema>

export const PositionChangeSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  position: z.string(),
  department: z.string().nullable(),
  effectiveFrom: z.string(),
  reason: z.string().nullable(),
  createdAt: z.string(),
})
export type PositionChange = z.infer<typeof PositionChangeSchema>

export const EmployeeDocumentSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  fileId: z.string(),
  category: EmployeeDocumentCategorySchema,
  notes: z.string().nullable(), // used as visual title
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>

export const TimeOffRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: TimeOffTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable(),
  status: TimeOffStatusSchema,
  createdAt: z.string(),
})
export type TimeOffRequest = z.infer<typeof TimeOffRequestSchema>

export const VacationBalanceSchema = z.object({
  entitlement: z.number(),
  used: z.number(),
  pending: z.number(),
  remaining: z.number(),
})
export type VacationBalance = z.infer<typeof VacationBalanceSchema>

export const EmergencyContactSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
  email: z.string().email().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>

// ─── CreateEmployeeDto ────────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees request body.
 *
 * Required: employeeNumber, firstName, lastName, hireDate.
 * All other fields are optional per backend v1 spec (§4.1).
 * NEVER include tenantId — backend reads it from the JWT via TenantContextGuard.
 */
export const CreateEmployeeDtoSchema = z.object({
  // ── Required fields ───────────────────────────────────────────────────────
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  hireDate: z.string().min(1), // YYYY-MM-DD

  // ── Personal info (optional) ──────────────────────────────────────────────
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(), // YYYY-MM-DD
  nationalId: z.string().optional(),
  nationalIdType: IdentityDocumentTypeSchema.optional(),

  // ── Address fields (optional) ─────────────────────────────────────────────
  street: z.string().optional(),
  exteriorNumber: z.string().optional(),
  interiorNumber: z.string().optional(),
  zipCode: z.string().optional(),
  neighborhood: z.string().optional(),
  municipality: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),

  // ── Employment info (optional) ────────────────────────────────────────────
  contractType: ContractTypeSchema.optional(),
  workModality: WorkModalitySchema.optional(),
  currentPosition: z.string().optional(),
  currentDepartment: z.string().optional(),
  currentSchedule: z.string().optional(),
  currentResponsibilities: z.string().optional(),
  annualVacationDays: z.number().int().nonnegative().optional(),

  // ── References (optional) ─────────────────────────────────────────────────
  managerId: z.string().uuid().optional(),
  photoFileId: z.string().uuid().optional(),
  cvFileId: z.string().uuid().optional(),
})

export type CreateEmployeeDto = z.infer<typeof CreateEmployeeDtoSchema>

// ─── UpdateEmployeeDto ────────────────────────────────────────────────────────

/**
 * Zod schema for PATCH /admin/employees/:id request body.
 *
 * All fields from CreateEmployeeDto are optional (partial update), EXCEPT:
 * - `hireDate` is excluded entirely (not patchable)
 * - `employeeNumber` is included but optional
 * - `tenantId` is NEVER included (backend reads from JWT)
 *
 * Manager cycle validation errors: MANAGER_SELF_REFERENCE, MANAGER_CYCLE.
 */
export const UpdateEmployeeDtoSchema = CreateEmployeeDtoSchema.omit({ hireDate: true }).partial()

export type UpdateEmployeeDto = z.infer<typeof UpdateEmployeeDtoSchema>

// ─── TerminateEmployeeDto ─────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:id/terminate request body.
 *
 * Both fields are required per backend v1 spec (§4.1).
 * Domain error on already-terminated employee: EMPLOYEE_ALREADY_TERMINATED.
 */
export const TerminateEmployeeDtoSchema = z.object({
  /** Termination date — YYYY-MM-DD format */
  terminationDate: z.string().min(1),
  /** Free-text reason for termination */
  terminationReason: z.string().min(1),
})

export type TerminateEmployeeDto = z.infer<typeof TerminateEmployeeDtoSchema>
