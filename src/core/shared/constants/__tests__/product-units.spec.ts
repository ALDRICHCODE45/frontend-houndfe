import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SERVICE_UNIT_OPTIONS, UNIT_OPTIONS } from '../product-units'
import * as productForm from '@/features/POS/products/composables/useProductForm'

// The unit labels are shared by products, human decisions and purchase orders, so they live in
// core. Products keeps re-exporting them; the other features read them from here, not from the
// products composable.
describe('product unit labels', () => {
  it('names the 8 product units and the 6 service units', () => {
    expect(UNIT_OPTIONS.map(o => `${o.value}:${o.label}`)).toEqual([
      'UNIDAD:Unidad', 'CAJA:Caja', 'BOLSA:Bolsa', 'METRO:Metro', 'CENTIMETRO:Centímetro',
      'KILOGRAMO:Kilogramo', 'GRAMO:Gramo', 'LITRO:Litro',
    ])
    expect(SERVICE_UNIT_OPTIONS.map(o => `${o.value}:${o.label}`)).toEqual([
      'HORA:Hora', 'SESION:Sesión', 'DIA:Día', 'CONSULTA:Consulta', 'CURSO:Curso', 'PAQUETE:Paquete',
    ])
  })

  it('is the same list the product form uses', () => {
    expect(productForm.UNIT_OPTIONS).toBe(UNIT_OPTIONS)
    expect(productForm.SERVICE_UNIT_OPTIONS).toBe(SERVICE_UNIT_OPTIONS)
  })

  it.each([
    'src/features/procurement/purchase-orders/utils/order-quantities.ts',
    'src/features/POS/human-decisions/utils/humanDecisionPresentation.ts',
  ])('%s reads the labels from core', path => {
    const source = readFileSync(path, 'utf8')
    expect(source).toContain("from '@/core/shared/constants/product-units'")
    expect(source).not.toContain('products/composables/useProductForm')
  })
})
