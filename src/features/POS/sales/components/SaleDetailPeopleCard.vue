<script setup lang="ts">
import { computed } from 'vue'
import type { SaleDetail } from '../interfaces/sale.types'

const props = defineProps<{
  sale: SaleDetail
  canUpdateSale?: boolean
  isSellerMutating?: boolean
}>()

const emit = defineEmits<{
  'assign-seller': []
  'unassign-seller': []
}>()

const customerInitial = computed(() => {
  if (!props.sale.customer) return 'P'
  return props.sale.customer.name.charAt(0).toUpperCase()
})

const sellerInitial = computed(() => {
  if (!props.sale.seller) return undefined
  return props.sale.seller.name.charAt(0).toUpperCase()
})

const canManageSeller = computed(() => 
  props.canUpdateSale && !props.isSellerMutating
)
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-base font-semibold text-muted">Personas</h3>
    </template>
    
    <div class="space-y-4">
      <!-- Cliente -->
      <div>
        <p class="text-sm text-muted mb-2">Cliente</p>
        <div class="flex items-center gap-3">
          <UAvatar
            size="sm"
            :alt="sale.customer?.name ?? 'Público'"
            :text="customerInitial"
          />
          <span class="font-medium">
            {{ sale.customer?.name ?? 'Público en General' }}
          </span>
        </div>
      </div>
      
      <hr class="border-t border-gray-200" />
      
      <!-- Vendedor -->
      <div>
        <p class="text-sm text-muted mb-2">Vendedor</p>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UAvatar
              v-if="sale.seller"
              size="sm"
              :alt="sale.seller.name"
              :text="sellerInitial"
            />
            <UAvatar
              v-else
              size="sm"
              icon="i-lucide-user"
              class="text-muted"
            />
            <span 
              class="font-medium" 
              :class="{ 'text-muted': !sale.seller }"
            >
              {{ sale.seller?.name ?? 'Sin asignar' }}
            </span>
          </div>
          
          <div v-if="canManageSeller" class="flex items-center gap-1">
            <UButton
              v-if="!sale.seller"
              variant="link"
              size="xs"
              data-testid="assign-seller-trigger"
              @click="emit('assign-seller')"
            >
              Asignar
            </UButton>
            <template v-else>
              <UButton
                variant="ghost"
                size="xs"
                data-testid="change-seller-trigger"
                @click="emit('assign-seller')"
              >
                Cambiar
              </UButton>
              <UButton
                variant="ghost"
                size="xs"
                color="red"
                data-testid="unassign-seller-trigger"
                @click="emit('unassign-seller')"
              >
                Quitar
              </UButton>
            </template>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>