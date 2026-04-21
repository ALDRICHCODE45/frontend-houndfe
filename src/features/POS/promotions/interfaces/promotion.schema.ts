import { z } from 'zod'

// ── Base shared fields ─────────────────────────────────────────────────────────

const baseSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es requerido')
    .max(200, 'El título no puede exceder 200 caracteres'),
  type: z.enum(['PRODUCT_DISCOUNT', 'ORDER_DISCOUNT', 'BUY_X_GET_Y', 'ADVANCED']),
  method: z.enum(['AUTOMATIC', 'MANUAL']),
  // Discount fields (accept numbers directly from UInputNumber)
  discountType: z.string(),
  discountValue: z.number(),
  // PRODUCT_DISCOUNT
  appliesTo: z.string(),
  targetItems: z.array(z.object({ targetId: z.string(), name: z.string() })),
  // ORDER_DISCOUNT
  hasMinPurchase: z.boolean(),
  minPurchaseAmountCents: z.number(),
  // BUY_X_GET_Y / ADVANCED
  buyQuantity: z.number(),
  getQuantity: z.number(),
  getDiscountPercent: z.number(),
  // ADVANCED sides
  buyTargetType: z.string(),
  buyTargetItems: z.array(z.object({ targetId: z.string(), name: z.string() })),
  getTargetType: z.string(),
  getTargetItems: z.array(z.object({ targetId: z.string(), name: z.string() })),
  // Conditions
  hasVigencia: z.boolean(),
  startDate: z.string(),
  endDate: z.string(),
  customerScope: z.enum(['ALL', 'REGISTERED_ONLY', 'SPECIFIC']),
  customerIds: z.array(z.string()),
  hasPriceLists: z.boolean(),
  priceListIds: z.array(z.string()),
  hasDaysOfWeek: z.boolean(),
  daysOfWeek: z.array(
    z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  ),
})

// ── superRefine: all type-conditional + cross-field validation ─────────────────

export const promotionFormSchema = baseSchema.superRefine((data, ctx) => {
  const type = data.type

  // ── Title already validated in base schema ──────────────────────────────────

  // ── Date range ──────────────────────────────────────────────────────────────
  if (data.hasVigencia && data.startDate && data.endDate) {
    if (new Date(data.endDate) < new Date(data.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La fecha de fin (endDate) debe ser mayor o igual a la de inicio',
        path: ['endDate'],
      })
    }
  }

  // ── PRODUCT_DISCOUNT ────────────────────────────────────────────────────────
  if (type === 'PRODUCT_DISCOUNT') {
    if (!data.discountType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El tipo de descuento es obligatorio',
        path: ['discountType'],
      })
    }
    if (data.discountValue == null || data.discountValue === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El valor del descuento es obligatorio',
        path: ['discountValue'],
      })
    }
    if (!data.appliesTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar a qué se aplica el descuento',
        path: ['appliesTo'],
      })
    }

    if (data.discountType && data.discountValue != null) {
      if (data.discountType === 'PERCENTAGE') {
        if (data.discountValue < 1 || data.discountValue > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El porcentaje debe estar entre 1 y 100',
            path: ['discountValue'],
          })
        }
      } else if (data.discountType === 'FIXED') {
        if (data.discountValue <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El valor debe ser mayor a 0',
            path: ['discountValue'],
          })
        }
      }
    }
  }

  // ── ORDER_DISCOUNT ──────────────────────────────────────────────────────────
  if (type === 'ORDER_DISCOUNT') {
    if (!data.discountType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El tipo de descuento es obligatorio',
        path: ['discountType'],
      })
    }
    if (data.discountValue == null || data.discountValue === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El valor del descuento es obligatorio',
        path: ['discountValue'],
      })
    }

    if (data.discountType && data.discountValue != null) {
      if (data.discountType === 'PERCENTAGE') {
        if (data.discountValue < 1 || data.discountValue > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El porcentaje debe estar entre 1 y 100',
            path: ['discountValue'],
          })
        }
      } else if (data.discountType === 'FIXED') {
        if (data.discountValue <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El valor debe ser mayor a 0',
            path: ['discountValue'],
          })
        }
      }
    }
  }

  // ── BUY_X_GET_Y ─────────────────────────────────────────────────────────────
  if (type === 'BUY_X_GET_Y') {
    if (data.buyQuantity == null || data.buyQuantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad de compra es obligatoria',
        path: ['buyQuantity'],
      })
    } else if (data.buyQuantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad debe ser al menos 1',
        path: ['buyQuantity'],
      })
    }

    if (data.getQuantity == null || data.getQuantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad a llevar es obligatoria',
        path: ['getQuantity'],
      })
    } else if (data.getQuantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad debe ser al menos 1',
        path: ['getQuantity'],
      })
    }

    if (data.getDiscountPercent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento porcentual es obligatorio',
        path: ['getDiscountPercent'],
      })
    } else if (data.getDiscountPercent < 0 || data.getDiscountPercent > 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento debe estar entre 0 y 99 (0 = gratis, 100 no permitido)',
        path: ['getDiscountPercent'],
      })
    }
  }

  // ── ADVANCED ────────────────────────────────────────────────────────────────
  if (type === 'ADVANCED') {
    if (data.buyQuantity == null || data.buyQuantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad de compra es obligatoria',
        path: ['buyQuantity'],
      })
    } else if (data.buyQuantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad debe ser al menos 1',
        path: ['buyQuantity'],
      })
    }

    if (data.getQuantity == null || data.getQuantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad a obtener es obligatoria',
        path: ['getQuantity'],
      })
    } else if (data.getQuantity < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La cantidad debe ser al menos 1',
        path: ['getQuantity'],
      })
    }

    if (data.getDiscountPercent == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento porcentual es obligatorio',
        path: ['getDiscountPercent'],
      })
    } else if (data.getDiscountPercent < 0 || data.getDiscountPercent > 99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento debe estar entre 0 y 99 (0 = gratis, 100 no permitido)',
        path: ['getDiscountPercent'],
      })
    }

    // buyTargetType + buyTargetItems coherence
    if (data.buyTargetType && data.buyTargetItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar al menos un producto en el lado de compra',
        path: ['buyTargetItems'],
      })
    }

    // getTargetType + getTargetItems coherence
    if (data.getTargetType && data.getTargetItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar al menos un producto en el lado de obtiene',
        path: ['getTargetItems'],
      })
    }
  }
})

export type PromotionFormValues = z.infer<typeof promotionFormSchema>
