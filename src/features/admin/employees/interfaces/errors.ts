/**
 * Centralized domain error code map for the Employees module.
 *
 * Backend returns error codes in the `error` field of the response body (not `message`).
 * This map converts those codes to user-facing Spanish toast messages.
 */
export type EmployeeDomainErrorCode =
  | 'EMPLOYEE_NOT_FOUND'
  | 'EMPLOYEE_NUMBER_CONFLICT'
  | 'MANAGER_CYCLE'
  | 'MANAGER_SELF_REFERENCE'
  | 'EMPLOYEE_ALREADY_TERMINATED'
  | 'EMPLOYEE_NOT_TERMINATED'
  | 'TIME_OFF_NOT_FOUND'
  | 'TIME_OFF_INVALID_TRANSITION'
  | 'TIME_OFF_INVALID_DATE_RANGE'
  | 'EMPLOYEE_DOCUMENT_NOT_FOUND'
  | 'EMERGENCY_CONTACT_NOT_FOUND'

export const EMPLOYEE_ERROR_MAP: Record<EmployeeDomainErrorCode, string> = {
  EMPLOYEE_NOT_FOUND: 'No se encontró el colaborador.',
  EMPLOYEE_NUMBER_CONFLICT: 'Ya existe un colaborador con ese número de empleado.',
  MANAGER_CYCLE: 'No se puede asignar ese jefe directo porque crearía un ciclo en el organigrama.',
  MANAGER_SELF_REFERENCE: 'Un colaborador no puede ser su propio jefe directo.',
  EMPLOYEE_ALREADY_TERMINATED: 'El colaborador ya se encuentra dado de baja.',
  EMPLOYEE_NOT_TERMINATED: 'El colaborador no está dado de baja.',
  TIME_OFF_NOT_FOUND: 'No se encontró la solicitud de ausencia.',
  TIME_OFF_INVALID_TRANSITION: 'La solicitud de ausencia no permite esa transición de estado.',
  TIME_OFF_INVALID_DATE_RANGE: 'El rango de fechas no es válido. La fecha de fin debe ser posterior o igual a la de inicio.',
  EMPLOYEE_DOCUMENT_NOT_FOUND: 'No se encontró el documento del colaborador.',
  EMERGENCY_CONTACT_NOT_FOUND: 'No se encontró el contacto de emergencia.',
} as const
