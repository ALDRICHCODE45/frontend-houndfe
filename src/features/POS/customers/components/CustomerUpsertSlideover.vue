<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import {
  customerFormSnapshot,
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
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { HfSwitchRow } from '@/core/shared/components/selection'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import AddressModal from './AddressModal.vue'
import AddressLocationStatus from '@/core/shared/components/AddressLocationStatus.vue'
import { formatAddress } from '@/core/shared/utils/formatAddress'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    customer?: CustomerDetail | null
    globalPriceLists?: { id: string; name: string }[]
    errors?: Partial<Record<string, string>>
    /**
     * Narrow sale-path opt-in (T7). Consumers that do not pass it keep the
     * accepted Clients presentation byte-for-byte; when present the marker is
     * APPENDED to this wrapper's own portal class, never swapped for it.
     */
    portalClass?: string
  }>(),
  {
    loading: false,
    customer: null,
    globalPriceLists: () => [],
    errors: () => ({}),
    portalClass: undefined,
  },
)

/**
 * The shared Clients defaults are rebuilt here so the opt-in can only append.
 * `clients-form-portal` stays the owner of the Clients theme; the venta sheet
 * forwards one extra marker and this file adds nothing else.
 */
const FORM_PORTAL_BASE = 'hf-theme hf-ui hf-form-overlay clients-form-portal'
const SELECT_PORTAL_BASE = 'hf-theme hf-ui clients-form-portal'

const contentClass = computed(() =>
  props.portalClass ? `${FORM_PORTAL_BASE} ${props.portalClass}` : FORM_PORTAL_BASE,
)

const selectContentClass = computed(() =>
  props.portalClass ? `${SELECT_PORTAL_BASE} ${props.portalClass}` : SELECT_PORTAL_BASE,
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateCustomerPayload]
  edit: [payload: UpdateCustomerPayload]
  close: []
  'create-address': [
    customerId: string,
    payload: CreateCustomerAddressPayload,
    acknowledge?: (saved: boolean) => void,
  ]
  'update-address': [
    customerId: string,
    addressId: string,
    payload: CreateCustomerAddressPayload,
    acknowledge?: (saved: boolean) => void,
  ]
  'remove-address': [customerId: string, addressId: string]
}>()

const { schema, state, resetForm, setState } = useCustomerForm()

// ── Tabs ───────────────────────────────────────────────────
const activeTab = ref('basic')

const tabs = [
  { label: 'Datos básicos', value: 'basic' },
  { label: 'Datos de facturación', value: 'billing' },
]

// ── Address modal ──────────────────────────────────────────
const isAddressModalOpen = ref(false)
const editingAddress = ref<CustomerAddress | null>(null)
const editingAddressIndex = ref<number | null>(null)
const addressOwnerId = ref<string | null>(null)
const addressSaving = ref(false)
const addressError = ref('')
let editorSession = 0

function closeAddressEditor() {
  editorSession++
  isAddressModalOpen.value = false
  editingAddress.value = null
  editingAddressIndex.value = null
  addressOwnerId.value = null
  addressSaving.value = false
  addressError.value = ''
}

// Pending addresses (create mode only)
const pendingAddresses = ref<CreateCustomerAddressPayload[]>([])

const formId = computed(() =>
  props.mode === 'create' ? 'create-customer-form' : 'edit-customer-form',
)

const title = computed(() => (props.mode === 'create' ? 'Nuevo cliente' : 'Editar cliente'))

const description = computed(() =>
  props.mode === 'create' ? 'Completa los datos del cliente.' : 'Actualiza los datos del cliente.',
)

// Edit saves only enable once the form differs from the loaded customer. The
// baseline follows the latest customer prop, so a same-customer refresh keeps
// the draft dirty against the refreshed values.
const isDirty = computed(
  () =>
    !!props.customer &&
    customerFormSnapshot(state) !== customerFormSnapshot(customerToFormInput(props.customer)),
)

const submitDisabled = computed(() => props.mode === 'edit' && !isDirty.value)

const priceListItems = computed(() =>
  props.globalPriceLists.map((pl) => ({ label: pl.name, value: pl.id })),
)

watch(
  [() => props.mode, () => props.customer?.id, open],
  ([mode, customerId, isOpen]) => {
    closeAddressEditor()
    if (!isOpen) return

    activeTab.value = 'basic'
    pendingAddresses.value = []

    if (mode === 'edit' && props.customer && customerId) {
      setState(customerToFormInput(props.customer))
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
  closeAddressEditor()
  addressOwnerId.value = props.mode === 'edit' ? (props.customer?.id ?? null) : null
  isAddressModalOpen.value = true
}

function handleAddressSave(payload: CreateCustomerAddressPayload) {
  if (!isAddressModalOpen.value || addressSaving.value) return
  const ownerId = addressOwnerId.value
  if (props.mode === 'edit' && (!ownerId || ownerId !== props.customer?.id || !open.value)) return
  if (props.mode === 'create') {
    if (editingAddressIndex.value !== null) {
      pendingAddresses.value[editingAddressIndex.value] = payload
    } else {
      pendingAddresses.value.push(payload)
    }
    closeAddressEditor()
  } else if (props.mode === 'edit' && ownerId) {
    addressSaving.value = true
    addressError.value = ''
    const session = editorSession
    const acknowledge = (saved: boolean) => {
      if (
        session !== editorSession ||
        !isAddressModalOpen.value ||
        ownerId !== props.customer?.id ||
        !open.value
      )
        return
      addressSaving.value = false
      if (saved) closeAddressEditor()
      else
        addressError.value = 'No se pudo guardar la dirección. Revisa los datos e intenta de nuevo.'
    }
    if (editingAddress.value?.id) {
      emit('update-address', ownerId, editingAddress.value.id, payload, acknowledge)
    } else {
      emit('create-address', ownerId, payload, acknowledge)
    }
  }
}

function removePendingAddress(index: number) {
  pendingAddresses.value.splice(index, 1)
}

function editExistingAddress(address: CustomerAddress) {
  closeAddressEditor()
  if (!open.value || props.mode !== 'edit' || props.customer?.id !== address.customerId) return
  addressOwnerId.value = address.customerId
  editingAddress.value = address
  editingAddressIndex.value = null
  isAddressModalOpen.value = true
}

const ADDRESS_ACTIONS: RowAction[] = [
  { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' },
  { key: 'remove', label: 'Quitar dirección', icon: 'i-lucide-trash-2', destructive: true },
]

function handleAddressAction(key: string, address: CustomerAddress) {
  if (key === 'edit') editExistingAddress(address)
  else if (key === 'remove') removeExistingAddress(address)
}

function removeExistingAddress(address: CustomerAddress) {
  if (props.customer) {
    emit('remove-address', props.customer.id, address.id)
  }
}

function onSubmit(event: FormSubmitEvent<CustomerFormValues>) {
  if (props.mode === 'create') {
    emit('create', toCreatePayload(event.data, pendingAddresses.value))
    return
  }

  if (submitDisabled.value) return
  emit('edit', toUpdatePayload(event.data))
}

function handleAddressOpenChange(value: boolean) {
  if (!value) closeAddressEditor()
}

function handleCancel() {
  closeAddressEditor()
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
    :ui="{ content: contentClass }"
    @after-leave="resetForm"
  >
    <template #body>
      <UTabs v-model="activeTab" :items="tabs" class="customer-tabs w-full" variant="link">
        <template #content="{ item }">
          <!-- ── Tab: Datos básicos ─────────────────────────── -->
          <div v-if="item.value === 'basic'" class="pt-4">
            <UForm
              :id="formId"
              :schema="schema"
              :state="state"
              class="flex flex-col gap-4"
              @submit="onSubmit"
            >
              <!-- T6c: every field lives in a shared section card (one surface
                   per group, 16px/600 heading); no loose fields beside tinted boxes. -->
              <HfSectionCard title="Contacto" class="sales-pos-customer-form-section">
                <div class="flex flex-col gap-4">
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <UFormField label="Nombre" name="firstName" :error="errors.firstName" required>
                      <UInput v-model="state.firstName" class="w-full" size="lg" placeholder="Ej: Juan" />
                    </UFormField>

                    <UFormField label="Apellido" name="lastName" :error="errors.lastName">
                      <UInput v-model="state.lastName" class="w-full" size="lg" placeholder="Ej: Pérez" />
                    </UFormField>
                  </div>

                  <!-- Teléfono: código de país + número -->
                  <div>
                    <label class="sales-pos-customer-form-label mb-1.5 block text-sm font-medium text-(--hf-ink)">Teléfono</label>
                    <div class="sales-pos-customer-form-phone flex gap-2">
                      <USelect
                        v-model="state.phoneCountryCode"
                        :items="COUNTRY_CODE_OPTIONS"
                        size="lg"
                        aria-label="Código de país"
                        class="sales-pos-customer-form-country w-32 shrink-0"
                        :ui="{ content: selectContentClass }"
                      />
                      <UFormField name="phone" :error="errors.phone" class="sales-pos-customer-form-phone-number flex-1">
                        <UInput
                          v-model="state.phone"
                          class="w-full"
                          size="lg"
                          placeholder="55 1234 5678"
                          inputmode="tel"
                          aria-label="Teléfono"
                        />
                      </UFormField>
                    </div>
                  </div>

                  <UFormField label="Correo electrónico" name="email" :error="errors.email">
                    <UInput
                      v-model="state.email"
                      class="w-full"
                      size="lg"
                      placeholder="juan@ejemplo.com"
                      type="email"
                    />
                  </UFormField>
                </div>
              </HfSectionCard>

              <!-- The switch row and the field it reveals share one bordered group
                   (the promotions «monto mínimo» pattern), never flush on the card edge. -->
              <HfSectionCard title="Precios" class="sales-pos-customer-form-section">
                <div
                  class="clients-form-switch-group overflow-hidden rounded-(--hf-radius-card) border border-(--hf-border)"
                >
                  <HfSwitchRow
                    v-model="state.assignPriceList"
                    label="Asignar una lista de precios al cliente"
                    test-id="customer-assign-price-list"
                  />
                  <div v-if="state.assignPriceList" class="clients-form-switch-group__body px-4 pb-4 pt-1">
                    <UFormField
                      label="Lista de precios"
                      name="globalPriceListId"
                      :error="errors.globalPriceListId"
                    >
                      <USelect
                        v-model="state.globalPriceListId"
                        :items="priceListItems"
                        placeholder="Seleccionar lista de precios"
                        class="w-full"
                        size="lg"
                        :ui="{ content: selectContentClass }"
                      />
                    </UFormField>
                  </div>
                </div>
              </HfSectionCard>

              <HfSectionCard title="Direcciones" class="sales-pos-customer-form-section">
                <!-- Pending addresses list (create mode): one bordered list, a row each -->
                <div
                  v-if="mode === 'create' && pendingAddresses.length > 0"
                  class="clients-form-address-list mb-3 overflow-hidden rounded-(--hf-radius-card) border border-(--hf-border) divide-y divide-(--hf-border)"
                >
                  <div
                    v-for="(addr, idx) in pendingAddresses"
                    :key="idx"
                    class="sales-pos-customer-form-address-row flex min-h-14 items-center justify-between gap-3 py-2 pl-4 pr-1"
                  >
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <span class="sales-pos-customer-form-address-text truncate text-sm text-(--hf-ink)">{{ formatAddress(addr) }}</span>
                      <AddressLocationStatus :address="addr" />
                    </div>
                    <UButton
                      icon="i-lucide-trash-2"
                      class="sales-pos-customer-form-icon-action min-h-(--hf-control-height) min-w-(--hf-control-height) justify-center"
                      color="error"
                      variant="ghost"
                      type="button"
                      :aria-label="`Quitar dirección: ${formatAddress(addr)}`"
                      @click="removePendingAddress(idx)"
                    />
                  </div>
                </div>

                <!-- Existing addresses list (edit mode) -->
                <div
                  v-if="mode === 'edit' && customer?.addresses && customer.addresses.length > 0"
                  class="clients-form-address-list mb-3 overflow-hidden rounded-(--hf-radius-card) border border-(--hf-border) divide-y divide-(--hf-border)"
                >
                  <div
                    v-for="addr in customer.addresses"
                    :key="addr.id"
                    :data-testid="`address-row-${addr.id}`"
                    class="sales-pos-customer-form-address-row flex min-h-14 items-center justify-between gap-3 py-2 pl-4 pr-1"
                  >
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <span class="sales-pos-customer-form-address-text truncate text-sm text-(--hf-ink)">{{ formatAddress(addr) }}</span>
                      <AddressLocationStatus :address="addr" />
                    </div>
                    <RowActionsMenu
                      :actions="ADDRESS_ACTIONS"
                      :row-label="formatAddress(addr)"
                      portal-class="clients-form-portal"
                      @select="handleAddressAction($event, addr)"
                    />
                  </div>
                </div>

                <p
                  v-if="
                    mode === 'create' ? pendingAddresses.length === 0 : !customer?.addresses?.length
                  "
                  class="sales-pos-customer-form-empty mb-3 text-sm text-(--hf-muted)"
                >
                  Sin direcciones añadidas
                </p>

                <UButton
                  label="Añadir dirección"
                  icon="i-lucide-plus"
                  class="sales-pos-customer-form-action sales-pos-customer-form-add-address min-h-(--hf-control-height)"
                  color="neutral"
                  variant="outline"
                  type="button"
                  @click="openAddressModal"
                />
              </HfSectionCard>

              <HfSectionCard title="Notas" class="sales-pos-customer-form-section">
                <UFormField label="Comentarios" name="comments" :error="errors.comments">
                  <UTextarea
                    v-model="state.comments"
                    class="w-full"
                    :rows="3"
                    placeholder="Notas adicionales sobre el cliente"
                  />
                </UFormField>
              </HfSectionCard>
            </UForm>
          </div>

          <!-- ── Tab: Datos de facturación ────────────────── -->
          <div v-else-if="item.value === 'billing'" class="flex flex-col gap-4 pt-4">
            <HfSectionCard title="Datos fiscales" class="sales-pos-customer-form-section">
              <div class="flex flex-col gap-4">
                <UFormField label="Razón social" name="businessName" :error="errors.businessName">
                  <UInput
                    v-model="state.businessName"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: ACME S.A. de C.V."
                  />
                </UFormField>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <UFormField
                    label="Código postal fiscal"
                    name="fiscalZipCode"
                    :error="errors.fiscalZipCode"
                  >
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

                <UFormField label="Régimen fiscal" name="fiscalRegime" :error="errors.fiscalRegime">
                  <USelect
                    v-model="state.fiscalRegime"
                    :items="FISCAL_REGIMES"
                    placeholder="Seleccionar régimen fiscal"
                    class="w-full"
                    size="lg"
                    :ui="{ content: selectContentClass }"
                  />
                </UFormField>
              </div>
            </HfSectionCard>

            <HfSectionCard title="Dirección de facturación" class="sales-pos-customer-form-section">
              <!-- Dirección de facturación (toggle) -->
              <button
                type="button"
                class="clients-form-link sales-pos-customer-form-link flex min-h-(--hf-control-height) items-center gap-1 rounded-(--hf-radius-control) text-sm font-medium text-(--hf-action) hover:underline"
                :aria-expanded="state.showBillingAddress"
                @click="state.showBillingAddress = !state.showBillingAddress"
              >
                <UIcon
                  :name="
                    state.showBillingAddress ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
                  "
                  class="size-4"
                  aria-hidden="true"
                />
                {{
                  state.showBillingAddress
                    ? '- Ocultar dirección de facturación'
                    : '+ Mostrar dirección de facturación'
                }}
              </button>

              <div v-if="state.showBillingAddress" class="mt-4 flex flex-col gap-4">
                <UFormField label="Calle" name="billingStreet" :error="errors.billingStreet">
                  <UInput
                    v-model="state.billingStreet"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: Av. Insurgentes Sur"
                  />
                </UFormField>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <UFormField
                    label="Número exterior"
                    name="billingExteriorNumber"
                    :error="errors.billingExteriorNumber"
                  >
                    <UInput
                      v-model="state.billingExteriorNumber"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 1234"
                    />
                  </UFormField>

                  <UFormField
                    label="Número interior"
                    name="billingInteriorNumber"
                    :error="errors.billingInteriorNumber"
                  >
                    <UInput
                      v-model="state.billingInteriorNumber"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 4B"
                    />
                  </UFormField>
                </div>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <UFormField
                    label="Código postal"
                    name="billingZipCode"
                    :error="errors.billingZipCode"
                  >
                    <UInput
                      v-model="state.billingZipCode"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: 03100"
                    />
                  </UFormField>

                  <UFormField
                    label="Colonia"
                    name="billingNeighborhood"
                    :error="errors.billingNeighborhood"
                  >
                    <UInput
                      v-model="state.billingNeighborhood"
                      class="w-full"
                      size="lg"
                      placeholder="Ej: Del Valle"
                    />
                  </UFormField>
                </div>

                <UFormField
                  label="Municipio / Delegación"
                  name="billingMunicipality"
                  :error="errors.billingMunicipality"
                >
                  <UInput
                    v-model="state.billingMunicipality"
                    class="w-full"
                    size="lg"
                    placeholder="Ej: Benito Juárez"
                  />
                </UFormField>

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                      :ui="{ content: selectContentClass }"
                    />
                  </UFormField>
                </div>
              </div>
            </HfSectionCard>
          </div>
        </template>
      </UTabs>
    </template>

    <template #footer>
      <div class="sales-pos-customer-form-footer flex justify-end gap-3">
        <UButton
          label="Cancelar"
          class="sales-pos-customer-form-action"
          color="neutral"
          variant="outline"
          @click="handleCancel"
        />
        <UButton
          :label="mode === 'create' ? 'Crear cliente' : 'Guardar cambios'"
          :loading="loading"
          :disabled="submitDisabled"
          type="submit"
          :form="formId"
          color="primary"
          class="hf-primary-control sales-pos-customer-form-action sales-pos-customer-form-submit"
        />
      </div>
    </template>
  </USlideover>

  <!-- Address Modal -->
  <AddressModal
    :open="isAddressModalOpen"
    :address="editingAddress"
    :loading="loading || addressSaving"
    :error="addressError"
    :portal-class="portalClass"
    allow-busy-cancellation
    @update:open="handleAddressOpenChange"
    @save="handleAddressSave"
    @close="closeAddressEditor"
  />
</template>

<style scoped>
.customer-tabs :deep([role='tablist']) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.customer-tabs :deep([role='tab']) {
  width: 100%;
  justify-content: center;
}
</style>
