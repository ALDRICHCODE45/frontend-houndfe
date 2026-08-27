/**
 * Shared, label-first address formatter.
 *
 * Single source of truth for rendering a human address string. Replaces the two
 * divergent local `formatAddress` helpers previously living in
 * `CustomerUpsertSlideover.vue` and `AssignCustomerSlideover.vue`
 * (design §8.1/§8.2, spec REQ-AMP-008/009/010).
 *
 * Ordering: label → `street #exterior Int. interior` →
 * `neighborhood, municipality, city, state` → `CP zipCode`.
 * Empty/whitespace fields are dropped; an input with nothing usable returns ''.
 */

/**
 * Superset input: every field optional + nullable so customer entities (no
 * `label` today) and the delivery-route stop projection (with `label`, plus
 * extra fields like `id`/`latitude`) both satisfy the contract structurally.
 */
export interface AddressFormatInput {
  label?: string | null
  street?: string | null
  exteriorNumber?: string | null
  interiorNumber?: string | null
  neighborhood?: string | null
  municipality?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
}

/** Trim and drop whitespace-only values so blank fields never reach the output. */
function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function formatAddress(input: AddressFormatInput): string {
  const segments: string[] = []

  const label = clean(input.label)
  if (label) segments.push(label)

  const exterior = clean(input.exteriorNumber)
  const interior = clean(input.interiorNumber)
  const street = [
    clean(input.street),
    exterior ? `#${exterior}` : '',
    interior ? `Int. ${interior}` : '',
  ].filter(Boolean)
  if (street.length) segments.push(street.join(' '))

  const locality = [
    clean(input.neighborhood),
    clean(input.municipality),
    clean(input.city),
    clean(input.state),
  ]
    .filter(Boolean)
    .join(', ')
  if (locality) segments.push(locality)

  const zip = clean(input.zipCode)
  if (zip) segments.push(`CP ${zip}`)

  return segments.join(', ')
}
