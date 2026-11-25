<script setup lang="ts">
/**
 * Sales history backend data T2 (S6, handoff 28 §5.2): the seller's best-selling products of the
 * period, as returned (at most five, backend order). The amount is after line discounts but
 * BEFORE sale-wide discounts, so the block says «antes de descuentos de la venta» and is never
 * summed into, or shown as part of, the seller's totals.
 */
import { useId } from 'vue'
import type { SellerReportTopProduct } from '../interfaces/seller-report.types'
import { formatSellerReportCents, formatSellerReportUnits } from '../utils/sellerReportPresentation'

defineProps<{ products: readonly SellerReportTopProduct[] }>()

const titleId = useId()

function productKey(product: SellerReportTopProduct): string {
  return `${product.productId}:${product.variantId ?? ''}`
}
</script>

<template>
  <section
    data-testid="seller-report-top-products"
    :aria-labelledby="titleId"
    class="grid min-w-0 gap-1 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] px-3 pt-3"
  >
    <div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h3 :id="titleId" class="m-0 text-sm font-semibold text-[var(--hf-heading)]">Más vendidos</h3>
      <span class="text-xs text-[var(--hf-muted)]"
        >Importes antes de descuentos de la venta; no suman a las ventas netas</span
      >
    </div>
    <ol class="m-0 grid min-w-0 list-none divide-y divide-[var(--hf-border)] p-0">
      <li
        v-for="product in products"
        :key="productKey(product)"
        data-testid="seller-report-top-product"
        class="flex min-w-0 items-center gap-3 py-2"
      >
        <span class="grid min-w-0 flex-1">
          <span
            class="truncate text-sm font-medium text-[var(--hf-ink)]"
            :title="product.productName"
            >{{ product.productName }}</span
          >
          <span class="truncate text-[13px] text-[var(--hf-muted)]">
            <template v-if="product.variantName">{{ product.variantName }} · </template>
            <span class="hf-figure">{{ formatSellerReportUnits(product.quantity) }}</span>
          </span>
        </span>
        <span class="hf-figure shrink-0 text-right text-sm font-semibold text-[var(--hf-ink)]">{{
          formatSellerReportCents(product.netSalesCents)
        }}</span>
      </li>
    </ol>
  </section>
</template>
