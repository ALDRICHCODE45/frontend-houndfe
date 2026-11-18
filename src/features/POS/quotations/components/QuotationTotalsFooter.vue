<script setup lang="ts">
/**
 * `QuotationTotalsFooter.vue` — T-UI-22/23 / REQ-UI-009.
 *
 * Sticky right-sidebar Resumen card for the quotation detail view. Mirrors
 * the Coco reference layout (`docs/redesign/quotations-detail-comparison.md`):
 *   - Title "Resumen" + context subtitle (N productos · M unidades · lista X)
 *   - Subtotal (muted), Descuentos (heading ink, with a minus), IVA incluido (gray, from the
 *     response's `ivaBreakdown`), separator, TOTAL (large, bold, black).
 *   - Full-width primary CTA "Enviar cotización" in --hf-action.
 *   - Secondary "Guardar borrador" outlined.
 *   - No expiry line: the date is said once, in the Expira field (draft) or the header.
 *
 * The component is purely presentational — it never calls the API. The
 * parent (`QuotationDetailView`) wires the CTA buttons to
 * `useQuotationDraft` mutations + dialogs.
 *
 * Contract:
 *   Props ↓
 *     quotation:     QuotationResponseDto
 *     priceListName?: string            — render "lista X" in the context
 *     editable?:     boolean            — show CTA + draft button (DRAFT only)
 *
 *   Events ↑
 *     send:            []
 *     save-draft:      []
 *
 * Testids:
 *   root:             quotation-totals-footer
 *   title:            summary-title
 *   context:          summary-context
 *   subtotal:         subtotal-amount
 *   discount row:     discount-row | discount-amount
 *   iva row:          summary-iva-row | summary-iva-amount
 *   total:            total-amount
 *   send button:      summary-send-btn
 *   draft button:     summary-save-draft-btn
 */
import { computed } from 'vue'
import type { QuotationResponseDto } from '../interfaces/quotation.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = withDefaults(
  defineProps<{
    quotation: QuotationResponseDto
    priceListName?: string | null
    editable?: boolean
  }>(),
  {
    priceListName: null,
    editable: false,
  },
)

const emit = defineEmits<{
  send: []
  'save-draft': []
}>()

// ── Derived values ────────────────────────────────────────────────────────────

const itemCount = computed(() => props.quotation.items.length)

const totalUnits = computed(() =>
  props.quotation.items.reduce((sum, item) => sum + item.quantity, 0),
)

const hasDiscount = computed(() => props.quotation.discountCents > 0)

const subtotalFormatted = computed(() => formatCentsMXN(props.quotation.subtotalCents))

const discountFormatted = computed(() => formatCentsMXN(props.quotation.discountCents))

const totalFormatted = computed(() => formatCentsMXN(props.quotation.totalCents))

/**
 * T4 / S6 — IVA per product (docs/quotations-frontend.md §3.18). Prices already include IVA and
 * the total never changes because of it. The amount to show is the sum of `ivaBreakdown[].amountCents`
 * in ONE «IVA incluido» row (no rates, no per-classification breakdown), exactly like the PDF.
 * `ivaBreakdown: []` (no items, or an old quotation without fiscal snapshots) means «do not show
 * IVA» — never «IVA $0». The legacy `taxRate`/`taxCents` are no longer on the wire and are ignored.
 */
interface IvaBreakdownLine {
  classification: string
  amountCents: number
}

const ivaBreakdown = computed<IvaBreakdownLine[]>(() => {
  // `ivaBreakdown` is read defensively: the shared DTO type predates it.
  const raw = (props.quotation as { ivaBreakdown?: unknown }).ivaBreakdown
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (line): line is IvaBreakdownLine =>
      !!line && typeof line === 'object' && Number.isFinite((line as IvaBreakdownLine).amountCents),
  )
})

const hasIva = computed<boolean>(() => ivaBreakdown.value.length > 0)

const ivaFormatted = computed(() =>
  formatCentsMXN(ivaBreakdown.value.reduce((sum, line) => sum + line.amountCents, 0)),
)

/** Counts agree in number: "1 producto · 1 unidad", "2 productos · 3 unidades". */
const legacyItemsCount = computed<string>(() => {
  const products = itemCount.value === 1 ? 'producto' : 'productos'
  const units = totalUnits.value === 1 ? 'unidad' : 'unidades'
  return `${itemCount.value} ${products} · ${totalUnits.value} ${units}`
})

function handleSend(): void {
  emit('send')
}

function handleSaveDraft(): void {
  emit('save-draft')
}
</script>

<template>
  <div
    class="flex flex-col gap-4 rounded-xl border border-default bg-default p-5"
    data-testid="quotation-totals-footer"
  >
    <!-- Header: Resumen title + context subtitle. The `items-count`
         testid stays attached to the context line so the original test
         ("renders N productos · M unidades") continues to anchor on a
         stable point — the new `summary-context` testid is the
         augmented one that includes the price-list segment. -->
    <div class="flex flex-col gap-1">
      <p class="text-sm font-semibold text-highlighted" data-testid="summary-title">Resumen</p>
      <p class="text-xs text-muted" data-testid="summary-context">
        <span data-testid="items-count">{{ legacyItemsCount }}</span>
        <template v-if="props.priceListName"> · lista {{ props.priceListName }}</template>
      </p>
    </div>

    <!-- Rows: subtotal → discount → IVA incluido → separator → TOTAL -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-muted">Subtotal</span>
        <span data-testid="subtotal-amount" class="text-sm text-muted tabular-nums">{{
          subtotalFormatted
        }}</span>
      </div>

      <div v-if="hasDiscount" class="flex items-center justify-between" data-testid="discount-row">
        <span class="text-sm text-muted flex items-center gap-1">
          <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
          Descuentos
        </span>
        <span
          data-testid="discount-amount"
          class="text-sm font-medium text-[var(--hf-heading)] tabular-nums"
          >-{{ discountFormatted }}</span
        >
      </div>

      <!-- T4 / S6 — «IVA incluido»: the sum of ivaBreakdown, hidden when it is empty. -->
      <div
        v-if="hasIva"
        class="flex items-center justify-between gap-2"
        data-testid="summary-iva-row"
      >
        <span class="text-sm text-muted">IVA incluido</span>
        <span class="text-sm text-muted tabular-nums" data-testid="summary-iva-amount">{{
          ivaFormatted
        }}</span>
      </div>

      <USeparator class="my-1 opacity-60" />

      <!-- TOTAL — large, bold, prominent -->
      <div class="flex items-baseline justify-between">
        <p class="text-sm font-semibold text-muted">Total</p>
        <span data-testid="total-amount" class="text-3xl font-semibold text-highlighted tabular-nums">{{
          totalFormatted
        }}</span>
      </div>
    </div>

    <!-- T-UI-23 — REQ-UI-009 sticky CTAs. Full-width primary "Enviar
         cotización" + outlined "Guardar borrador" below. Only rendered
         when editable=true (DRAFT quotations only). T-UI-28 testid
         migration: `summary-actions` → `detail-sidebar-actions` per
         design.md migration table (the header action wrapper is
         `detail-header-actions`). -->
    <div v-if="editable" class="hidden flex-col gap-2 lg:flex" data-testid="detail-sidebar-actions">
      <button
        type="button"
        class="quotations-primary-action inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--hf-action)] px-4 py-3 text-sm font-semibold text-[var(--hf-on-action)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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

  </div>
</template>
