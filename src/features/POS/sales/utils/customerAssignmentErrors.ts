/**
 * Spanish copy for a draft customer-assignment failure (`PUT/DELETE /sales/drafts/:id/customer`,
 * shipping address). Shared by the POS (`SalesView`) and «Nueva venta» from the customer page
 * (`useStartSaleForCustomer`, owner-ideas-batch T4).
 *
 * Accepts a `DraftCustomerAssignmentError` / `{ code }` or a raw axios rejection: the domain code of
 * an axios error lives in `response.data.error` (its own `code` is the transport one).
 */

export const CUSTOMER_ASSIGNMENT_FALLBACK_MESSAGE = 'No se pudo completar la operación'

function assignmentErrorCode(error: unknown): string | undefined {
  const value = error as { code?: unknown; response?: { data?: { error?: unknown } } } | null
  const domainCode = value?.response?.data?.error
  if (typeof domainCode === 'string') return domainCode
  return typeof value?.code === 'string' ? value.code : undefined
}

export function mapCustomerAssignmentErrorMessage(error: unknown): string {
  switch (assignmentErrorCode(error)) {
    case 'CUSTOMER_NOT_FOUND':
      return 'No se encontró el cliente. Recarga la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOUND':
      return 'No se encontró la dirección. Recarga la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER':
      return 'Esa dirección no pertenece al cliente seleccionado.'
    case 'SHIPPING_ADDRESS_REQUIRES_CUSTOMER':
      return 'Asigna un cliente antes de elegir la dirección.'
    case 'SALE_NOT_DRAFT':
      return 'Esta venta ya no es un borrador. Recarga la página.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tienes permisos para modificar esta venta.'
    default:
      return CUSTOMER_ASSIGNMENT_FALLBACK_MESSAGE
  }
}
