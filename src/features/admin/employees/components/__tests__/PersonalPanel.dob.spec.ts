// T8 D8 — the date of birth is a calendar date: `new Date('1990-04-12')` is UTC
// midnight, which reads one day early west of UTC (America/Mexico_City → 11 de abril).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PersonalPanel from '../PersonalPanel.vue'
import type { Employee } from '../../interfaces/employee.types'

function makeEmployee(dateOfBirth: string | null): Employee {
  return {
    id: 'emp-uuid-1',
    employeeNumber: 'EMP-001',
    fullName: 'Ana García',
    email: 'ana@test.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'REMOTE',
    currentPosition: 'Gerente de tienda',
    currentDepartment: 'Operaciones',
    managerId: null,
    hireDate: '2023-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    dateOfBirth,
  }
}

function dob(dateOfBirth: string | null) {
  const wrapper = mount(PersonalPanel, { props: { employee: makeEmployee(dateOfBirth) } })
  const item = wrapper.findAll('.employees-dl__item').find((row) => row.get('dt').text() === 'Fecha de nacimiento')
  const text = item!.get('dd').text()
  wrapper.unmount()
  return text
}

let previousTz: string | undefined

beforeEach(() => {
  previousTz = process.env.TZ
  process.env.TZ = 'America/Mexico_City'
})

afterEach(() => {
  if (previousTz === undefined) delete process.env.TZ
  else process.env.TZ = previousTz
})

describe('PersonalPanel — date of birth (calendar date, no UTC shift)', () => {
  it('reads 1990-04-12 as «12 de abril de 1990» west of UTC', () => {
    expect(dob('1990-04-12')).toBe('12 de abril de 1990')
  })

  it('keeps the calendar day of an ISO midnight timestamp too', () => {
    expect(dob('1990-04-12T00:00:00.000Z')).toBe('12 de abril de 1990')
  })

  it('shows a dash when there is no date and the raw text when it is not a date', () => {
    expect(dob(null)).toBe('—')
    expect(dob('no es fecha')).toBe('no es fecha')
  })
})
