<script setup lang="ts">
/**
 * ReceiptSaleSummaryModal — the sale a transfer receipt pays, at a glance: its lines (with the
 * variant when one was ordered) and its totals. Reuses the sale detail pieces of Ventas and reads
 * the sale only while the modal is open.
 */
import { computed } from 'vue'
import SaleDetailItemsList from '@/features/POS/sales/components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '@/features/POS/sales/components/SaleDetailTotalsCard.vue'
import { useSaleDetail } from '@/features/POS/sales/composables/useSaleDetail'

const props = defineProps<{
  saleId: string
  folio: string | null
}>()

const open = defineModel<boolean>('open', { required: true })

const { sale, isLoading, isError, isNotFound } = useSaleDetail(
  computed(() => (open.value ? props.saleId : '')),
)

const title = computed(() => (props.folio ? `Venta ${props.folio}` : 'Venta'))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="title"
    description="Productos y totales de la venta que paga este comprobante"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div data-testid="sale-summary" class="flex flex-col gap-4">
        <p v-if="isLoading" class="text-sm text-muted" aria-live="polite">Cargando la venta…</p>
        <p v-else-if="isNotFound" class="text-sm text-muted" role="alert">
          No encontramos esta venta.
        </p>
        <p v-else-if="isError || !sale" class="text-sm text-muted" role="alert">
          No se pudo cargar la venta.
        </p>
        <template v-else>
          <SaleDetailItemsList :items="sale.items" portal-class="hf-theme hf-ui" />
          <SaleDetailTotalsCard
            :subtotal-cents="sale.subtotalCents"
            :discount-cents="sale.discountCents"
            :total-cents="sale.totalCents"
            :paid-cents="sale.paidCents"
            :debt-cents="sale.debtCents"
            :change-due-cents="sale.changeDueCents"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
