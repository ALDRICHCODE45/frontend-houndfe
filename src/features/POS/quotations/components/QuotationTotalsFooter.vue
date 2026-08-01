<script setup lang="ts">
/**
 * `QuotationTotalsFooter.vue` — S6 / REQ-QTN-007 (totals side-effect) /
 * REQ-QTN-008.
 *
 * Compact footer bar at the bottom of the quotation detail view that
 * mirrors `SaleTotalsFooter` (POS sales module) but consumes the
 * quotation response shape directly. Pure presentation — receives a full
 * `QuotationResponseDto`, derives the formatted strings with
 * `formatCentsMXN`, and emits nothing. All mutations flow back through
 * the parent (which owns `useQuotationDraft`).
 *
 * Layout (compact, single-row):
 *   "{N} productos · {M} unidades"  (muted, top)
 *   Subtotal                            $X.XX  (muted)
 *   Descuento                          -$Y.YY  (primary, when > 0)
 *   ─────────────────────────────────────────
 *   TOTAL                              $Z.ZZ  (large, bold, prominent)
 *
 * Why a footer (vs inline in the detail view):
 *   - The cashier's mental model is "what's the bottom line" — pinning the
 *     totals to the bottom of the editor keeps them visible while scrolling
 *     through items, promos, and customer context.
 *   - Mirrors `SaleTotalsFooter` so the two POS surfaces stay coherent.
 */
import { computed } from 'vue'
import type { QuotationResponseDto } from '../interfaces/quotation.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = defineProps<{
  quotation: QuotationResponseDto
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
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl border border-default bg-default px-5 py-4"
    data-testid="quotation-totals-footer"
  >
    <!-- Top line: items + units (mirrors SaleTotalsFooter's `Artic · Unidad`). -->
    <p
      class="text-xs text-muted"
      data-testid="items-count"
    >
      {{ itemCount }} productos · {{ totalUnits }} unidades
    </p>

    <!-- Subtotal row. -->
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted">Subtotal</span>
      <span
        data-testid="subtotal-amount"
        class="text-sm text-muted tabular-nums"
      >{{ subtotalFormatted }}</span>
    </div>

    <!-- Discount row (only when the backend applied a discount). -->
    <div
      v-if="hasDiscount"
      class="flex items-center justify-between"
      data-testid="discount-row"
    >
      <span class="text-sm text-primary flex items-center gap-1">
        <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
        Descuento
      </span>
      <span
        data-testid="discount-amount"
        class="text-sm font-medium text-primary tabular-nums"
      >-{{ discountFormatted }}</span>
    </div>

    <USeparator class="my-1 opacity-60" />

    <!-- Total row — prominent (large, bold). -->
    <div class="flex items-baseline justify-between">
      <p class="text-xs font-semibold text-muted uppercase tracking-wider">
        Total
      </p>
      <span
        data-testid="total-amount"
        class="text-2xl font-extrabold text-highlighted tabular-nums"
      >{{ totalFormatted }}</span>
    </div>
  </div>
</template>
