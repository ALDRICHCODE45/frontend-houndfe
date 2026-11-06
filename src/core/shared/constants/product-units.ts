/**
 * Product and service unit labels. Products (the unit select), human decisions and purchase
 * orders all name a unit with these labels, so they live in core; the products form re-exports
 * them. Pinned by `__tests__/product-units.spec.ts`.
 */

export const UNIT_OPTIONS = [
  { label: 'Unidad', value: 'UNIDAD' },
  { label: 'Caja', value: 'CAJA' },
  { label: 'Bolsa', value: 'BOLSA' },
  { label: 'Metro', value: 'METRO' },
  { label: 'Centímetro', value: 'CENTIMETRO' },
  { label: 'Kilogramo', value: 'KILOGRAMO' },
  { label: 'Gramo', value: 'GRAMO' },
  { label: 'Litro', value: 'LITRO' },
] as const

// ── Service units (subset of service-capable units) ─────────
//
// 6 of the 8 product units (the physical-measurement ones) are NOT valid
// for services. Services accept: HORA, SESION, DIA, CONSULTA, CURSO, PAQUETE.
// Source of truth for the matrix; consumed by `unitOptionsFor` in the products form.
export const SERVICE_UNIT_OPTIONS = [
  { label: 'Hora', value: 'HORA' },
  { label: 'Sesión', value: 'SESION' },
  { label: 'Día', value: 'DIA' },
  { label: 'Consulta', value: 'CONSULTA' },
  { label: 'Curso', value: 'CURSO' },
  { label: 'Paquete', value: 'PAQUETE' },
] as const
