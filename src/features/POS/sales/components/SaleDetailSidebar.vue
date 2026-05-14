<script setup lang="ts">
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDate } from '../utils/saleDate.utils'
import { getPaymentStatusBadge } from '../utils/saleStatus.utils'
import type { SaleDetail } from '../interfaces/sale.types'

defineProps<{
  sale: SaleDetail
}>()

const emit = defineEmits<{
  'register-payment': []
}>()
</script>

<template>
  <UCard>
    <div class="space-y-4 text-sm">
      <div>
        <p class="text-xs text-muted">Estado</p>
        <div class="mt-1 flex items-center gap-2">
          <AppBadge :tone="getPaymentStatusBadge(sale.paymentStatus).color">
            {{ getPaymentStatusBadge(sale.paymentStatus).label }}
          </AppBadge>
          <span>{{ formatCentsMXN(sale.totalCents) }}</span>
        </div>
      </div>

      <div><p class="text-xs text-muted">Fecha</p><p>{{ formatSaleDate(sale.confirmedAt) }}</p></div>
      <div><p class="text-xs text-muted">Canal</p><p>Punto de Venta</p></div>
      <div><p class="text-xs text-muted">Caja</p><p>{{ sale.register }}</p></div>
      <div><p class="text-xs text-muted">Cliente</p><p>{{ sale.customer?.name ?? 'Público en General' }}</p></div>
      <div><p class="text-xs text-muted">Cajero</p><p>{{ sale.cashier.name }}</p></div>
      <div><p class="text-xs text-muted">Vendedor</p><p>{{ sale.seller?.name ?? 'Asignar Vendedor' }}</p></div>

      <div v-if="sale.paymentStatus !== 'PAID'" class="space-y-2">
        <p class="text-xs text-muted">Deuda pendiente</p>
        <p class="font-medium">{{ formatCentsMXN(sale.debtCents) }}</p>
        <UButton data-testid="register-debt-payment" block @click="emit('register-payment')">
          Registrar Pago
        </UButton>
      </div>
    </div>
  </UCard>
</template>
