<script setup lang="ts">
/**
 * `QuotationTotalsFooter.vue` — T-UI-22/23 / REQ-UI-009.
 *
 * Sticky right-sidebar RESUMEN card for the quotation detail view. Mirrors
 * the Coco reference layout (`docs/redesign/quotations-detail-comparison.md`):
 *   - Title "RESUMEN" + context subtitle (N productos · M unidades · lista X)
 *   - Subtotal (muted), Descuentos (blue, info), IVA 16% (gray, computed),
 *     separator, TOTAL (large, bold, black).
 *   - Full-width primary CTA "Enviar cotización" in --coco-primary.
 *   - Secondary "Guardar borrador" outlined.
 *   - Validity notice "Válida hasta …".
 *
 * The component is purely presentational — it never calls the API. The
 * parent (`QuotationDetailView`) wires the CTA buttons to
 * `useQuotationDraft` mutations + dialogs.
 *
 * Contract:
 *   Props ↓
 *     quotation:     QuotationResponseDto
 *     priceListName?: string            — render "lista X" in the context
 *     expiresAt?:    string | null      — explicit override for the validity
 *                                          notice (defaults to quotation.expiresAt)
 *     editable?:     boolean            — show CTA + draft button (DRAFT only)
 *
 *   Events ↑
 *     send:            []
 *     save-draft:      []
 *     update:tax-rate: [taxRate: number]
 *
 * Testids:
 *   root:             quotation-totals-footer
 *   title:            summary-title
 *   context:          summary-context
 *   subtotal:         subtotal-amount
 *   discount row:     discount-row | discount-amount
 *   iva row:          summary-iva-row
 *   iva select:       summary-iva-select (only when editable=true)
 *   total:            total-amount
 *   send button:      summary-send-btn
 *   draft button:     summary-save-draft-btn
 *   validity notice:  summary-validity-notice
 */
import { computed, ref, watch } from 'vue'
import type { QuotationResponseDto } from '../interfaces/quotation.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = withDefaults(
  defineProps<{
    quotation: QuotationResponseDto
    priceListName?: string | null
    expiresAt?: string | null
    editable?: boolean
  }>(),
  {
    priceListName: null,
    expiresAt: undefined,
    editable: false,
  },
)

const emit = defineEmits<{
  send: []
  'save-draft': []
  'update:tax-rate': [taxRate: number]
}>()

// ── Derived values ────────────────────────────────────────────────────────────

const itemCount = computed(() => props.quotation.items.length)

const totalUnits = computed(() =>
  props.quotation.items.reduce((sum, item) => sum + item.quantity, 0),
)

const hasDiscount = computed(() => props.quotation.discountCents > 0)

const subtotalFormatted = computed(() =>
  formatCentsMXN(props.quotation.subtotalCents),
)

const discountFormatted = computed(() =>
  formatCentsMXN(props.quotation.discountCents),
)

const totalFormatted = computed(() =>
  formatCentsMXN(props.quotation.totalCents),
)

/** IVA — read straight from the backend (`taxCents` + `taxRate`). The row
 *  only renders when both fields are non-null; older payloads that don't
 *  stamp the tax leave the row out entirely. The label is built from the
 *  rate rounded to the nearest integer percentage so a `0.16` rate from
 *  the backend renders as "IVA 16%" without any client-side math. */
const ivaPercentLabel = computed<string | null>(() => {
  const rate = props.quotation.taxRate
  if (rate === null || rate === undefined) return null
  return `IVA ${Math.round(rate * 100)}%`
})

const ivaFormatted = computed(() => formatCentsMXN(props.quotation.taxCents ?? 0))

const hasIva = computed<boolean>(
  () => props.quotation.taxCents !== null && props.quotation.taxRate !== null,
)

/** Effective expiresAt — explicit prop takes precedence over the
 *  embedded quotation value so the parent can decouple the validity
 *  notice from the data the totals card needs. */
const effectiveExpiresAt = computed<string | null>(() => {
  if (props.expiresAt !== undefined) return props.expiresAt
  return props.quotation.expiresAt
})

const validityLabel = computed<string | null>(() => {
  const value = effectiveExpiresAt.value
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
})

const hasValidityNotice = computed<boolean>(() => validityLabel.value !== null)

const contextLine = computed<string>(() => {
  const parts: string[] = [
    `${itemCount.value} productos`,
    `${totalUnits.value} unidades`,
  ]
  if (props.priceListName) parts.push(`lista ${props.priceListName}`)
  return parts.join(' · ')
})

/** The legacy `items-count` row used the same plural-only wording so
 *  the original tests continue to anchor on "1 productos" / "1 unidades". */
const legacyItemsCount = computed<string>(
  () => `${itemCount.value} productos · ${totalUnits.value} unidades`,
)

function handleSend(): void {
  emit('send')
}

function handleSaveDraft(): void {
  emit('save-draft')
}

// ── IVA rate selector (DRAFT only) ───────────────────────────────────────────
// Backend accepts four tax rates per the spec (0, 0.08, 0.16, 0.21). The
// select is mounted only when `editable=true` (DRAFT quotations); non-DRAFT
// states render the plain-text label so the historic read-only display
// stays untouched. The select's v-model is seeded from `quotation.taxRate`
// so any change the parent makes via the backend (e.g. an applyDiscount
// cascade) propagates back to the dropdown without a remount.

interface TaxRateOption {
  label: string
  value: number
}

const TAX_RATE_OPTIONS: TaxRateOption[] = [
  { label: '0% (Exento)', value: 0 },
  { label: '8%', value: 0.08 },
  { label: '16%', value: 0.16 },
  { label: '21%', value: 0.21 },
]

const taxRateOptions = computed<TaxRateOption[]>(() => TAX_RATE_OPTIONS)

/** Local mirror of `props.quotation.taxRate`. The parent owns the cache; we
 *  only mirror so the v-model has a stable ref to bind. Synced on every
 *  change of the upstream tax rate (initial mount + reactive updates). */
const selectedTaxRate = ref<number>(props.quotation.taxRate ?? 0)

watch(
  () => props.quotation.taxRate,
  (next) => {
    if (next === null || next === undefined) return
    selectedTaxRate.value = next
  },
)

function handleTaxRateChange(value: number | null | undefined): void {
  if (value === null || value === undefined) return
  emit('update:tax-rate', value)
}
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5"
    data-testid="quotation-totals-footer"
  >
    <!-- Header: RESUMEN title + context subtitle. The `items-count`
         testid stays attached to the context line so the original test
         ("renders N productos · M unidades") continues to anchor on a
         stable point — the new `summary-context` testid is the
         augmented one that includes the price-list segment. -->
    <div class="flex flex-col gap-1">
      <p
        class="text-xs font-semibold uppercase tracking-wide text-muted"
        data-testid="summary-title"
      >RESUMEN</p>
      <p
        class="text-xs text-muted"
        data-testid="summary-context"
      >
        <span data-testid="items-count">{{ legacyItemsCount }}</span>
        <template v-if="props.priceListName"> · lista {{ props.priceListName }}</template>
      </p>
    </div>

    <!-- Rows: subtotal → discount → iva 16% → separator → TOTAL -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">Subtotal</span>
        <span
          data-testid="subtotal-amount"
          class="text-sm text-muted tabular-nums"
        >{{ subtotalFormatted }}</span>
      </div>

      <div
        v-if="hasDiscount"
        class="flex items-center justify-between"
        data-testid="discount-row"
      >
        <span class="text-sm text-[var(--coco-info)] flex items-center gap-1">
          <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
          Descuentos
        </span>
        <span
          data-testid="discount-amount"
          class="text-sm font-medium text-[var(--coco-info)] tabular-nums"
        >-{{ discountFormatted }}</span>
      </div>

      <!-- T-UI-12/13 — IVA row. Rendered only when the backend stamps both
           `taxRate` and `taxCents`; older payloads that don't expose the
           tax leave the row out entirely. The label is dynamic — a 16%
           rate renders as "IVA 16%", an 8% rate as "IVA 8%", etc.
           Editable mode (DRAFT only) swaps the label for a USelectMenu
           that emits `update:tax-rate` so the parent can PATCH the
           draft with the new rate. Non-DRAFT states keep the static
           label so the historic read-only display is unaffected. -->
      <div
        v-if="hasIva"
        class="flex items-center justify-between gap-2"
        data-testid="summary-iva-row"
      >
        <USelectMenu
          v-if="editable"
          v-model="selectedTaxRate"
          :items="taxRateOptions"
          value-key="value"
          label-key="label"
          size="xs"
          class="min-w-[140px]"
          data-testid="summary-iva-select"
          @update:model-value="handleTaxRateChange"
        />
        <span v-else class="text-sm text-muted">{{ ivaPercentLabel }}</span>
        <span
          class="text-sm text-muted tabular-nums"
          data-testid="summary-iva-amount"
        >{{ ivaFormatted }}</span>
      </div>

      <USeparator class="my-1 opacity-60" />

      <!-- TOTAL — large, bold, prominent -->
      <div class="flex items-baseline justify-between">
        <p class="text-xs font-semibold text-muted uppercase tracking-wider">
          Total
        </p>
        <span
          data-testid="total-amount"
          class="text-3xl font-bold text-highlighted tabular-nums"
        >{{ totalFormatted }}</span>
      </div>
    </div>

    <!-- T-UI-23 — REQ-UI-009 sticky CTAs. Full-width primary "Enviar
         cotización" + outlined "Guardar borrador" below. Only rendered
         when editable=true (DRAFT quotations only). T-UI-28 testid
         migration: `summary-actions` → `detail-sidebar-actions` per
         design.md migration table (the header action wrapper is
         `detail-header-actions`). -->
    <div
      v-if="editable"
      class="flex flex-col gap-2"
      data-testid="detail-sidebar-actions"
    >
      <button
        type="button"
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--coco-primary)] px-4 py-3 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="summary-send-btn"
        @click="handleSend"
      >
        <UIcon name="i-lucide-send" class="h-4 w-4" />
        Enviar cotización
      </button>
      <button
        type="button"
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-default bg-default px-4 py-2 text-sm font-medium text-muted hover:bg-elevated"
        data-testid="summary-save-draft-btn"
        @click="handleSaveDraft"
      >
        <UIcon name="i-lucide-save" class="h-4 w-4" />
        Guardar borrador
      </button>
    </div>

    <!-- Validity notice: only when the quotation has a real expiry. -->
    <p
      v-if="hasValidityNotice"
      class="flex items-center gap-2 text-xs text-muted"
      data-testid="summary-validity-notice"
    >
      <UIcon name="i-lucide-shield-check" class="h-4 w-4 text-[var(--coco-success)]" />
      Válida hasta el {{ validityLabel }}.
    </p>
  </div>
</template>
