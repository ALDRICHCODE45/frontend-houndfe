import { formatCustomerPhone } from './customerPhone.utils'

type CustomerContact = {
  phone?: string | null
  phoneCountryCode?: string | null
}

/** The phone as shown plus its `tel:` link; `null` without a phone. */
export function customerPhoneLink(customer: CustomerContact | null | undefined) {
  const value = customer?.phone?.trim()
  if (!value || !customer) return null
  const code = customer.phoneCountryCode?.replace(/[^\d]/g, '') ?? ''
  return {
    label: formatCustomerPhone(customer.phoneCountryCode, value),
    href: `tel:${code ? `+${code}` : ''}${value.replace(/[^\d+]/g, '')}`,
  }
}

/**
 * «Escribir por WhatsApp»: `https://wa.me/<digits>` (country code + number, digits only). A number
 * without a country code is sent as stored, never guessed. `null` without a phone.
 */
export function customerWhatsAppHref(customer: CustomerContact | null | undefined): string | null {
  const digits = customer?.phone?.replace(/\D/g, '') ?? ''
  if (!digits) return null
  const code = customer?.phoneCountryCode?.replace(/\D/g, '') ?? ''
  return `https://wa.me/${code}${digits}`
}

/** «mar 2025» from the customer's `createdAt`; `null` when missing or invalid. */
export function formatCustomerSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value.replace(/\.$/, '') ?? ''
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  return `${month} ${year}`.trim() || null
}
