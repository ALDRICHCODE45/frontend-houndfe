<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import CustomerUpsertSlideover from '@/features/POS/customers/components/CustomerUpsertSlideover.vue'
import AddressModal from '@/features/POS/customers/components/AddressModal.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useDraftCustomerAssignment, DraftCustomerAssignmentError } from '../composables/useDraftCustomerAssignment'
import type {
  CreateCustomerAddressPayload,
  CreateCustomerPayload,
  Customer,
  CustomerAddress,
  CustomerDetail,
} from '@/features/POS/customers/interfaces/customer.types'

declare const useToast: () => {
  add: (options: { title: string, description?: string, color?: 'error' | 'success' | 'warning' | 'primary' | 'neutral' }) => void
}

const props = defineProps<{
  open: boolean
  saleId: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
}>()

const authStore = useAuthStore()
const queryClient = useQueryClient()
const toast = useToast()
const { assignCustomer, setShippingAddress } = useDraftCustomerAssignment(() => props.saleId)

const searchInput = ref('')
const debouncedSearch = ref('')
const selectedCustomer = ref<CustomerDetail | null>(null)
const isCreateCustomerOpen = ref(false)
const isCreateAddressOpen = ref(false)
const isCreatingCustomer = ref(false)
const isCreatingAddress = ref(false)

const canCreateCustomer = computed(() => authStore.userCan('create', 'Customer'))

watch(searchInput, (value) => {
  const timeout = setTimeout(() => {
    debouncedSearch.value = value.trim().toLowerCase()
  }, 200)

  return () => clearTimeout(timeout)
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      searchInput.value = ''
      debouncedSearch.value = ''
      selectedCustomer.value = null
      isCreateCustomerOpen.value = false
      isCreateAddressOpen.value = false
    }
  },
)

const customersQuery = useQuery({
  queryKey: ['customers', 'list'],
  queryFn: () => customerApi.getPaginated({ pageIndex: 0, pageSize: 100, globalFilter: '' }),
  enabled: computed(() => props.open),
  staleTime: 30_000,
})

const customers = computed(() => customersQuery.data.value?.data ?? [])

const filteredCustomers = computed(() => {
  const search = debouncedSearch.value
  if (!search) return customers.value

  return customers.value.filter((customer) => {
    const haystack = [
      customer.firstName,
      customer.lastName ?? '',
      customer.email ?? '',
      customer.phone ?? '',
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })
})

const addresses = computed(() => selectedCustomer.value?.addresses ?? [])
const showAddressPicker = computed(() => addresses.value.length > 0)

function resolveErrorMessage(error: unknown): string {
  const code = error instanceof DraftCustomerAssignmentError ? error.code : (error as { code?: string })?.code

  switch (code) {
    case 'CUSTOMER_NOT_FOUND':
      return 'No se encontró el cliente. Recargá la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOUND':
      return 'No se encontró la dirección. Recargá la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER':
      return 'Esa dirección no pertenece al cliente seleccionado.'
    case 'SHIPPING_ADDRESS_REQUIRES_CUSTOMER':
      return 'Asigná un cliente antes de elegir la dirección.'
    case 'SALE_NOT_DRAFT':
      return 'Esta venta ya no es un borrador. Recargá la página.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tenés permisos para modificar esta venta.'
    default:
      return 'No se pudo completar la operación'
  }
}

async function handleSelectCustomer(customer: Customer) {
  try {
    await assignCustomer({ customerId: customer.id })
    selectedCustomer.value = await customerApi.getById(customer.id)
    emit('update:open', false)
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  }
}

async function handleCreateCustomer(payload: CreateCustomerPayload) {
  isCreatingCustomer.value = true
  try {
    const createdCustomer = await customerApi.create(payload)
    await queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
    await assignCustomer({ customerId: createdCustomer.id })
    selectedCustomer.value = createdCustomer
    isCreateCustomerOpen.value = false
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  } finally {
    isCreatingCustomer.value = false
  }
}

async function handleAddressSelect(shippingAddressId: string | null) {
  try {
    await setShippingAddress({ shippingAddressId })
    emit('update:open', false)
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  }
}

async function handleCreateAddress(payload: CreateCustomerAddressPayload) {
  if (!selectedCustomer.value) return

  isCreatingAddress.value = true
  try {
    const createdAddress = await customerApi.createAddress(selectedCustomer.value.id, payload)
    await queryClient.invalidateQueries({ queryKey: ['customers', 'list'] })
    await handleAddressSelect(createdAddress.id)
    isCreateAddressOpen.value = false
    selectedCustomer.value = await customerApi.getById(selectedCustomer.value.id)
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  } finally {
    isCreatingAddress.value = false
  }
}

function formatAddress(address: CustomerAddress): string {
  return [address.street, address.exteriorNumber ? `#${address.exteriorNumber}` : null, address.city]
    .filter(Boolean)
    .join(', ')
}
</script>

<template>
  <USlideover :open="open" side="right" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="flex h-full flex-col" data-testid="assign-customer-slideover">
        <div class="border-b border-default px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-lg font-semibold">Asignar cliente</p>
              <p class="text-sm text-muted">Seleccioná cliente y dirección de envío</p>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" @click="emit('update:open', false)" />
          </div>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div class="flex items-center justify-between gap-3">
            <UInput
              v-model="searchInput"
              data-testid="customer-search-input"
              icon="i-lucide-search"
              placeholder="Buscar por nombre, email o teléfono"
              class="w-full"
            />
            <UButton
              v-if="canCreateCustomer"
              data-testid="open-create-customer"
              color="neutral"
              variant="outline"
              label="+ Nuevo cliente"
              @click="isCreateCustomerOpen = true"
            />
          </div>

          <div v-if="customersQuery.isLoading.value" class="space-y-2">
            <USkeleton v-for="idx in 3" :key="idx" class="h-12 w-full" />
          </div>

          <div v-else-if="customersQuery.isError.value" class="rounded-md border border-error/50 p-4 text-sm text-error">
            No se pudieron cargar los clientes.
          </div>

          <div v-else-if="filteredCustomers.length === 0" class="rounded-md border border-dashed border-default p-6 text-center text-sm text-muted">
            Aún no hay clientes registrados
          </div>

          <div v-else class="space-y-2">
            <button
              v-for="customer in filteredCustomers"
              :key="customer.id"
              :data-testid="`customer-row-${customer.id}`"
              type="button"
              class="w-full rounded-md border border-default px-3 py-2 text-left"
              @click="handleSelectCustomer(customer)"
            >
              <p class="font-medium">{{ customer.fullName }}</p>
              <p class="text-xs text-muted">{{ customer.email ?? 'Sin email' }} · {{ customer.phone ?? 'Sin teléfono' }}</p>
            </button>
          </div>

          <div v-if="selectedCustomer" class="space-y-3 rounded-md border border-default p-3">
            <p class="text-sm font-semibold">Cliente seleccionado: {{ selectedCustomer.fullName }}</p>

            <div v-if="showAddressPicker" data-testid="shipping-address-picker" class="space-y-2">
              <p class="text-sm font-medium">Dirección de envío</p>
              <UButton label="Sin dirección" variant="soft" color="neutral" @click="handleAddressSelect(null)" />
              <button
                v-for="address in addresses"
                :key="address.id"
                type="button"
                class="block w-full rounded-md border border-default px-3 py-2 text-left text-sm"
                @click="handleAddressSelect(address.id)"
              >
                {{ formatAddress(address) }}
              </button>
            </div>

            <UButton
              data-testid="open-create-address"
              label="+ Nueva dirección"
              color="neutral"
              variant="outline"
              @click="isCreateAddressOpen = true"
            />
          </div>
        </div>
      </div>
    </template>
  </USlideover>

  <!-- Nested USlideover works correctly in Nuxt UI 4 (focus + stacking verified); no modal fallback needed. -->
  <CustomerUpsertSlideover
    v-model:open="isCreateCustomerOpen"
    mode="create"
    :loading="isCreatingCustomer"
    @create="handleCreateCustomer"
  />

  <AddressModal
    :open="isCreateAddressOpen"
    :loading="isCreatingAddress"
    @update:open="isCreateAddressOpen = $event"
    @close="isCreateAddressOpen = false"
    @save="handleCreateAddress"
  />
</template>
