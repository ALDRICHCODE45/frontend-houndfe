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

export const productFormSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  sku: z.string().trim().max(100, 'Máximo 100 caracteres'),
  barcode: z.string().trim().max(100, 'Máximo 100 caracteres'),
  categoryId: z.string().trim(),
  description: z.string().trim().max(2000, 'Máximo 2000 caracteres'),
  location: z.string().trim().max(120, 'Máximo 120 caracteres'),
  satKey: z.string().trim().max(100, 'Máximo 100 caracteres'),
  price: z
    .string({ required_error: 'El precio es obligatorio' })
    .trim()
    .min(1, 'El precio es obligatorio')
    .regex(priceRegex, 'Ingresá un valor decimal válido (ej: 199.90)'),
  quantity: z
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Debe ser entero')
    .min(0, 'No puede ser negativo'),
  minQuantity: z
    .number({ invalid_type_error: 'Ingresá un número válido' })
    .int('Debe ser entero')
    .min(0, 'No puede ser negativo'),
  useStock: z.boolean(),
  sellInPos: z.boolean(),
  includeInOnlineCatalog: z.boolean(),
  chargeProductTaxes: z.boolean(),
})

export type ProductFormValues = z.infer<typeof productFormSchema>

function getInitialState(): ProductFormInput {
  return {
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    description: '',
    location: '',
    satKey: '',
    price: '',
    quantity: 0,
    minQuantity: 0,
    useStock: true,
    sellInPos: true,
    includeInOnlineCatalog: true,
    chargeProductTaxes: true,
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
  return {
    name: product.name,
    sku: product.sku ?? '',
    barcode: product.barcode ?? '',
    categoryId: product.categoryId ?? '',
    description: 'description' in product ? (product.description ?? '') : '',
    location: 'location' in product ? (product.location ?? '') : '',
    satKey: 'satKey' in product ? (product.satKey ?? '') : '',
    price: centsToDecimalInput(product.priceCents),
    quantity: product.quantity,
    minQuantity: product.minQuantity,
    useStock: product.useStock,
    sellInPos: product.sellInPos,
    includeInOnlineCatalog: product.includeInOnlineCatalog,
    chargeProductTaxes: product.chargeProductTaxes,
  }
}

export function toCreatePayload(values: ProductFormValues): CreateProductPayload {
  return {
    name: values.name,
    ...(values.sku ? { sku: values.sku } : {}),
    ...(values.barcode ? { barcode: values.barcode } : {}),
    ...(values.categoryId ? { categoryId: values.categoryId } : {}),
    ...(values.description ? { description: values.description } : {}),
    ...(values.location ? { location: values.location } : {}),
    ...(values.satKey ? { satKey: values.satKey } : {}),
    useStock: values.useStock,
    quantity: values.useStock ? values.quantity : 0,
    minQuantity: values.useStock ? values.minQuantity : 0,
    sellInPos: values.sellInPos,
    includeInOnlineCatalog: values.includeInOnlineCatalog,
    chargeProductTaxes: values.chargeProductTaxes,
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
