<script setup lang="ts">
import '@/core/shared/design-system/houndfe-ui.css'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AxiosError } from 'axios'
import { computed, nextTick, reactive, ref, shallowRef, useTemplateRef, watch } from 'vue'
import ProductWorkspaceNavigation, { type ProductWorkspaceTask } from '../components/ProductWorkspaceNavigation.vue'
import EditorialWorkspace from '../components/editorial/EditorialWorkspace.vue'
import InventoryStockPanel from '@/features/POS/inventory/components/InventoryStockPanel.vue'
import { useInventoryAccess } from '@/features/POS/inventory/composables/useInventoryAccess'
import { canReadEditorial } from '../authorization/editorial-access'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { productApi } from '../api/product.api'
import ProductCatalogSettingsSection from '../components/ProductCatalogSettingsSection.vue'
import { useCatalogSettingsQuery } from '@/features/system/catalog-settings/composables/useCatalogSettingsQuery'
import type { OnlineStockPresentationMode } from '@/features/system/catalog-settings/interfaces/catalog-settings.types'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { parseMoneyInput } from '@/core/shared/utils/money-input.utils'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import PriceListSection from '../components/PriceListSection.vue'
import ProductDetailSkeleton from '../components/ProductDetailSkeleton.vue'
import ProductLotsTable, { type ProductLotRow } from '../components/ProductLotsTable.vue'
import ProductPriceMarginTable, {
  type ProductPriceRow,
} from '../components/ProductPriceMarginTable.vue'
import ReadOnlyStock from '../components/ReadOnlyStock.vue'
import ProductQuickCreateModal from '../components/ProductQuickCreateModal.vue'
import ProductSummaryPanel from '../components/ProductSummaryPanel.vue'
import ProductVariantsTable, {
  type ProductVariantRow,
} from '../components/ProductVariantsTable.vue'
import { productStatusConfig } from '../utils/productStatusConfig.utils'
import { productStockTotal } from '../utils/productStockTotal'
import {
  hasStockOnHand,
  productStockError,
  type ProductStockErrorField,
} from '../utils/productStockErrors'
import ProductImageGallery from '../components/ProductImageGallery.vue'
import HfCombobox, { type HfComboboxItem } from '@/core/shared/components/form/HfCombobox.vue'
import HfFieldGrid from '@/core/shared/components/form/HfFieldGrid.vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import HfSectionCard from '@/core/shared/components/form/HfSectionCard.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'
import { useLeaveGuard } from '@/core/shared/composables/useLeaveGuard'
import SatKeySelect from '../components/SatKeySelect.vue'
import VariantDetailModal from '../components/VariantDetailModal.vue'
import VariantImagePickerModal from '../components/VariantImagePickerModal.vue'
import {
  productFormSchema,
  centsToDecimalInput,
  moneyTextToCents,
  optionalMoneyText,
  readTierRows,
  type TierRowInput,
  productToFormInput,
  toCreatePayload,
  toUpdatePayload,
  inventoryFieldsVisible,
  isService,
  locationLabelFor,
  unitOptionsFor,
  IVA_OPTIONS,
  IEPS_OPTIONS,
} from '../composables/useProductForm'
import type {
  BrandOption,
  CategoryOption,
  CreateLotPayload,
  CreateProductPayload,
  CreateVariantPayload,
  GlobalPriceList,
  PendingLot,
  PendingPriceList,
  PendingVariant,
  PriceList,
  ProductFormInput,
  ProductImage,
  ProductVariant,
  UpdateProductPayload,
  UpdateVariantPayload,
} from '../interfaces/product.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const toast = useToast()

const PRODUCT_VARIANT_OPTIONS = ['Tamaño', 'Color', 'Material', 'Estilo'] as const
const SERVICE_VARIANT_OPTIONS = ['Duración', 'Horario', 'Frecuencia', 'Zona'] as const
// Sentinel for the SERVICE "Otra opción…" free-text entry.
const CUSTOM_VARIANT_OPTION_VALUE = '__custom__'

const variantOptionItems = computed<{ label: string; value: string }[]>(() => {
  const options = isService(formState.type) ? SERVICE_VARIANT_OPTIONS : PRODUCT_VARIANT_OPTIONS
  const items: { label: string; value: string }[] = options.map((option) => ({
    label: option,
    value: option,
  }))
  if (isService(formState.type)) {
    items.push({ label: 'Otra opción…', value: CUSTOM_VARIANT_OPTION_VALUE })
  }
  return items
})

const productId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && id.length > 0 ? id : null
})

const isCreateMode = computed(() => productId.value === null)
const productIdOrEmpty = computed(() => productId.value ?? '')

function getDefaultFormState(): ProductFormInput {
  return {
    name: '',
    type: 'PRODUCT',
    sku: '',
    barcode: '',
    categoryId: '',
    brandId: '',
    description: '',
    location: '',
    satKey: '',
    unit: 'UNIDAD',
    price: centsToDecimalInput(0),
    quantity: 0,
    minQuantity: 0,
    useStock: true,
    useLotsAndExpirations: false,
    hasVariants: false,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    ivaRate: 'IVA_16',
    iepsRate: 'NO_APLICA',
    purchaseCostMode: 'NET',
    purchaseCost: centsToDecimalInput(0),
    serviceDetail: { capacity: null, notes: '' },
  }
}

const formState = reactive<ProductFormInput>(getDefaultFormState())
const activeTask = shallowRef<ProductWorkspaceTask>('identity')
const identityFields = new Set([
  'type', 'name', 'barcode', 'sku', 'sellInPos', 'includeInOnlineCatalog',
  'requiresPrescription', 'unit', 'categoryId', 'brandId', 'location', 'satKey', 'description',
])

function revealInvalidTask(event: { errors: { name?: string }[] }) {
  const name = event.errors[0]?.name
  if (!name) return
  activeTask.value = identityFields.has(name) ? 'identity' : 'presentations'
}

const categorySchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'La categoría debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
})

type CategoryFormState = z.infer<typeof categorySchema>

const categoryState = reactive<CategoryFormState>({
  name: '',
})

const brandSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'La marca debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
})

type BrandFormState = z.infer<typeof brandSchema>

const brandState = reactive<BrandFormState>({
  name: '',
})

const variantSchema = z.object({
  option: z.string().trim().min(1, 'Selecciona una opción'),
  customOption: z.string().trim().max(50).optional(),
  value: z.string().trim().min(1, 'El valor es obligatorio').max(100),
  sku: z.string().trim().max(100),
  barcode: z.string().trim().max(100),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0),
  purchaseCost: optionalMoneyText(),
})

type VariantFormState = z.infer<typeof variantSchema>

const lotSchema = z.object({
  lotNumber: z.string().trim().min(2, 'El lote debe tener al menos 2 caracteres').max(120),
  quantity: z.number().int().min(0),
  manufactureDate: z.string().trim().optional(),
  expirationDate: z.string().trim().min(1, 'La fecha de vencimiento es obligatoria'),
})

type LotFormState = z.infer<typeof lotSchema>
type MainFormValues = z.infer<typeof productFormSchema>

const isCategoryModalOpen = ref(false)
const categoryCreateError = ref('')
const isBrandModalOpen = ref(false)
const brandCreateError = ref('')
const satKeyError = ref('')
const isVariantModalOpen = ref(false)
const isLotModalOpen = ref(false)
const editingVariantId = ref<string | null>(null)
const isVariantDetailModalOpen = ref(false)
const variantDetailModalVariant = ref<ProductVariant | null>(null)
const isVariantImageModalOpen = ref(false)
const variantImageModalVariant = ref<ProductVariant | null>(null)
const confirmState = ref({
  open: false,
  description: '',
  onConfirm: () => {},
})

function openConfirm(description: string, onConfirm: () => void) {
  confirmState.value = { open: true, description, onConfirm }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

// O1 S7: first variant of a product with stock — the backend zeroes the
// product stock, so ask before creating it.
const firstVariantConfirm = ref<{ open: boolean; payload: CreateVariantPayload | null }>({
  open: false,
  payload: null,
})

function confirmFirstVariant() {
  const { payload } = firstVariantConfirm.value
  firstVariantConfirm.value = { open: false, payload: null }
  if (payload) createVariantMutation.mutate(payload)
}

// O1 S7: stock error copy, shown next to the field or action it blocks.
const stockErrors = reactive<Record<ProductStockErrorField, string>>({
  quantity: '',
  useStock: '',
  lots: '',
  type: '',
})

function clearStockErrors() {
  stockErrors.quantity = ''
  stockErrors.useStock = ''
  stockErrors.lots = ''
  stockErrors.type = ''
}

/** Puts the copy at its field, opens the task that holds it, and returns the copy. */
function showStockError(error: unknown): string | null {
  const mapped = productStockError(error)
  if (!mapped) return null
  stockErrors[mapped.field] = mapped.message
  activeTask.value = mapped.field === 'type' ? 'identity' : 'presentations'
  return mapped.message
}

const variantState = reactive<VariantFormState>({
  option: '',
  customOption: '',
  value: '',
  sku: '',
  barcode: '',
  quantity: 0,
  minQuantity: 0,
  purchaseCost: '',
})

const lotState = reactive<LotFormState>({
  lotNumber: '',
  quantity: 0,
  manufactureDate: '',
  expirationDate: '',
})

// ── Local state for create-mode inline sub-resources ────────
let localIdCounter = 0
function nextLocalId(): string {
  return `local-${++localIdCounter}`
}

const pendingVariants = ref<PendingVariant[]>([])
const pendingLots = ref<PendingLot[]>([])
const pendingPriceLists = ref<PendingPriceList[]>([])
const isAddPriceListPickerOpen = ref(false)
const pendingPriceListSelection = ref('')

const isTierPricesModalOpen = ref(false)
const tierModalPriceListId = ref<string | null>(null)
const tierRows = ref<TierRowInput[]>([])
const tierRowErrors = ref<Record<number, string>>({})
let tierRowKeyCounter = 0

const isPendingVariantDetailModalOpen = ref(false)
const pendingVariantDetailId = ref<string | null>(null)
const pendingVariantDetailState = reactive({
  sku: '',
  barcode: '',
  quantity: 0,
  minQuantity: 0,
  purchaseCost: '',
  prices: [] as Array<{
    priceListId: string
    priceListName: string
    priceCents: number
    tierPrices: { minQuantity: number; priceCents: number }[]
  }>,
})

const isPendingVariantTierModalOpen = ref(false)
const pendingVariantTierPriceListId = ref<string | null>(null)
const pendingVariantTierRows = ref<TierRowInput[]>([])
const pendingVariantTierRowErrors = ref<Record<number, string>>({})
const pendingVariantCostError = ref<string | null>(null)

const canCreateProduct = computed(() => authStore.userCan('create', 'Product'))
const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))
// WU5 (REQ-14/REQ-15): the advanced section and the PATCH need update:Product
// only; the per-product support selector + settings GET additionally require
// read:TenantCatalogSettings (frontend data-access gate, never auto-granted).
const canReadSettings = computed(() => authStore.userCan('read', 'TenantCatalogSettings'))
const { settings: catalogSettings, isLoading: settingsLoading, isError: settingsError } = useCatalogSettingsQuery(tenantId, { enabled: canReadSettings })
const tenantPublicContexts = computed(() => catalogSettings.value?.priceContexts ?? [])
const lastSaveCatalogOnly = ref(false)
const canSubmitMainForm = computed(() =>
  isCreateMode.value ? canCreateProduct.value : canUpdateProduct.value,
)
const isFormReadonly = computed(() => !isCreateMode.value && !canUpdateProduct.value)
const isEditorialTask = computed(() => activeTask.value === 'content')
const editorialVisited = shallowRef(false)
const editorialUnavailableReason = computed(() => {
  if (isCreateMode.value) return 'Crea el producto primero para trabajar su contenido editorial.'
  if (!authStore.isAuthenticated || authStore.authPhase !== 'authenticated' || !authStore.user?.id)
    return 'Espera a que tu sesión esté lista para consultar contenido editorial.'
  if (!authStore.permissionsLoaded) return 'Espera a que se carguen tus permisos editoriales.'
  if (!authStore.currentTenant?.id && !authStore.isSuperAdmin)
    return 'Selecciona un tenant para consultar contenido editorial.'
  if (!canReadEditorial(authStore.permissionCodes, authStore.isSuperAdmin))
    return 'No tienes permiso para consultar el contenido editorial de este producto.'
  return null
})
const canAccessEditorial = computed(() => editorialUnavailableReason.value === null)
watch([isEditorialTask, canAccessEditorial], ([selected, allowed]) => {
  if (selected && allowed) editorialVisited.value = true
}, { flush: 'sync' })

// The fifth task: a saved product, and only for who can read the journal.
const { canRead: canReadInventory } = useInventoryAccess()
const showInventoryTask = computed(() => !isCreateMode.value && canReadInventory.value)
const inventoryVisited = shallowRef(false)
watch([activeTask, showInventoryTask], ([task, shown]) => {
  if (task === 'inventory' && shown) inventoryVisited.value = true
  else if (task === 'inventory') activeTask.value = 'identity'
}, { flush: 'sync' })

const {
  data: product,
  isLoading: isLoadingProduct,
  isError: isProductError,
  error: productError,
  refetch: refetchProduct,
} = useQuery({
  queryKey: computed(() => productQueryKeys.detail(tenantId.value, productIdOrEmpty.value)),
  queryFn: () => productApi.getById(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
})

/** A missing record (404) is an empty state with a way back, not the error design. */
const isProductNotFound = computed(
  () =>
    !isCreateMode.value &&
    isProductError.value &&
    (productError.value as { response?: { status?: number } } | null)?.response?.status === 404,
)
/** The form, its save actions and the summary exist only once there is a record (or a new one). */
const showWorkspace = computed(
  () => isCreateMode.value || (!isProductError.value && !isLoadingProduct.value),
)
/** The product's own save saves the operational form, which is not on Contenido: hidden there for every
 * user. Creating a product keeps it, since the content task only says to create the product first. */
const showProductSave = computed(
  () => showWorkspace.value && !isFormReadonly.value && !(isEditorialTask.value && !isCreateMode.value),
)
/** Identidad saves from its own bar at the bottom (like Contenido); the header and mobile save stay
 * for the other operational tasks, which keep sharing the same form. */
const showIdentitySaveBar = computed(
  () => showWorkspace.value && !isFormReadonly.value && activeTask.value === 'identity',
)
const showHeaderSave = computed(() => showProductSave.value && activeTask.value !== 'identity')

const { data: categories } = useQuery<CategoryOption[]>({
  queryKey: computed(() => productQueryKeys.categories(tenantId.value)),
  queryFn: productApi.getCategories,
  refetchOnWindowFocus: false,
})

const { data: globalPriceLists } = useQuery<GlobalPriceList[]>({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: productApi.getGlobalPriceLists,
  refetchOnWindowFocus: false,
})

const { data: productPriceLists } = useQuery<PriceList[]>({
  queryKey: computed(() => productQueryKeys.priceLists(tenantId.value, productIdOrEmpty.value)),
  queryFn: () => productApi.getPriceLists(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value && productIdOrEmpty.value.length > 0),
  refetchOnWindowFocus: false,
})

const { data: productImages } = useQuery<ProductImage[]>({
  queryKey: computed(() => productQueryKeys.images(tenantId.value, productIdOrEmpty.value)),
  queryFn: () => productApi.getImages(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value && productIdOrEmpty.value.length > 0),
  refetchOnWindowFocus: false,
})

const { data: brands } = useQuery<BrandOption[]>({
  queryKey: computed(() => productQueryKeys.brands(tenantId.value)),
  queryFn: productApi.getBrands,
  refetchOnWindowFocus: false,
})

const {
  data: variants,
  isFetching: isFetchingVariants,
  isError: isVariantsError,
  refetch: refetchVariants,
} = useQuery({
  queryKey: computed(() => productQueryKeys.variants(tenantId.value, productIdOrEmpty.value)),
  queryFn: () => productApi.getVariants(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
})

const { data: lots, isFetching: isFetchingLots, isError: isLotsError, refetch: refetchLots } = useQuery({
  queryKey: computed(() => productQueryKeys.lots(tenantId.value, productIdOrEmpty.value)),
  queryFn: () => productApi.getLots(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
    })

const variantsList = computed(() => variants.value ?? [])
const lotsList = computed(() => lots.value ?? [])

// WU4/WU5: pristine advanced snapshot from the authoritative server response.
const pristineAdvanced = computed(() => {
  const pristine = product.value
  if (!pristine) return null
  return {
    hidePriceInOnlineCatalog: pristine.hidePriceInOnlineCatalog ?? false,
    supportedCatalogPriceListIds: pristine.supportedCatalogPriceListIds ?? [],
    supportsAllCatalogPriceLists: pristine.supportsAllCatalogPriceLists ?? false,
    onlineStockPresentation: pristine.onlineStockPresentation ?? null,
    onlineStockPresentationCustomQty: pristine.onlineStockPresentationCustomQty ?? null,
  }
})
const categoriesList = computed(() => categories.value ?? [])
const brandsList = computed(() => brands.value ?? [])
const globalPriceListOptions = computed(() => globalPriceLists.value ?? [])
const productPriceListsList = computed(() => productPriceLists.value ?? [])
const productImagesList = computed(() => productImages.value ?? [])
const availablePriceListOptions = computed(() => {
  const usedIds = new Set(pendingPriceLists.value.map((pl) => pl.priceListId))
  return globalPriceListOptions.value.filter((gpl) => !usedIds.has(gpl.id))
})

const variantGroups = computed(() => {
  const grouped = new Map<string, { option: string; values: string[] }>()

  // Use pending variants in create mode, backend variants in edit mode
  const items = isCreateMode.value
    ? pendingVariants.value.map((pv) => ({
        option: pv.option?.trim() ?? '',
        value: pv.value || pv.option,
      }))
    : variantsList.value.map((v) => ({
        option: v.option?.trim() ?? '',
        value: v.value?.trim() || v.name,
      }))

  for (const item of items) {
    // A variant without an option (Talla, Color) only repeats its own table row: no group card.
    if (!item.option) continue
    const existing = grouped.get(item.option)

    if (!existing) {
      grouped.set(item.option, { option: item.option, values: [item.value] })
      continue
    }

    if (!existing.values.includes(item.value)) {
      existing.values.push(item.value)
    }
  }

  return Array.from(grouped.values())
})

function getPublicPrice(variant: ProductVariant) {
  return variant.variantPrices.find((p) => p.priceListName === 'PUBLICO')
}

// «Sin …» clears the choice; HfCombobox needs a non-empty value for it.
const NO_CHOICE = '__none__'
const categoryActions = [{ value: 'create', label: 'Crear categoría', icon: 'i-lucide-plus' }]
const brandActions = [{ value: 'create', label: 'Crear marca', icon: 'i-lucide-plus' }]
const categoryItems = computed<HfComboboxItem[]>(() => [
  { label: 'Sin categoría', value: NO_CHOICE },
  ...categoriesList.value.map((category) => ({ label: category.name, value: category.id })),
])
const brandItems = computed<HfComboboxItem[]>(() => [
  { label: 'Sin marca', value: NO_CHOICE },
  ...brandsList.value.map((brand) => ({ label: brand.name, value: brand.id })),
])
const unitItems = computed<HfComboboxItem[]>(() =>
  unitOptionsFor(formState.type).map((unit) => ({ label: unit.label, value: unit.value })),
)
const TYPE_ITEMS: HfComboboxItem[] = [
  { label: 'Producto', value: 'PRODUCT' },
  { label: 'Servicio', value: 'SERVICE' },
]
const channelToggles = [
  { key: 'sellInPos', label: 'Vender en punto de venta', description: 'Aparece en la pantalla de venta' },
  { key: 'includeInOnlineCatalog', label: 'Incluir en catálogo en línea', description: 'Visible en la tienda en línea' },
  { key: 'requiresPrescription', label: 'Requerir receta médica', description: 'Se pide la receta al venderlo' },
] as const
const fromChoice = (value: string | string[] | null) => (typeof value === 'string' && value !== NO_CHOICE ? value : '')
/** A UFormField slot error is a string, or `false`/`undefined` with nothing to say. */
const fieldError = (error: unknown) => (typeof error === 'string' && error ? error : undefined)

const showLotsCheckbox = computed(() => formState.useStock && !formState.hasVariants)
const showStockByVariantMessage = computed(() => formState.hasVariants)
const showInventoryCard = computed(() => formState.type === 'PRODUCT')
const showInventoryFields = computed(() => inventoryFieldsVisible(formState.type))
// Stock moves only by adjustment, so tracking cannot be switched off while units remain.
const stockOnHand = computed(() => {
  if (isCreateMode.value || !product.value) return false
  const variantStock = variantsList.value.reduce((total, variant) => total + variant.quantity, 0)
  return hasStockOnHand({
    quantity: product.value.quantity,
    variantStockTotal: Math.max(product.value.variantStockTotal ?? 0, variantStock),
  })
})
const useStockLocked = computed(() => stockOnHand.value && formState.useStock)
// Creating the first variant zeroes the product stock (REMOVAL FIRST_VARIANT_ZEROING).
const firstVariantZeroesStock = computed(
  () => !isCreateMode.value && variantsList.value.length === 0 && (product.value?.quantity ?? 0) > 0,
)
const locationFieldLabel = computed(() => locationLabelFor(formState.type))
const showServiceDetailCard = computed(() => isService(formState.type))
const productStatus = computed(() =>
  product.value ? productStatusConfig[product.value.status] : undefined,
)
const createModeTitle = computed(() => (isService(formState.type) ? 'Nuevo servicio' : 'Nuevo producto'))
const createModeSubmitLabel = computed(() =>
  isService(formState.type) ? 'Crear servicio' : 'Crear producto',
)
const showManualStockFields = computed(
  () => formState.useStock && !formState.useLotsAndExpirations && !formState.hasVariants,
)
const showLotsSection = computed(
  () => formState.useStock && formState.useLotsAndExpirations && !formState.hasVariants,
)
const showVariantsSection = computed(() => !formState.useLotsAndExpirations)
const previewEditPublicPriceList = computed(() =>
  productPriceListsList.value.find((priceList) => priceList.name.toUpperCase() === 'PUBLICO'),
)
const previewMainImage = computed(() => {
  if (isCreateMode.value) return null

  return (
    productImagesList.value.find((image) => image.variantId === null && image.isMain) ??
    productImagesList.value.find((image) => image.variantId === null) ??
    productImagesList.value[0] ??
    null
  )
})
const previewPublicPriceCents = computed(() => {
  if (isCreateMode.value) {
    const defaultPriceList = pendingPriceLists.value.find((pl) => isDefaultPriceList(pl.priceListId))
    return defaultPriceList?.priceCents ?? 0
  }

  return previewEditPublicPriceList.value?.priceCents ?? product.value?.priceCents ?? moneyTextToCents(formState.price) ?? 0
})
const previewCostCents = computed(() => moneyTextToCents(formState.purchaseCost) ?? 0)
const previewMarginPercent = computed(() => {
  if (previewPublicPriceCents.value <= 0 || previewCostCents.value <= 0) return null

  return Math.round(
    ((previewPublicPriceCents.value - previewCostCents.value) / previewPublicPriceCents.value) * 100,
  )
})
const previewStockTotal = computed(() =>
  productStockTotal({
    type: formState.type,
    useStock: formState.useStock,
    hasVariants: formState.hasVariants,
    useLotsAndExpirations: formState.useLotsAndExpirations,
    isCreateMode: isCreateMode.value,
    formQuantity: formState.quantity,
    pendingVariants: pendingVariants.value,
    variants: variantsList.value,
    variantStockTotal: product.value?.variantStockTotal ?? undefined,
    pendingLots: pendingLots.value,
    lots: lotsList.value,
    savedQuantity: product.value?.quantity ?? undefined,
  }),
)
const previewChecklistItems = computed(() => [
  { label: 'Nombre del producto', done: formState.name.trim().length >= 2, disabled: false },
  { label: 'Precio de venta definido', done: previewPublicPriceCents.value > 0, disabled: false },
  { label: 'Categoría asignada', done: Boolean(formState.categoryId), disabled: false },
  {
    label: isCreateMode.value ? 'Imágenes disponibles después de crear' : 'Al menos una imagen',
    done: !isCreateMode.value && productImagesList.value.length > 0,
    disabled: isCreateMode.value,
  },
])
const previewApplicableChecklistItems = computed(() =>
  previewChecklistItems.value.filter((item) => !item.disabled),
)
const previewCompletedItems = computed(
  () => previewApplicableChecklistItems.value.filter((item) => item.done).length,
)
const previewCompletionPercent = computed(() =>
  Math.round((previewCompletedItems.value / previewApplicableChecklistItems.value.length) * 100),
)
const variantModalTitle = computed(() =>
  editingVariantId.value ? 'Editar variante' : 'Agregar variante',
)
const variantSubmitLabel = computed(() =>
  editingVariantId.value ? 'Guardar variante' : 'Agregar variante',
)

// ── Unsaved changes: the form against a snapshot taken once the load (and its watchers) settled ──
const pristineForm = shallowRef<string | null>(null)
const restoringForm = shallowRef(false)
const savedAt = ref<Date | string | null>(null)
const saveError = ref<string | null>(null)
const leaveAllowed = shallowRef(false)

function snapshotForm() {
  void nextTick(() => { pristineForm.value = JSON.stringify(formState) })
}

function resetCreateState() {
  Object.assign(formState, getDefaultFormState())
  pendingVariants.value = []
  pendingLots.value = []
  pendingPriceLists.value = []
  isAddPriceListPickerOpen.value = false
  pendingPriceListSelection.value = ''
}

watch(
  () => isCreateMode.value,
  (createMode) => {
    if (createMode) {
      resetCreateState()
      snapshotForm()
    }
  },
  { immediate: true },
)

watch(
  () => product.value,
  (productValue) => {
    if (!productValue || isCreateMode.value) return
    Object.assign(formState, productToFormInput(productValue))
    savedAt.value = productValue.updatedAt ?? null
    snapshotForm()
  },
  { immediate: true },
)

const dirtyCount = computed(() => {
  if (pristineForm.value === null) return 0
  const pristine = JSON.parse(pristineForm.value) as Record<string, unknown>
  const current = formState as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(pristine), ...Object.keys(current)])
  let changed = [...keys].filter((key) => JSON.stringify(current[key]) !== JSON.stringify(pristine[key])).length
  if (isCreateMode.value) {
    changed += pendingVariants.value.length + pendingLots.value.length
    // Only priced lists reach the payload (buildFullCreatePayload); the auto-attached zero lists are no change.
    changed += pendingPriceLists.value.filter((pl) => pl.priceCents > 0 || (pl.tierPrices?.length ?? 0) > 0).length
  }
  return changed
})
const isSaving = computed(() => updateMutation.isPending.value || createMutation.isPending.value)
/** A saved product with no edits has nothing to save, so the header and mobile save wait for a change
 * (as Identidad's save bar does). Creating keeps it enabled: the form validates on submit. */
const headerSaveDisabled = computed(
  () => !canSubmitMainForm.value || (!isCreateMode.value && dirtyCount.value === 0),
)

useLeaveGuard(() => dirtyCount.value > 0 && !leaveAllowed.value, {
  description: 'Tienes cambios sin guardar en el producto.',
})

watch(
  () => variantsList.value,
  (nextVariants) => {
    if (!variantDetailModalVariant.value) return

    const nextVariant = nextVariants.find((item) => item.id === variantDetailModalVariant.value?.id)
    if (!nextVariant) {
      isVariantDetailModalOpen.value = false
      variantDetailModalVariant.value = null
      return
    }

    variantDetailModalVariant.value = nextVariant
  },
  { immediate: true },
)

watch(
  () => isVariantDetailModalOpen.value,
  (isOpen) => {
    if (!isOpen) {
      variantDetailModalVariant.value = null
    }
  },
)

// Auto-attach ALL global price lists in create mode
watch(
  () => globalPriceListOptions.value,
  (lists) => {
    if (!isCreateMode.value || lists.length === 0) return
    if (pendingPriceLists.value.length > 0) return

    for (const gpl of lists) {
      addPendingPriceList(gpl.id, 0)
    }
  },
  { immediate: true },
)

watch(
  () => formState.type,
  (type, previousType) => {
    // Descartar puts back a consistent snapshot: no defaults to force, nothing to warn about.
    if (restoringForm.value) return
    // SERVICE: force inventory defaults (stock/lots off, qty 0) and clear
    // pendingLots only. NEVER force hasVariants=false and NEVER clear
    // pendingVariants / pendingPriceLists — services support variants
    // (dog-walk durations, etc) per the backend handoff.
    if (type === 'SERVICE') {
      formState.useStock = false
      formState.useLotsAndExpirations = false
      formState.quantity = 0
      formState.minQuantity = 0
      pendingLots.value = []
    }

    // In edit mode, switching types needs explicit warnings. The backend will
    // also surface PRODUCT_TYPE_CHANGE_BLOCKED if a type change can't be
    // honored (handled in mapDomainError below).
    if (previousType && previousType !== type) {
      if (type === 'PRODUCT' && previousType === 'SERVICE') {
        toast.add({
          title: 'Cambiaste a producto',
          description:
            'Después de guardar, agrega existencias y costos nuevamente. La información de servicio no se traslada.',
          color: 'warning',
        })
      } else if (type === 'SERVICE' && previousType === 'PRODUCT') {
        const hadStock = !!product.value?.useStock
        const hadLots = !!product.value?.useLotsAndExpirations
        if (hadStock || hadLots) {
          // SERVICE drops stock/lots on the wire; warn via openConfirm so the
          // user can cancel the type change before save.
          openConfirm(
            'Al cambiar a Servicio se perderán las existencias y lotes actuales. ¿',
            () => {
              /* keep the change */
            },
          )
        }
      }
    }
  },
)

// When useStock is unchecked → force lots off, qty to 0
watch(
  () => formState.useStock,
  (val) => {
    if (!val) {
      formState.useLotsAndExpirations = false
      formState.quantity = 0
      formState.minQuantity = 0
    }
  },
)

// When hasVariants is true → force lots off, qty to 0
watch(
  () => formState.hasVariants,
  (val) => {
    if (val) {
      formState.useLotsAndExpirations = false
      formState.quantity = 0
      formState.minQuantity = 0
    }
  },
)

// When lots is on → quantity must be 0 (stock lives in lots)
watch(
  () => formState.useLotsAndExpirations,
  (val) => {
    if (val) {
      formState.quantity = 0
    }
  },
)

function mapDomainError(error: AxiosError<DomainApiError>): string {
  const response = error.response?.data
  if (!response) return 'No pudimos completar la operación. Reintenta en unos segundos.'
  // SAT_KEY_NOT_FOUND surfaces as a field-level error under the
  // SatKeySelect (mirrors ProductsView's `ProductFormErrors.satKey`
  // mapping for the slideover path).
  if (response.error === 'SAT_KEY_NOT_FOUND') {
    satKeyError.value = response.message ?? 'Clave SAT inválida.'
  } else {
    satKeyError.value = ''
  }
  const stockMessage = productStockError(error)?.message
  if (stockMessage) return stockMessage
  return response.message ?? 'No pudimos completar la operación. Reintenta en unos segundos.'
}

function handleBack() {
  void router.push('/pos/products')
}

function resetCategoryForm() {
  categoryState.name = ''
  categoryCreateError.value = ''
}

function resetBrandForm() {
  brandState.name = ''
  brandCreateError.value = ''
}

function resetVariantForm() {
  Object.assign(variantState, {
    option: '',
    customOption: '',
    value: '',
    sku: '',
    barcode: '',
    quantity: 0,
    minQuantity: 0,
    purchaseCost: '',
  })
  editingVariantId.value = null
}

/** Resolve the effective variant option on submit — maps the custom sentinel to
 *  its free-text value. Returns an empty string when the custom field is empty. */
function resolveVariantOption(option: string, customOption: string | undefined): string {
  if (option === CUSTOM_VARIANT_OPTION_VALUE) return customOption?.trim() ?? ''
  return option
}

/** Normalize an existing variant option for the form — non-catalog SERVICE values
 *  map to the custom sentinel so editing a custom option round-trips. */
function resolveOptionForForm(option: string): { option: string; customOption: string } {
  const isCustom =
    isService(formState.type) &&
    option.length > 0 &&
    !(SERVICE_VARIANT_OPTIONS as readonly string[]).includes(option)
  return isCustom
    ? { option: CUSTOM_VARIANT_OPTION_VALUE, customOption: option }
    : { option, customOption: '' }
}

function resetLotForm() {
  Object.assign(lotState, {
    lotNumber: '',
    quantity: 0,
    manufactureDate: '',
    expirationDate: '',
  })
}

function buildFullCreatePayload(formValues: MainFormValues): CreateProductPayload {
  const base = toCreatePayload(formValues)

  // Sync product-level priceCents with the PUBLICO price list price.
  // In the full editor, formState.price is never rendered (stays at 0),
  // so we derive priceCents from the PUBLICO pending price list — the single
  // source of truth for the default sale price (matches edit-mode behavior).
  const publicoPriceList = pendingPriceLists.value.find((pl) => isDefaultPriceList(pl.priceListId))
  if (publicoPriceList) {
    base.priceCents = publicoPriceList.priceCents
  }

  // Inline variants
  if (formValues.hasVariants && pendingVariants.value.length > 0) {
    const showInventory = inventoryFieldsVisible(formValues.type)
    base.variants = pendingVariants.value.map((v) => ({
      option: v.option || undefined,
      value: v.value || undefined,
      ...(showInventory && v.sku ? { sku: v.sku } : {}),
      ...(showInventory && v.barcode ? { barcode: v.barcode } : {}),
      quantity: showInventory ? v.quantity : 0,
      minQuantity: showInventory ? v.minQuantity : 0,
      ...(v.purchaseNetCostCents != null ? { purchaseNetCostCents: v.purchaseNetCostCents } : {}),
    }))
  }

  // Inline lots
  if (formValues.useStock && formValues.useLotsAndExpirations && !formValues.hasVariants && pendingLots.value.length > 0) {
    base.lots = pendingLots.value.map((l) => ({
      lotNumber: l.lotNumber,
      quantity: l.quantity,
      expirationDate: l.expirationDate,
      ...(l.manufactureDate ? { manufactureDate: l.manufactureDate } : {}),
    }))
  }

  // Inline price lists — only include lists with non-zero price or tier prices
  // (backend auto-creates all lists with default values, so only send overrides)
  if (pendingPriceLists.value.length > 0) {
    const overrides = pendingPriceLists.value
      .filter((pl) => pl.priceCents > 0 || pl.tierPrices.length > 0)
      .map((pl) => ({
        priceListId: pl.priceListId,
        priceCents: pl.priceCents,
        ...(pl.tierPrices.length > 0 ? { tierPrices: pl.tierPrices } : {}),
      }))

    if (overrides.length > 0) {
      base.priceLists = overrides
    }
  }

  return base
}

const createMutation = useMutation({
  mutationFn: async (payload: MainFormValues) => {
    const fullPayload = buildFullCreatePayload(payload)
    const createdProduct = await productApi.create(fullPayload)

    // Step 4 (per backend guide): update variant prices after creation.
    // The backend auto-creates variantPrices at 0 for each variant × price list.
    // We need to use the IDs from the raw response to set the prices configured locally.
    const rawVariants = (createdProduct._raw?.variants ?? []) as Array<{
      id: string
      option: string | null
      value: string | null
      name: string | null
      sku: string | null
      variantPrices: Array<{
        id: string
        priceListId: string
        priceListName: string
        priceCents: number
      }>
    }>

    // Take a snapshot of pending variants BEFORE they get cleared
    const localVariantsSnapshot = pendingVariants.value.map((pv) => ({
      ...pv,
      variantPrices: pv.variantPrices.map((vp) => ({ ...vp, tierPrices: [...vp.tierPrices] })),
    }))

    if (rawVariants.length > 0 && localVariantsSnapshot.length > 0) {
      const variantPriceUpdates: Promise<unknown>[] = []

      for (const createdVariant of rawVariants) {
        const localVariant = localVariantsSnapshot.find((pv) => {
          if (pv.sku && createdVariant.sku && pv.sku.toUpperCase() === createdVariant.sku.toUpperCase()) return true
          if (pv.option === createdVariant.option && pv.value === createdVariant.value) return true
          if (pv.value === createdVariant.name) return true
          return false
        })

        if (!localVariant?.variantPrices?.length) continue

        for (const localPrice of localVariant.variantPrices) {
          if (localPrice.priceCents === 0 && localPrice.tierPrices.length === 0) continue

          const createdVarPrice = createdVariant.variantPrices?.find(
            (vp) => vp.priceListName === localPrice.priceListName,
          )

          if (!createdVarPrice) continue

          variantPriceUpdates.push(
            productApi.upsertVariantPrice(
              createdProduct.id,
              createdVariant.id,
              createdVarPrice.priceListId,
              {
                priceCents: localPrice.priceCents,
                ...(localPrice.tierPrices.length > 0 ? { tierPrices: localPrice.tierPrices } : {}),
              },
            ),
          )
        }
      }

      if (variantPriceUpdates.length > 0) {
        await Promise.allSettled(variantPriceUpdates)
      }
    }

    return createdProduct
  },
  onMutate: () => {
    saveError.value = null
  },
  onSuccess: async (createdProduct) => {
    satKeyError.value = ''
    leaveAllowed.value = true
    pendingVariants.value = []
    pendingLots.value = []
    pendingPriceLists.value = []

    toast.add({
      title: 'Producto creado',
      description: 'El producto se creó correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated(tenantId.value) })
    await router.push(`/pos/products/${createdProduct.id}`)
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    saveError.value = message
    toast.add({ title: 'Error al crear producto', description: message, color: 'error' })
  },
})

const updateMutation = useMutation({
  mutationFn: (payload: UpdateProductPayload) => {
    if (!productId.value) throw new Error('Missing product id')
    return productApi.update(productId.value, payload)
  },
  onMutate: () => {
    clearStockErrors()
    saveError.value = null
  },
  onSuccess: async () => {
    satKeyError.value = ''
    savedAt.value = new Date()
    toast.add({
      title: 'Producto actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    if (!productId.value) return

    // WU5 REQ-18: catalog-only product PATCH invalidates ONLY detail; mixed
    // changes retain the pre-existing invalidation set — catalog adds none.
    const invalidateKeys = lastSaveCatalogOnly.value
      ? [productQueryKeys.detail(tenantId.value, productId.value)]
      : [
          productQueryKeys.paginated(tenantId.value),
          productQueryKeys.detail(tenantId.value, productId.value),
          productQueryKeys.priceLists(tenantId.value, productId.value),
          productQueryKeys.variants(tenantId.value, productId.value),
        ]
    await Promise.all(invalidateKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })))
  },
  onError: (error) => {
    const code = (error as AxiosError<DomainApiError>)?.response?.data?.error
    const message =
      showStockError(error) ??
      (code === 'PRODUCT_HAS_VARIANTS'
        ? 'No puedes desactivar las variantes mientras el producto tenga variantes. Elimínalas primero.'
        : mapDomainError(error as AxiosError<DomainApiError>))
    saveError.value = message
    toast.add({ title: 'Error al actualizar producto', description: message, color: 'error' })
  },
})

const createCategoryMutation = useMutation({
  mutationFn: (name: string) => productApi.createCategory({ name }),
  onMutate: () => {
    categoryCreateError.value = ''
  },
  onSuccess: async (category) => {
    formState.categoryId = category.id
    isCategoryModalOpen.value = false
    resetCategoryForm()

    toast.add({
      title: 'Categoría creada',
      description: `La categoría ${category.name} ya está disponible para seleccionar.`,
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.categories(tenantId.value) })
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    categoryCreateError.value = message
    toast.add({ title: 'Error al crear categoría', description: message, color: 'error' })
  },
})

const createBrandMutation = useMutation({
  mutationFn: (name: string) => productApi.createBrand({ name }),
  onMutate: () => {
    brandCreateError.value = ''
  },
  onSuccess: async (brand) => {
    formState.brandId = brand.id
    isBrandModalOpen.value = false
    resetBrandForm()

    toast.add({
      title: 'Marca creada',
      description: `La marca ${brand.name} ya está disponible para seleccionar.`,
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.brands(tenantId.value) })
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    brandCreateError.value = message
    toast.add({ title: 'Error al crear marca', description: message, color: 'error' })
  },
})

const createVariantMutation = useMutation({
  mutationFn: (payload: CreateVariantPayload) =>
    productApi.createVariant(productIdOrEmpty.value, payload),
  onSuccess: async () => {
    resetVariantForm()
    isVariantModalOpen.value = false

    toast.add({
      title: 'Variante creada',
      description: 'La variante se creó correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(tenantId.value, productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(tenantId.value, productIdOrEmpty.value),
      }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear variante', description: message, color: 'error' })
  },
})

const updateVariantMutation = useMutation({
  mutationFn: (payload: { variantId: string; values: UpdateVariantPayload }) =>
    productApi.updateVariant(productIdOrEmpty.value, payload.variantId, payload.values),
  onSuccess: async () => {
    resetVariantForm()
    isVariantModalOpen.value = false

    toast.add({
      title: 'Variante actualizada',
      description: 'La variante se actualizó correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(tenantId.value, productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(tenantId.value, productIdOrEmpty.value),
      }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al actualizar variante', description: message, color: 'error' })
  },
})

const deleteVariantMutation = useMutation({
  mutationFn: (variantId: string) => productApi.removeVariant(productIdOrEmpty.value, variantId),
  onSuccess: async () => {
    toast.add({
      title: 'Variante eliminada',
      description: 'La variante fue eliminada correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(tenantId.value, productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(tenantId.value, productIdOrEmpty.value),
      }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar variante', description: message, color: 'error' })
  },
})

const createLotMutation = useMutation({
  mutationFn: (payload: CreateLotPayload) => productApi.createLot(productIdOrEmpty.value, payload),
  onSuccess: async () => {
    resetLotForm()
    isLotModalOpen.value = false
    toast.add({
      title: 'Lote creado',
      description: 'El lote se creó correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(tenantId.value, productIdOrEmpty.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(tenantId.value, productIdOrEmpty.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear lote', description: message, color: 'error' })
  },
})

const deleteLotMutation = useMutation({
  mutationFn: (lotId: string) => productApi.removeLot(productIdOrEmpty.value, lotId),
  onMutate: () => {
    stockErrors.lots = ''
  },
  onSuccess: async () => {
    toast.add({
      title: 'Lote eliminado',
      description: 'El lote fue eliminado correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(tenantId.value, productIdOrEmpty.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(tenantId.value, productIdOrEmpty.value) }),
    ])
  },
  onError: (error) => {
    const message = showStockError(error) ?? mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar lote', description: message, color: 'error' })
  },
})

function openCreateCategoryModal() {
  categoryCreateError.value = ''
  isCategoryModalOpen.value = true
}

function closeCreateCategoryModal() {
  isCategoryModalOpen.value = false
  resetCategoryForm()
}

function openCreateBrandModal() {
  brandCreateError.value = ''
  isBrandModalOpen.value = true
}

function closeCreateBrandModal() {
  isBrandModalOpen.value = false
  resetBrandForm()
}

function openAddVariantModal() {
  resetVariantForm()
  isVariantModalOpen.value = true
}

function openEditVariantModal(variantId: string) {
  if (isCreateMode.value) {
    const pending = pendingVariants.value.find((v) => v._localId === variantId)
    if (!pending) return

    editingVariantId.value = pending._localId
    const { option, customOption } = resolveOptionForForm(pending.option)
    Object.assign(variantState, {
      option,
      customOption,
      value: pending.value,
      sku: pending.sku,
      barcode: pending.barcode,
      quantity: pending.quantity,
      minQuantity: pending.minQuantity,
      purchaseCost: pending.purchaseNetCostCents != null
        ? centsToDecimalInput(pending.purchaseNetCostCents)
        : '',
    })

    isVariantModalOpen.value = true
    return
  }

  const variant = variantsList.value.find((item) => item.id === variantId)
  if (!variant) return

  editingVariantId.value = variant.id
  const { option, customOption } = resolveOptionForForm(variant.option ?? '')
  Object.assign(variantState, {
    option,
    customOption,
    value: variant.value ?? variant.name,
    sku: variant.sku ?? '',
    barcode: variant.barcode ?? '',
    quantity: variant.quantity,
    minQuantity: variant.minQuantity ?? 0,
    purchaseCost: variant.purchaseNetCostCents != null
      ? centsToDecimalInput(variant.purchaseNetCostCents)
      : '',
  })

  isVariantModalOpen.value = true
}

function openPendingVariantDetailModal(variantId: string) {
  const variant = pendingVariants.value.find((v) => v._localId === variantId)
  if (!variant) return

  // Ensure variant has prices for ALL current pending price lists
  for (const pl of pendingPriceLists.value) {
    if (!variant.variantPrices.some((vp) => vp.priceListId === pl.priceListId)) {
      variant.variantPrices.push({
        priceListId: pl.priceListId,
        priceListName: pl.priceListName,
        priceCents: 0,
        tierPrices: [],
      })
    }
  }

  pendingVariantDetailId.value = variant._localId
  pendingVariantDetailState.sku = variant.sku
  pendingVariantDetailState.barcode = variant.barcode
  pendingVariantDetailState.quantity = variant.quantity
  pendingVariantDetailState.minQuantity = variant.minQuantity
  pendingVariantDetailState.purchaseCost =
    variant.purchaseNetCostCents != null ? centsToDecimalInput(variant.purchaseNetCostCents) : ''
  pendingVariantDetailState.prices = variant.variantPrices.map((vp) => ({
    priceListId: vp.priceListId,
    priceListName: vp.priceListName,
    priceCents: vp.priceCents,
    tierPrices: vp.tierPrices.map((t) => ({ ...t })),
  }))

  isPendingVariantDetailModalOpen.value = true
}

function closePendingVariantDetailModal() {
  isPendingVariantDetailModalOpen.value = false
  pendingVariantDetailId.value = null
  pendingVariantDetailState.sku = ''
  pendingVariantDetailState.barcode = ''
  pendingVariantDetailState.quantity = 0
  pendingVariantDetailState.minQuantity = 0
  pendingVariantDetailState.purchaseCost = ''
  pendingVariantDetailState.prices = []
  pendingVariantCostError.value = null
}

function savePendingVariantDetailModal() {
  const variantId = pendingVariantDetailId.value
  if (!variantId) return

  const index = pendingVariants.value.findIndex((v) => v._localId === variantId)
  if (index === -1) return

  const updated = pendingVariants.value[index]!
  updated.sku = pendingVariantDetailState.sku
  updated.barcode = pendingVariantDetailState.barcode
  updated.quantity = Math.max(0, Math.trunc(pendingVariantDetailState.quantity))
  updated.minQuantity = Math.max(0, Math.trunc(pendingVariantDetailState.minQuantity))
  // A blank cost keeps no own cost; one that does not read blocks the save.
  const cost = pendingVariantDetailState.purchaseCost.trim()
  const costResult = cost ? parseMoneyInput(cost) : null
  pendingVariantCostError.value = costResult && 'error' in costResult ? costResult.error : null
  if (pendingVariantCostError.value) return
  updated.purchaseNetCostCents = costResult && 'cents' in costResult ? costResult.cents : null
  updated.variantPrices = pendingVariantDetailState.prices.map((vp) => ({
    priceListId: vp.priceListId,
    priceListName: vp.priceListName,
    priceCents: vp.priceCents,
    tierPrices: vp.tierPrices.map((t) => ({ ...t })),
  }))

  const publicPrice = updated.variantPrices.find((vp) => vp.priceListName === 'PUBLICO')
  if (publicPrice) {
    updated.publicPriceCents = publicPrice.priceCents
  }

  closePendingVariantDetailModal()
}

const pendingVariantTierPriceListName = computed(() => {
  const id = pendingVariantTierPriceListId.value
  if (!id) return ''
  const target = pendingVariantDetailState.prices.find((p) => p.priceListId === id)
  return target?.priceListName ?? ''
})

const pendingVariantDetailName = computed(() => {
  const id = pendingVariantDetailId.value
  if (!id) return ''
  const variant = pendingVariants.value.find((v) => v._localId === id)
  if (!variant) return ''
  return variant.option ? `${variant.value}` : variant.value
})

function openPendingVariantTierPricesModal(priceListId: string) {
  const target = pendingVariantDetailState.prices.find((p) => p.priceListId === priceListId)
  if (!target) return

  pendingVariantTierPriceListId.value = priceListId
  pendingVariantTierRowErrors.value = {}
  pendingVariantTierRows.value = target.tierPrices.map((tier) => ({
    key: tierRowKeyCounter++,
    minQuantity: tier.minQuantity,
    price: centsToDecimalInput(tier.priceCents),
  }))
  isPendingVariantTierModalOpen.value = true
}

function closePendingVariantTierPricesModal() {
  isPendingVariantTierModalOpen.value = false
  pendingVariantTierPriceListId.value = null
  pendingVariantTierRows.value = []
}

function savePendingVariantTierPricesModal() {
  const targetId = pendingVariantTierPriceListId.value
  if (!targetId) return

  const target = pendingVariantDetailState.prices.find((p) => p.priceListId === targetId)
  if (!target) return

  const read = readTierRows(pendingVariantTierRows.value)
  if ('errors' in read) {
    pendingVariantTierRowErrors.value = read.errors
    return
  }
  target.tierPrices = read.tiers.filter(
    (row) => Number.isInteger(row.minQuantity) && row.minQuantity >= 0,
  )

  closePendingVariantTierPricesModal()
}

function addPendingVariantTierRow() {
  pendingVariantTierRows.value.push({
    key: tierRowKeyCounter++,
    minQuantity: '',
    price: '',
  })
}

function removePendingVariantTierRow(rowKey: number) {
  pendingVariantTierRows.value = pendingVariantTierRows.value.filter((row) => row.key !== rowKey)
}

function closeVariantModal() {
  isVariantModalOpen.value = false
  resetVariantForm()
}

function closeLotModal() {
  isLotModalOpen.value = false
  resetLotForm()
}

// ── Local price list management (create mode) ──────────────
function addPendingPriceList(priceListId: string, priceCents: number) {
  if (!priceListId) return
  const gpl = globalPriceListOptions.value.find((pl) => pl.id === priceListId)
  if (!gpl) return

  pendingPriceLists.value.push({
    _localId: nextLocalId(),
    priceListId: gpl.id,
    priceListName: gpl.name,
    priceCents,
    tierPrices: [],
  })

  for (const variant of pendingVariants.value) {
    if (!variant.variantPrices.some((vp) => vp.priceListId === gpl.id)) {
      variant.variantPrices.push({
        priceListId: gpl.id,
        priceListName: gpl.name,
        priceCents: 0,
        tierPrices: [],
      })
    }
  }
}

function removePendingPriceList(localId: string) {
  const list = pendingPriceLists.value.find((pl) => pl._localId === localId)
  if (!list) return
  if (isDefaultPriceList(list.priceListId)) return

  pendingPriceLists.value = pendingPriceLists.value.filter((pl) => pl._localId !== localId)

  for (const variant of pendingVariants.value) {
    variant.variantPrices = variant.variantPrices.filter((vp) => vp.priceListId !== list.priceListId)
  }
}

function updatePendingPriceListPrice(localId: string, priceCents: number) {
  const item = pendingPriceLists.value.find((pl) => pl._localId === localId)
  if (item) item.priceCents = priceCents
}

function getPendingCostCents(): number {
  return moneyTextToCents(formState.purchaseCost) ?? 0
}

function isDefaultPriceList(priceListId: string): boolean {
  const gpl = globalPriceListOptions.value.find((pl) => pl.id === priceListId)
  return gpl?.isDefault ?? false
}

function setPendingVariantPublicPrice(variantLocalId: string, priceCents: number) {
  const variant = pendingVariants.value.find((v) => v._localId === variantLocalId)
  if (!variant) return

  variant.publicPriceCents = priceCents
  const publicPrice = variant.variantPrices.find((vp) => vp.priceListName === 'PUBLICO')
  if (publicPrice) {
    publicPrice.priceCents = priceCents
  }
}

function handleAddPendingPriceList() {
  const id = pendingPriceListSelection.value
  if (!id) return

  addPendingPriceList(id, 0)
  pendingPriceListSelection.value = ''
  isAddPriceListPickerOpen.value = false
}

function openTierPricesModal(priceListLocalId: string) {
  const list = pendingPriceLists.value.find((pl) => pl._localId === priceListLocalId)
  if (!list) return

  tierModalPriceListId.value = priceListLocalId
  tierRowErrors.value = {}
  tierRows.value = list.tierPrices.map((tier) => ({
    key: tierRowKeyCounter++,
    minQuantity: tier.minQuantity,
    price: centsToDecimalInput(tier.priceCents),
  }))
  isTierPricesModalOpen.value = true
}

function closeTierPricesModal() {
  isTierPricesModalOpen.value = false
  tierModalPriceListId.value = null
  tierRows.value = []
}

function addTierRow() {
  tierRows.value.push({ key: tierRowKeyCounter++, minQuantity: '', price: '' })
}

function removeTierRow(rowKey: number) {
  tierRows.value = tierRows.value.filter((row) => row.key !== rowKey)
}

function saveTierRows() {
  const targetId = tierModalPriceListId.value
  if (!targetId) return

  const list = pendingPriceLists.value.find((pl) => pl._localId === targetId)
  if (!list) return

  const read = readTierRows(tierRows.value)
  if ('errors' in read) {
    tierRowErrors.value = read.errors
    return
  }
  list.tierPrices = read.tiers.filter(
    (row) => Number.isInteger(row.minQuantity) && row.minQuantity >= 0,
  )
  closeTierPricesModal()
}

const mainForm = useTemplateRef('mainForm')

function saveFromIdentityBar() {
  void mainForm.value?.submit()
}

async function discardFormChanges() {
  const discard = await useConfirm().confirm({
    title: '¿Descartar los cambios?',
    description: 'Se pierden los cambios sin guardar del producto.',
    confirmLabel: 'Descartar',
    cancelLabel: 'Seguir editando',
    tone: 'danger',
  })
  if (!discard) return
  restoringForm.value = true
  if (isCreateMode.value) {
    resetCreateState()
    for (const gpl of globalPriceListOptions.value) addPendingPriceList(gpl.id, 0)
  } else if (pristineForm.value !== null) {
    Object.assign(formState, JSON.parse(pristineForm.value))
  }
  clearStockErrors()
  satKeyError.value = ''
  saveError.value = null
  mainForm.value?.clear()
  await nextTick()
  restoringForm.value = false
}

function handleSubmitMainForm(event: FormSubmitEvent<MainFormValues>) {
  if (!canSubmitMainForm.value) return

  if (isCreateMode.value) {
    createMutation.mutate(event.data)
    return
  }

  const payload = toUpdatePayload(event.data, pristineAdvanced.value ?? undefined)
  delete payload.priceCents
  // WU5 REQ-18: drives the surgical invalidation branch in updateMutation.
  lastSaveCatalogOnly.value = isCatalogOnlySave(event.data)
  updateMutation.mutate(payload)
}

// WU5 (REQ-15): granular supported-contexts intent from the advanced section.
function toggleSupportedContext(priceListId: string) {
  const ids = formState.supportedCatalogPriceListIds ?? []
  formState.supportedCatalogPriceListIds = ids.includes(priceListId)
    ? ids.filter((id) => id !== priceListId)
    : [...ids, priceListId]
}

function applyStockChange(value: {
  mode: OnlineStockPresentationMode | null
  customQuantity: number | null
}) {
  formState.onlineStockPresentation = value.mode
  formState.onlineStockPresentationCustomQty = value.customQuantity
}

// WU5 REQ-18: catalog-only PATCH invalidates ONLY productQueryKeys.detail;
// mixed changes keep the pre-existing invalidation set — catalog adds none.
const ADVANCED_CATALOG_KEYS = [
  'hidePriceInOnlineCatalog',
  'supportedCatalogPriceListIds',
  'onlineStockPresentation',
  'onlineStockPresentationCustomQty',
] as const

function isCatalogOnlySave(values: MainFormValues): boolean {
  const pristineProduct = product.value
  const pristineAdvancedSnapshot = pristineAdvanced.value
  if (!pristineProduct || !pristineAdvancedSnapshot) return false
  const pristineForm = productToFormInput(pristineProduct)
  const pristineRecord = pristineForm as unknown as Record<string, unknown>
  const ids = values.supportedCatalogPriceListIds ?? []
  const pristineIds = pristineAdvancedSnapshot.supportedCatalogPriceListIds
  const advancedChanged =
    (values.hidePriceInOnlineCatalog ?? false) !== pristineAdvancedSnapshot.hidePriceInOnlineCatalog ||
    (values.onlineStockPresentation ?? null) !== pristineAdvancedSnapshot.onlineStockPresentation ||
    (values.onlineStockPresentationCustomQty ?? null) !== pristineAdvancedSnapshot.onlineStockPresentationCustomQty ||
    ids.length !== pristineIds.length ||
    ids.some((id, index) => id !== pristineIds[index])
  if (!advancedChanged) return false
  return !Object.entries(values).some(([key, value]) => {
    if ((ADVANCED_CATALOG_KEYS as readonly string[]).includes(key)) return false
    if (key === 'serviceDetail') {
      return JSON.stringify(value) !== JSON.stringify(pristineForm.serviceDetail)
    }
    return value !== pristineRecord[key]
  })
}

function handleCreateCategory(name: string) {
  createCategoryMutation.mutate(name.trim())
}

function handleCreateBrand(name: string) {
  createBrandMutation.mutate(name.trim())
}

function handleCreateLot(event: FormSubmitEvent<LotFormState>) {
  if (!showLotsSection.value) return

  if (isCreateMode.value) {
    pendingLots.value.push({
      _localId: nextLocalId(),
      lotNumber: event.data.lotNumber,
      quantity: event.data.quantity,
      expirationDate: event.data.expirationDate,
      manufactureDate: event.data.manufactureDate ?? '',
    })
    resetLotForm()
    isLotModalOpen.value = false
    return
  }

  createLotMutation.mutate({
    lotNumber: event.data.lotNumber,
    quantity: event.data.quantity,
    expirationDate: event.data.expirationDate,
    ...(event.data.manufactureDate ? { manufactureDate: event.data.manufactureDate } : {}),
  })
}

function handleSubmitVariant(event: FormSubmitEvent<VariantFormState>) {
  const showInventory = inventoryFieldsVisible(formState.type)
  const option = resolveVariantOption(event.data.option, event.data.customOption)
  if (!option) {
    toast.add({
      title: 'Opción requerida',
      description: 'Ingresa una opción personalizada.',
      color: 'error',
    })
    return
  }

  if (isCreateMode.value) {
    const costCents = moneyTextToCents(event.data.purchaseCost)

    // Local CRUD for create mode
    if (editingVariantId.value) {
      const index = pendingVariants.value.findIndex((v) => v._localId === editingVariantId.value)
      if (index !== -1) {
        pendingVariants.value[index] = {
          ...pendingVariants.value[index]!,
          option,
          value: event.data.value,
          // SERVICE drops inventory fields; mirror backend hygiene.
          ...(showInventory ? { sku: event.data.sku, barcode: event.data.barcode } : {}),
          quantity: showInventory ? event.data.quantity : 0,
          minQuantity: showInventory ? event.data.minQuantity : 0,
          purchaseNetCostCents: costCents,
        }
      }
    } else {
      pendingVariants.value.push({
        _localId: nextLocalId(),
        option,
        value: event.data.value,
        sku: showInventory ? event.data.sku : '',
        barcode: showInventory ? event.data.barcode : '',
        quantity: showInventory ? event.data.quantity : 0,
        minQuantity: showInventory ? event.data.minQuantity : 0,
        purchaseNetCostCents: costCents,
        publicPriceCents: 0,
        variantPrices: pendingPriceLists.value.map((pl) => ({
          priceListId: pl.priceListId,
          priceListName: pl.priceListName,
          priceCents: 0,
          tierPrices: [],
        })),
      })
    }
    resetVariantForm()
    isVariantModalOpen.value = false
    return
  }

  const costCentsEdit = moneyTextToCents(event.data.purchaseCost) ?? undefined

  const payload: UpdateVariantPayload = {
    option,
    value: event.data.value,
    ...(showInventory && event.data.sku ? { sku: event.data.sku } : {}),
    ...(showInventory && event.data.barcode ? { barcode: event.data.barcode } : {}),
    ...(showInventory ? { minQuantity: event.data.minQuantity } : {}),
    ...(costCentsEdit != null ? { purchaseNetCostCents: costCentsEdit } : {}),
  }

  // O1 S1: a saved variant is edited without quantity (read-only, adjusted from
  // Inventario); only a new variant is created with its initial stock.
  if (editingVariantId.value) {
    updateVariantMutation.mutate({ variantId: editingVariantId.value, values: payload })
    return
  }

  const createPayload: CreateVariantPayload = {
    ...payload,
    quantity: showInventory ? event.data.quantity : 0,
  }
  if (firstVariantZeroesStock.value) {
    firstVariantConfirm.value = { open: true, payload: createPayload }
    return
  }
  createVariantMutation.mutate(createPayload)
}

function handleOpenVariantDetailModal(variant: ProductVariant) {
  variantDetailModalVariant.value = variant
  isVariantDetailModalOpen.value = true
}

function handleVariantDetailModalOpenChange(isOpen: boolean) {
  isVariantDetailModalOpen.value = isOpen
}

function handleOpenVariantImageModal(variant: ProductVariant) {
  variantImageModalVariant.value = variant
  isVariantImageModalOpen.value = true
}

function handleVariantImageModalOpenChange(isOpen: boolean) {
  isVariantImageModalOpen.value = isOpen
}

function handleInlineVariantPublicPriceBlur(variant: ProductVariant, nextPriceCents: number) {
  if (!canUpdateProduct.value) return

  const publicPrice = getPublicPrice(variant)
  if (!publicPrice) return

  if (nextPriceCents === publicPrice.priceCents) return

  const tierPricesPayload =
    publicPrice.tierPrices.length > 0
      ? publicPrice.tierPrices.map((t) => ({
          minQuantity: t.minQuantity,
          priceCents: t.priceCents,
        }))
      : undefined

  productApi
    .upsertVariantPrice(productIdOrEmpty.value, variant.id, publicPrice.priceListId, {
      priceCents: nextPriceCents,
      ...(tierPricesPayload ? { tierPrices: tierPricesPayload } : {}),
    })
    .then(async () => {
      toast.add({
        title: 'Precio actualizado',
        description: 'El precio público se guardó correctamente.',
        color: 'success',
      })
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(tenantId.value, productIdOrEmpty.value),
      })
    })
    .catch((error: unknown) => {
      toast.add({
        title: 'Error al guardar precio',
        description: mapDomainError(error as AxiosError<DomainApiError>),
        color: 'error',
      })
    })
}

async function handleDeleteVariant(variantId: string, variantName: string) {
  if (isCreateMode.value) {
    openConfirm(`¿Quieres eliminar la variante ${variantName}?`, () => {
      pendingVariants.value = pendingVariants.value.filter((v) => v._localId !== variantId)
    })
    return
  }

  if (!canDeleteProduct.value) return

  openConfirm(`¿Quieres eliminar la variante ${variantName}?`, () => {
    void deleteVariantMutation.mutateAsync(variantId).then(() => {
      if (variantDetailModalVariant.value?.id === variantId) {
        isVariantDetailModalOpen.value = false
        variantDetailModalVariant.value = null
      }
    })
  })
}

function getVariantLabel(variant: ProductVariant): string {
  const option = variant.option?.trim()
  const value = variant.value?.trim() || variant.name

  if (!option) return value
  return `${option}: ${value}`
}

async function handleDeleteLot(lotId: string, lotNumber: string) {
  if (isCreateMode.value) {
    openConfirm(`¿Quieres eliminar el lote ${lotNumber}?`, () => {
      pendingLots.value = pendingLots.value.filter((l) => l._localId !== lotId)
    })
    return
  }

  if (!canDeleteProduct.value) return

  openConfirm(`¿Quieres eliminar el lote ${lotNumber}?`, () => {
    deleteLotMutation.mutate(lotId)
  })
}

function handleEditLotPlaceholder() {
  toast.add({
    title: 'Próximamente',
    description: 'La edición de lotes estará disponible en una próxima iteración.',
    color: 'warning',
  })
}

// ── Presentational tables: row models and the actions they emit ──────────────

const variantTableRows = computed<ProductVariantRow[]>(() =>
  isCreateMode.value
    ? pendingVariants.value.map((pv) => ({
        id: pv._localId,
        label: pv.option ? `${pv.option}: ${pv.value}` : pv.value,
        sku: pv.sku,
        barcode: pv.barcode,
        quantity: pv.quantity,
        priceCents: pv.publicPriceCents,
        deleteName: pv.value || pv.option,
      }))
    : variantsList.value.map((variant) => ({
        id: variant.id,
        label: getVariantLabel(variant),
        sku: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        quantity: variant.quantity,
        priceCents: getPublicPrice(variant)?.priceCents ?? 0,
        deleteName: variant.name,
      })),
)

function findSavedVariant(variantId: string): ProductVariant | undefined {
  return variantsList.value.find((variant) => variant.id === variantId)
}

// O1 S1: only a pending variant (create mode) has an editable stock; a saved
// variant's stock is read-only and moves through an adjustment.
function handleVariantQuantityUpdate(id: string, value: number | undefined) {
  if (!isCreateMode.value) return
  const pending = pendingVariants.value.find((pv) => pv._localId === id)
  if (pending) pending.quantity = value ?? 0
}

function handleVariantPriceCommit(id: string, cents: number) {
  if (isCreateMode.value) {
    setPendingVariantPublicPrice(id, cents)
    return
  }
  const variant = findSavedVariant(id)
  if (variant) handleInlineVariantPublicPriceBlur(variant, cents)
}

function handleVariantAction(key: string, id: string) {
  const variant = findSavedVariant(id)
  const pending = pendingVariants.value.find((pv) => pv._localId === id)
  if (key === 'photos' && variant) handleOpenVariantImageModal(variant)
  else if (key === 'details') {
    if (isCreateMode.value) openPendingVariantDetailModal(id)
    else if (variant) handleOpenVariantDetailModal(variant)
  } else if (key === 'edit') openEditVariantModal(id)
  else if (key === 'delete') {
    if (isCreateMode.value && pending) void handleDeleteVariant(id, pending.value || pending.option)
    else if (variant) void handleDeleteVariant(id, variant.name)
  }
}

const lotTableRows = computed<ProductLotRow[]>(() =>
  isCreateMode.value
    ? pendingLots.value.map((lot) => ({
        id: lot._localId,
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate,
        quantity: lot.quantity,
      }))
    : lotsList.value.map((lot) => ({
        id: lot.id,
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate,
        quantity: lot.quantity,
      })),
)

function handleLotTableDelete(lot: ProductLotRow) {
  void handleDeleteLot(lot.id, lot.lotNumber)
}

const pendingPriceListRows = computed<ProductPriceRow[]>(() =>
  pendingPriceLists.value.map((pl) => ({
    id: pl._localId,
    name: pl.priceListName,
    priceCents: pl.priceCents,
    removable: !isDefaultPriceList(pl.priceListId),
  })),
)

function handlePendingPriceListAction(key: string, id: string) {
  if (key === 'tiers') openTierPricesModal(id)
  else if (key === 'remove') removePendingPriceList(id)
}

const pendingVariantCostCents = computed(() => moneyTextToCents(pendingVariantDetailState.purchaseCost) ?? 0)

const pendingVariantPriceRows = computed<ProductPriceRow[]>(() =>
  pendingVariantDetailState.prices.map((price) => ({
    id: price.priceListId,
    name: price.priceListName,
    priceCents: price.priceCents,
    removable: false,
  })),
)

function updatePendingVariantDetailPrice(priceListId: string, priceCents: number) {
  const price = pendingVariantDetailState.prices.find((p) => p.priceListId === priceListId)
  if (price) price.priceCents = priceCents
}

function handlePendingVariantPriceAction(key: string, priceListId: string) {
  if (key === 'tiers') openPendingVariantTierPricesModal(priceListId)
}
</script>

<template>
  <div class="hf-theme hf-ui product-workspace -m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
    <div class="product-workspace-header shrink-0 border-b border-default px-4 py-4 sm:px-6 lg:px-10">
      <div class="mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-4">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Volver a productos"
            @click="handleBack"
          />
          <div class="min-w-0">
            <div
              v-if="showWorkspace && !isCreateMode && productStatus"
              class="product-header-meta mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted"
            >
              <StatusBadge :label="productStatus.label" :tone="productStatus.tone" />
              <span v-if="product?.updatedAt">Actualizado {{ formatShortDateTime(product.updatedAt) }}</span>
            </div>
            <h1 class="hf-page-title line-clamp-2 break-words">
              {{ isCreateMode ? createModeTitle : showWorkspace ? formState.name || 'Producto' : 'Producto' }}
            </h1>
          </div>
        </div>

        <div v-if="showHeaderSave" class="max-md:hidden">
          <UButton
            :label="isCreateMode ? createModeSubmitLabel : 'Guardar cambios'"
            type="submit"
            form="product-detail-form"
            :loading="updateMutation.isPending.value || createMutation.isPending.value"
            :disabled="headerSaveDisabled"
            color="primary"
            class="hf-primary-control"
          />
        </div>
      </div>
    </div>

    <!-- On Contenido and Identidad the save bar is the last thing in the scroll, flush to its bottom edge: no padding under it. -->
    <div
      class="mx-auto flex w-full min-w-0 max-w-[1480px] flex-1 flex-col gap-6 overflow-y-auto px-4 pt-6 sm:px-6 lg:px-10"
      :class="isEditorialTask || showIdentitySaveBar ? 'pb-0' : 'pb-6'"
    >
      <EmptyState
        v-if="isProductNotFound"
        title="No encontramos el producto"
        description="Pudo haberse eliminado o el enlace no es correcto."
        action-label="Volver a productos"
        action-icon="i-lucide-arrow-left"
        @action="handleBack"
      />

      <EmptyState
        v-else-if="!isCreateMode && isProductError"
        kind="error"
        title="No se pudo cargar el producto"
        description="Inténtalo de nuevo en un momento."
        action-label="Reintentar"
        @action="refetchProduct"
      />

      <ProductDetailSkeleton v-else-if="!isCreateMode && isLoadingProduct" />

      <div v-else class="product-workspace-grid">
        <div class="min-w-0">
        <ProductWorkspaceNavigation
          :active-task="activeTask"
          :show-inventory="showInventoryTask"
          @select="activeTask = $event"
        />
        <section
          v-if="isEditorialTask && !canAccessEditorial"
          data-testid="editorial-unavailable"
          class="rounded-lg border border-default bg-default p-6"
          aria-labelledby="editorial-unavailable-title"
        >
          <h2 id="editorial-unavailable-title" class="text-base font-semibold">
            Contenido editorial
          </h2>
          <p class="mt-2 text-sm text-muted">
            {{ editorialUnavailableReason }}
          </p>
        </section>
        <EditorialWorkspace
          v-if="editorialVisited && canAccessEditorial"
          v-show="isEditorialTask"
          :product-id="productIdOrEmpty"
          :embedded="true"
        />
        <InventoryStockPanel
          v-if="inventoryVisited && showInventoryTask"
          v-show="activeTask === 'inventory'"
          :product-id="productIdOrEmpty"
        />
        <UForm
          id="product-detail-form"
          ref="mainForm"
          class="min-w-0"
          :schema="productFormSchema"
          :state="formState"
          @submit="handleSubmitMainForm"
          @error="revealInvalidTask"
        >
        <fieldset :disabled="isFormReadonly" class="min-w-0 space-y-6">
          <div v-show="activeTask === 'identity'" data-product-task="identity" class="product-identity">
            <HfSectionCard id="product-identity-what" title="Qué es" :heading-level="2">
              <HfFieldGrid>
                <UFormField v-slot="{ error }" name="type" :error="false" span="full">
                  <HfFormField
                    label="Tipo"
                    label-id="product-type-label"
                    help="Un servicio no lleva inventario."
                    :error="fieldError(error)"
                  >
                    <HfSegmented
                      :items="TYPE_ITEMS"
                      :model-value="formState.type"
                      labelledby="product-type-label"
                      :disabled="isFormReadonly"
                      @update:model-value="formState.type = $event as ProductFormInput['type']"
                    />
                    <p
                      v-if="stockErrors.type"
                      class="hf-form-field__message"
                      data-tone="error"
                      role="alert"
                      data-testid="type-error"
                    >
                      {{ stockErrors.type }}
                    </p>
                  </HfFormField>
                </UFormField>

                <UFormField v-slot="{ error }" name="name" :error="false" span="full">
                  <HfFormField label="Nombre" for="product-name" required required-label="Obligatorio" :error="fieldError(error)">
                    <UInput v-model="formState.name" class="w-full" id="product-name" placeholder="Ej: Jabón de mano" />
                  </HfFormField>
                </UFormField>

                <UFormField v-slot="{ error }" name="unit" :error="false">
                  <HfFormField label="Unidad" label-id="product-unit-label" :error="fieldError(error)">
                    <HfCombobox
                      id="product-unit"
                      label="Unidad"
                      :items="unitItems"
                      :model-value="formState.unit"
                      :invalid="Boolean(fieldError(error))"
                      :disabled="isFormReadonly"
                      @update:model-value="formState.unit = fromChoice($event) || formState.unit"
                    />
                  </HfFormField>
                </UFormField>

                <UFormField v-slot="{ error }" name="categoryId" :error="false">
                  <HfFormField label="Categoría" label-id="product-category-label" :error="fieldError(error)">
                    <HfCombobox
                      id="product-category"
                      label="Categoría"
                      placeholder="Sin categoría"
                      :items="categoryItems"
                      :model-value="formState.categoryId || null"
                      :actions="categoryActions"
                      :invalid="Boolean(fieldError(error))"
                      :disabled="isFormReadonly"
                      @update:model-value="formState.categoryId = fromChoice($event)"
                      @action="openCreateCategoryModal"
                    />
                  </HfFormField>
                </UFormField>

                <UFormField v-if="showInventoryFields" v-slot="{ error }" name="brandId" :error="false">
                  <HfFormField label="Marca" label-id="product-brand-label" :error="fieldError(error)">
                    <HfCombobox
                      id="product-brand"
                      label="Marca"
                      placeholder="Sin marca"
                      :items="brandItems"
                      :model-value="formState.brandId || null"
                      :actions="brandActions"
                      :invalid="Boolean(fieldError(error))"
                      :disabled="isFormReadonly"
                      @update:model-value="formState.brandId = fromChoice($event)"
                      @action="openCreateBrandModal"
                    />
                  </HfFormField>
                </UFormField>

                <UFormField v-slot="{ error }" name="location" :error="false">
                  <HfFormField :label="locationFieldLabel" for="product-location" :error="fieldError(error)">
                    <UInput
                      v-model="formState.location"
                      class="w-full"
                      id="product-location"
                      :placeholder="formState.type === 'SERVICE' ? 'Ej: Zona de guardería' : 'Ej: Estante 3B'"
                    />
                  </HfFormField>
                </UFormField>

                <UFormField v-slot="{ error }" name="description" :error="false" span="full">
                  <HfFormField
                    label="Descripción"
                    for="product-description"
                    :hint="`${formState.description.length} de 2000`"
                    :error="fieldError(error)"
                  >
                    <UTextarea
                      v-model="formState.description"
                      id="product-description"
                      :rows="4"
                      class="w-full"
                      placeholder="Agregar una descripción..."
                    />
                  </HfFormField>
                </UFormField>
              </HfFieldGrid>
            </HfSectionCard>

            <HfSectionCard id="product-identity-codes" title="Códigos" :heading-level="2">
              <HfFieldGrid>
                <UFormField v-if="showInventoryFields" v-slot="{ error }" name="barcode" :error="false">
                  <HfFormField label="Código de barras" for="product-barcode" :error="fieldError(error)">
                    <UInput v-model="formState.barcode" class="w-full" id="product-barcode" placeholder="Opcional" />
                  </HfFormField>
                </UFormField>

                <UFormField v-if="showInventoryFields" v-slot="{ error }" name="sku" :error="false">
                  <HfFormField label="SKU" for="product-sku" :error="fieldError(error)">
                    <UInput v-model="formState.sku" class="w-full" id="product-sku" placeholder="Opcional" />
                  </HfFormField>
                </UFormField>

                <UFormField name="satKey" :error="false" span="full">
                  <HfFormField label="Clave SAT" for="product-sat-key">
                    <SatKeySelect id="product-sat-key" v-model="formState.satKey" :error="satKeyError" />
                  </HfFormField>
                </UFormField>
              </HfFieldGrid>
            </HfSectionCard>

            <HfSectionCard id="product-identity-channels" title="Dónde se vende" :heading-level="2">
              <ul class="product-toggle-list">
                <li v-for="toggle in channelToggles" :key="toggle.key" class="product-toggle-row">
                  <span class="product-toggle-row__text">
                    <label :for="`product-${toggle.key}`" class="product-toggle-row__label">{{ toggle.label }}</label>
                    <span class="product-toggle-row__description">{{ toggle.description }}</span>
                  </span>
                  <USwitch :id="`product-${toggle.key}`" v-model="formState[toggle.key]" />
                </li>
              </ul>
            </HfSectionCard>

            <div v-if="showIdentitySaveBar" class="product-identity-save" data-testid="identity-save-bar">
              <HfSaveBar
                :dirty-count="dirtyCount"
                :saving="isSaving"
                :saved-at="isCreateMode ? null : savedAt"
                :error="saveError"
                :save-label="isCreateMode ? createModeSubmitLabel : 'Guardar'"
                @save="saveFromIdentityBar"
                @discard="discardFormChanges"
              />
            </div>
          </div>
          <div v-show="activeTask === 'presentations'" data-product-task="presentations" class="space-y-6">
          <UCard v-if="showInventoryFields">
            <template #header>
              <h2 class="text-base font-semibold">Precio de compra</h2>
            </template>

            <div class="space-y-4">
              <URadioGroup
                v-model="formState.purchaseCostMode"
                orientation="horizontal"
                :items="[
                  { label: 'Neto', description: 'Sin impuestos', value: 'NET' },
                  { label: 'Bruto', description: 'Con impuestos', value: 'GROSS' },
                ]"
              />

              <USeparator class="my-4" />

              <UFormField label="" name="purchaseCost">
                <div class="relative w-full md:max-w-md">
                  <span
                    class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted"
                    >$</span
                  >
                  <UInput
                    v-model="formState.purchaseCost"
                    inputmode="decimal"
                    placeholder="0.00"
                    class="w-full"
                    :ui="{ base: 'pl-7 pr-24' }"
                  />
                  <span
                    class="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-xs text-muted"
                    >por Unidad</span
                  >
                </div>
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-base font-semibold">Impuestos</h2>
            </template>

            <div class="space-y-4">
              <USwitch
                v-model="formState.chargeProductTaxes"
                label="Cobrar impuestos"
                description="Aplicar IVA e IEPS a este producto"
              />

              <div
                v-if="formState.chargeProductTaxes"
                class="grid grid-cols-1 gap-4 md:grid-cols-2"
              >
                <UFormField label="IVA" name="ivaRate">
                  <USelect
                    v-model="formState.ivaRate"
                    :items="IVA_OPTIONS"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="IEPS" name="iepsRate">
                  <USelect
                    v-model="formState.iepsRate"
                    :items="IEPS_OPTIONS"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard v-if="showServiceDetailCard">
            <template #header>
              <h2 class="text-base font-semibold">Detalles del servicio</h2>
            </template>

            <div class="space-y-4">
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField
                  label="Capacidad (informativo)"
                  name="serviceDetail.capacity"
                  description="Cantidad máxima de servicio simultáneo (referencia)."
                >
                  <UInputNumber
                    v-model="formState.serviceDetail.capacity"
                    :min="1"
                    class="w-full md:max-w-xs"
                    placeholder="Ej: 3"
                  />
                </UFormField>
              </div>

              <UFormField
                label="Notas del servicio"
                name="serviceDetail.notes"
                description="Información adicional que verá el equipo (máx. 500 caracteres)."
              >
                <UTextarea
                  v-model="formState.serviceDetail.notes"
                  :rows="4"
                  :maxlength="500"
                  class="w-full"
                  placeholder="Ej: Paseo de 60 minutos por parque..."
                />
              </UFormField>
            </div>
          </UCard>

          <UCard v-if="showInventoryCard">
            <template #header>
              <h2 class="text-base font-semibold">Inventario</h2>
            </template>

            <div class="space-y-4">
              <div class="space-y-1">
                <USwitch
                  v-model="formState.useStock"
                  :disabled="useStockLocked"
                  label="Controlar inventario"
                  description="Activar seguimiento de existencias y cantidad mínima"
                />
                <p
                  v-if="useStockLocked"
                  class="text-xs text-muted"
                  data-testid="use-stock-locked-reason"
                >
                  Hay existencias: ajusta el stock a 0 para desactivarlo.
                </p>
                <p
                  v-if="stockErrors.useStock"
                  class="text-xs text-[var(--hf-danger)]"
                  role="alert"
                  data-testid="use-stock-error"
                >
                  {{ stockErrors.useStock }}
                </p>
              </div>

              <div v-if="showManualStockFields" class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="Existencias" name="quantity">
                  <ReadOnlyStock
                    v-if="!isCreateMode"
                    :value="formState.quantity"
                    label="Existencias"
                    data-testid="product-detail-stock-readonly"
                  />
                  <template v-else>
                    <UInputNumber v-model="formState.quantity" :min="0" class="w-full" />
                    <p class="mt-1 text-xs text-muted">Unidades</p>
                  </template>
                  <p
                    v-if="stockErrors.quantity"
                    class="mt-1 text-xs text-[var(--hf-danger)]"
                    role="alert"
                    data-testid="quantity-error"
                  >
                    {{ stockErrors.quantity }}
                  </p>
                </UFormField>

                <UFormField label="Existencias mínimas" name="minQuantity">
                  <UInputNumber v-model="formState.minQuantity" :min="0" class="w-full" />
                  <p class="mt-1 text-xs text-muted">Unidades</p>
                </UFormField>
              </div>

              <USeparator class="my-4" />

              <USwitch
                v-if="showLotsCheckbox"
                v-model="formState.useLotsAndExpirations"
                label="Usar lotes y vencimientos"
                description="Agrupar unidades por lote y fecha de expiración"
              />

              <p v-if="showStockByVariantMessage" class="text-sm text-muted">
                El stock se gestiona por variante
              </p>

              <USeparator class="my-4" />

              <USwitch
                v-model="formState.hasVariants"
                label="Tiene variantes"
                description="Talles, colores u otras opciones"
              />
            </div>
          </UCard>

              <!-- WU5 REQ-14: advanced catalog section, rendered only with
                   update:Product (never with settings-read substituting it). -->
              <ProductCatalogSettingsSection
                v-if="!isCreateMode && canUpdateProduct"
                data-testid="product-catalog-settings"
                :hide-price-in-online-catalog="formState.hidePriceInOnlineCatalog ?? false"
                :supported-catalog-price-list-ids="formState.supportedCatalogPriceListIds ?? []"
                :supports-all-catalog-price-lists="product?.supportsAllCatalogPriceLists ?? false"
                :online-stock-presentation="formState.onlineStockPresentation ?? null"
                :online-stock-presentation-custom-qty="formState.onlineStockPresentationCustomQty ?? null"
                :contexts="tenantPublicContexts"
                :can-read-settings="canReadSettings"
                :settings-loading="settingsLoading"
                :settings-error="settingsError"
                @toggle-hide-price="formState.hidePriceInOnlineCatalog = $event"
                @stock-change="applyStockChange"
                @toggle-context="toggleSupportedContext"
              />

              <UCard v-if="showVariantsSection">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-base font-semibold">Variantes</h2>
                <UButton
                  label="Agregar variante"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  :disabled="!isCreateMode && !canUpdateProduct"
                  @click="openAddVariantModal"
                />
              </div>
            </template>

            <!-- SERVICE: the "Tiene variantes" switch lives inside the
                 PRODUCT-only Inventario card. For SERVICE (no inventory) it
                 must be exposed here, otherwise pending variants are collected
                 but never attached to the create payload (hasVariants stays
                 false → buildFullCreatePayload skips base.variants). -->
            <div v-if="isService(formState.type)" class="mb-4">
              <USwitch
                v-model="formState.hasVariants"
                label="Tiene variantes"
                description="Opciones de tu servicio"
              />
            </div>

            <div v-if="variantGroups.length > 0" class="mb-4 space-y-3">
              <div
                v-for="group in variantGroups"
                :key="group.option"
                class="rounded-md border border-default bg-elevated/20 p-3"
              >
                <p class="text-xs font-semibold text-muted">
                  {{ group.option }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span
                    v-for="value in group.values"
                    :key="`${group.option}-${value}`"
                    class="rounded-md bg-elevated px-2 py-0.5 text-xs font-medium"
                  >
                    {{ value }}
                  </span>
                </div>
              </div>
            </div>

            <ProductVariantsTable
              :rows="variantTableRows"
              :pending="isCreateMode"
              :show-stock="formState.useStock"
              :loading="!isCreateMode && isFetchingVariants"
              :error="!isCreateMode && isVariantsError"
              :can-update="canUpdateProduct"
              :can-delete="canDeleteProduct"
              @update-quantity="handleVariantQuantityUpdate"
              @commit-price="handleVariantPriceCommit"
              @action="handleVariantAction"
              @retry="refetchVariants()"
            />
          </UCard>

          <UCard v-if="showLotsSection">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-base font-semibold">Lotes</h2>
                <UButton
                  label="Agregar lote"
                  icon="i-lucide-plus"
                  color="neutral"
                  variant="outline"
                  :disabled="!isCreateMode && !canUpdateProduct"
                  @click="isLotModalOpen = true"
                />
              </div>
            </template>

            <div class="space-y-3">
              <p
                v-if="stockErrors.lots"
                class="text-sm text-[var(--hf-danger)]"
                role="alert"
                data-testid="lot-error"
              >
                {{ stockErrors.lots }}
              </p>
              <ProductLotsTable
                :lots="lotTableRows"
                :pending="isCreateMode"
                :loading="!isCreateMode && isFetchingLots"
                :error="!isCreateMode && isLotsError"
                :can-delete="canDeleteProduct"
                @edit="handleEditLotPlaceholder"
                @delete="handleLotTableDelete"
                @retry="refetchLots()"
              />

              <USeparator class="my-4" />

              <UFormField label="Existencias mínimas" name="minQuantity">
                <UInputNumber v-model="formState.minQuantity" :min="0" class="w-full md:max-w-xs" />
                <p class="mt-1 text-xs text-muted">Unidades</p>
              </UFormField>
            </div>
          </UCard>

          <!-- Create mode: inline price list management -->
          <UCard v-if="isCreateMode">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-base font-semibold">Listas de precios</h2>
              </div>
            </template>

            <div class="space-y-4">
              <div v-if="isAddPriceListPickerOpen && availablePriceListOptions.length > 0" class="flex items-end gap-3">
                <UFormField label="Agregar lista de precios" class="flex-1">
                  <USelect
                    v-model="pendingPriceListSelection"
                    :items="availablePriceListOptions.map((gpl) => ({ label: gpl.name, value: gpl.id }))"
                    placeholder="Seleccionar lista..."
                    size="lg"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  type="button"
                  label="Agregar"
                  color="neutral"
                  variant="outline"
                  :disabled="!pendingPriceListSelection"
                  @click="handleAddPendingPriceList"
                />
              </div>
              <p v-else-if="globalPriceListOptions.length === 0" class="text-sm text-muted">
                No hay listas de precios globales. Se crearán automáticamente al guardar.
              </p>
              <p v-else class="text-sm text-muted">
                Todas las listas de precios están asignadas.
              </p>

              <ProductPriceMarginTable
                v-if="pendingPriceLists.length > 0"
                :rows="pendingPriceListRows"
                :cost-cents="getPendingCostCents()"
                @update-price="updatePendingPriceListPrice"
                @action="handlePendingPriceListAction"
              />

              <UButton
                v-if="availablePriceListOptions.length > 0 && !isAddPriceListPickerOpen"
                type="button"
                icon="i-lucide-plus"
                label="Agregar lista de precios"
                color="neutral"
                variant="ghost"
                class="text-(--hf-active)"
                @click="isAddPriceListPickerOpen = true"
              />
            </div>
          </UCard>

          <!-- Edit mode: full price list management -->
          <PriceListSection
            v-if="!isCreateMode"
            :product-id="productIdOrEmpty"
            :can-update="canUpdateProduct"
            :can-delete="canDeleteProduct"
          />

          <ProductImageGallery
            v-if="!isCreateMode"
            :product-id="productIdOrEmpty"
            :variants="variantsList"
            :can-update="canUpdateProduct"
            :can-delete="canDeleteProduct"
          />
          </div>
        </fieldset>
      </UForm>
        </div>

        <ProductSummaryPanel
          :name="formState.name"
          :image-url="previewMainImage?.url"
          :is-product="formState.type === 'PRODUCT'"
          :sell-in-pos="formState.sellInPos"
          :include-in-online-catalog="formState.includeInOnlineCatalog"
          :price-cents="previewPublicPriceCents"
          :cost-cents="previewCostCents"
          :margin-percent="previewMarginPercent"
          :stock-total="previewStockTotal"
          :checklist="previewChecklistItems"
          :completed-items="previewCompletedItems"
          :applicable-items="previewApplicableChecklistItems.length"
          :completion-percent="previewCompletionPercent"
        />
      </div>
    </div>

    <!-- Mobile: the single primary lives in the sticky bottom bar. -->
    <div
      v-if="showHeaderSave"
      class="product-action-bar shrink-0 md:hidden"
      data-testid="mobile-action-bar"
    >
      <button
        type="submit"
        form="product-detail-form"
        class="product-bar-primary"
        :disabled="headerSaveDisabled || isSaving"
      >
        {{ isCreateMode ? createModeSubmitLabel : 'Guardar cambios' }}
      </button>
    </div>

    <UModal
      v-model:open="isTierPricesModalOpen"
      title="Precios por cantidad"
      :content="{ class: 'hf-theme hf-ui sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <p class="font-semibold">
            {{ pendingPriceLists.find((pl) => pl._localId === tierModalPriceListId)?.priceListName ?? '' }}
          </p>

          <div class="space-y-3">
            <div
              v-for="row in tierRows"
              :key="row.key"
              class="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 rounded-md border border-default p-2"
            >
              <UInputNumber v-model="row.minQuantity" :min="0" class="w-full" />
              <span class="text-sm text-muted">o más</span>
              <div>
                <UInput
                  v-model="row.price"
                  inputmode="decimal"
                  placeholder="0.00"
                  class="w-full"
                  aria-label="Precio por unidad"
                  :aria-invalid="tierRowErrors[row.key] ? 'true' : undefined"
                  :aria-describedby="tierRowErrors[row.key] ? `tier-${row.key}-message` : undefined"
                />
                <p
                  v-if="tierRowErrors[row.key]"
                  :id="`tier-${row.key}-message`"
                  class="hf-form-field__message"
                  data-tone="error"
                >
                  {{ tierRowErrors[row.key] }}
                </p>
              </div>
              <UButton
                type="button"
                icon="i-lucide-trash"
                color="error"
                variant="ghost"
                aria-label="Quitar este precio por cantidad"
                @click="removeTierRow(row.key)"
              />
            </div>
          </div>

          <UButton
            type="button"
            icon="i-lucide-plus"
            label="Agregar"
            color="neutral"
            variant="ghost"
            @click="addTierRow"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="closeTierPricesModal"
          />
          <UButton
            type="button"
            label="Guardar"
            color="primary"
            class="hf-primary-control"
            @click="saveTierRows"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isPendingVariantDetailModalOpen"
      title="Editar variante"
      :content="{ class: 'hf-theme hf-ui sm:max-w-4xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <UCard>
            <template #header>
              <h3 class="font-semibold">General</h3>
            </template>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField v-if="inventoryFieldsVisible(formState.type)" label="SKU">
                <UInput v-model="pendingVariantDetailState.sku" placeholder="SKU" />
              </UFormField>
              <UFormField v-if="inventoryFieldsVisible(formState.type)" label="Código de barras">
                <UInput v-model="pendingVariantDetailState.barcode" placeholder="Código de barras" />
              </UFormField>
              <UFormField label="Costo (del producto)" class="md:col-span-2">
                <div class="relative">
                  <span class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted"
                    >$</span
                  >
                  <UInput
                    v-model="pendingVariantDetailState.purchaseCost"
                    inputmode="decimal"
                    class="w-full"
                    :ui="{ base: 'pl-7 pr-24' }"
                    aria-label="Costo (del producto)"
                    :aria-invalid="pendingVariantCostError ? 'true' : undefined"
                    :aria-describedby="pendingVariantCostError ? 'pending-variant-cost-message' : undefined"
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-xs text-muted"
                    >por Unidad</span
                  >
                </div>
                <p
                  v-if="pendingVariantCostError"
                  id="pending-variant-cost-message"
                  class="hf-form-field__message"
                  data-tone="error"
                >
                  {{ pendingVariantCostError }}
                </p>
                <p class="mt-1 text-xs text-muted">Ingresa un valor para definir costo propio de esta variante</p>
              </UFormField>
            </div>
          </UCard>

          <UCard v-if="inventoryFieldsVisible(formState.type)">
            <template #header>
              <h3 class="font-semibold">Existencias</h3>
            </template>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField label="Cantidad">
                <UInputNumber v-model="pendingVariantDetailState.quantity" :min="0" class="w-full" />
              </UFormField>
              <UFormField label="Cantidad mínima">
                <UInputNumber v-model="pendingVariantDetailState.minQuantity" :min="0" class="w-full" />
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="font-semibold">Precios</h3>
            </template>
            <ProductPriceMarginTable
              :rows="pendingVariantPriceRows"
              :cost-cents="pendingVariantCostCents"
              @update-price="updatePendingVariantDetailPrice"
              @action="handlePendingVariantPriceAction"
            />
          </UCard>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton type="button" label="Cancelar" color="neutral" variant="outline" @click="closePendingVariantDetailModal" />
          <UButton type="button" label="Guardar" color="primary" class="hf-primary-control" @click="savePendingVariantDetailModal" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isPendingVariantTierModalOpen"
      title="Precios por cantidad"
      :content="{ class: 'hf-theme hf-ui sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ pendingVariantDetailName }}</span>
            <span class="rounded-md bg-elevated px-2 py-0.5 text-xs font-medium">{{ pendingVariantTierPriceListName }}</span>
          </div>

          <div class="space-y-3">
            <div
              v-for="row in pendingVariantTierRows"
              :key="row.key"
              class="grid grid-cols-1 gap-3 rounded-md border border-default p-3 md:grid-cols-[1fr_1fr_auto]"
            >
              <div class="flex items-center gap-2">
                <UInputNumber v-model="row.minQuantity" :min="0" class="flex-1" />
                <span class="shrink-0 text-xs text-muted">o más</span>
              </div>

              <div>
                <div class="relative">
                  <span
                    class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted"
                    >$</span
                  >
                  <UInput
                    v-model="row.price"
                    inputmode="decimal"
                    class="w-full"
                    :ui="{ base: 'pl-7 pr-24' }"
                    aria-label="Precio por unidad"
                    :aria-invalid="pendingVariantTierRowErrors[row.key] ? 'true' : undefined"
                    :aria-describedby="pendingVariantTierRowErrors[row.key] ? `pending-tier-${row.key}-message` : undefined"
                  />
                  <span
                    class="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-xs text-muted"
                    >por Unidad</span
                  >
                </div>
                <p
                  v-if="pendingVariantTierRowErrors[row.key]"
                  :id="`pending-tier-${row.key}-message`"
                  class="hf-form-field__message"
                  data-tone="error"
                >
                  {{ pendingVariantTierRowErrors[row.key] }}
                </p>
              </div>

              <div class="flex justify-end md:justify-center">
                <UButton
                  type="button"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  aria-label="Quitar este precio por cantidad"
                  @click="removePendingVariantTierRow(row.key)"
                />
              </div>
            </div>
          </div>

          <UButton
            type="button"
            label="+ Agregar"
            color="neutral"
            variant="outline"
            @click="addPendingVariantTierRow"
          />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            @click="closePendingVariantTierPricesModal"
          />
          <UButton type="button" label="Guardar" color="primary" class="hf-primary-control" @click="savePendingVariantTierPricesModal" />
        </div>
      </template>
    </UModal>

    <VariantDetailModal
      v-if="!isCreateMode"
      :open="isVariantDetailModalOpen"
      :product-id="productIdOrEmpty"
      :product-name="product?.name ?? ''"
      :variant="variantDetailModalVariant"
      :use-stock="formState.useStock"
      :can-update="canUpdateProduct"
      :product-type="formState.type"
      :product-purchase-net-cost-cents="product?.purchaseNetCostCents ?? 0"
      @update:open="handleVariantDetailModalOpenChange"
    />

    <VariantImagePickerModal
      v-if="!isCreateMode && variantImageModalVariant"
      :open="isVariantImageModalOpen"
      :product-id="productIdOrEmpty"
      :product-name="product?.name ?? ''"
      :variant="variantImageModalVariant"
      :can-update="canUpdateProduct"
      :can-delete="canDeleteProduct"
      @update:open="handleVariantImageModalOpenChange"
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="deleteVariantMutation.isPending.value || deleteLotMutation.isPending.value"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <ConfirmModal
      :open="firstVariantConfirm.open"
      title="¿Crear la primera variante?"
      description="El stock actual pasa a 0."
      confirm-label="Crear variante"
      confirm-color="error"
      :loading="createVariantMutation.isPending.value"
      @update:open="firstVariantConfirm.open = $event"
      @confirm="confirmFirstVariant"
    />

    <ProductQuickCreateModal
      v-model:open="isCategoryModalOpen"
      v-model:name="categoryState.name"
      title="Nueva categoría"
      label="Nombre"
      placeholder="Nombre de la categoría"
      form-id="create-category-modal-form"
      :schema="categorySchema"
      :error="categoryCreateError"
      :pending="createCategoryMutation.isPending.value"
      @submit="handleCreateCategory"
      @cancel="closeCreateCategoryModal"
    />

    <ProductQuickCreateModal
      v-model:open="isBrandModalOpen"
      v-model:name="brandState.name"
      title="Nueva marca"
      label="Nombre"
      placeholder="Nombre de la marca"
      form-id="create-brand-modal-form"
      :schema="brandSchema"
      :error="brandCreateError"
      :pending="createBrandMutation.isPending.value"
      @submit="handleCreateBrand"
      @cancel="closeCreateBrandModal"
    />

    <UModal
      v-model:open="isLotModalOpen"
      title="Agregar lote"
      :content="{ class: 'hf-theme hf-ui sm:max-w-2xl' }"
      @after-leave="resetLotForm"
    >
      <template #body>
        <UForm
          id="create-lot-modal-form"
          :schema="lotSchema"
          :state="lotState"
          class="grid grid-cols-1 gap-4 md:grid-cols-2"
          @submit="handleCreateLot"
        >
          <UFormField label="Lote" name="lotNumber">
            <UInput v-model="lotState.lotNumber" placeholder="Ej: LOTE-2026-04" />
          </UFormField>

          <UFormField label="Existencias" name="quantity">
            <UInputNumber v-model="lotState.quantity" :min="0" class="w-full" />
          </UFormField>

          <UFormField label="Fabricación" name="manufactureDate">
            <UInput v-model="lotState.manufactureDate" type="date" />
          </UFormField>

          <UFormField label="Caducidad" name="expirationDate">
            <UInput v-model="lotState.expirationDate" type="date" />
          </UFormField>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="createLotMutation.isPending.value"
            @click="closeLotModal"
          />
          <UButton
            label="Guardar lote"
            type="submit"
            form="create-lot-modal-form"
            color="primary"
            class="hf-primary-control"
            :loading="createLotMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isVariantModalOpen"
      :title="variantModalTitle"
      :content="{ class: 'hf-theme hf-ui sm:max-w-2xl' }"
      @after-leave="resetVariantForm"
    >
      <template #body>
        <UForm
          id="variant-modal-form"
          :schema="variantSchema"
          :state="variantState"
          class="grid grid-cols-1 gap-4 md:grid-cols-2"
          @submit="handleSubmitVariant"
        >
          <UFormField label="Opción" name="option">
            <div class="space-y-2">
              <USelect
                v-model="variantState.option"
                :items="variantOptionItems"
                placeholder="Selecciona una opción"
                size="lg"
                class="w-full"
              />
              <UInput
                v-if="variantState.option === CUSTOM_VARIANT_OPTION_VALUE"
                v-model="variantState.customOption"
                placeholder="Escribe la opción"
                class="w-full"
              />
            </div>
          </UFormField>

          <UFormField label="Valor" name="value">
            <UInput v-model="variantState.value" placeholder="Ej: Mediano" />
          </UFormField>

          <UFormField v-if="inventoryFieldsVisible(formState.type)" label="SKU" name="sku">
            <UInput v-model="variantState.sku" placeholder="Opcional" />
          </UFormField>

          <UFormField v-if="inventoryFieldsVisible(formState.type)" label="Código de barras" name="barcode">
            <UInput v-model="variantState.barcode" placeholder="Opcional" />
          </UFormField>

          <UFormField v-if="inventoryFieldsVisible(formState.type)" label="Existencias" name="quantity">
            <ReadOnlyStock
              v-if="!isCreateMode && editingVariantId"
              :value="variantState.quantity"
              label="Existencias"
              data-testid="variant-edit-stock-readonly"
            />
            <UInputNumber v-else v-model="variantState.quantity" :min="0" class="w-full" />
          </UFormField>

          <UFormField v-if="inventoryFieldsVisible(formState.type)" label="Existencias mínimas" name="minQuantity">
            <UInputNumber v-model="variantState.minQuantity" :min="0" class="w-full" />
          </UFormField>

          <UFormField label="Costo de compra (neto)" name="purchaseCost" class="md:col-span-2">
            <div class="relative w-full">
              <span
                class="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted"
                >$</span
              >
              <UInput
                v-model="variantState.purchaseCost"
                inputmode="decimal"
                placeholder="0.00 (hereda del producto si está vacío)"
                class="w-full"
                :ui="{ base: 'pl-7' }"
              />
            </div>
          </UFormField>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="
              createVariantMutation.isPending.value || updateVariantMutation.isPending.value
            "
            @click="closeVariantModal"
          />
          <UButton
            :label="variantSubmitLabel"
            type="submit"
            form="variant-modal-form"
            color="primary"
            class="hf-primary-control"
            :loading="
              createVariantMutation.isPending.value || updateVariantMutation.isPending.value
            "
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.product-workspace { background: var(--hf-page); }
.product-workspace-header { background: var(--hf-surface); }
.product-workspace-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 24px;
  min-width: 0;
}
/* No column grows to its content's width (the Contenido chip row scrolls inside itself). */
.product-workspace-grid > * { min-width: 0; }
#product-detail-form :deep([data-slot='root'].divide-y) {
  background: var(--hf-surface);
  border-radius: var(--hf-radius-card);
  box-shadow: 0 1px 2px color-mix(in srgb, var(--hf-ink) 5%, transparent);
}
#product-detail-form :deep(h2) { color: var(--hf-heading); }
.product-workspace-header :deep(button),
#product-detail-form :deep(button[data-slot='base']:not([role])) {
  min-height: var(--hf-control-height);
}
.product-workspace-header :deep(button:focus-visible),
#product-detail-form :deep(button:focus-visible) {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}
@media (max-width: 720px) {
  .product-workspace-grid { grid-template-columns: minmax(0, 1fr); }
  /* The summary leads on mobile, collapsed behind its toggle. */
  .product-workspace-grid > :last-child { order: -1; }
}
/* Identidad: section cards 16px apart, then its save bar flush to the scroller's bottom edge (as on Contenido). */
.product-identity { display: grid; gap: 16px; min-width: 0; }
.product-identity-save { position: sticky; bottom: 0; z-index: 5; margin-inline: -16px; }
.product-identity-save :deep(.hf-save-bar) { position: static; padding-bottom: max(12px, env(safe-area-inset-bottom)); }
/* A calm list of switches: label and description on the left, the switch on the right, hairlines between. */
.product-toggle-list { margin: 0; padding: 0; list-style: none; }
.product-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 56px; padding: 10px 0; }
.product-toggle-row + .product-toggle-row { border-top: 1px solid var(--hf-border); }
.product-toggle-row:first-child { padding-top: 0; }
.product-toggle-row:last-child { padding-bottom: 0; }
.product-toggle-row__text { display: grid; gap: 2px; min-width: 0; }
.product-toggle-row__label { color: var(--hf-ink); font-size: 14px; font-weight: 500; cursor: pointer; }
.product-toggle-row__description { color: var(--hf-muted); font-size: 13px; }
@media (min-width: 640px) {
  .product-identity-save { margin-inline: -24px; }
}
@media (min-width: 1024px) {
  .product-identity-save { margin-inline: 0; }
}
.product-action-bar {
  border-top: 1px solid var(--hf-border);
  background: var(--hf-surface);
  padding: 12px 16px max(12px, env(safe-area-inset-bottom));
}
.product-bar-primary {
  display: inline-flex;
  width: 100%;
  min-height: var(--hf-control-height);
  align-items: center;
  justify-content: center;
  border-radius: var(--hf-radius-control);
  background: var(--hf-action);
  color: var(--hf-on-action);
  font-size: 14px;
  font-weight: 600;
}
.product-bar-primary:disabled { cursor: not-allowed; opacity: 0.5; }
</style>
