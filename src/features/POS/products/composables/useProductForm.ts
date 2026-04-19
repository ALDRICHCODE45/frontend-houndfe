import { reactive } from 'vue'
import { z } from 'zod'
import type {
  CreateProductPayload,
  Product,
  ProductDetail,
  ProductFormInput,
  UpdateProductPayload,
} from '../interfaces/product.types'

const priceRegex = /^\d+(?:[.,]\d{1,2})?$/

// ── Enums for selects ──────────────────────────────────────

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

export const IVA_OPTIONS = [
  { label: '16%', value: 'IVA_16' },
  { label: '8%', value: 'IVA_8' },
  { label: '0%', value: 'IVA_0' },
  { label: 'Exento', value: 'IVA_EXENTO' },
] as const

export const IEPS_OPTIONS = [
  { label: 'No aplica', value: 'NO_APLICA' },
  { label: '160%', value: 'IEPS_160' },
  { label: '53%', value: 'IEPS_53' },
  { label: '50%', value: 'IEPS_50' },
  { label: '30.4%', value: 'IEPS_30_4' },
  { label: '30%', value: 'IEPS_30' },
  { label: '26.5%', value: 'IEPS_26_5' },
  { label: '25%', value: 'IEPS_25' },
  { label: '9%', value: 'IEPS_9' },
  { label: '8%', value: 'IEPS_8' },
  { label: '7%', value: 'IEPS_7' },
  { label: '6%', value: 'IEPS_6' },
  { label: '3%', value: 'IEPS_3' },
  { label: '0%', value: 'IEPS_0' },
] as const

// ── Schema ─────────────────────────────────────────────────

export const productFormSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  type: z.enum(['PRODUCT', 'SERVICE']),
  sku: z.string().trim().max(100, 'Máximo 100 caracteres'),
  barcode: z.string().trim().max(100, 'Máximo 100 caracteres'),
  categoryId: z.string().trim(),
  brandId: z.string().trim(),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
  location: z.string().trim().max(120, 'Máximo 120 caracteres'),
  satKey: z.string().trim().max(100, 'Máximo 100 caracteres'),
  unit: z.string().trim(),
  price: z
    .string()
    .trim()
    .regex(priceRegex, 'Ingresá un valor decimal válido (ej: 199.90)')
    .or(z.literal(''))
    .default('0.00'),
  quantity: z
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Debe ser entero')
    .min(0, 'No puede ser negativo'),
  minQuantity: z
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Debe ser entero')
    .min(0, 'No puede ser negativo'),
  useStock: z.boolean(),
  useLotsAndExpirations: z.boolean(),
  hasVariants: z.boolean(),
  sellInPos: z.boolean(),
  includeInOnlineCatalog: z.boolean(),
  requiresPrescription: z.boolean(),
  chargeProductTaxes: z.boolean(),
  ivaRate: z.string().trim(),
  iepsRate: z.string().trim(),
  purchaseCostMode: z.enum(['NET', 'GROSS']),
  purchaseCost: z
    .string()
    .trim()
    .regex(priceRegex, 'Ingresá un valor decimal válido')
    .or(z.literal('')),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

// ── Helpers ────────────────────────────────────────────────

function getInitialState(): ProductFormInput {
  return {
    name: '',
    type: 'PRODUCT',
    sku: '',
    barcode: '',
    categoryId: '',
    brandId: '',
    description: '',
    location: '',
    satKey: '',
    unit: 'UNIDAD',
    price: '',
    quantity: 0,
    minQuantity: 0,
    useStock: true,
    useLotsAndExpirations: false,
    hasVariants: false,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    ivaRate: 'IVA_16',
    iepsRate: 'NO_APLICA',
    purchaseCostMode: 'NET',
    purchaseCost: '0.00',
  }
}

export function centsToDecimalInput(cents: number): string {
  return (Math.max(cents, 0) / 100).toFixed(2)
}

export function decimalInputToCents(value: string): number {
  const normalized = value.replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed)) return 0
  return Math.round(parsed * 100)
}

export function productToFormInput(product: Product | ProductDetail): ProductFormInput {
  const isDetail = 'description' in product

  return {
    name: product.name,
    type: isDetail ? (product as ProductDetail).type : 'PRODUCT',
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    brandId: product.brandId ?? '',
    description: isDetail ? ((product as ProductDetail).description ?? '') : '',
    location: isDetail ? ((product as ProductDetail).location ?? '') : '',
    satKey: isDetail ? ((product as ProductDetail).satKey ?? '') : '',
    unit: isDetail ? (product as ProductDetail).unit : 'UNIDAD',
    price: centsToDecimalInput(product.priceCents),
    quantity: product.quantity,
    minQuantity: product.minQuantity,
    useStock: product.useStock,
    useLotsAndExpirations: product.useLotsAndExpirations,
    hasVariants: product.hasVariants,
    sellInPos: product.sellInPos,
    includeInOnlineCatalog: product.includeInOnlineCatalog,
    requiresPrescription: product.requiresPrescription ?? false,
    chargeProductTaxes: product.chargeProductTaxes,
    ivaRate: isDetail ? (product as ProductDetail).ivaRate : 'IVA_16',
    iepsRate: isDetail ? (product as ProductDetail).iepsRate : 'NO_APLICA',
    purchaseCostMode: isDetail ? (product as ProductDetail).purchaseCostMode : 'NET',
    purchaseCost: isDetail
      ? centsToDecimalInput(
          (product as ProductDetail).purchaseCostMode === 'NET'
            ? (product as ProductDetail).purchaseNetCostCents
            : (product as ProductDetail).purchaseGrossCostCents,
        )
      : '0.00',
  }
}

export function toCreatePayload(values: ProductFormValues): CreateProductPayload {
  const costCents = values.purchaseCost ? decimalInputToCents(values.purchaseCost) : 0

  return {
    name: values.name,
    type: values.type,
    ...(values.sku ? { sku: values.sku } : {}),
    ...(values.barcode ? { barcode: values.barcode } : {}),
    ...(values.categoryId ? { categoryId: values.categoryId } : {}),
    ...(values.brandId ? { brandId: values.brandId } : { brandId: null }),
    ...(values.description ? { description: values.description } : {}),
    ...(values.location ? { location: values.location } : {}),
    ...(values.satKey ? { satKey: values.satKey } : {}),
    unit: values.unit,
    useStock: values.useStock,
    useLotsAndExpirations: values.useStock ? values.useLotsAndExpirations : false,
    hasVariants: values.hasVariants,
    quantity:
      values.useStock && !values.useLotsAndExpirations && !values.hasVariants ? values.quantity : 0,
    minQuantity: values.useStock && !values.hasVariants ? values.minQuantity : 0,
    sellInPos: values.sellInPos,
    includeInOnlineCatalog: values.includeInOnlineCatalog,
    requiresPrescription: values.requiresPrescription,
    chargeProductTaxes: values.chargeProductTaxes,
    ...(values.chargeProductTaxes ? { ivaRate: values.ivaRate, iepsRate: values.iepsRate } : {}),
    ...(costCents > 0
      ? { purchaseCost: { mode: values.purchaseCostMode, valueCents: costCents } }
      : {}),
    priceCents: decimalInputToCents(values.price),
  }
}

export function toUpdatePayload(values: ProductFormValues): UpdateProductPayload {
  return toCreatePayload(values)
}

export function useProductForm() {
  const state = reactive<ProductFormInput>(getInitialState())

  function resetForm() {
    Object.assign(state, getInitialState())
  }

  function setState(nextState: ProductFormInput) {
    Object.assign(state, nextState)
  }

  return {
    schema: productFormSchema,
    state,
    resetForm,
    setState,
  }
}
