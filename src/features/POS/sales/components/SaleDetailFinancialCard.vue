<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import { formatSaleDueDate } from '../utils/saleDate.utils'
import { getPaymentStatusBadge } from '../utils/saleStatus.utils'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{
  sale: SaleDetail
  canEditDueDate?: boolean
}>()

const emit = defineEmits<{
  'register-payment': []
  'edit-due-date': []
}>()

const paymentStatusBadge = computed(() => getPaymentStatusBadge(props.sale.paymentStatus))

const debtColor = computed(() => {
  if (props.sale.debtCents === 0) return 'text-success-600'
  return 'text-error-600'
})

const hasDebt = computed(() => props.sale.debtCents > 0)
</script>

<template>
  <UCard>
    <div class="space-y-4">
      <!-- Payment Status Badge -->
      <UBadge 
        :color="paymentStatusBadge.color" 
        variant="soft" 
        size="lg"
        class="w-full justify-center"
        data-testid="payment-status-badge"
      >
        {{ paymentStatusBadge.label }}
      </UBadge>
      
      <!-- Total and Paid amounts -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-muted">Total</p>
          <p class="text-base font-medium">{{ formatCentsMXN(sale.totalCents) }}</p>
        </div>
        <div>
          <p class="text-sm text-muted">Pagado</p>
          <p class="text-base font-medium">{{ formatCentsMXN(sale.paidCents) }}</p>
        </div>
      </div>
      
      <hr class="border-t border-gray-200" />
      
      <!-- Balance -->
      <div>
        <p class="text-sm text-muted">Saldo</p>
        <p class="text-2xl font-bold" :class="debtColor">
          {{ formatCentsMXN(sale.debtCents) }}
        </p>
      </div>
      
      <hr class="border-t border-gray-200" />
      
      <!-- Due Date -->
      <div v-if="sale.paymentStatus !== 'PAID'" class="flex items-center justify-between" data-testid="sidebar-due-date">
        <div>
          <p class="text-sm text-muted">Vence</p>
          <p v-if="sale.dueDate" class="font-medium">
            {{ formatSaleDueDate(sale.dueDate) }}
          </p>
          <p v-else class="text-muted">Sin fecha</p>
        </div>
        <UButton
          v-if="canEditDueDate"
          variant="link"
          size="sm"
          data-testid="edit-due-date-trigger"
          @click="emit('edit-due-date')"
        >
          {{ sale.dueDate ? 'Editar' : 'Asignar fecha' }}
        </UButton>
      </div>
      
      <hr class="border-t border-gray-200" />
      
      <!-- Payment Action -->
      <div v-if="hasDebt">
        <UButton
          block
          icon="i-lucide-credit-card"
          data-testid="register-debt-payment"
          @click="emit('register-payment')"
        >
          Registrar Pago
        </UButton>
      </div>
      <div v-else>
        <p class="text-sm text-success-600 text-center">
          Venta pagada en su totalidad
        </p>
      </div>
    </div>
  </UCard>
</template>