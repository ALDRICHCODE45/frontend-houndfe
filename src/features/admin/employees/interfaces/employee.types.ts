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

/**
 * Pure predicate for client-side date-range validation.
 *
 * Returns `true` when `endDate >= startDate` (inclusive on the equal
 * case so single-day requests pass). The backend enforces the same rule
 * server-side and returns 400 `TIME_OFF_INVALID_DATE_RANGE` if violated —
 * this client-side check exists to block the submit BEFORE the network
 * call and surface a voseo error in the form.
 *
 * Co-located with the schema (instead of a separate util) because it is
 * the exact predicate {@link CreateTimeOffDtoSchema}'s `superRefine` uses.
 * Pure — zero side effects, no module-level state.
 */
export function isValidTimeOffRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  // NaN guard: unparseable strings should fail closed (invalid range).
  if (Number.isNaN(start) || Number.isNaN(end)) return false
  return end >= start
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

/**
 * TimeOffRequestSchema — backend EmployeeTimeOff v1 contract.
 *
 * Added in slice S4 (hr-validation-notifications) per
 * `sdd/hr-validation-notifications/design` (obs 3176):
 *   - `requestedByUserId` — nullable (null while being prepared)
 *   - `reviewerUserId`   — nullable (null until a reviewer acts)
 *   - `reviewedAt`       — nullable (null until reviewed)
 *   - `reviewerNotes`    — nullable (null unless reviewer wrote notes)
 *   - `tenantId`         — required (backend always stamps it)
 *   - `updatedAt`        — required (backend always stamps it)
 *
 * Convention matches the rest of the file: `.nullable()` for fields the
 * backend always sends but that can be null; required for fields that are
 * NEVER stripped. Do NOT widen these to `.optional()` — the backend always
 * includes them.
 */
export const TimeOffRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: TimeOffTypeSchema,
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable(),
  status: TimeOffStatusSchema,
  createdAt: z.string(),
  requestedByUserId: z.string().nullable(),
  reviewerUserId: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewerNotes: z.string().nullable(),
  tenantId: z.string(),
  updatedAt: z.string(),
})
export type TimeOffRequest = z.infer<typeof TimeOffRequestSchema>

/**
 * VacationBalanceSchema — backend vacation-balance v1 contract.
 *
 * Added in slice S4: `year` (integer). Backend returns
 * `{ year, entitlement, used, pending, remaining }`. The year is the
 * anchor the balance applies to; the card in `AusenciasPanel.vue` (S6)
 * filters by it.
 */
export const VacationBalanceSchema = z.object({
  year: z.number().int(),
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

// ─── AddSalaryChangeDto ───────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:employeeId/salary-history.
 *
 * Requires create:EmployeeSalary permission.
 * amountCents: integer, min 1 (centavos — e.g. $45,000.00 = 4_500_000).
 * currency: exactly 3-char ISO 4217, default "MXN".
 * effectiveFrom: YYYY-MM-DD date string.
 * reason: required, min 1 char.
 *
 * NEVER send tenantId — backend reads from JWT via TenantContextGuard.
 */
export const AddSalaryChangeDtoSchema = z.object({
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).default('MXN'),
  effectiveFrom: z.string().min(1),
  reason: z.string().min(1),
})

export type AddSalaryChangeDto = z.infer<typeof AddSalaryChangeDtoSchema>

// ─── AddPositionChangeDto ─────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:employeeId/position-history.
 *
 * Requires update:Employee permission (NOT EmployeeSalary).
 * position: required, min 1 char.
 * department: optional (new department).
 * effectiveFrom: YYYY-MM-DD date string.
 * reason: required, min 1 char.
 *
 * NEVER send tenantId — backend reads from JWT via TenantContextGuard.
 */
export const AddPositionChangeDtoSchema = z.object({
  position: z.string().min(1),
  department: z.string().optional(),
  effectiveFrom: z.string().min(1),
  reason: z.string().min(1),
})

export type AddPositionChangeDto = z.infer<typeof AddPositionChangeDtoSchema>

// ─── UploadDocumentDto ────────────────────────────────────────────────────────

/**
 * Zod schema for the FormData fields in POST /admin/employees/:employeeId/documents.
 *
 * The `file` (binary) is added to the FormData separately before upload.
 * These fields are the text fields passed in the multipart body.
 *
 * category:  Required — one of the 9 EmployeeDocumentCategory values.
 * expiresAt: Optional — YYYY-MM-DD expiration date.
 * notes:     Optional — max 500 chars; serves as document title/description.
 *            Backend desviación #1: no `title` field — use `notes` instead.
 *
 * NEVER send tenantId — backend reads it from JWT via TenantContextGuard.
 */
export const UploadDocumentDtoSchema = z.object({
  category: EmployeeDocumentCategorySchema,
  expiresAt: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export type UploadDocumentDto = z.infer<typeof UploadDocumentDtoSchema>

// ─── ReviewTimeOffDto ─────────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:employeeId/time-off/:timeOffId/review.
 *
 * Requires update:EmployeeTimeOff permission.
 * Only works if the current status is PENDING — backend returns TIME_OFF_INVALID_TRANSITION otherwise.
 * decision: 'APPROVED' | 'REJECTED' — only these two values.
 * reviewerNotes: optional, max 500 chars.
 *
 * NEVER send tenantId.
 */
export const ReviewTimeOffDtoSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reviewerNotes: z.string().max(500).optional(),
})

export type ReviewTimeOffDto = z.infer<typeof ReviewTimeOffDtoSchema>

// ─── CreateEmergencyContactDto ────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:employeeId/emergency-contacts.
 *
 * Requires create:EmployeeEmergencyContact permission.
 * name: 1-120 chars.
 * relationship: 1-60 chars, free text.
 * phone: 1-40 chars.
 * email: optional, must be valid email if provided.
 *
 * NEVER send tenantId.
 */
export const CreateEmergencyContactDtoSchema = z.object({
  name: z.string().min(1).max(120),
  relationship: z.string().min(1).max(60),
  phone: z.string().min(1).max(40),
  email: z.string().email().optional(),
})

export type CreateEmergencyContactDto = z.infer<typeof CreateEmergencyContactDtoSchema>

// ─── UpdateEmergencyContactDto ────────────────────────────────────────────────

/**
 * Zod schema for PATCH /admin/employees/:employeeId/emergency-contacts/:contactId.
 *
 * Requires update:EmployeeEmergencyContact permission.
 * All fields from CreateEmergencyContactDto, all optional (partial update).
 *
 * NEVER send tenantId.
 */
export const UpdateEmergencyContactDtoSchema = CreateEmergencyContactDtoSchema.partial()

export type UpdateEmergencyContactDto = z.infer<typeof UpdateEmergencyContactDtoSchema>

// ─── CreateTimeOffDto ─────────────────────────────────────────────────────────

/**
 * Zod schema for POST /admin/employees/:employeeId/time-off request body.
 *
 * Required: type, startDate, endDate.
 * reason is optional, max 500 chars.
 * endDate must be >= startDate — enforced CLIENT-SIDE here via
 * superRefine (blocks submit before the network call AND surfaces a voseo
 * error attached to the `endDate` field). Backend re-enforces the same
 * rule and returns 400 `TIME_OFF_INVALID_DATE_RANGE` as a safety net.
 *
 * TimeOffType values: VACATION, SICK, PERSONAL, UNPAID.
 * NEVER send tenantId — backend reads from JWT via TenantContextGuard.
 *
 * Range validation: see {@link isValidTimeOffRange} (the same pure
 * predicate the superRefine delegates to).
 */
export const CreateTimeOffDtoSchema = z
  .object({
    type: TimeOffTypeSchema,
    startDate: z.string().min(1), // YYYY-MM-DD
    endDate: z.string().min(1), // YYYY-MM-DD, inclusive, >= startDate
    reason: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (!isValidTimeOffRange(data.startDate, data.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha de fin debe ser igual o posterior a la fecha de inicio',
        path: ['endDate'],
      })
    }
  })

export type CreateTimeOffDto = z.infer<typeof CreateTimeOffDtoSchema>
