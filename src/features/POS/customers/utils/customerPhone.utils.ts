import { formatPhoneCountryCode } from '@/core/shared/utils/phone.utils'

/**
 * Display-only phone for lists: `+52 55 1234 5678`. A 10-digit number is
 * grouped 2-4-4; anything else is shown as stored, never guessed. The stored
 * value is not changed.
 */
export function formatCustomerPhone(
  countryCode: string | null | undefined,
  phone: string | null | undefined,
): string {
  const raw = phone?.trim() ?? ''
  if (!raw) return '—'
  const digits = raw.replace(/[\s\-().]/g, '')
  const national = /^\d{10}$/.test(digits)
    ? `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`
    : raw
  return [formatPhoneCountryCode(countryCode), national].filter(Boolean).join(' ')
}
