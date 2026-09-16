<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, reactive, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { productApi, fromVariantRawCatalog, toVariantPatchCatalogPayload } from '../api/product.api'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { centsToDecimalInput, decimalInputToCents } from '../composables/useProductForm'
import VariantPricingTable from './VariantPricingTable.vue'
import type { ProductType, ProductVariant, UpdateVariantPayload, VariantCatalogForm, VariantPatchCatalogPayload } from '../interfaces/product.types'
import OnlineStockOverrideFields from './OnlineStockOverrideFields.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const props = defineProps<{
  open: boolean
  productId: string
  productName: string
  productPurchaseNetCostCents: number
  variant: ProductVariant | null
  useStock: boolean
  canUpdate: boolean
  productType?: ProductType
}>()

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
}>()

const toast = useToast()
const queryClient = useQueryClient()
const tenantId = useSafeTenantId()

const formState = reactive({
  sku: '',
  barcode: '',
  quantity: 0,
  minQuantity: 0,
  purchaseCost: '',
})

const initialState = reactive({
  sku: '',
  barcode: '',
  quantity: 0,
  minQuantity: 0,
  purchaseCost: '',
})

const modalOpen = computed({
  get: () => props.open,
  set: (value: boolean) => {
    emit('update:open', value)
  },
})

const modalTitle = computed(() => {
  if (!props.variant) return 'Editar variante'
  return `Editar ${props.productName} ${props.variant.name}`
})

const hasOwnCost = computed(() => props.variant?.purchaseNetCostCents != null)

const isServiceProduct = computed(() => props.productType === 'SERVICE')

// WU6 (REQ-16): catalog controls exist only for persisted variants. A variant
// mapped by fromVariantRawCatalog always carries catalogPublishMode; inline /
// new-variant objects do not, so the section stays absent for them.
const persistedCatalog = computed<VariantCatalogForm | null>(() =>
  props.variant?.catalogPublishMode != null ? fromVariantRawCatalog(props.variant) : null,
)

const catalogForm = reactive<VariantCatalogForm>({
  catalogPublishMode: 'INHERIT',
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
})

const catalogPristine = reactive<VariantCatalogForm>({
  catalogPublishMode: 'INHERIT',
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
})

function onCatalogStockChange(value: { mode: VariantCatalogForm['onlineStockPresentation']; customQuantity: number | null }) {
  catalogForm.onlineStockPresentation = value.mode
  catalogForm.onlineStockPresentationCustomQty = value.customQuantity
}

const showInventoryCard = computed(() => props.useStock && !isServiceProduct.value)
const showGeneralSkuBarcode = computed(() => !isServiceProduct.value)
const saveChangeableKeys = computed<ChangeableField[]>(() =>
  // SERVICE: backend rejects inventory keys; persist only cost.
  isServiceProduct.value
    ? ['purchaseCost']
    : props.useStock
      ? ['sku', 'barcode', 'quantity', 'minQuantity', 'purchaseCost']
      : ['sku', 'barcode', 'purchaseCost'],
)

const costLabel = computed(() => {
  if (!props.variant) return 'Costo'
  return hasOwnCost.value ? 'Costo (variante)' : 'Costo (del producto)'
})

const productCostHint = computed(() => {
  if (hasOwnCost.value) {
    return `Costo del producto: $ ${centsToDecimalInput(props.productPurchaseNetCostCents)}`
  }
  return 'Ingresa un valor para definir costo propio de esta variante'
})

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function normalizeQuantity(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function syncFormFromVariant(variant: ProductVariant | null) {
  initialState.sku = normalizeText(variant?.sku)
  initialState.barcode = normalizeText(variant?.barcode)
  initialState.quantity = normalizeQuantity(variant?.quantity)
  initialState.minQuantity = normalizeQuantity(variant?.minQuantity)
  initialState.purchaseCost =
    variant?.purchaseNetCostCents != null
      ? centsToDecimalInput(variant.purchaseNetCostCents)
      : centsToDecimalInput(props.productPurchaseNetCostCents)

  formState.sku = initialState.sku
  formState.barcode = initialState.barcode
  formState.quantity = initialState.quantity
  formState.minQuantity = initialState.minQuantity
  formState.purchaseCost = initialState.purchaseCost

  const persisted = persistedCatalog.value
    const nextCatalog = persisted ?? {
      catalogPublishMode: 'INHERIT' as const,
      onlineStockPresentation: null,
      onlineStockPresentationCustomQty: null,
    }
  Object.assign(catalogForm, nextCatalog)
  Object.assign(catalogPristine, nextCatalog)
}

watch(
  () => [props.variant?.id, props.open],
  () => {
    if (!props.open) return
    syncFormFromVariant(props.variant)
  },
  { immediate: true },
)

const updateVariantMutation = useMutation({
  mutationFn: (params: { variantId: string; values: UpdateVariantPayload & VariantPatchCatalogPayload }) =>
    productApi.updateVariant(props.productId, params.variantId, params.values),
})

type ChangeableField = 'sku' | 'barcode' | 'quantity' | 'minQuantity' | 'purchaseCost'

function getChanges(keys: ChangeableField[]): UpdateVariantPayload {
  const changes: UpdateVariantPayload = {}

  if (keys.includes('sku')) {
    const nextSku = normalizeText(formState.sku)
    if (nextSku !== initialState.sku) {
      changes.sku = nextSku
    }
  }

  if (keys.includes('barcode')) {
    const nextBarcode = normalizeText(formState.barcode)
    if (nextBarcode !== initialState.barcode) {
      changes.barcode = nextBarcode
    }
  }

  if (keys.includes('quantity')) {
    const nextQuantity = normalizeQuantity(formState.quantity)
    formState.quantity = nextQuantity
    if (nextQuantity !== initialState.quantity) {
      changes.quantity = nextQuantity
    }
  }

  if (keys.includes('minQuantity')) {
    const nextMinQty = normalizeQuantity(formState.minQuantity)
    formState.minQuantity = nextMinQty
    if (nextMinQty !== initialState.minQuantity) {
      changes.minQuantity = nextMinQty
    }
  }

  if (keys.includes('purchaseCost')) {
    const nextCostCents = decimalInputToCents(formState.purchaseCost)
    const currentCostCents = decimalInputToCents(initialState.purchaseCost)
    if (nextCostCents !== currentCostCents) {
      changes.purchaseNetCostCents = nextCostCents
    }
  }

  return changes
}

async function persistChanges(
  keys: ChangeableField[],
  successMessage: string,
  closeAfterSave = false,
  // WU6: catalog flat keys ride only on the explicit Save (Guardar) flow.
  includeCatalog = false,
) {
  if (!props.canUpdate || !props.variant) {
    if (closeAfterSave) modalOpen.value = false
    return
  }

    const changes: UpdateVariantPayload & VariantPatchCatalogPayload = getChanges(keys)
    // Only an explicit-Save PATCH on a persisted variant carries catalog keys;
    // blur autosaves must not swallow an unsent catalog draft.
    const includeCatalogKeys = includeCatalog && persistedCatalog.value != null
    if (includeCatalogKeys) {
      Object.assign(changes, toVariantPatchCatalogPayload({ ...catalogForm }, { ...catalogPristine }))
    }
    if (Object.keys(changes).length === 0) {
      if (closeAfterSave) modalOpen.value = false
      return
    }

  try {
    await updateVariantMutation.mutateAsync({
      variantId: props.variant.id,
      values: changes,
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(tenantId.value, props.productId) })

    initialState.sku = normalizeText(changes.sku ?? initialState.sku)
    initialState.barcode = normalizeText(changes.barcode ?? initialState.barcode)
    initialState.quantity = normalizeQuantity(changes.quantity ?? initialState.quantity)
    initialState.minQuantity = normalizeQuantity(changes.minQuantity ?? initialState.minQuantity)
    if (changes.purchaseNetCostCents != null) {
      initialState.purchaseCost = centsToDecimalInput(changes.purchaseNetCostCents)
    }
    // Only a PATCH that actually carried catalog keys may re-pristine the
    // draft; autosaves keep pending unsent catalog edits intact.
    if (includeCatalogKeys) {
      Object.assign(catalogPristine, { ...catalogForm })
    }

    toast.add({
      title: successMessage,
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    if (closeAfterSave) {
      modalOpen.value = false
    }
  } catch (error) {
    toast.add({
      title: 'Error al actualizar variante',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  }
}

function handleCancel() {
  modalOpen.value = false
}
</script>

<template>
  <UModal v-model:open="modalOpen" :title="modalTitle" :content="{ class: 'sm:max-w-3xl' }">
    <template #body>
      <div v-if="variant" class="space-y-4">
        <UCard>
          <template #header>
            <h3 class="font-semibold">General</h3>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField v-if="showGeneralSkuBarcode" label="SKU">
              <UInput
                v-model="formState.sku"
                placeholder="SKU"
                :disabled="!canUpdate"
                @blur="persistChanges(['sku'], 'SKU actualizado')"
                @keyup.enter="persistChanges(['sku'], 'SKU actualizado')"
              />
            </UFormField>

            <UFormField v-if="showGeneralSkuBarcode" label="Código de barras / Barcode">
              <UInput
                v-model="formState.barcode"
                placeholder="Código de barras"
                :disabled="!canUpdate"
                @blur="persistChanges(['barcode'], 'Código actualizado')"
                @keyup.enter="persistChanges(['barcode'], 'Código actualizado')"
              />
            </UFormField>

            <UFormField :label="costLabel" class="md:col-span-2">
              <div class="relative">
                <span
                  class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                  >$</span
                >
                <UInput
                  v-model="formState.purchaseCost"
                  inputmode="decimal"
                  class="w-full"
                  :ui="{ base: 'pl-7 pr-24' }"
                  :disabled="!canUpdate"
                  @blur="persistChanges(['purchaseCost'], 'Costo actualizado')"
                  @keyup.enter="persistChanges(['purchaseCost'], 'Costo actualizado')"
                />
                <span
                  class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                  >por Unidad</span
                >
              </div>
              <p class="mt-1 text-xs text-muted">{{ productCostHint }}</p>
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="showInventoryCard">
          <template #header>
            <h3 class="font-semibold">Existencias</h3>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Cantidad">
              <UInputNumber
                v-model="formState.quantity"
                :min="0"
                class="w-full"
                :disabled="!canUpdate"
                @blur="persistChanges(['quantity'], 'Existencias actualizadas')"
                @keyup.enter="persistChanges(['quantity'], 'Existencias actualizadas')"
              />
            </UFormField>

            <UFormField label="Cantidad mínima">
              <UInputNumber
                v-model="formState.minQuantity"
                :min="0"
                class="w-full"
                :disabled="!canUpdate"
                @blur="persistChanges(['minQuantity'], 'Cantidad mínima actualizada')"
                @keyup.enter="persistChanges(['minQuantity'], 'Cantidad mínima actualizada')"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard v-if="persistedCatalog">
          <template #header>
            <h3 class="font-semibold">Catálogo online</h3>
          </template>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <UFormField label="Publicación en catálogo">
              <select
                id="catalog-publish-mode"
                data-testid="catalog-publish-mode"
                class="rounded-lg border border-default px-2 py-1 text-sm"
                :disabled="!canUpdate"
                v-model="catalogForm.catalogPublishMode"
              >
                <option value="INHERIT">Heredar</option>
                <option value="ON">Publicado</option>
                <option value="OFF">Oculto</option>
              </select>
            </UFormField>

            <OnlineStockOverrideFields
              :value="{
                mode: catalogForm.onlineStockPresentation,
                customQuantity: catalogForm.onlineStockPresentationCustomQty,
              }"
              :disabled="!canUpdate"
              @change="onCatalogStockChange"
            />
          </div>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="font-semibold">Precios</h3>
          </template>

          <VariantPricingTable :product-id="productId" :variant="variant" :can-update="canUpdate" />
        </UCard>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-3">
        <UButton
          type="button"
          label="Cancelar"
          color="neutral"
          variant="outline"
          :disabled="updateVariantMutation.isPending.value"
          @click="handleCancel"
        />
        <UButton
          type="button"
          label="Guardar"
          :disabled="!canUpdate"
          :loading="updateVariantMutation.isPending.value"
          @click="persistChanges(saveChangeableKeys, 'Variante actualizada', true, true)"
        />
      </div>
    </template>
  </UModal>
</template>
