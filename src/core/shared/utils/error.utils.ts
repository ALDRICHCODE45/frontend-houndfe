import type { AxiosError } from 'axios'

export interface DomainApiError {
  statusCode?: number
  error?: string
  message?: string
}

export function mapDomainError(
  error: AxiosError<DomainApiError>,
  fallback = 'No pudimos completar la operación. Reintentá.',
): string {
  return error.response?.data?.message ?? fallback
}
