import { z } from 'zod'
import {
  BXGY_ALLOWED_APPLIES_TO,
  CUSTOMER_SCOPE,
  DAY_OF_WEEK,
  DISCOUNT_TYPE,
  PROMOTION_METHOD,
  PROMOTION_TYPE,
} from '../constants/promotion.constants'

// ── BXGY-only constants (REQ-11) ───────────────────────────────────────────────
//
// REQ-11: a BUY_X_GET_Y submission must target PRODUCTS, VARIANTS, CATEGORIES
// or BRANDS — the same set PRODUCT_DISCOUNT allows minus ORDERS (which has no
// "appliesTo" semantics) and minus the ADVANCED-only sides. Intentionally
// scoped to the BXGY branch only so the base `appliesTo: z.string()` stays
// free for ORDER_DISCOUNT (`appliesTo: ''`) and ADVANCED (`appliesTo: ''`).
// Tuple lives in `constants/promotion.constants.ts` — see BXGY_ALLOWED_APPLIES_TO.

// ── Base shared fields ─────────────────────────────────────────────────────────

const baseSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es requerido')
    .max(200, 'El título no puede exceder 200 caracteres'),
  type: z.enum([
    PROMOTION_TYPE.PRODUCT_DISCOUNT,
    PROMOTION_TYPE.ORDER_DISCOUNT,
    PROMOTION_TYPE.BUY_X_GET_Y,
    PROMOTION_TYPE.ADVANCED,
  ]),
  method: z.enum([PROMOTION_METHOD.AUTOMATIC, PROMOTION_METHOD.MANUAL]),
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
  customerScope: z.enum([
    CUSTOMER_SCOPE.ALL,
    CUSTOMER_SCOPE.REGISTERED_ONLY,
    CUSTOMER_SCOPE.SPECIFIC,
  ]),
  customerIds: z.array(z.string()),
  hasPriceLists: z.boolean(),
  priceListIds: z.array(z.string()),
  hasDaysOfWeek: z.boolean(),
  daysOfWeek: z.array(
    z.enum([
      DAY_OF_WEEK.MONDAY,
      DAY_OF_WEEK.TUESDAY,
      DAY_OF_WEEK.WEDNESDAY,
      DAY_OF_WEEK.THURSDAY,
      DAY_OF_WEEK.FRIDAY,
      DAY_OF_WEEK.SATURDAY,
      DAY_OF_WEEK.SUNDAY,
    ]),
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
  if (type === PROMOTION_TYPE.PRODUCT_DISCOUNT) {
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
      if (data.discountType === DISCOUNT_TYPE.PERCENTAGE) {
        if (data.discountValue < 1 || data.discountValue > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El porcentaje debe estar entre 1 y 100',
            path: ['discountValue'],
          })
        }
      } else if (data.discountType === DISCOUNT_TYPE.FIXED) {
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
  if (type === PROMOTION_TYPE.ORDER_DISCOUNT) {
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
      if (data.discountType === DISCOUNT_TYPE.PERCENTAGE) {
        if (data.discountValue < 1 || data.discountValue > 100) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El porcentaje debe estar entre 1 y 100',
            path: ['discountValue'],
          })
        }
      } else if (data.discountType === DISCOUNT_TYPE.FIXED) {
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
  if (type === PROMOTION_TYPE.BUY_X_GET_Y) {
    // REQ-11: BXGY MUST include `appliesTo` ∈ {PRODUCTS, VARIANTS, CATEGORIES,
    // BRANDS} and at least one `targetItem`. Empty / unknown `appliesTo` both
    // surface as a single appliesTo issue with a Spanish message so the form
    // can show one clear hint instead of a wall of redundant errors.
    const appliesToAllowed =
      typeof data.appliesTo === 'string' &&
      (BXGY_ALLOWED_APPLIES_TO as readonly string[]).includes(data.appliesTo)
    if (!appliesToAllowed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar a qué se aplica la promoción',
        path: ['appliesTo'],
      })
    }

    if (data.targetItems.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe seleccionar al menos un producto',
        path: ['targetItems'],
      })
    }

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
    } else if (data.getDiscountPercent < 0 || data.getDiscountPercent > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento debe estar entre 0 y 100 (100 = gratis)',
        path: ['getDiscountPercent'],
      })
    }
  }

  // ── ADVANCED ────────────────────────────────────────────────────────────────
  if (type === PROMOTION_TYPE.ADVANCED) {
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
      // SUPERSEDE NOTE: bound was 0..99 (and rejected 100). Proposal
      // `sdd/advanced-promotion-type/proposal` widens to 0..100 inclusive
      // so ADVANCED can model the buy-N-get-M-free case (100 = gratis).
      // Mirrors the BUY_X_GET_Y branch (L213) which already uses the wider
      // bound. INTENTIONAL supersede of the prior 0..99 rule — not a bug.
    } else if (data.getDiscountPercent < 0 || data.getDiscountPercent > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El descuento debe estar entre 0 y 100 (100 = gratis)',
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
