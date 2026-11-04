/**
 * Unit tests for employeeBadgeConfig.utils.
 *
 * Coverage:
 *  - employeeStatusConfig: tone + label for every EmployeeStatus
 *  - employeeStatusToBadgeTone: pure tone lookup (re-export contract)
 *
 * Locked behavior: a termination is a closed state (neutral), a leave in
 * progress is info and only the active state is success. Danger is reserved
 * for what is wrong, so no employee status uses it.
 */

import { describe, expect, it } from 'vitest'
import { employeeStatusConfig, employeeStatusToBadgeTone } from '../employeeBadgeConfig.utils'

describe('employeeStatusConfig — single source of truth for status badge', () => {
  it('ACTIVE → success, "Activo"', () => {
    expect(employeeStatusConfig.ACTIVE).toEqual({ tone: 'success', label: 'Activo' })
  })

  it('ON_LEAVE → info, "Licencia" (in progress, not pending action)', () => {
    expect(employeeStatusConfig.ON_LEAVE).toEqual({ tone: 'info', label: 'Licencia' })
  })

  it('TERMINATED → neutral, "Baja" (closed, not an error)', () => {
    expect(employeeStatusConfig.TERMINATED).toEqual({ tone: 'neutral', label: 'Baja' })
  })

  it('never uses warning or danger', () => {
    const tones = Object.values(employeeStatusConfig).map((config) => config.tone as string)
    expect(tones).not.toContain('warning')
    expect(tones).not.toContain('danger')
    expect(tones).not.toContain('error')
  })
})

describe('employeeStatusToBadgeTone — pure tone lookup (re-export contract)', () => {
  it('maps ACTIVE → success', () => {
    expect(employeeStatusToBadgeTone('ACTIVE')).toBe('success')
  })

  it('maps ON_LEAVE → info', () => {
    expect(employeeStatusToBadgeTone('ON_LEAVE')).toBe('info')
  })

  it('maps TERMINATED → neutral', () => {
    expect(employeeStatusToBadgeTone('TERMINATED')).toBe('neutral')
  })
})
