/** Handoff 27 §5–§6, §8: «Para: <nombre>» and the sale-line pet errors. */
import { describe, expect, it } from 'vitest'
import { readSaleLinePetError, saleLinePetLabel } from '../saleLinePet.utils'

function apiError(status: number, error: string) {
  return { response: { status, data: { statusCode: status, error, message: error } } }
}

describe('saleLinePetLabel', () => {
  it('shows «Para: <nombre>» from the line snapshot', () => {
    expect(saleLinePetLabel({ id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' })).toBe(
      'Para: Bruno',
    )
  })

  it('keeps the snapshot name when the pet row is gone (id and status null)', () => {
    expect(saleLinePetLabel({ id: null, name: 'Bruno', species: 'DOG', status: null })).toBe(
      'Para: Bruno',
    )
  })
})

describe('readSaleLinePetError', () => {
  it('PET_NOT_FOUND: the pet is gone, the pets list reloads', () => {
    expect(readSaleLinePetError(apiError(404, 'PET_NOT_FOUND'))).toEqual({
      code: 'PET_NOT_FOUND',
      message: 'Esa mascota ya no existe. Actualizamos la lista.',
      reloadPets: true,
      reloadDraft: false,
    })
  })

  it('PET_CUSTOMER_MISMATCH: the pet is not of the sale customer', () => {
    expect(readSaleLinePetError(apiError(422, 'PET_CUSTOMER_MISMATCH'))).toEqual({
      code: 'PET_CUSTOMER_MISMATCH',
      message: 'Esa mascota no es del cliente de esta venta.',
      reloadPets: false,
      reloadDraft: false,
    })
  })

  it('PET_ARCHIVED: the pet was archived, the pets list reloads', () => {
    expect(readSaleLinePetError(apiError(422, 'PET_ARCHIVED'))).toEqual({
      code: 'PET_ARCHIVED',
      message: 'Esa mascota está archivada. Actualizamos la lista.',
      reloadPets: true,
      reloadDraft: false,
    })
  })

  it('SALE_ITEM_NOT_FOUND: the line is not in the draft anymore, the draft reloads', () => {
    expect(readSaleLinePetError(apiError(422, 'SALE_ITEM_NOT_FOUND'))).toEqual({
      code: 'SALE_ITEM_NOT_FOUND',
      message: 'Ese producto ya no está en la venta. Actualizamos la venta.',
      reloadPets: false,
      reloadDraft: true,
    })
  })

  it('an unknown error never shows the server message', () => {
    expect(readSaleLinePetError(apiError(500, 'Internal Server Error'))).toEqual({
      code: null,
      message: 'No se pudo cambiar la mascota de la línea. Intenta de nuevo.',
      reloadPets: false,
      reloadDraft: false,
    })
  })
})
