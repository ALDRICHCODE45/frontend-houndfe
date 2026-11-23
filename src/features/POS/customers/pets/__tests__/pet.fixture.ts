import type { Pet } from '../pet.types'

export function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'p1',
    customerId: 'c1',
    name: 'Bruno',
    species: 'DOG',
    speciesOther: null,
    breed: 'Chihuahua',
    size: 'SMALL',
    birthDate: '2026-01-01',
    birthDatePrecision: 'MONTH',
    ageMonths: 10,
    ageLabel: '~10 meses',
    allergies: 'Pollo',
    notes: null,
    status: 'ACTIVE',
    archivedAt: null,
    archivedReason: null,
    createdVia: 'POS',
    version: 3,
    createdAt: '2026-11-23T16:20:11.000Z',
    updatedAt: '2026-11-23T16:20:11.000Z',
    ...overrides,
  }
}
