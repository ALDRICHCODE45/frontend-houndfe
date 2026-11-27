/**
 * owner-ideas-batch T4 (S2): the Spanish copy for a draft customer-assignment failure, shared by
 * the POS (`SalesView`) and «Nueva venta» from the customer page (`useStartSaleForCustomer`).
 */
import { describe, expect, it } from 'vitest'
import { DraftCustomerAssignmentError } from '../../composables/useDraftCustomerAssignment'
import { mapCustomerAssignmentErrorMessage } from '../customerAssignmentErrors'

describe('mapCustomerAssignmentErrorMessage', () => {
  it.each([
    ['CUSTOMER_NOT_FOUND', 'No se encontró el cliente. Recarga la lista.'],
    ['SHIPPING_ADDRESS_NOT_FOUND', 'No se encontró la dirección. Recarga la lista.'],
    ['SHIPPING_ADDRESS_NOT_FOR_CUSTOMER', 'Esa dirección no pertenece al cliente seleccionado.'],
    ['SHIPPING_ADDRESS_REQUIRES_CUSTOMER', 'Asigna un cliente antes de elegir la dirección.'],
    ['SALE_NOT_DRAFT', 'Esta venta ya no es un borrador. Recarga la página.'],
    ['SALE_UPDATE_FORBIDDEN', 'No tienes permisos para modificar esta venta.'],
  ] as const)('%s from a DraftCustomerAssignmentError', (code, message) => {
    expect(mapCustomerAssignmentErrorMessage(new DraftCustomerAssignmentError(code))).toBe(message)
  })

  it('reads a plain { code } object', () => {
    expect(mapCustomerAssignmentErrorMessage({ code: 'SALE_NOT_DRAFT' })).toBe(
      'Esta venta ya no es un borrador. Recarga la página.',
    )
  })

  it('reads the domain code of a raw axios rejection (its own `code` is the transport one)', () => {
    const axiosError = Object.assign(new Error('HTTP 404'), {
      code: 'ERR_BAD_REQUEST',
      isAxiosError: true,
      response: { status: 404, data: { error: 'CUSTOMER_NOT_FOUND' } },
    })
    expect(mapCustomerAssignmentErrorMessage(axiosError)).toBe(
      'No se encontró el cliente. Recarga la lista.',
    )
  })

  it('falls back to a generic message for anything else', () => {
    expect(mapCustomerAssignmentErrorMessage(new Error('boom'))).toBe(
      'No se pudo completar la operación',
    )
    expect(mapCustomerAssignmentErrorMessage(undefined)).toBe('No se pudo completar la operación')
  })
})
