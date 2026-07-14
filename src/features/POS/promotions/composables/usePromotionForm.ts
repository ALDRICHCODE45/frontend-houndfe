import { reactive } from 'vue'
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
  { label: 'Automático', value: 'AUTOMATIC' },
  { label: 'Manual', value: 'MANUAL' },
]

export const DISCOUNT_TYPE_OPTIONS: SelectOption<DiscountType>[] = [
  { label: 'Porcentaje (%)', value: 'PERCENTAGE' },
  { label: 'Monto fijo ($)', value: 'FIXED' },
]

export const CUSTOMER_SCOPE_OPTIONS: SelectOption<CustomerScope>[] = [
  { label: 'Todos los clientes', value: 'ALL' },
  { label: 'Solo clientes registrados', value: 'REGISTERED_ONLY' },
  { label: 'Clientes específicos', value: 'SPECIFIC' },
]

export const DAY_OPTIONS: SelectOption<DayOfWeek>[] = (
  Object.entries(DAY_OF_WEEK_LABELS) as [DayOfWeek, string][]
).map(([value, label]) => ({ value, label }))

export const TARGET_TYPE_OPTIONS: SelectOption<PromotionTargetType>[] = [
  { label: 'Categorías', value: 'CATEGORIES' },
  { label: 'Marcas', value: 'BRANDS' },
  { label: 'Productos', value: 'PRODUCTS' },
  { label: 'Variantes', value: 'VARIANTS' },
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
    method: 'AUTOMATIC',
    // Discount fields
    discountType: '',
    discountValue: 0,
    // PRODUCT_DISCOUNT
    appliesTo: 'PRODUCTS',
    targetItems: [],
    // ORDER_DISCOUNT
    hasMinPurchase: false,
    minPurchaseAmountCents: 0,
    // BUY_X_GET_Y / ADVANCED
    buyQuantity: 0,
    getQuantity: 0,
    getDiscountPercent: 0,
    // ADVANCED
    buyTargetType: 'PRODUCTS',
    buyTargetItems: [],
    getTargetType: 'PRODUCTS',
    getTargetItems: [],
    // Conditions
    hasVigencia: false,
    startDate: '',
    endDate: '',
    customerScope: 'ALL',
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
  if (ti.targetType === 'VARIANTS' && typeof ti.variantName === 'string') {
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
  const defaultItems = response.targetItems.filter((ti) => ti.side === 'DEFAULT')
  const buyItems = response.targetItems.filter((ti) => ti.side === 'BUY')
  const getItems = response.targetItems.filter((ti) => ti.side === 'GET')

  return {
    // Shared
    title: response.title,
    type: response.type,
    method: response.method,
    // Discount — convert cents → dollars for FIXED type display
    discountType: response.discountType ?? '',
    discountValue:
      response.discountType === 'FIXED' && response.discountValue != null
        ? response.discountValue / 100
        : (response.discountValue ?? 0),
    // PRODUCT_DISCOUNT
    appliesTo: response.appliesTo ?? 'PRODUCTS',
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
    buyTargetType: response.buyTargetType ?? 'PRODUCTS',
    buyTargetItems: buyItems.map(hydrateTargetItem),
    getTargetType: response.getTargetType ?? 'PRODUCTS',
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

  if (state.type === 'PRODUCT_DISCOUNT') {
    return {
      ...base,
      type: 'PRODUCT_DISCOUNT',
      discountType: state.discountType as DiscountType,
      discountValue:
        state.discountType === 'FIXED'
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

  if (state.type === 'ORDER_DISCOUNT') {
    return {
      ...base,
      type: 'ORDER_DISCOUNT',
      discountType: state.discountType as DiscountType,
      discountValue:
        state.discountType === 'FIXED'
          ? Math.round(state.discountValue * 100)
          : state.discountValue,
      ...(state.hasMinPurchase && state.minPurchaseAmountCents
        ? { minPurchaseAmountCents: Math.round(state.minPurchaseAmountCents * 100) }
        : {}),
    }
  }

  if (state.type === 'BUY_X_GET_Y') {
    return {
      ...base,
      type: 'BUY_X_GET_Y',
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
    type: 'ADVANCED',
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
    ...(state.customerScope !== 'ALL' ? { customerScope: state.customerScope } : {}),
    // customerIds: always send the array — empty [] clears the relation on backend
    // SPECIFIC → send the actual IDs; any other scope → send [] to clear
    customerIds: state.customerScope === 'SPECIFIC' ? state.customerIds : [],
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
  const code = input.error
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

export function usePromotionForm(type: PromotionType = 'PRODUCT_DISCOUNT') {
  const state = reactive<PromotionFormState>(getInitialState(type))

  function resetForm() {
    Object.assign(state, getInitialState(state.type))
  }

  function setState(nextState: PromotionFormState) {
    Object.assign(state, nextState)
  }

  return {
    schema: promotionFormSchema,
    state,
    resetForm,
    setState,
  }
}
