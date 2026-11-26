/**
 * customers-module T6: the 400s of GET /customers/listing (handoff 32 §2.7) as Spanish sentences.
 * The listing envelope is { statusCode, code, message, field, details? }: the code decides the
 * sentence, `field` names the filter, and the server message is never shown.
 */
import { CUSTOMERS_FILTER_LABELS } from './customersFiltersSchema'

export interface CustomersListingErrorBody {
  code: string
  field: string | null
  details: Record<string, unknown> | undefined
}

export interface CustomersListingError {
  code: string
  /** The filter the error is about (the filters sheet shows it there); null for the sort. */
  filterId: string | null
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The listing envelope of an axios error, or null (network, Nest validation body, plain error). */
export function readCustomersListingError(error: unknown): CustomersListingErrorBody | null {
  if (!isRecord(error) || !isRecord(error.response)) return null
  const data = error.response.data
  // Some envelopes nest the body under `error` (as GET /sales does); read both.
  const body = isRecord(data) && isRecord(data.error) ? data.error : data
  if (!isRecord(body) || typeof body.code !== 'string' || !body.code.startsWith('LISTING_')) return null
  return {
    code: body.code,
    field: typeof body.field === 'string' && body.field ? body.field : null,
    details: isRecord(body.details) ? body.details : undefined,
  }
}

/**
 * The filter a backend `field` belongs to: a range bound (`openDebtMin`, `createdFrom`) or the
 * range name itself (`openDebt`, LISTING_INVERTED_RANGE) maps to the range filter; the null
 * companions map to their multi filter.
 */
function filterIdOf(field: string | null): string | null {
  if (!field || field === 'sortBy') return null
  if (field in CUSTOMERS_FILTER_LABELS) return field
  if (field === 'deliveryZoneNone') return 'deliveryZoneType'
  if (field === 'priceListIncludeNull') return 'priceListId'
  const range = field.replace(/(Min|Max|From|To)$/, '')
  return range in CUSTOMERS_FILTER_LABELS ? range : null
}

export function customersListingError(error: unknown): CustomersListingError | null {
  const body = readCustomersListingError(error)
  if (!body) return null
  const filterId = filterIdOf(body.field)
  const label = (filterId && CUSTOMERS_FILTER_LABELS[filterId]) || 'Uno de los filtros'

  let message: string
  switch (body.code) {
    case 'LISTING_INVALID_NUMBER':
      message = `${label}: escribe un número entero, de 0 en adelante.`
      break
    case 'LISTING_INVERTED_RANGE':
      message = `${label}: el inicio del rango es mayor que el final.`
      break
    case 'LISTING_INVALID_DATE':
      message = `${label}: la fecha no es válida.`
      break
    case 'LISTING_INVALID_ENUM_VALUE':
      message = `${label}: uno de los valores no es válido.`
      break
    case 'LISTING_TOO_MANY_VALUES': {
      const cap = typeof body.details?.cap === 'number' ? body.details.cap : null
      message = cap ? `${label}: elige ${cap} valores o menos.` : `${label}: elegiste demasiados valores.`
      break
    }
    case 'LISTING_INVALID_UUID':
      message = `${label}: una de las listas no es válida.`
      break
    case 'LISTING_PARAM_REQUIRES_PERMISSION':
      message = filterId
        ? `Tu rol no puede ver las ventas, así que no puede usar «${label}».`
        : 'Tu rol no puede ver las ventas, así que no puede ordenar por montos ni compras.'
      break
    default:
      return null
  }
  return { code: body.code, filterId, message }
}
