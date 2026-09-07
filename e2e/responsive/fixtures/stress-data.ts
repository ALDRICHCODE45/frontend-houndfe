/** Immutable deterministic stress tokens covering every declared long-data/token category (BRE-REQ-002). */
export const STRESS_TOKENS = Object.freeze({
  longName: 'Producto Artesanal De Panadería Con Un Nombre De Catálogo Comercial Extremadamente Largo Para Desbordar',
  longEmail: 'direccion.correo.comercial.muy.larga.para.desbordamiento@subdominio.ejemplo-hound.com.mx',
  sku: 'SKU-E2E-0000000000000001', uuid: 'e2e00001-0000-4000-8000-000000000001',
  accountNumber: '7000000190', clabe: '002180700000019012', cents: 123456789, isoDate: '2025-06-15T10:30:00.000Z', status: 'activa',
  badges: Object.freeze(['Café', 'Molido', 'Origen Único', 'Reserva', 'Edición Limitada']),
})

export interface StressRow { readonly id: string; readonly name: string; readonly email: string; readonly sku: string; readonly priceCents: number; readonly accountNumber: string; readonly clabe: string; readonly status: string; readonly updatedAt: string; readonly badges: readonly string[] }

const pad = (value: number): string => String(value).padStart(2, '0')

/** Deterministic 12-row stress dataset; row one carries every unbroken stress token. */
export const STRESS_ROWS: readonly StressRow[] = Object.freeze(
  Array.from({ length: 12 }, (_, index): StressRow => Object.freeze({
    id: `e2e-${STRESS_TOKENS.uuid.slice(0, 8)}-${pad(index + 1)}-4000-8000-000000000001`,
    name: index === 0 ? STRESS_TOKENS.longName : `Producto E2E ${pad(index + 1)}`,
    email: index === 0 ? STRESS_TOKENS.longEmail : `producto${index + 1}@hound.test`,
    sku: `${STRESS_TOKENS.sku.slice(0, -2)}${pad(index + 1)}`,
    priceCents: STRESS_TOKENS.cents + index, accountNumber: STRESS_TOKENS.accountNumber, clabe: STRESS_TOKENS.clabe,
    status: STRESS_TOKENS.status, updatedAt: STRESS_TOKENS.isoDate,
    badges: index === 0 ? STRESS_TOKENS.badges : STRESS_TOKENS.badges.slice(0, 2),
  })),
)
