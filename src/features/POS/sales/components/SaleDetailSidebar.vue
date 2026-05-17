<script setup lang="ts">
import { computed, ref } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import AssignSellerSlideover from './AssignSellerSlideover.vue'
import DueDateEditModal from './DueDateEditModal.vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDate, formatSaleDueDate } from '../utils/saleDate.utils'
import { getPaymentStatusBadge } from '../utils/saleStatus.utils'
import { useSellerAssignment } from '../composables/useSellerAssignment'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { SaleDetail } from '../interfaces/sale.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'error' | 'success' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  sale: SaleDetail
}>()

const emit = defineEmits<{
  'register-payment': []
}>()

const authStore = useAuthStore()
const toast = useToast()
const isAssignSellerOpen = ref(false)
const isDueDateModalOpen = ref(false)

const canUpdateSale = computed(() => authStore.userCan('update', 'Sale'))
const canEditDueDate = computed(
  () => canUpdateSale.value && props.sale.paymentStatus !== 'PAID',
)
const { unassignSeller, isPending: isSellerMutating } = useSellerAssignment(() => props.sale.id)

async function handleUnassignSeller() {
  try {
    await unassignSeller()
  } catch (error) {
    const code = (error as { code?: string })?.code
    const description = code === 'SALE_UPDATE_FORBIDDEN'
      ? 'No tenés permisos para modificar esta venta.'
      : 'No se pudo quitar el vendedor.'
    toast.add({ title: 'Error', description, color: 'error' })
  }
}
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
      
       <div>
         <p class="text-xs text-muted">Factura</p>
         <UTooltip text="Funcionalidad próximamente">
           <button
             type="button"
             disabled
             class="text-xs text-muted cursor-not-allowed"
           >
             Ver detalles
           </button>
         </UTooltip>
       </div>
      <div v-if="sale.paymentStatus !== 'PAID'" data-testid="sidebar-due-date">
        <p class="text-xs text-muted">Vence</p>
        <div class="flex items-center gap-2">
          <p v-if="sale.dueDate" class="font-medium">{{ formatSaleDueDate(sale.dueDate) }}</p>
          <p v-else class="font-medium text-muted font-normal">Sin fecha</p>
          <button
            v-if="canEditDueDate"
            type="button"
            data-testid="edit-due-date-trigger"
            class="text-xs text-primary hover:underline"
            @click="isDueDateModalOpen = true"
          >
            {{ sale.dueDate ? 'Editar' : 'Asignar fecha' }}
          </button>
        </div>
      </div>
      <div><p class="text-xs text-muted">Canal</p><p>Punto de Venta</p></div>
      <div><p class="text-xs text-muted">Caja</p><p>{{ sale.register }}</p></div>
      <div><p class="text-xs text-muted">Cliente</p><p>{{ sale.customer?.name ?? 'Público en General' }}</p></div>
      <div><p class="text-xs text-muted">Cajero</p><p>{{ sale.cashier.name }}</p></div>
      <div>
        <p class="text-xs text-muted">Vendedor</p>
        <div class="flex items-center gap-2">
          <p class="font-medium" :class="{ 'text-muted font-normal': !sale.seller }">
            {{ sale.seller?.name ?? 'Sin asignar' }}
          </p>
          <template v-if="canUpdateSale && !isSellerMutating">
            <button
              v-if="!sale.seller"
              data-testid="assign-seller-trigger"
              type="button"
              class="text-xs text-primary hover:underline"
              @click="isAssignSellerOpen = true"
            >
              Asignar
            </button>
            <template v-else>
              <button
                data-testid="change-seller-trigger"
                type="button"
                class="text-xs text-primary hover:underline"
                @click="isAssignSellerOpen = true"
              >
                Cambiar
              </button>
              <button
                data-testid="unassign-seller-trigger"
                type="button"
                class="text-xs text-error hover:underline"
                @click="handleUnassignSeller"
              >
                Quitar
              </button>
            </template>
          </template>
        </div>
      </div>

      <div v-if="sale.paymentStatus !== 'PAID'" class="space-y-2">
        <p class="text-xs text-muted">Deuda pendiente</p>
        <p class="font-medium">{{ formatCentsMXN(sale.debtCents) }}</p>
        <UButton data-testid="register-debt-payment" block @click="emit('register-payment')">
          Registrar Pago
        </UButton>
      </div>
    </div>
  </UCard>

  <AssignSellerSlideover
    v-model:open="isAssignSellerOpen"
    :sale-id="sale.id"
  />

  <DueDateEditModal
    v-model:open="isDueDateModalOpen"
    :sale-id="sale.id"
    :current-due-date="sale.dueDate"
  />
</template>
