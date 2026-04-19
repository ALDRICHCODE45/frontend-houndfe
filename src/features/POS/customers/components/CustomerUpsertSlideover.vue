<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import {
  customerToFormInput,
  toCreatePayload,
  toUpdatePayload,
  useCustomerForm,
  COUNTRY_CODE_OPTIONS,
  FISCAL_REGIMES,
  MEXICO_STATE_OPTIONS,
  type CustomerFormValues,
} from '../composables/useCustomerForm'
import type {
  CreateCustomerAddressPayload,
  CreateCustomerPayload,
  CustomerAddress,
  CustomerDetail,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'
import AddressModal from './AddressModal.vue'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    customer?: CustomerDetail | null
    globalPriceLists?: { id: string; name: string }[]
    errors?: Partial<Record<string, string>>
  }>(),
  {
    loading: false,
    customer: null,
    globalPriceLists: () => [],
    errors: () => ({}),
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateCustomerPayload]
  edit: [payload: UpdateCustomerPayload]
  close: []
}>()

const { schema, state, resetForm, setState } = useCustomerForm()

// ── Tabs ───────────────────────────────────────────────────
const activeTab = ref('basic')

const tabs = [
  { label: 'Datos Básicos', value: 'basic' },
  { label: 'Datos de Facturación', value: 'billing' },
]

// ── Address modal ──────────────────────────────────────────
const isAddressModalOpen = ref(false)
const editingAddress = ref<CustomerAddress | null>(null)
const editingAddressIndex = ref<number | null>(null)

// Pending addresses (create mode only)
const pendingAddresses = ref<CreateCustomerAddressPayload[]>([])

const formId = computed(() =>
  props.mode === 'create' ? 'create-customer-form' : 'edit-customer-form',
)

const title = computed(() => (props.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'))

const description = computed(() =>
  props.mode === 'create'
    ? 'Completá los datos del cliente.'
    : 'Actualizá los datos del cliente.',
)

const priceListItems = computed(() =>
  props.globalPriceLists.map((pl) => ({ label: pl.name, value: pl.id })),
)

watch(
  () => [props.mode, props.customer, open.value] as const,
  ([mode, customer, isOpen]) => {
    if (!isOpen) return

    activeTab.value = 'basic'
    pendingAddresses.value = []

    if (mode === 'edit' && customer) {
      setState(customerToFormInput(customer))
      return
    }

    resetForm()
  },
  { immediate: true },
)

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (wasOpen && !isOpen) {
      emit('close')
    }
  },
)

function openAddressModal() {
  editingAddress.value = null
  editingAddressIndex.value = null
  isAddressModalOpen.value = true
}

function handleAddressSave(payload: CreateCustomerAddressPayload) {
  if (props.mode === 'create') {
    if (editingAddressIndex.value !== null) {
      pendingAddresses.value[editingAddressIndex.value] = payload
    } else {
      pendingAddresses.value.push(payload)
    }
  }
  isAddressModalOpen.value = false
  editingAddress.value = null
  editingAddressIndex.value = null
}

function removePendingAddress(index: number) {
  pendingAddresses.value.splice(index, 1)
}

function formatAddress(addr: CreateCustomerAddressPayload | CustomerAddress): string {
  const parts = [
    addr.street,
    'exteriorNumber' in addr && addr.exteriorNumber ? `#${addr.exteriorNumber}` : null,
    addr.neighborhood ?? null,
    addr.city ?? null,
    addr.state ?? null,
  ].filter(Boolean)
  return parts.join(', ')
}

function onSubmit(event: FormSubmitEvent<CustomerFormValues>) {
  if (props.mode === 'create') {
    emit('create', toCreatePayload(event.data, pendingAddresses.value))
    return
  }

  emit('edit', toUpdatePayload(event.data))
}

function handleCancel() {
  resetForm()
  open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    :description="description"
    side="right"
    inset
    @after-leave="resetForm"
  >
    <template #body>
      <UTabs v-model="activeTab" :items="tabs" class="w-full">
        <template #content="{ item }">
          <!-- ── Tab: Datos Básicos ─────────────────────────── -->
          <div v-if="item.value === 'basic'" class="pt-4">
            <UForm
              :id="formId"
              :schema="schema"
              :state="state"
              class="flex flex-col gap-4"
              @submit="onSubmit"
            >
              <UFormField label="Nombre" name="firstName" :error="errors.firstName" required>
                <UInput
                  v-model="state.firstName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: Juan"
                />
              </UFormField>

              <UFormField label="Apellido" name="lastName" :error="errors.lastName">
                <UInput
                  v-model="state.lastName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: Pérez"
                />
              </UFormField>

              <!-- Teléfono: código de país + número -->
              <div>
                <label class="mb-1.5 block text-sm font-medium">Teléfono</label>
                <div class="flex gap-2">
                  <USelect
                    v-model="state.phoneCountryCode"
                    :items="COUNTRY_CODE_OPTIONS"
                    size="lg"
                    class="w-32 shrink-0"
                  />
                  <UFormField name="phone" :error="errors.phone" class="flex-1">
                    <UInput
                      v-model="state.phone"
                      class="w-full"
                      size="lg"
                      placeholder="55 1234 5678"
                      inputmode="tel"
                    />
                  </UFormField>
                </div>
              </div>

              <UFormField label="Email" name="email" :error="errors.email">
                <UInput
                  v-model="state.email"
                  class="w-full"
                  size="lg"
                  placeholder="juan@ejemplo.com"
                  type="email"
                />
              </UFormField>

              <!-- Sección Precios -->
              <div class="rounded-lg border border-default bg-elevated/30 p-4">
                <p class="mb-3 font-semibold">Precios</p>
                <UCheckbox v-model="state.assignPriceList" label="Asignar una lista de precios al cliente" />
                <div v-if="state.assignPriceList" class="mt-3">
                  <UFormField label="Lista de precios" name="globalPriceListId" :error="errors.globalPriceListId">
                    <USelect
                      v-model="state.globalPriceListId"
                      :items="priceListItems"
                      placeholder="Seleccionar lista de precios"
                      class="w-full"
                      size="lg"
                    />
                  </UFormField>
                </div>
              </div>

              <!-- Sección Dirección y Más -->
              <div class="rounded-lg border border-default bg-elevated/30 p-4">
                <div class="mb-3 flex items-center justify-between">
                  <p class="font-semibold">Dirección</p>
                  <UButton
                    label="+ Añadir Dirección"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    type="button"
                    @click="openAddressModal"
                  />
                </div>

                <!-- Pending addresses list (create mode) -->
                <div v-if="mode === 'create' && pendingAddresses.length > 0" class="mb-3 space-y-2">
                  <div
                    v-for="(addr, idx) in pendingAddresses"
                    :key="idx"
                    class="flex items-center justify-between rounded-md border border-default bg-background px-3 py-2"
                  >
                    <span class="truncate text-sm">{{ formatAddress(addr) }}</span>
                    <UButton
                      icon="i-lucide-trash-2"
                      size="xs"
                      color="error"
                      variant="ghost"
                      type="button"
                      @click="removePendingAddress(idx)"
                    />
                  </div>
                </div>

                <!-- Existing addresses list (edit mode) -->
                <div
                  v-if="mode === 'edit' && customer?.addresses && customer.addresses.length > 0"
                  class="mb-3 space-y-2"
                >
                  <div
                    v-for="addr in customer.addresses"
                    :key="addr.id"
                    class="flex items-center justify-between rounded-md border border-default bg-background px-3 py-2"
                  >
                    <span class="truncate text-sm">{{ formatAddress(addr) }}</span>
                  </div>
                </div>

                <p
                  v-if="
                    mode === 'create'
                      ? pendingAddresses.length === 0
                      : !customer?.addresses?.length
                  "
                  class="text-sm text-muted"
                >
                  Sin direcciones añadidas
                </p>
              </div>

              <UFormField label="Comentarios" name="comments" :error="errors.comments">
                <UTextarea
                  v-model="state.comments"
                  class="w-full"
                  :rows="3"
                  placeholder="Notas adicionales sobre el cliente"
                />
              </UFormField>
            </UForm>
          </div>

          <!-- ── Tab: Datos de Facturación ────────────────── -->
          <div v-else-if="item.value === 'billing'" class="pt-4">
            <div class="flex flex-col gap-4">
              <UFormField label="Razón Social" name="businessName" :error="errors.businessName">
                <UInput
                  v-model="state.businessName"
                  class="w-full"
                  size="lg"
                  placeholder="Ej: ACME S.A. de C.V."
                />
              </UFormField>

              <div class="grid grid-cols-2 gap-4">
                <UFormField label="Código Postal Fiscal" name="fiscalZipCode" :error="errors.fiscalZipCode">
                  <UInput
                    v-model="state.fiscalZipCode"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: 03100"
                  />
                </UFormField>

                <UFormField label="R.F.C." name="rfc" :error="errors.rfc">
                  <UInput
                    v-model="state.rfc"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: XAXX010101000"
                  />
                </UFormField>
              </div>

              <UFormField label="Régimen Fiscal" name="fiscalRegime" :error="errors.fiscalRegime">
                <USelect
                  v-model="state.fiscalRegime"
                  :items="FISCAL_REGIMES"
                  placeholder="Seleccionar régimen fiscal"
                  class="w-full"
                  size="lg"
                />
              </UFormField>

              <!-- Dirección de facturación (toggle) -->
              <div>
                <button
                  type="button"
                  class="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  @click="state.showBillingAddress = !state.showBillingAddress"
                >
                  <UIcon
                    :name="state.showBillingAddress ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="size-4"
                  />
                  {{
                    state.showBillingAddress
                      ? '- Ocultar dirección de facturación'
                      : '+ Mostrar dirección de facturación'
                  }}
                </button>
              </div>

              <div v-if="state.showBillingAddress" class="flex flex-col gap-4">
                <UFormField label="Calle" name="billingStreet" :error="errors.billingStreet">
                  <UInput
                    v-model="state.billingStreet"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: Av. Insurgentes Sur"
                  />
                </UFormField>

                <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Número Exterior" name="billingExteriorNumber" :error="errors.billingExteriorNumber">
                    <UInput
                      v-model="state.billingExteriorNumber"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 1234"
                    />
                  </UFormField>

                  <UFormField label="Número Interior" name="billingInteriorNumber" :error="errors.billingInteriorNumber">
                    <UInput
                      v-model="state.billingInteriorNumber"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 4B"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Código Postal" name="billingZipCode" :error="errors.billingZipCode">
                    <UInput
                      v-model="state.billingZipCode"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 03100"
                    />
                  </UFormField>

                  <UFormField label="Colonia" name="billingNeighborhood" :error="errors.billingNeighborhood">
                    <UInput
                      v-model="state.billingNeighborhood"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: Del Valle"
                    />
                  </UFormField>
                </div>

                <UFormField label="Municipio / Delegación" name="billingMunicipality" :error="errors.billingMunicipality">
                  <UInput
                    v-model="state.billingMunicipality"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: Benito Juárez"
                  />
                </UFormField>

                <div class="grid grid-cols-2 gap-4">
                  <UFormField label="Ciudad" name="billingCity" :error="errors.billingCity">
                    <UInput
                      v-model="state.billingCity"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: Ciudad de México"
                    />
                  </UFormField>

                  <UFormField label="Estado" name="billingState" :error="errors.billingState">
                    <USelect
                      v-model="state.billingState"
                      :items="MEXICO_STATE_OPTIONS"
                      placeholder="Seleccionar"
                      class="w-full"
                      size="lg"
                    />
                  </UFormField>
                </div>
              </div>
            </div>
          </div>
        </template>
      </UTabs>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleCancel" />
        <UButton
          :label="mode === 'create' ? 'Crear cliente' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>

  <!-- Address Modal -->
  <AddressModal
    :open="isAddressModalOpen"
    :address="editingAddress"
    :loading="loading"
    @update:open="isAddressModalOpen = $event"
    @save="handleAddressSave"
    @close="isAddressModalOpen = false"
  />
</template>
