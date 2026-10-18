/** Format a display/select prefix without validating country codes.
 * Whitespace is ignored; legacy leading plus signs collapse to one.
 * Other nonnumeric values are left unprefixed rather than guessed.
 */
export function formatPhoneCountryCode(code: string | null | undefined): string {
  const compact = code?.replace(/\s/g, '') ?? ''
  const value = compact.replace(/^\++/, '')
  if (!value) return ''
  return compact.startsWith('+') || /^\d+$/.test(value) ? `+${value}` : value
}
