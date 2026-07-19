// Value-pin contract tests for `employee.constants.ts` (backend-v1 freeze).
// Each row asserts EXACT string equality — a renamed literal (e.g. 'CANCELLED'
// → 'CANCELED', two Ls; 'ONSITE' → 'ON_SITE') fails the build. Never edit a value.

import { describe, it, expect } from 'vitest'
import {
  TIME_OFF_STATUS, TIME_OFF_TYPE, EMPLOYEE_STATUS, WORK_MODALITY,
  EMPLOYEE_DOCUMENT_CATEGORY, REVIEW_DECISION, EMPLOYEE_STATUS_FILTER,
} from '../employee.constants'

type PinRow = [actual: string, expected: string]

const groups: Array<[group: string, cases: PinRow[]]> = [
  ['TIME_OFF_STATUS', [
    [TIME_OFF_STATUS.PENDING, 'PENDING'],
    [TIME_OFF_STATUS.APPROVED, 'APPROVED'],
    [TIME_OFF_STATUS.REJECTED, 'REJECTED'],
    [TIME_OFF_STATUS.CANCELLED, 'CANCELLED'],
  ]],
  ['TIME_OFF_TYPE', [
    [TIME_OFF_TYPE.VACATION, 'VACATION'],
    [TIME_OFF_TYPE.SICK, 'SICK'],
    [TIME_OFF_TYPE.PERSONAL, 'PERSONAL'],
    [TIME_OFF_TYPE.UNPAID, 'UNPAID'],
  ]],
  ['EMPLOYEE_STATUS', [
    [EMPLOYEE_STATUS.ACTIVE, 'ACTIVE'],
    [EMPLOYEE_STATUS.ON_LEAVE, 'ON_LEAVE'],
    [EMPLOYEE_STATUS.TERMINATED, 'TERMINATED'],
  ]],
  ['WORK_MODALITY', [
    [WORK_MODALITY.ONSITE, 'ONSITE'],
    [WORK_MODALITY.REMOTE, 'REMOTE'],
    [WORK_MODALITY.HYBRID, 'HYBRID'],
  ]],
  ['EMPLOYEE_DOCUMENT_CATEGORY', [
    [EMPLOYEE_DOCUMENT_CATEGORY.CONTRACT, 'CONTRACT'],
    [EMPLOYEE_DOCUMENT_CATEGORY.NDA, 'NDA'],
    [EMPLOYEE_DOCUMENT_CATEGORY.EVALUATION, 'EVALUATION'],
    [EMPLOYEE_DOCUMENT_CATEGORY.CERTIFICATE, 'CERTIFICATE'],
    [EMPLOYEE_DOCUMENT_CATEGORY.WARNING, 'WARNING'],
    [EMPLOYEE_DOCUMENT_CATEGORY.ID_DOCUMENT, 'ID_DOCUMENT'],
    [EMPLOYEE_DOCUMENT_CATEGORY.CV, 'CV'],
    [EMPLOYEE_DOCUMENT_CATEGORY.MEDICAL, 'MEDICAL'],
    [EMPLOYEE_DOCUMENT_CATEGORY.OTHER, 'OTHER'],
  ]],
  ['REVIEW_DECISION', [
    [REVIEW_DECISION.APPROVED, 'APPROVED'],
    [REVIEW_DECISION.REJECTED, 'REJECTED'],
  ]],
]

describe.each(groups)('%s — value-pin contract', (_group, cases) => {
  it.each(cases)('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))
})

// EMPLOYEE_STATUS_FILTER is LOWERCASE — distinct from EMPLOYEE_STATUS (UPPERCASE).
describe('EMPLOYEE_STATUS_FILTER — value-pin contract (lowercase API params)', () => {
  it.each<PinRow>([
    [EMPLOYEE_STATUS_FILTER.ACTIVE, 'active'],
    [EMPLOYEE_STATUS_FILTER.TERMINATED, 'terminated'],
    [EMPLOYEE_STATUS_FILTER.ALL, 'all'],
  ])('%s === "%s"', (actual, expected) => expect(actual).toBe(expected))

  it('casing is lowercase (not uppercase — distinct from EMPLOYEE_STATUS)', () => {
    expect(EMPLOYEE_STATUS_FILTER.ACTIVE).not.toBe('ACTIVE')
    expect(EMPLOYEE_STATUS_FILTER.TERMINATED).not.toBe('TERMINATED')
  })
})
