import { SERVICE_UNIT_OPTIONS, UNIT_OPTIONS } from '@/features/POS/products/composables/useProductForm'

export const FRACTIONAL_UNITS: ReadonlySet<string> = new Set(['KILOGRAMO', 'GRAMO', 'LITRO', 'METRO', 'CENTIMETRO'])
const INTEGER_UNITS: ReadonlySet<string> = new Set(['UNIDAD', 'CAJA', 'BOLSA', 'PAQUETE', 'HORA', 'SESION', 'DIA', 'CONSULTA', 'CURSO'])
const labels = new Map<string, string>([...UNIT_OPTIONS, ...SERVICE_UNIT_OPTIONS].map(option => [option.value, option.label]))
const quantityPattern = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$/
const amountPattern = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/

export function quantityRule(unit: string | null | undefined): 'fractional' | 'integer' | 'unknown' {
  if (unit && FRACTIONAL_UNITS.has(unit)) return 'fractional'
  if (unit && INTEGER_UNITS.has(unit)) return 'integer'
  return 'unknown'
}
export function unitLabel(unit: string | null | undefined): string | null {
  return unit ? labels.get(unit) ?? null : null
}
// JS $ also matches before a trailing newline. Require a full-string match
// without trimming, coercing, or rewriting the caller's decimal string.
function matchesEntire(pattern: RegExp, value: string): boolean {
  return pattern.exec(value)?.[0] === value
}
export function validateOrderQuantity(value: string, unit: string | null | undefined): 'valid' | 'invalid' | 'unknown' {
  const rule = quantityRule(unit)
  // Missing/stale unit metadata is a server diagnostic, not an invented rule.
  if (rule === 'unknown') return 'unknown'
  if (!matchesEntire(quantityPattern, value) || !/[1-9]/.test(value)) return 'invalid'
  if (rule === 'integer' && value.includes('.')) return 'invalid'
  return 'valid'
}
export function isValidOrderAmount(value: string): boolean {
  return matchesEntire(amountPattern, value)
}
