<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSaleDetail } from '../composables/useSaleDetail'
import { useDebtPayment } from '../composables/useDebtPayment'
import { useSaleComments } from '../composables/useSaleComments'
import SaleDetailItemsList from '../components/SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../components/SaleDetailTotalsCard.vue'
import SaleDetailTimeline from '../components/SaleDetailTimeline.vue'
import SaleCommentInput from '../components/SaleCommentInput.vue'
import SaleDetailSidebar from '../components/SaleDetailSidebar.vue'
import SaleDetailHeader from '../components/SaleDetailHeader.vue'
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

const actionItems = computed(() => [
  { label: 'Imprimir Ticket', icon: 'i-lucide-printer', disabled: true },
  { label: 'Descargar PDF', icon: 'i-lucide-download', disabled: true },
  { label: 'Facturar Venta', icon: 'i-lucide-file-text', disabled: true },
  { label: 'Enviar Recordatorio', icon: 'i-lucide-message-circle', disabled: true },
])

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
  <div v-if="canReadSales" data-testid="sale-detail-layout" class="mx-auto w-full max-w-7xl px-10 space-y-6">
    <!-- Header -->
    <SaleDetailHeader
      v-if="sale && !isLoading"
      :sale="sale"
      :action-items="actionItems"
      @back="goBack"
    />

    <!-- Main content grid -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Main column -->
      <div class="space-y-6 lg:col-span-2">
        <section v-if="sale" class="space-y-3">
          <h3 class="text-xs font-semibold uppercase tracking-wider text-muted">
            Productos<span v-if="sale.items.length" class="text-muted/70"> · {{ sale.items.length }}</span>
          </h3>
          <SaleDetailItemsList :items="sale.items" />
        </section>
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

      <!-- Sidebar -->
      <SaleDetailSidebar
        v-if="sale"
        :sale="sale"
        class="lg:col-span-1"
        @register-payment="debtModalOpen = true"
      />
    </div>

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
