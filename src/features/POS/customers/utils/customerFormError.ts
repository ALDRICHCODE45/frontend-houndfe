import type { AxiosError } from 'axios'
import type { DomainApiError } from '@/core/shared/utils/error.utils'

/**
 * Message and field errors of a failed customer write (create, update, addresses, delete). Moved
 * from CustomersView (customers-module T4) so the customer page shows the same copy.
 */
export function mapCustomerDomainError(error: unknown): {
  message: string
  fields: Partial<Record<string, string>>
} {
  const response = (error as AxiosError<DomainApiError> | null)?.response?.data
  const fallback = 'No pudimos guardar el cliente. Reintenta en unos segundos.'

  if (!response) {
    return { message: fallback, fields: {} }
  }

  const message = response.message ?? fallback
  const fields: Partial<Record<string, string>> = {}
  const normalized = (message ?? '').toLowerCase()

  if (normalized.includes('email')) {
    fields.email = 'Ya existe un cliente con ese correo electrónico.'
  }

  if (normalized.includes('rfc')) {
    fields.rfc = 'Ya existe un cliente con ese RFC.'
  }

  return { message, fields }
}
