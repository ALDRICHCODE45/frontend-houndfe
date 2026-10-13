<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import '../styles/sales-pos-customer.css'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import CustomerUpsertSlideover from '@/features/POS/customers/components/CustomerUpsertSlideover.vue'
import AddressModal from '@/features/POS/customers/components/AddressModal.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'
import { useDraftCustomerAssignment, DraftCustomerAssignmentError } from '../composables/useDraftCustomerAssignment'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import type {
  CreateCustomerAddressPayload,
  CreateCustomerPayload,
  Customer,
  CustomerDetail,
} from '@/features/POS/customers/interfaces/customer.types'

declare const useToast: () => {
  add: (options: { title: string, description?: string, color?: 'error' | 'success' | 'warning' | 'primary' | 'neutral' }) => void
}

const props = defineProps<{
  open: boolean
  /** Sale drafts use the built-in assignment/address flow. Other consumers can
   * omit this and handle `customer-selected` themselves. */
  saleId?: string
  /**
   * Optional teleport boundary marker forwarded to the installed slideover
   * content root. Absent by default, which preserves every existing consumer's
   * original presentation and behavior.
   */
  portalClass?: string
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  'customer-selected': [customerId: string]
}>()

const authStore = useAuthStore()
const tenantId = useSafeTenantId()
const queryClient = useQueryClient()
const toast = useToast()
const { assignCustomer, setShippingAddress } = useDraftCustomerAssignment(() => props.saleId ?? '')

const searchInput = ref('')
const debouncedSearch = ref('')
const selectedCustomer = ref<CustomerDetail | null>(null)
const isCreateCustomerOpen = ref(false)
const isCreateAddressOpen = ref(false)
const isCreatingCustomer = ref(false)
const isCreatingAddress = ref(false)

const canCreateCustomer = computed(() => authStore.userCan('create', 'Customer'))

/**
 * Venta opt-in gate (T7).
 *
 * The sheet is shared: quotations opt into their own portal token, and other
 * consumers pass nothing at all. Only the `sales-pos-customer` token selects
 * the venta presentation, so a truthy `portalClass` is deliberately NOT the
 * gate. Nested wrappers receive a single marker that they APPEND to their own
 * accepted default; when it is `undefined` their prior `ui` value survives
 * byte-for-byte.
 */
const SALE_PORTAL_TOKEN = 'sales-pos-customer'
const SALE_FORM_MARKER = 'sales-pos-customer-form'

const isSaleCustomerPortal = computed(
  () => props.portalClass?.split(/\s+/).includes(SALE_PORTAL_TOKEN) ?? false,
)
const nestedFormPortalClass = computed(() =>
  isSaleCustomerPortal.value ? SALE_FORM_MARKER : undefined,
)

/**
 * Address-step context. It is built only from the customer that is already
 * loaded; nothing is invented and no local selection draft is kept, because
 * the flow saves an address immediately.
 */
const selectedCustomerContact = computed(() => {
  const customer = selectedCustomer.value
  if (!customer) return ''
  const phone = customer.phone
    ? [customer.phoneCountryCode, customer.phone].filter(Boolean).join(' ')
    : ''
  return [customer.email ?? '', phone].filter(Boolean).join(' · ')
})

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
  queryKey: computed(() => customerQueryKeys.paginated(tenantId.value)),
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
      return 'No se encontró el cliente. Recarga la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOUND':
      return 'No se encontró la dirección. Recarga la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER':
      return 'Esa dirección no pertenece al cliente seleccionado.'
    case 'SHIPPING_ADDRESS_REQUIRES_CUSTOMER':
      return 'Asigna un cliente antes de elegir la dirección.'
    case 'SALE_NOT_DRAFT':
      return 'Esta venta ya no es un borrador. Recarga la página.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tienes permisos para modificar esta venta.'
    default:
      return 'No se pudo completar la operación'
  }
}

async function handleSelectCustomer(customer: Customer) {
  if (!props.saleId) {
    emit('customer-selected', customer.id)
    emit('update:open', false)
    return
  }

  try {
    await assignCustomer({ customerId: customer.id })
    selectedCustomer.value = await customerApi.getById(customer.id)
    // Do NOT close the slideover - let user pick address or skip
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  }
}

async function handleCreateCustomer(payload: CreateCustomerPayload) {
  isCreatingCustomer.value = true
  try {
    const createdCustomer = await customerApi.create(payload)
    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
    if (!props.saleId) {
      emit('customer-selected', createdCustomer.id)
      emit('update:open', false)
      isCreateCustomerOpen.value = false
      return
    }
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
    if (
      selectedCustomer.value
      && error instanceof DraftCustomerAssignmentError
      && error.code === 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER'
    ) {
      await queryClient.invalidateQueries({
        queryKey: customerQueryKeys.addresses(tenantId.value, selectedCustomer.value.id),
      })
    }

    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  }
}

async function handleCreateAddress(payload: CreateCustomerAddressPayload) {
  if (!selectedCustomer.value) return

  isCreatingAddress.value = true
  try {
    const createdAddress = await customerApi.createAddress(selectedCustomer.value.id, payload)
    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
    await handleAddressSelect(createdAddress.id)
    isCreateAddressOpen.value = false
    selectedCustomer.value = await customerApi.getById(selectedCustomer.value.id)
  } catch (error) {
    toast.add({ title: 'Error', description: resolveErrorMessage(error), color: 'error' })
  } finally {
    isCreatingAddress.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    side="right"
    inset
    :ui="portalClass ? { content: portalClass } : undefined"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="flex h-full flex-col" data-testid="assign-customer-slideover">
        <div class="sales-pos-customer-header border-b border-default px-5 py-4">
          <!-- Step 1: Customer Selection Header -->
          <div v-if="!selectedCustomer" class="flex items-center justify-between gap-3">
            <div>
              <p class="sales-pos-customer-title text-lg font-semibold">Asignar cliente</p>
              <p class="sales-pos-customer-subtitle text-sm text-muted">Selecciona un cliente</p>
            </div>
            <UButton
              class="sales-pos-customer-close"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="emit('update:open', false)"
            />
          </div>

          <!-- Step 2: Address Selection Header -->
          <div v-else class="sales-pos-customer-selected flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <UAvatar :alt="selectedCustomer.fullName" size="sm" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="sales-pos-customer-title text-lg font-semibold truncate">
                    {{ selectedCustomer.fullName }}
                  </p>
                  <UBadge
                    color="neutral"
                    class="sales-pos-customer-selected-badge text-coco-gold-800"
                    label="Seleccionado"
                    size="xs"
                  />
                </div>
                <p
                  v-if="isSaleCustomerPortal && selectedCustomerContact"
                  class="sales-pos-customer-contact text-xs text-muted truncate"
                >
                  {{ selectedCustomerContact }}
                </p>
                <button
                  type="button"
                  data-testid="change-customer-step"
                  class="sales-pos-customer-change text-xs hover:underline"
                  :class="isSaleCustomerPortal ? '' : 'text-coco-gold-800'"
                  @click="selectedCustomer = null"
                >
                  Cambiar cliente
                </button>
              </div>
            </div>
            <UButton
              class="sales-pos-customer-close"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              @click="emit('update:open', false)"
            />
          </div>
        </div>

        <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <!-- Step 1: Customer Selection -->
          <template v-if="!selectedCustomer">
            <div class="sales-pos-customer-search-row flex items-center justify-between gap-3">
              <div class="sales-pos-customer-search min-w-0 flex-1">
                <label
                  v-if="isSaleCustomerPortal"
                  class="sales-pos-customer-search-label block text-sm"
                  for="sales-pos-customer-search-input"
                >
                  Buscar cliente
                </label>
                <UInput
                  id="sales-pos-customer-search-input"
                  v-if="isSaleCustomerPortal"
                  v-model="searchInput"
                  data-testid="customer-search-input"
                  icon="i-lucide-search"
                  placeholder="Buscar por nombre, email o teléfono"
                  class="sales-pos-customer-search-field w-full"
                />
                <UInput
                  v-else
                  v-model="searchInput"
                  data-testid="customer-search-input"
                  icon="i-lucide-search"
                  placeholder="Buscar por nombre, email o teléfono"
                  class="w-full"
                />
              </div>
              <UButton
                v-if="canCreateCustomer"
                data-testid="open-create-customer"
                color="neutral"
                variant="outline"
                label="+ Nuevo cliente"
                class="sales-pos-customer-new-customer"
                @click="isCreateCustomerOpen = true"
              />
            </div>

            <div v-if="customersQuery.isLoading.value" class="space-y-2">
              <USkeleton v-for="idx in 3" :key="idx" class="h-16 w-full" />
            </div>

            <div v-else-if="customersQuery.isError.value" class="rounded-md border border-error/50 p-4 text-sm text-error">
              No se pudieron cargar los clientes.
            </div>

            <div v-else-if="filteredCustomers.length === 0" class="space-y-4">
              <div class="rounded-md border border-dashed border-default p-6 text-center">
                <UIcon name="i-lucide-user-search" class="mx-auto size-8 text-muted mb-2" />
                <p class="text-sm text-muted">
                  {{ debouncedSearch ? 'No se encontraron clientes' : 'Aún no hay clientes registrados' }}
                </p>
                <UButton
                  v-if="canCreateCustomer && !debouncedSearch"
                  data-testid="open-create-customer"
                  color="primary"
                  variant="soft"
                  label="+ Nuevo cliente"
                  class="mt-3 rounded-xl font-semibold shadow-sm"
                  :class="portalClass ? 'hf-primary-control' : '!bg-(--brand-action) !text-black hover:!brightness-110'"
                  @click="isCreateCustomerOpen = true"
                />
              </div>
            </div>

            <div v-else class="space-y-3">
              <UCard
                v-for="customer in filteredCustomers"
                :key="customer.id"
                :data-testid="`customer-row-${customer.id}`"
                class="sales-pos-customer-card cursor-pointer transition-colors hover:bg-elevated/70"
                :role="isSaleCustomerPortal ? 'button' : undefined"
                :tabindex="isSaleCustomerPortal ? 0 : undefined"
                @click="handleSelectCustomer(customer)"
                @keydown.enter.prevent="handleSelectCustomer(customer)"
                @keydown.space.prevent="handleSelectCustomer(customer)"
              >
                <div class="flex items-center gap-3">
                  <UAvatar :alt="customer.fullName" size="sm" />
                  <div class="min-w-0 flex-1">
                    <p class="sales-pos-customer-card-name font-medium truncate">
                      {{ customer.fullName }}
                    </p>
                    <p class="sales-pos-customer-card-meta text-xs text-muted truncate">
                      {{ customer.email ?? 'Sin email' }} · {{ customer.phone ?? 'Sin teléfono' }}
                    </p>
                  </div>
                  <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
                </div>
              </UCard>
            </div>
          </template>

          <!-- Step 2: Address Selection -->
          <template v-if="selectedCustomer">
            <div class="space-y-4">
              <div>
                <h3 class="sales-pos-customer-section-title text-sm font-medium text-highlighted mb-3">
                  Dirección de envío
                </h3>

                <div class="space-y-2">
                  <!-- No shipping address option -->
                  <UCard
                    data-testid="skip-shipping-address"
                    class="sales-pos-customer-card sales-pos-customer-card-skip cursor-pointer transition-colors hover:bg-elevated/70"
                    :role="isSaleCustomerPortal ? 'button' : undefined"
                    :tabindex="isSaleCustomerPortal ? 0 : undefined"
                    @click="handleAddressSelect(null)"
                    @keydown.enter.prevent="handleAddressSelect(null)"
                    @keydown.space.prevent="handleAddressSelect(null)"
                  >
                    <div class="flex items-center gap-3">
                      <UIcon name="i-lucide-circle-slash" class="sales-pos-customer-card-icon size-5 text-muted" />
                      <div class="min-w-0 flex-1">
                        <p class="sales-pos-customer-card-name font-medium">Sin dirección de envío</p>
                        <p class="sales-pos-customer-card-meta text-xs text-muted">El cliente recogerá en persona</p>
                      </div>
                    </div>
                  </UCard>

                  <!-- Existing addresses -->
                  <div v-if="showAddressPicker" data-testid="shipping-address-picker" class="space-y-2">
                    <UCard
                      v-for="address in addresses"
                      :key="address.id"
                      :data-testid="`shipping-address-option-${address.id}`"
                      class="sales-pos-customer-card cursor-pointer transition-colors hover:bg-elevated/70"
                      :role="isSaleCustomerPortal ? 'button' : undefined"
                      :tabindex="isSaleCustomerPortal ? 0 : undefined"
                      @click="handleAddressSelect(address.id)"
                      @keydown.enter.prevent="handleAddressSelect(address.id)"
                      @keydown.space.prevent="handleAddressSelect(address.id)"
                    >
                      <div class="flex items-center gap-3">
                        <UIcon name="i-lucide-map-pin" class="sales-pos-customer-card-icon size-5 text-muted" />
                        <div class="min-w-0 flex-1">
                          <p class="sales-pos-customer-card-name font-medium truncate">
                            {{ formatAddress(address) }}
                          </p>
                          <p class="sales-pos-customer-card-meta text-xs text-muted">
                            {{ address.neighborhood ?? 'Sin colonia' }}
                          </p>
                        </div>
                      </div>
                    </UCard>
                  </div>
                </div>
              </div>

              <!-- Footer with actions -->
              <div class="sales-pos-customer-footer flex items-center justify-between pt-3 border-t border-default">
                <UButton
                  v-if="canCreateCustomer"
                  data-testid="open-create-address"
                  class="sales-pos-customer-action"
                  label="+ Nueva dirección"
                  color="neutral"
                  :variant="isSaleCustomerPortal ? 'outline' : 'ghost'"
                  @click="isCreateAddressOpen = true"
                />
                <div class="flex gap-2">
                  <UButton
                    class="sales-pos-customer-action"
                    label="Cancelar"
                    color="neutral"
                    variant="outline"
                    @click="emit('update:open', false)"
                  />
                </div>
              </div>
            </div>

            <!-- Legacy sticky new-client footer. It is a duplicate of the
                 search-step action, so only the venta sheet drops it; every
                 other consumer keeps exactly what it had. -->
            <div v-if="!isSaleCustomerPortal" class="border-t border-default p-4">
              <UButton
                v-if="canCreateCustomer"
                data-testid="open-create-customer"
                label="+ Nuevo cliente"
                color="primary"
                class="w-full !bg-(--brand-action) !text-black hover:!brightness-110 rounded-xl font-semibold shadow-sm"
                @click="isCreateCustomerOpen = true"
              />
            </div>
          </template>
        </div>
      </div>
    </template>
  </USlideover>

  <!-- Nested USlideover works correctly in Nuxt UI 4 (focus + stacking verified); no modal fallback needed. -->
  <CustomerUpsertSlideover
    v-model:open="isCreateCustomerOpen"
    mode="create"
    :loading="isCreatingCustomer"
    :portal-class="nestedFormPortalClass"
    @create="handleCreateCustomer"
  />

  <AddressModal
    v-if="isCreateAddressOpen"
    :open="isCreateAddressOpen"
    :loading="isCreatingAddress"
    :portal-class="nestedFormPortalClass"
    @update:open="isCreateAddressOpen = $event"
    @close="isCreateAddressOpen = false"
    @save="handleCreateAddress"
  />
</template>
