import { computed, reactive, type ComputedRef } from 'vue'
import { promotionFormSchema } from '../interfaces/promotion.schema'
import type {
  CreatePromotionPayload,
  CustomerScope,
  DayOfWeek,
  DiscountType,
  PromotionFormState,
  PromotionMethod,
  PromotionResponse,
  PromotionTargetType,
  PromotionType,
  UpdatePromotionPayload,
} from '../interfaces/promotion.types'
import { DAY_OF_WEEK_LABELS } from '../interfaces/promotion.types'
import {
  CUSTOMER_SCOPE,
  DAY_OF_WEEK,
  DISCOUNT_TYPE,
  PROMOTION_METHOD,
  PROMOTION_TARGET_TYPE,
  PROMOTION_TYPE,
  TARGET_SIDE,
} from '../constants/promotion.constants'
import {
  computeOverlappingTargets,
  type OverlappingTarget,
} from '../utils/advancedTargets.utils'

// ── Select option types ────────────────────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  label: string
  value: T
}

export interface BuyXGetYPreset {
  label: string
  buyQuantity: number
  getQuantity: number
  getDiscountPercent: number
}

// ── Option arrays ─────────────────────────────────────────────────────────────

export const METHOD_OPTIONS: SelectOption<PromotionMethod>[] = [
  { label: 'Automático', value: PROMOTION_METHOD.AUTOMATIC },
  { label: 'Manual', value: PROMOTION_METHOD.MANUAL },
]

export const DISCOUNT_TYPE_OPTIONS: SelectOption<DiscountType>[] = [
  { label: 'Porcentaje (%)', value: DISCOUNT_TYPE.PERCENTAGE },
  { label: 'Monto fijo ($)', value: DISCOUNT_TYPE.FIXED },
]

export const CUSTOMER_SCOPE_OPTIONS: SelectOption<CustomerScope>[] = [
  { label: 'Todos los clientes', value: CUSTOMER_SCOPE.ALL },
  { label: 'Solo clientes registrados', value: CUSTOMER_SCOPE.REGISTERED_ONLY },
  { label: 'Clientes específicos', value: CUSTOMER_SCOPE.SPECIFIC },
]

export const DAY_OPTIONS: SelectOption<DayOfWeek>[] = (
  Object.entries(DAY_OF_WEEK_LABELS) as [DayOfWeek, string][]
).map(([value, label]) => ({ value, label }))

export const TARGET_TYPE_OPTIONS: SelectOption<PromotionTargetType>[] = [
  { label: 'Categorías', value: PROMOTION_TARGET_TYPE.CATEGORIES },
  { label: 'Marcas', value: PROMOTION_TARGET_TYPE.BRANDS },
  { label: 'Productos', value: PROMOTION_TARGET_TYPE.PRODUCTS },
  { label: 'Variantes', value: PROMOTION_TARGET_TYPE.VARIANTS },
]

// ── Discount percent select options (REQ-8) ───────────────────────────────────
//
// REQ-8: BXGY bound is 0..100 inclusive; 100 = gratis ("Gratis" maps to 100,
// NOT the legacy inverted 0→"Gratis"). ADVANCED still rejects 100 via the
// schema bound (0..99), so this shared list intentionally exposes the full
// BXGY range — ADVANCED is enforced at the schema level, not here.
//
// Extracted from PromotionForm.vue so it can be unit-tested as pure data
// without mounting the SFC (Extract-Before-Mock).
export const DISCOUNT_PERCENT_OPTIONS: { label: string; value: number }[] = [
  ...Array.from({ length: 19 }, (_, i) => {
    const pct = (i + 1) * 5
    return { label: `${pct}% OFF`, value: pct }
  }),
  { label: 'Gratis', value: 100 },
]

// REQ-10: locked preset table for BUY_X_GET_Y quick-pick.
export const BUY_X_GET_Y_PRESETS: BuyXGetYPreset[] = [
  { label: '2x1', buyQuantity: 1, getQuantity: 1, getDiscountPercent: 100 },
  { label: '3x2', buyQuantity: 2, getQuantity: 1, getDiscountPercent: 100 },
  { label: 'Segundo al 50%', buyQuantity: 1, getQuantity: 1, getDiscountPercent: 50 },
]

// ── Initial state factory ─────────────────────────────────────────────────────

export function getInitialState(type: PromotionType): PromotionFormState {
  return {
    // Shared
    title: '',
    type,
    method: PROMOTION_METHOD.AUTOMATIC,
    // Discount fields
    discountType: '',
    discountValue: 0,
    // PRODUCT_DISCOUNT
    appliesTo: PROMOTION_TARGET_TYPE.PRODUCTS,
    targetItems: [],
    // ORDER_DISCOUNT
    hasMinPurchase: false,
    minPurchaseAmountCents: 0,
    // BUY_X_GET_Y / ADVANCED
    buyQuantity: 0,
    getQuantity: 0,
    getDiscountPercent: 0,
    // ADVANCED
    buyTargetType: PROMOTION_TARGET_TYPE.PRODUCTS,
    buyTargetItems: [],
    getTargetType: PROMOTION_TARGET_TYPE.PRODUCTS,
    getTargetItems: [],
    // Conditions
    hasVigencia: false,
    startDate: '',
    endDate: '',
    customerScope: CUSTOMER_SCOPE.ALL,
    customerIds: [],
    hasPriceLists: false,
    priceListIds: [],
    hasDaysOfWeek: false,
    daysOfWeek: [],
  }
}

// ── API Response → Form State ─────────────────────────────────────────────────

/**
 * Hydrate a backend `PromotionTargetItem` into a form entry.
 *
 * For VARIANTS entries that the backend has enriched with `variantName`
 * (the Slice 4 backend follow-up), we map the friendly variant name into
 * the entry's `name` field and carry the optional `productId` + `productName`
 * so the chip renders `"{productName} · {variantName}"` directly from the
 * read response — no second round-trip.
 *
 * For everything else (non-VARIANTS, OR VARIANTS whose enrichment fields are
 * absent because the variant was deleted or the backend is older), we fall
 * back to the existing `{ targetId, name: '' }` shape. The form entry's
 * `productId` and `productName` are LEFT UNDEFINED (never `null`) so the
 * serializer spread in `toCreatePayload` / `toUpdatePayload` strips them
 * rather than promoting them into the request body.
 *
 * The mapping is intentionally side-agnostic — it keys off the presence of
 * the enrichment fields, not off `side` (DEFAULT / BUY / GET). All three
 * hydration sites in `promotionToFormState` use this helper.
 */
function hydrateTargetItem(
  ti: PromotionResponse['targetItems'][number],
): PromotionFormState['targetItems'][number] {
  if (ti.targetType === PROMOTION_TARGET_TYPE.VARIANTS && typeof ti.variantName === 'string') {
    return {
      targetId: ti.targetId,
      name: ti.variantName,
      // Carried for chip rendering ("{productName} · {name}"). Session-only;
      // stripped by toCreatePayload / toUpdatePayload (INV-1 + INV-3).
      ...(ti.productId != null ? { productId: ti.productId } : {}),
      ...(ti.productName != null ? { productName: ti.productName } : {}),
    }
  }
  return { targetId: ti.targetId, name: '' }
}

export function promotionToFormState(response: PromotionResponse): PromotionFormState {
  const defaultItems = response.targetItems.filter((ti) => ti.side === TARGET_SIDE.DEFAULT)
  const buyItems = response.targetItems.filter((ti) => ti.side === TARGET_SIDE.BUY)
  const getItems = response.targetItems.filter((ti) => ti.side === TARGET_SIDE.GET)

  return {
    // Shared
    title: response.title,
    type: response.type,
    method: response.method,
    // Discount — convert cents → dollars for FIXED type display
    discountType: response.discountType ?? '',
    discountValue:
      response.discountType === DISCOUNT_TYPE.FIXED && response.discountValue != null
        ? response.discountValue / 100
        : (response.discountValue ?? 0),
    // PRODUCT_DISCOUNT
    appliesTo: response.appliesTo ?? PROMOTION_TARGET_TYPE.PRODUCTS,
    targetItems: defaultItems.map(hydrateTargetItem),
    // ORDER_DISCOUNT — convert cents → dollars for display
    hasMinPurchase: response.minPurchaseAmountCents != null,
    minPurchaseAmountCents:
      response.minPurchaseAmountCents != null ? response.minPurchaseAmountCents / 100 : 0,
    // BUY_X_GET_Y / ADVANCED
    buyQuantity: response.buyQuantity ?? 0,
    getQuantity: response.getQuantity ?? 0,
    getDiscountPercent: response.getDiscountPercent ?? 0,
    // ADVANCED
    buyTargetType: response.buyTargetType ?? PROMOTION_TARGET_TYPE.PRODUCTS,
    buyTargetItems: buyItems.map(hydrateTargetItem),
    getTargetType: response.getTargetType ?? PROMOTION_TARGET_TYPE.PRODUCTS,
    getTargetItems: getItems.map(hydrateTargetItem),
    // Conditions
    hasVigencia: response.startDate != null,
    startDate: response.startDate ? response.startDate.slice(0, 10) : '',
    endDate: response.endDate ? response.endDate.slice(0, 10) : '',
    customerScope: response.customerScope,
    customerIds: response.customers.map((c) => c.customerId),
    hasPriceLists: response.priceLists.length > 0,
    priceListIds: response.priceLists.map((pl) => pl.globalPriceListId),
    hasDaysOfWeek: response.daysOfWeek.length > 0,
    daysOfWeek: response.daysOfWeek.map((d) => d.day),
  }
}

// ── Form State → Create Payload ───────────────────────────────────────────────

export function toCreatePayload(state: PromotionFormState): CreatePromotionPayload {
  const base = buildBasePayload(state)

  if (state.type === PROMOTION_TYPE.PRODUCT_DISCOUNT) {
    return {
      ...base,
      type: PROMOTION_TYPE.PRODUCT_DISCOUNT,
      discountType: state.discountType as DiscountType,
      discountValue:
        state.discountType === DISCOUNT_TYPE.FIXED
          ? Math.round(state.discountValue * 100)
          : state.discountValue,
      appliesTo: state.appliesTo as PromotionTargetType,
      ...(state.targetItems.length > 0
        ? {
            targetItems: state.targetItems.map((ti) => ({
              targetType: state.appliesTo as PromotionTargetType,
              targetId: ti.targetId,
            })),
          }
        : {}),
    }
  }

  if (state.type === PROMOTION_TYPE.ORDER_DISCOUNT) {
    return {
      ...base,
      type: PROMOTION_TYPE.ORDER_DISCOUNT,
      discountType: state.discountType as DiscountType,
      discountValue:
        state.discountType === DISCOUNT_TYPE.FIXED
          ? Math.round(state.discountValue * 100)
          : state.discountValue,
      ...(state.hasMinPurchase && state.minPurchaseAmountCents
        ? { minPurchaseAmountCents: Math.round(state.minPurchaseAmountCents * 100) }
        : {}),
    }
  }

  if (state.type === PROMOTION_TYPE.BUY_X_GET_Y) {
    return {
      ...base,
      type: PROMOTION_TYPE.BUY_X_GET_Y,
      buyQuantity: state.buyQuantity,
      getQuantity: state.getQuantity,
      getDiscountPercent: state.getDiscountPercent,
      ...(state.appliesTo ? { appliesTo: state.appliesTo as PromotionTargetType } : {}),
      ...(state.targetItems.length > 0
        ? {
            targetItems: state.targetItems.map((ti) => ({
              targetType: state.appliesTo as PromotionTargetType,
              targetId: ti.targetId,
            })),
          }
        : {}),
    }
  }

  // ADVANCED
  return {
    ...base,
    type: PROMOTION_TYPE.ADVANCED,
    buyQuantity: state.buyQuantity,
    getQuantity: state.getQuantity,
    getDiscountPercent: state.getDiscountPercent,
    ...(state.buyTargetType ? { buyTargetType: state.buyTargetType as PromotionTargetType } : {}),
    ...(state.getTargetType ? { getTargetType: state.getTargetType as PromotionTargetType } : {}),
    ...(state.buyTargetItems.length > 0
      ? { buyTargetItems: state.buyTargetItems.map((ti) => ({ targetId: ti.targetId })) }
      : {}),
    ...(state.getTargetItems.length > 0
      ? { getTargetItems: state.getTargetItems.map((ti) => ({ targetId: ti.targetId })) }
      : {}),
  }
}

// ── Form State → Update Payload ───────────────────────────────────────────────

export function toUpdatePayload(state: PromotionFormState): UpdatePromotionPayload {
  // Build the full create payload and strip the type field
  const full = toCreatePayload(state) as unknown as Record<string, unknown>

  const { type: _type, ...rest } = full
  return rest as UpdatePromotionPayload
}

// ── Private helpers ───────────────────────────────────────────────────────────

function buildBasePayload(state: PromotionFormState) {
  return {
    title: state.title,
    method: state.method,
    ...(state.hasVigencia && state.startDate ? { startDate: state.startDate } : {}),
    ...(state.hasVigencia && state.endDate ? { endDate: state.endDate } : {}),
    // customerScope: always include when not ALL
    ...(state.customerScope !== CUSTOMER_SCOPE.ALL ? { customerScope: state.customerScope } : {}),
    // customerIds: always send the array — empty [] clears the relation on backend
    // SPECIFIC → send the actual IDs; any other scope → send [] to clear
    customerIds: state.customerScope === CUSTOMER_SCOPE.SPECIFIC ? state.customerIds : [],
    // priceListIds: always include the array — empty [] clears relation on backend
    priceListIds: state.hasPriceLists ? state.priceListIds : [],
    // daysOfWeek: always include the array — empty [] clears relation on backend
    daysOfWeek: state.hasDaysOfWeek ? state.daysOfWeek : [],
  }
}

// ── Field-level error mapping ─────────────────────────────────────────────────

export interface FormFieldError {
  path: string
  message: string
}

export interface ApiErrorInput {
  error?: string
  message?: string | string[]
}

export interface ApiErrorMapping {
  fieldErrors: FormFieldError[]
  toastMessage: string | null
}

/** Map of form field keywords → form state path */
const FIELD_PATH_MAP: Record<string, string> = {
  title: 'title',
  discounttype: 'discountType',
  discountvalue: 'discountValue',
  startdate: 'startDate',
  enddate: 'endDate',
  buyquantity: 'buyQuantity',
  getquantity: 'getQuantity',
  getdiscountpercent: 'getDiscountPercent',
  minpurchaseamountcents: 'minPurchaseAmountCents',
  appliesto: 'appliesTo',
  method: 'method',
}

/**
 * Pure function: maps a backend API error object to field-level form errors
 * and/or a toast fallback message.
 *
 * Returns `{ fieldErrors, toastMessage }` where:
 * - `fieldErrors`: array of `{ path, message }` for use with UForm `:errors`
 * - `toastMessage`: non-null string for errors that can't be bound to a specific field
 */
export function mapApiErrorToFields(input: ApiErrorInput): ApiErrorMapping {
  // REQ-12: error-code matching MUST be case-insensitive — the backend may emit
  // `duplicate_target` (or any casing variant) and the user expects the same
  // mapping regardless. We canonicalize once up-front so the comparisons below
  // stay readable against uppercase constants.
  const code = (input.error ?? '').toUpperCase()
  const rawMessage = Array.isArray(input.message) ? input.message.join(', ') : (input.message ?? '')

  // ── INVALID_DATE_RANGE → always endDate field ──────────────────────────────
  if (code === 'INVALID_DATE_RANGE') {
    return {
      fieldErrors: [
        {
          path: 'endDate',
          message: 'La fecha de fin debe ser posterior a la fecha de inicio',
        },
      ],
      toastMessage: null,
    }
  }

  // ── MISSING_REQUIRED_FIELD → try to extract field name from message ────────
  if (code === 'MISSING_REQUIRED_FIELD') {
    const fieldPath = extractFieldPath(rawMessage)
    if (fieldPath) {
      return {
        fieldErrors: [{ path: fieldPath, message: `El campo ${fieldPath} es requerido` }],
        toastMessage: null,
      }
    }
    return {
      fieldErrors: [],
      toastMessage: rawMessage || 'Campo requerido faltante. Verificá el formulario.',
    }
  }

  // ── INVALID_FIELD_VALUE → try to extract field name from message ───────────
  if (code === 'INVALID_FIELD_VALUE') {
    const fieldPath = extractFieldPath(rawMessage)
    if (fieldPath) {
      return {
        fieldErrors: [{ path: fieldPath, message: rawMessage || `Valor inválido en ${fieldPath}` }],
        toastMessage: null,
      }
    }
    return {
      fieldErrors: [],
      toastMessage: rawMessage || 'Uno o más valores del formulario son inválidos.',
    }
  }

  // ── DUPLICATE_TARGET → field-level error on targetItems (S39) ────────────
  if (code === 'DUPLICATE_TARGET') {
    return {
      fieldErrors: [
        {
          path: 'targetItems',
          message: 'Hay targets duplicados. Revisá que no haya items repetidos.',
        },
      ],
      toastMessage: null,
    }
  }

  // ── INVALID_TARGET → field-level error on targetItems (REQ-6) ───────────
  // Triggered when the backend rejects a variant id as no longer valid
  // (deleted, moved to another tenant, etc.). The form stays editable so
  // the merchant can swap the variant and resubmit.
  if (code === 'INVALID_TARGET') {
    return {
      fieldErrors: [
        {
          path: 'targetItems',
          message: 'La variante seleccionada no existe o no pertenece a tu comercio',
        },
      ],
      toastMessage: null,
    }
  }

  // ── ADVANCED_OVERLAPPING_TARGETS → field-level error on getTargetItems ─────
  // (advanced-promotion-type WU-A) The backend refused the submission because
  // the same {targetType, targetId} appears on both BUY and GET sides. The
  // form surfaces this as a field-level error on the GET side because that's
  // where the user is most likely to react first. The local client-side
  // `overlappingTargets` computed (exposed by usePromotionForm) also surfaces
  // the warning non-blockingly before submit, but backend remains authoritative.
  if (code === 'ADVANCED_OVERLAPPING_TARGETS') {
    return {
      fieldErrors: [
        {
          path: 'getTargetItems',
          message: 'Los objetivos de compra y obtención no pueden superponerse.',
        },
      ],
      toastMessage: null,
    }
  }

  // ── ADVANCED_MISSING_TARGETS → toast (side not derivable from code) ──────
  // The backend rejected because either BUY or GET side has zero targets, but
  // the code alone does not tell us WHICH side. Defaulting to a toast is the
  // safer UX choice (no false-positive field highlight). The client-side
  // zod schema already guards empty sides per type, so this toast is the
  // last line of defense for cross-cutting cases (e.g. all targets removed
  // mid-edit by a server-side race).
  if (code === 'ADVANCED_MISSING_TARGETS') {
    return {
      fieldErrors: [],
      toastMessage: 'Debe seleccionar objetivos de compra y de obtención.',
    }
  }

  // ── FORBIDDEN_FIELD → toast only (REQ-12) ─────────────────────────────
  // The backend refused the update because the field is immutable for this
  // promotion type (e.g. flipping BXGY → ADVANCED post-creation). No field
  // binding: the user must rethink the change, not retry it.
  if (code === 'FORBIDDEN_FIELD') {
    return {
      fieldErrors: [],
      toastMessage: 'No se permite modificar ese campo para este tipo de promoción.',
    }
  }

  // ── INVALID_FIELD_CHANGE → toast only (REQ-12) ───────────────────────
  // The backend refused the update because the promotion's `type` cannot be
  // changed after creation. No field binding for the same reason as above.
  if (code === 'INVALID_FIELD_CHANGE') {
    return {
      fieldErrors: [],
      toastMessage: 'No se puede cambiar el tipo de una promoción existente.',
    }
  }

  // ── ENTITY_ALREADY_EXISTS → toast only ────────────────────────────────────
  if (code === 'ENTITY_ALREADY_EXISTS') {
    return {
      fieldErrors: [],
      toastMessage: 'Ya existe una promoción con esos datos.',
    }
  }

  // ── Fallback: show whatever message we got ─────────────────────────────────
  return {
    fieldErrors: [],
    toastMessage: rawMessage || 'No se pudo completar la operación. Reintentá en unos segundos.',
  }
}

/** Scan the message string for known field keywords (case-insensitive) */
function extractFieldPath(message: string): string | null {
  const lowerMsg = message.toLowerCase()
  for (const [keyword, path] of Object.entries(FIELD_PATH_MAP)) {
    if (lowerMsg.includes(keyword)) return path
  }
  return null
}

// ── Composable ────────────────────────────────────────────────────────────────

export function usePromotionForm(type: PromotionType = PROMOTION_TYPE.PRODUCT_DISCOUNT) {
  const state = reactive<PromotionFormState>(getInitialState(type))

  /**
   * Non-blocking warning — `advanced-promotion-type` WU-A (R-D).
   *
   * Detects BUY∩GET target overlap for ADVANCED promotions via the pure
   * `computeOverlappingTargets` wrapper (single source of truth shared with
   * `PromotionForm.vue`'s rendered path). Exposed as a `computed` so callers
   * can react to overlap reactively. The form DOES NOT block submit on
   * overlap — backend `advanced_overlapping_targets` is the authoritative
   * gate.
   *
   * For non-ADVANCED types (and when either side is empty) returns `[]`,
   * which is the "no warning" state.
   */
  const overlappingTargets: ComputedRef<OverlappingTarget[]> = computed(() =>
    computeOverlappingTargets(
      state.type,
      state.buyTargetType || '',
      state.buyTargetItems,
      state.getTargetType || '',
      state.getTargetItems,
    ),
  )

  function resetForm() {
    Object.assign(state, getInitialState(state.type))
  }

  function setState(nextState: PromotionFormState) {
    Object.assign(state, nextState)
  }

  return {
    schema: promotionFormSchema,
    state,
    overlappingTargets,
    resetForm,
    setState,
  }
}
