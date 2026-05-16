<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSaleDetail } from '../composables/useSaleDetail'
import { useDebtPayment } from '../composables/useDebtPayment'
import { useSaleComments } from '../composables/useSaleComments'
import { extractFolioNumber } from '../utils/saleFolio.utils'
import { getDeliveryStatusBadge } from '../utils/saleStatus.utils'
import SaleDetailItemsTable from '../components/SaleDetailItemsTable.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailTimeline from '../components/SaleDetailTimeline.vue'
import SaleCommentInput from '../components/SaleCommentInput.vue'
import SaleDetailSidebar from '../components/SaleDetailSidebar.vue'
import DebtPaymentModal from '../components/DebtPaymentModal.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const saleId = computed(() => String(route.params.id ?? ''))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const { sale, isLoading } = useSaleDetail(saleId)
const { addComment, updateComment, deleteComment, isPending: commentsPending, lastError } = useSaleComments(saleId)
const debtModalOpen = ref(false)
const { submit, isSubmitting, externalError } = useDebtPayment(saleId.value)

async function handleDebtSubmit(payload: { method: 'cash' | 'card_credit' | 'card_debit' | 'transfer'; amountCents: number; reference?: string }) {
  await submit(payload)
  debtModalOpen.value = false
}

function goBack() {
  void router.push('/pos/ventas')
}

function mapCommentErrorMessage(code?: string | null): string {
  if (code === 'COMMENT_AUTHOR_FORBIDDEN') return 'Solo el autor puede editar o eliminar este comentario'
  if (code === 'COMMENT_NOT_FOUND') return 'Comentario no encontrado'
  if (code === 'SALE_NOT_FOUND') return 'Venta no encontrada'
  return 'No se pudo guardar el comentario'
}

watch(
  () => lastError.value,
  (error) => {
    if (!error) return
    useToast().add({ title: 'Error', description: mapCommentErrorMessage(error.code), color: 'error' })
  },
)
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
      <SaleDetailTimeline
        v-if="sale"
        :timeline="sale.timeline"
        :current-user-id="authStore.user?.id ?? null"
        :is-pending="commentsPending"
        :on-update-comment="updateComment"
        :on-delete-comment="deleteComment"
      />
      <SaleCommentInput v-if="sale" :is-pending="commentsPending" :on-submit="addComment" />
    </div>

    <SaleDetailSidebar
      v-if="sale"
      :sale="sale"
      class="lg:col-span-1"
      @register-payment="debtModalOpen = true"
    />

    <DebtPaymentModal
      v-if="sale"
      v-model:open="debtModalOpen"
      :sale-id="sale.id"
      :debt-cents="sale.debtCents"
      :is-submitting="isSubmitting"
      :external-error="externalError"
      @submit="handleDebtSubmit"
    />
  </div>
</template>
