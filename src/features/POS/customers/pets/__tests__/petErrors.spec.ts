/** Pet errors (handoff 27 §3.7–§3.9): switch on `error`, never on `message`; 400 mapped by `property`. */
import { describe, expect, it } from 'vitest'
import { readPetError } from '../petErrors'

const httpError = (status: number, data: unknown) => ({ response: { status, data } })
const code = (status: number, error: string, extra: object = {}) =>
  httpError(status, { statusCode: status, error, message: error, ...extra })

describe('readPetError', () => {
  it('PET_VERSION_CONFLICT asks to reload and keeps currentVersion', () => {
    const info = readPetError(code(409, 'PET_VERSION_CONFLICT', { currentVersion: 4 }))
    expect(info).toMatchObject({ code: 'PET_VERSION_CONFLICT', reload: true, currentVersion: 4 })
    expect(info.message).toMatch(/modificó esta mascota/)
  })

  it.each([
    ['PET_ARCHIVED', 422, /archivada/, true],
    ['PET_NOT_ARCHIVED', 422, /ya está activa/, true],
    ['PET_LIMIT_REACHED', 422, /20 mascotas activas/, false],
    ['PET_NOT_FOUND', 404, /ya no existe/, true],
    ['CUSTOMER_NOT_FOUND', 404, /cliente ya no existe/, false],
  ])('%s → Spanish copy', (error, status, copy, reload) => {
    const info = readPetError(code(status, error))
    expect(info.code).toBe(error)
    expect(info.message).toMatch(copy)
    expect(info.reload).toBe(reload)
  })

  it('never shows the server message of an unknown code', () => {
    const info = readPetError(
      httpError(500, { statusCode: 500, error: 'X', message: 'boom stack' }),
    )
    expect(info.message).not.toContain('boom')
  })

  it('maps a 400 per-field body by property to the form fields, in Spanish', () => {
    const info = readPetError(
      httpError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: [
          { property: 'name', children: [], constraints: { maxLength: 'name must be shorter' } },
          { property: 'birthDate', children: [], constraints: { birthDateInFuture: 'future' } },
          {
            property: 'approxAge',
            children: [{ property: 'years', children: [], constraints: { max: 'years max' } }],
          },
        ],
      }),
    )
    expect(Object.keys(info.fields).sort()).toEqual(['approxAge', 'birthDate', 'name'])
    expect(info.fields.birthDate).toMatch(/futura/)
    expect(Object.values(info.fields).join(' ')).not.toMatch(/must|future|max/)
  })
})
