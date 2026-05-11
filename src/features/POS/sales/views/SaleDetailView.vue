<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSaleDetail } from '../composables/useSaleDetail'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge } from '../utils/saleStatus.utils'
import SaleDetailItemsTable from '../components/SaleDetailItemsTable.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailTimeline from '../components/SaleDetailTimeline.vue'
import SaleDetailSidebar from '../components/SaleDetailSidebar.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const saleId = computed(() => String(route.params.id ?? ''))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const { sale, isLoading } = useSaleDetail(saleId)

function goBack() {
  void router.push('/pos/ventas')
}
</script>

<template>
  <div v-if="canReadSales" data-testid="sale-detail-layout" class="grid grid-cols-1 gap-6 px-10 lg:grid-cols-3">
    <div class="space-y-4 lg:col-span-2">
      <div class="flex items-center justify-between">
        <UButton variant="ghost" icon="i-lucide-arrow-left" @click="goBack">Volver</UButton>

        <h1 class="text-xl font-semibold">Venta {{ extractFolioNumber(sale?.folio ?? '') }}</h1>
      </div>

      <UCard v-if="sale && !isLoading" class="space-y-4">
        <AppBadge :tone="getDeliveryStatusBadge(sale.deliveryStatus).color">
          {{ getDeliveryStatusBadge(sale.deliveryStatus).label }}
        </AppBadge>
      </UCard>

      <SaleDetailItemsTable v-if="sale" :items="sale.items" />
      <SaleDetailTotalsCard
        v-if="sale"
        :subtotal-cents="sale.subtotalCents"
        :discount-cents="sale.discountCents"
        :total-cents="sale.totalCents"
      />
      <SaleDetailTimeline v-if="sale" :timeline="sale.timeline" :payments="sale.payments" />
    </div>

    <SaleDetailSidebar v-if="sale" :sale="sale" class="lg:col-span-1" />
  </div>
</template>
