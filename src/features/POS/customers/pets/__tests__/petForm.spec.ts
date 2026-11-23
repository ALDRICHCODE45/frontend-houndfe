/** Form → payload rules (handoff 27 §2–§3.3) and the Spanish labels. */
import { describe, expect, it } from 'vitest'
import {
  emptyPetForm,
  petSizeLabel,
  petSpeciesLabel,
  petToForm,
  toCreatePetPayload,
  toUpdatePetPayload,
  validatePetForm,
} from '../petForm'
import { makePet } from './pet.fixture'

describe('Spanish labels', () => {
  it('names DOG and CAT, and OTHER by its speciesOther', () => {
    expect(petSpeciesLabel(makePet({ species: 'DOG' }))).toBe('Perro')
    expect(petSpeciesLabel(makePet({ species: 'CAT' }))).toBe('Gato')
    expect(petSpeciesLabel(makePet({ species: 'OTHER', speciesOther: 'Hurón' }))).toBe('Hurón')
    expect(petSizeLabel('SMALL')).toBe('Chico')
    expect(petSizeLabel(null)).toBeNull()
  })
})

describe('toCreatePetPayload', () => {
  it('sends approxAge only with the numbers typed, no date, and omits blanks', () => {
    const payload = toCreatePetPayload({
      ...emptyPetForm(),
      name: '  Bruno ',
      species: 'DOG',
      ageMode: 'approx',
      approxYears: null,
      approxMonths: 10,
      allergies: 'Pollo',
      breed: '   ',
    })
    expect(payload).toEqual({
      name: 'Bruno',
      species: 'DOG',
      approxAge: { months: 10 },
      allergies: 'Pollo',
    })
  })

  it('sends an exact date with EXACT precision and no approxAge', () => {
    const payload = toCreatePetPayload({
      ...emptyPetForm(),
      name: 'Mishi',
      species: 'CAT',
      ageMode: 'date',
      birthDate: '2024-03-15',
      approxYears: 3,
    })
    expect(payload).toEqual({
      name: 'Mishi',
      species: 'CAT',
      birthDate: '2024-03-15',
      birthDatePrecision: 'EXACT',
    })
  })

  it('keeps speciesOther only for OTHER', () => {
    const base = { ...emptyPetForm(), name: 'Pepe', speciesOther: 'Hurón' }
    expect(toCreatePetPayload({ ...base, species: 'OTHER' }).speciesOther).toBe('Hurón')
    expect(toCreatePetPayload({ ...base, species: 'DOG' })).not.toHaveProperty('speciesOther')
  })
})

describe('toUpdatePetPayload', () => {
  const pet = makePet()

  it('sends only the version when nothing changed (approximate age kept as is)', () => {
    expect(toUpdatePetPayload(pet, petToForm(pet))).toEqual({ version: 3 })
  })

  it('sends only the changed fields and null to clear', () => {
    const form = { ...petToForm(pet), allergies: '', notes: 'Nervioso con el ruido', size: null }
    expect(toUpdatePetPayload(pet, form)).toEqual({
      version: 3,
      allergies: null,
      notes: 'Nervioso con el ruido',
      size: null,
    })
  })

  it('edits an approximate age with a new approxAge, never rebuilding it from birthDate', () => {
    const form = petToForm(pet)
    expect(form.ageMode).toBe('approx')
    expect(form.approxYears).toBeNull()
    expect(form.approxMonths).toBeNull()
    expect(toUpdatePetPayload(pet, { ...form, approxYears: 2 })).toEqual({
      version: 3,
      approxAge: { years: 2 },
    })
  })

  it('clears the age with birthDate null and switches to an exact date without approxAge', () => {
    expect(toUpdatePetPayload(pet, { ...petToForm(pet), ageMode: 'none' })).toEqual({
      version: 3,
      birthDate: null,
    })
    const exact = makePet({ birthDate: '2024-03-15', birthDatePrecision: 'EXACT' })
    expect(petToForm(exact)).toMatchObject({ ageMode: 'date', birthDate: '2024-03-15' })
    expect(toUpdatePetPayload(exact, { ...petToForm(exact), birthDate: '2024-04-01' })).toEqual({
      version: 3,
      birthDate: '2024-04-01',
      birthDatePrecision: 'EXACT',
    })
  })

  it('changing species to OTHER sends speciesOther; away from OTHER lets the server clear it', () => {
    expect(
      toUpdatePetPayload(pet, { ...petToForm(pet), species: 'OTHER', speciesOther: 'Hurón' }),
    ).toEqual({ version: 3, species: 'OTHER', speciesOther: 'Hurón' })
    const other = makePet({ species: 'OTHER', speciesOther: 'Hurón' })
    expect(toUpdatePetPayload(other, { ...petToForm(other), species: 'CAT' })).toEqual({
      version: 3,
      species: 'CAT',
    })
  })
})

describe('validatePetForm', () => {
  const today = '2026-11-23'

  it('requires a name, speciesOther for OTHER, a past date and whole approx numbers', () => {
    expect(validatePetForm({ ...emptyPetForm(), name: ' ' }, today)).toHaveProperty('name')
    expect(
      validatePetForm({ ...emptyPetForm(), name: 'P', species: 'OTHER' }, today),
    ).toHaveProperty('speciesOther')
    expect(
      validatePetForm(
        { ...emptyPetForm(), name: 'P', ageMode: 'date', birthDate: '2027-01-01' },
        today,
      ),
    ).toHaveProperty('birthDate')
    expect(
      validatePetForm({ ...emptyPetForm(), name: 'P', ageMode: 'approx', approxYears: 51 }, today),
    ).toHaveProperty('approxAge')
    expect(
      validatePetForm(
        { ...emptyPetForm(), name: 'Bruno', ageMode: 'approx', approxMonths: 10 },
        today,
      ),
    ).toEqual({})
  })
})
