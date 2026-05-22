<script setup lang="ts">
import { computed, ref } from 'vue'
import SaleDetailFinancialCard from './SaleDetailFinancialCard.vue'
import SaleDetailPeopleCard from './SaleDetailPeopleCard.vue'
import SaleDetailMetadataCard from './SaleDetailMetadataCard.vue'
import AssignSellerSlideover from './AssignSellerSlideover.vue'
import DueDateEditModal from './DueDateEditModal.vue'
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

function handleAssignSeller() {
  isAssignSellerOpen.value = true
}

function handleEditDueDate() {
  isDueDateModalOpen.value = true
}
</script>

<template>
  <div class="sticky top-6 self-start space-y-4" data-testid="sidebar">
    <!-- Block 1: Financial Card -->
    <SaleDetailFinancialCard
      :sale="sale"
      :can-edit-due-date="canEditDueDate"
      @register-payment="emit('register-payment')"
      @edit-due-date="handleEditDueDate"
    />
    
    <!-- Block 2: People Card -->
    <SaleDetailPeopleCard
      :sale="sale"
      :can-update-sale="canUpdateSale"
      :is-seller-mutating="isSellerMutating"
      @assign-seller="handleAssignSeller"
      @unassign-seller="handleUnassignSeller"
    />
    
    <!-- Block 3: Details Card -->
    <SaleDetailMetadataCard :sale="sale" />
  </div>

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
