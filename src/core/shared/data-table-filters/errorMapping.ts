export type FilterFieldError = {
  filterId: string
  message: string
}

const LISTING_ERROR_MESSAGES: Record<string, string> = {
  LISTING_INVALID_ENUM_VALUE: 'Valor inválido en {field}',
  LISTING_INVALID_UUID: 'Identificador inválido en {field}',
  LISTING_INVALID_DATE: 'Fecha inválida en {field}',
  LISTING_INVALID_NUMBER: 'Valor numérico inválido en {field}',
  LISTING_INVERTED_RANGE: 'El rango está invertido en {field}',
  LISTING_TOO_MANY_VALUES: 'Demasiados valores seleccionados en {field}',
}

type ListingErrorLike = {
  code?: unknown
  field?: unknown
}

export function mapListingErrorToFilterField(error: unknown): FilterFieldError | null {
  if (!error || typeof error !== 'object') return null
  const { code, field } = error as ListingErrorLike
  if (typeof code !== 'string' || typeof field !== 'string' || !field) return null
  const template = LISTING_ERROR_MESSAGES[code]
  if (!template) return null
  return { filterId: field, message: template.replace('{field}', field) }
}
