/**
 * useProductForm — Composable para el form de producto con UForm + Zod
 *
 * ANTES (vee-validate):
 *   - import useForm, toTypedSchema, defineField
 *   - toTypedSchema(schema) para convertir
 *   - defineField('name') por cada campo
 *   - handleSubmit wrapper
 *   - helper toFieldEntry
 *   = ~50 líneas de plomería
 *
 * AHORA (UForm nativo):
 *   - schema de zod (se pasa directo a <UForm :schema>)
 *   - reactive({}) como state
 *   - función para resetear
 *   = ~20 líneas. Eso es TODO.
 *
 * ¿Por qué? Porque <UForm> ya sabe leer schemas de zod
 * gracias a Standard Schema. No necesitás adapters ni bridges.
 */
import { reactive } from 'vue'
import { z } from 'zod'

// ─── Schema ─────────────────────────────────────────────────────
export const productSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .min(2, 'El nombre debe tener al menos 2 caracteres'),

  sku: z
    .string({ required_error: 'El SKU es obligatorio' })
    .min(3, 'El SKU debe tener al menos 3 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones'),

  category: z
    .string({ required_error: 'La categoría es obligatoria' })
    .min(2, 'La categoría debe tener al menos 2 caracteres'),

  price: z
    .number({
      required_error: 'El precio es obligatorio',
      invalid_type_error: 'Ingresá un número válido',
    })
    .min(0.01, 'El precio debe ser mayor a 0'),

  stock: z
    .number({
      required_error: 'El stock es obligatorio',
      invalid_type_error: 'Ingresá un número válido',
    })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo'),
})

// Tipo inferido del schema
export type ProductFormValues = z.infer<typeof productSchema>

// ─── Initial values ─────────────────────────────────────────────
function getInitialState(): Partial<ProductFormValues> {
  return {
    name: undefined,
    sku: undefined,
    category: undefined,
    price: undefined,
    stock: undefined,
  }
}

// ─── Composable ─────────────────────────────────────────────────
export function useProductForm() {
  // reactive({}) — esto es TODO el state. UForm lo bindea directo.
  const state = reactive<Partial<ProductFormValues>>(getInitialState())

  function resetForm() {
    Object.assign(state, getInitialState())
  }

  return {
    schema: productSchema,
    state,
    resetForm,
  }
}
