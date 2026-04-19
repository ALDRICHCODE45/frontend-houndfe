<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AxiosError } from 'axios'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { productApi } from '../api/product.api'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import PriceListSection from '../components/PriceListSection.vue'
import ProductImageGallery from '../components/ProductImageGallery.vue'
import CategorySelect from '../components/CategorySelect.vue'
import VariantDetailModal from '../components/VariantDetailModal.vue'
import {
  productFormSchema,
  centsToDecimalInput,
  decimalInputToCents,
  productToFormInput,
  toCreatePayload,
  toUpdatePayload,
  UNIT_OPTIONS,
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
  ProductFormInput,
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
const toast = useToast()

const VARIANT_OPTION_CHOICES = ['Tamaño', 'Color', 'Material', 'Estilo'] as const
const variantOptionItems = VARIANT_OPTION_CHOICES.map((option) => ({
  label: option,
  value: option,
}))

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
  }
}

const formState = reactive<ProductFormInput>(getDefaultFormState())

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
  option: z.string().trim().min(1, 'Seleccioná una opción'),
  value: z.string().trim().min(1, 'El valor es obligatorio').max(100),
  sku: z.string().trim().max(100),
  barcode: z.string().trim().max(100),
  quantity: z.number().int().min(0),
  minQuantity: z.number().int().min(0),
  purchaseCost: z
    .string()
    .trim()
    .regex(/^\d+(?:[.,]\d{1,2})?$/, 'Valor decimal válido')
    .or(z.literal('')),
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
const isVariantModalOpen = ref(false)
const isLotModalOpen = ref(false)
const editingVariantId = ref<string | null>(null)
const isVariantDetailModalOpen = ref(false)
const variantDetailModalVariant = ref<ProductVariant | null>(null)
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

const variantState = reactive<VariantFormState>({
  option: '',
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
const tierRows = ref<Array<{ key: number; minQuantity: number | string; price: string }>>([])
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
const pendingVariantTierRows = ref<Array<{ key: number; minQuantity: number | string; price: string }>>([])

const canCreateProduct = computed(() => authStore.userCan('create', 'Product'))
const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))
const canSubmitMainForm = computed(() =>
  isCreateMode.value ? canCreateProduct.value : canUpdateProduct.value,
)
const isFormReadonly = computed(() => !isCreateMode.value && !canUpdateProduct.value)

const {
  data: product,
  isLoading: isLoadingProduct,
  isError: isProductError,
  refetch: refetchProduct,
} = useQuery({
  queryKey: computed(() => productQueryKeys.detail(productIdOrEmpty.value)),
  queryFn: () => productApi.getById(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
})

const { data: categories } = useQuery<CategoryOption[]>({
  queryKey: productQueryKeys.categories(),
  queryFn: productApi.getCategories,
  refetchOnWindowFocus: false,
})

const { data: globalPriceLists } = useQuery<GlobalPriceList[]>({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: productApi.getGlobalPriceLists,
  refetchOnWindowFocus: false,
})

const { data: brands } = useQuery<BrandOption[]>({
  queryKey: productQueryKeys.brands(),
  queryFn: productApi.getBrands,
  refetchOnWindowFocus: false,
})

const { data: variants, isFetching: isFetchingVariants } = useQuery({
  queryKey: computed(() => productQueryKeys.variants(productIdOrEmpty.value)),
  queryFn: () => productApi.getVariants(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
})

const { data: lots, isFetching: isFetchingLots } = useQuery({
  queryKey: computed(() => productQueryKeys.lots(productIdOrEmpty.value)),
  queryFn: () => productApi.getLots(productIdOrEmpty.value),
  enabled: computed(() => !isCreateMode.value),
  refetchOnWindowFocus: false,
})

const variantsList = computed(() => variants.value ?? [])
const lotsList = computed(() => lots.value ?? [])
const categoriesList = computed(() => categories.value ?? [])
const brandsList = computed(() => brands.value ?? [])
const globalPriceListOptions = computed(() => globalPriceLists.value ?? [])
const availablePriceListOptions = computed(() => {
  const usedIds = new Set(pendingPriceLists.value.map((pl) => pl.priceListId))
  return globalPriceListOptions.value.filter((gpl) => !usedIds.has(gpl.id))
})
const inlineVariantQuantityInputs = reactive<Record<string, number>>({})
const inlineVariantPublicPriceInputs = reactive<Record<string, string>>({})

const variantGroups = computed(() => {
  const grouped = new Map<string, { option: string; values: string[] }>()

  // Use pending variants in create mode, backend variants in edit mode
  const items = isCreateMode.value
    ? pendingVariants.value.map((pv) => ({
        option: pv.option || 'Sin opción',
        value: pv.value || pv.option,
      }))
    : variantsList.value.map((v) => ({
        option: v.option?.trim() || 'Sin opción',
        value: v.value?.trim() || v.name,
      }))

  for (const item of items) {
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

function syncInlineVariantQuantityInputs(nextVariants: ProductVariant[]) {
  const currentIds = new Set(nextVariants.map((variant) => variant.id))

  for (const variantId of Object.keys(inlineVariantQuantityInputs)) {
    if (!currentIds.has(variantId)) {
      delete inlineVariantQuantityInputs[variantId]
    }
  }

  for (const variant of nextVariants) {
    inlineVariantQuantityInputs[variant.id] = variant.quantity
  }
}

function getPublicPrice(variant: ProductVariant) {
  return variant.variantPrices.find((p) => p.priceListName === 'PUBLICO')
}

function syncInlineVariantPublicPriceInputs(nextVariants: ProductVariant[]) {
  const currentIds = new Set(nextVariants.map((v) => v.id))

  for (const variantId of Object.keys(inlineVariantPublicPriceInputs)) {
    if (!currentIds.has(variantId)) {
      delete inlineVariantPublicPriceInputs[variantId]
    }
  }

  for (const variant of nextVariants) {
    const publicPrice = getPublicPrice(variant)
    inlineVariantPublicPriceInputs[variant.id] = centsToDecimalInput(publicPrice?.priceCents ?? 0)
  }
}

const categoryItems = computed(() => [
  { label: 'Crear categoría', value: '__create__', icon: 'i-lucide-plus', type: 'action' as const },
  { label: '', value: '__sep__', type: 'separator' as const },
  { label: 'Sin categoría', value: '', icon: 'i-lucide-minus' },
  ...categoriesList.value.map((category) => ({
    label: category.name,
    value: category.id,
    icon: 'i-lucide-package',
  })),
])

const brandItems = computed(() => [
  { label: 'Crear marca', value: '__create__', icon: 'i-lucide-plus', type: 'action' as const },
  { label: '', value: '__sep__', type: 'separator' as const },
  { label: 'Sin marca', value: '', icon: 'i-lucide-minus' },
  ...brandsList.value.map((brand) => ({
    label: brand.name,
    value: brand.id,
    icon: 'i-lucide-tag',
  })),
])

const showLotsCheckbox = computed(() => formState.useStock && !formState.hasVariants)
const showStockByVariantMessage = computed(() => formState.hasVariants)
const showInventoryCard = computed(() => formState.type === 'PRODUCT')
const showManualStockFields = computed(
  () => formState.useStock && !formState.useLotsAndExpirations && !formState.hasVariants,
)
const showLotsSection = computed(
  () => formState.useStock && formState.useLotsAndExpirations && !formState.hasVariants,
)
const showVariantsSection = computed(() => !formState.useLotsAndExpirations)
const variantModalTitle = computed(() =>
  editingVariantId.value ? 'Editar variante' : 'Agregar variante',
)
const variantSubmitLabel = computed(() =>
  editingVariantId.value ? 'Guardar variante' : 'Agregar variante',
)

watch(
  () => isCreateMode.value,
  (createMode) => {
    if (createMode) {
      Object.assign(formState, getDefaultFormState())
      pendingVariants.value = []
      pendingLots.value = []
      pendingPriceLists.value = []
      isAddPriceListPickerOpen.value = false
      pendingPriceListSelection.value = ''
    }
  },
  { immediate: true },
)

watch(
  () => product.value,
  (productValue) => {
    if (!productValue || isCreateMode.value) return
    Object.assign(formState, productToFormInput(productValue))
  },
  { immediate: true },
)

watch(
  () => variantsList.value,
  (nextVariants) => {
    syncInlineVariantQuantityInputs(nextVariants)
    syncInlineVariantPublicPriceInputs(nextVariants)

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
  (type) => {
    if (type === 'SERVICE') {
      formState.useStock = false
      formState.useLotsAndExpirations = false
      formState.hasVariants = false
      formState.quantity = 0
      formState.minQuantity = 0
      if (isCreateMode.value) {
        pendingVariants.value = []
        pendingLots.value = []
        pendingPriceLists.value = []
        isAddPriceListPickerOpen.value = false
        pendingPriceListSelection.value = ''
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
  if (!response) return 'No pudimos completar la operación. Reintentá en unos segundos.'
  return response.message ?? 'No pudimos completar la operación. Reintentá en unos segundos.'
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
    value: '',
    sku: '',
    barcode: '',
    quantity: 0,
    minQuantity: 0,
    purchaseCost: '',
  })
  editingVariantId.value = null
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

  // Inline variants
  if (formValues.hasVariants && pendingVariants.value.length > 0) {
    base.variants = pendingVariants.value.map((v) => ({
      option: v.option || undefined,
      value: v.value || undefined,
      ...(v.sku ? { sku: v.sku } : {}),
      ...(v.barcode ? { barcode: v.barcode } : {}),
      quantity: v.quantity,
      minQuantity: v.minQuantity,
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
  onSuccess: async (createdProduct) => {
    pendingVariants.value = []
    pendingLots.value = []
    pendingPriceLists.value = []

    toast.add({
      title: 'Producto creado',
      description: 'El producto se creó correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated() })
    await router.push(`/pos/products/${createdProduct.id}`)
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear producto', description: message, color: 'error' })
  },
})

const updateMutation = useMutation({
  mutationFn: (payload: UpdateProductPayload) => {
    if (!productId.value) throw new Error('Missing product id')
    return productApi.update(productId.value, payload)
  },
  onSuccess: async () => {
    toast.add({
      title: 'Producto actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    if (!productId.value) return

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated() }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.priceLists(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(productId.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
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

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.categories() })
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

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.brands() })
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
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(productIdOrEmpty.value),
      }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear variante', description: message, color: 'error' })
  },
})

const updateVariantMutation = useMutation({
  mutationFn: (payload: { variantId: string; values: CreateVariantPayload }) =>
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
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(productIdOrEmpty.value),
      }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al actualizar variante', description: message, color: 'error' })
  },
})

const updateVariantInlineStockMutation = useMutation({
  mutationFn: (payload: { variantId: string; values: UpdateVariantPayload }) =>
    productApi.updateVariant(productIdOrEmpty.value, payload.variantId, payload.values),
  onSuccess: async () => {
    await queryClient.invalidateQueries({
      queryKey: productQueryKeys.variants(productIdOrEmpty.value),
    })
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al actualizar existencias', description: message, color: 'error' })
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
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productIdOrEmpty.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variants(productIdOrEmpty.value),
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
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productIdOrEmpty.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(productIdOrEmpty.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear lote', description: message, color: 'error' })
  },
})

const deleteLotMutation = useMutation({
  mutationFn: (lotId: string) => productApi.removeLot(productIdOrEmpty.value, lotId),
  onSuccess: async () => {
    toast.add({
      title: 'Lote eliminado',
      description: 'El lote fue eliminado correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productIdOrEmpty.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(productIdOrEmpty.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
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
    Object.assign(variantState, {
      option: pending.option,
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
  Object.assign(variantState, {
    option: variant.option ?? '',
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
  updated.purchaseNetCostCents = pendingVariantDetailState.purchaseCost
    ? decimalInputToCents(pendingVariantDetailState.purchaseCost)
    : null
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

  target.tierPrices = pendingVariantTierRows.value
    .filter((row) => String(row.minQuantity).trim() !== '' && row.price.trim() !== '')
    .map((row) => ({
      minQuantity:
        typeof row.minQuantity === 'string'
          ? Number.parseInt(row.minQuantity, 10)
          : row.minQuantity,
      priceCents: decimalInputToCents(row.price),
    }))
    .filter((row) => Number.isFinite(row.minQuantity) && row.minQuantity >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity)

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

function handleCategorySelectChange(value: string) {
  if (value === '__create__') {
    formState.categoryId = ''
    openCreateCategoryModal()
    return
  }

  formState.categoryId = value
}

function handleCategoryAction(value: string) {
  if (value === '__create__') {
    openCreateCategoryModal()
  }
}

function handleBrandSelectChange(value: string) {
  if (value === '__create__') {
    formState.brandId = ''
    openCreateBrandModal()
    return
  }

  formState.brandId = value
}

function handleBrandAction(value: string) {
  if (value === '__create__') {
    openCreateBrandModal()
  }
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
  const costInput = formState.purchaseCost
  return costInput ? decimalInputToCents(costInput) : 0
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

  const mapped = tierRows.value
    .filter((row) => String(row.minQuantity).trim() !== '' && row.price.trim() !== '')
    .map((row) => ({
      minQuantity:
        typeof row.minQuantity === 'string'
          ? Number.parseInt(row.minQuantity, 10)
          : row.minQuantity,
      priceCents: decimalInputToCents(row.price),
    }))
    .filter((row) => Number.isFinite(row.minQuantity) && row.minQuantity >= 0)
    .sort((a, b) => a.minQuantity - b.minQuantity)

  list.tierPrices = mapped
  closeTierPricesModal()
}

function handleSubmitMainForm(event: FormSubmitEvent<MainFormValues>) {
  if (!canSubmitMainForm.value) return

  if (isCreateMode.value) {
    createMutation.mutate(event.data)
    return
  }

  const payload = toUpdatePayload(event.data)
  delete payload.priceCents
  updateMutation.mutate(payload)
}

function handleCreateCategory(event: FormSubmitEvent<CategoryFormState>) {
  createCategoryMutation.mutate(event.data.name.trim())
}

function handleCreateBrand(event: FormSubmitEvent<BrandFormState>) {
  createBrandMutation.mutate(event.data.name.trim())
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
  if (isCreateMode.value) {
    const costCents = event.data.purchaseCost
      ? decimalInputToCents(event.data.purchaseCost)
      : null

    // Local CRUD for create mode
    if (editingVariantId.value) {
      const index = pendingVariants.value.findIndex((v) => v._localId === editingVariantId.value)
      if (index !== -1) {
        pendingVariants.value[index] = {
          ...pendingVariants.value[index]!,
          option: event.data.option,
          value: event.data.value,
          sku: event.data.sku,
          barcode: event.data.barcode,
          quantity: event.data.quantity,
          minQuantity: event.data.minQuantity,
          purchaseNetCostCents: costCents,
        }
      }
    } else {
      pendingVariants.value.push({
        _localId: nextLocalId(),
        option: event.data.option,
        value: event.data.value,
        sku: event.data.sku,
        barcode: event.data.barcode,
        quantity: event.data.quantity,
        minQuantity: event.data.minQuantity,
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

  const costCentsEdit = event.data.purchaseCost
    ? decimalInputToCents(event.data.purchaseCost)
    : undefined

  const payload: CreateVariantPayload = {
    option: event.data.option,
    value: event.data.value,
    ...(event.data.sku ? { sku: event.data.sku } : {}),
    ...(event.data.barcode ? { barcode: event.data.barcode } : {}),
    quantity: event.data.quantity,
    minQuantity: event.data.minQuantity,
    ...(costCentsEdit != null ? { purchaseNetCostCents: costCentsEdit } : {}),
  }

  if (editingVariantId.value) {
    updateVariantMutation.mutate({ variantId: editingVariantId.value, values: payload })
    return
  }

  createVariantMutation.mutate(payload)
}

function normalizeQuantity(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.trunc(value))
}

function handleOpenVariantDetailModal(variant: ProductVariant) {
  variantDetailModalVariant.value = variant
  isVariantDetailModalOpen.value = true
}

function handleVariantDetailModalOpenChange(isOpen: boolean) {
  isVariantDetailModalOpen.value = isOpen
}

function handleInlineVariantQuantityBlur(variant: ProductVariant) {
  if (!canUpdateProduct.value) return

  const nextQuantity = normalizeQuantity(inlineVariantQuantityInputs[variant.id])
  inlineVariantQuantityInputs[variant.id] = nextQuantity

  if (nextQuantity === variant.quantity) return

  updateVariantInlineStockMutation.mutate({
    variantId: variant.id,
    values: { quantity: nextQuantity },
  })
}

function handleInlineVariantPublicPriceBlur(variant: ProductVariant) {
  if (!canUpdateProduct.value) return

  const publicPrice = getPublicPrice(variant)
  if (!publicPrice) return

  const rawInput = inlineVariantPublicPriceInputs[variant.id] ?? '0'
  const nextPriceCents = decimalInputToCents(rawInput)

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
        queryKey: productQueryKeys.variants(productIdOrEmpty.value),
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
    openConfirm(`¿Querés eliminar la variante ${variantName}?`, () => {
      pendingVariants.value = pendingVariants.value.filter((v) => v._localId !== variantId)
    })
    return
  }

  if (!canDeleteProduct.value) return

  openConfirm(`¿Querés eliminar la variante ${variantName}?`, () => {
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
    openConfirm(`¿Querés eliminar el lote ${lotNumber}?`, () => {
      pendingLots.value = pendingLots.value.filter((l) => l._localId !== lotId)
    })
    return
  }

  if (!canDeleteProduct.value) return

  openConfirm(`¿Querés eliminar el lote ${lotNumber}?`, () => {
    void deleteLotMutation.mutateAsync(lotId)
  })
}

function handleEditLotPlaceholder() {
  toast.add({
    title: 'Próximamente',
    description: 'La edición de lotes estará disponible en una próxima iteración.',
    color: 'warning',
  })
}
</script>

<template>
  <div class="-m-4 flex h-[calc(100%+2rem)] flex-col sm:-m-6 sm:h-[calc(100%+3rem)]">
    <div class="shrink-0 border-b border-default bg-default px-10 py-4">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between">
        <div class="flex items-center gap-3">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="handleBack"
          />
          <div>
            <h1 class="text-xl font-semibold">
              {{ isCreateMode ? 'Nuevo producto' : formState.name || 'Producto' }}
            </h1>
            <p v-if="!isCreateMode" class="text-sm text-muted">Editando producto</p>
          </div>
        </div>

        <UButton
          v-if="!isFormReadonly"
          :label="isCreateMode ? 'Crear producto' : 'Guardar cambios'"
          type="submit"
          form="product-detail-form"
          :loading="updateMutation.isPending.value || createMutation.isPending.value"
          :disabled="!canSubmitMainForm"
        />
      </div>
    </div>

    <div
      class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 overflow-y-auto px-10 pb-6 pt-6"
    >
      <div
        v-if="!isCreateMode && isProductError"
        class="flex items-center justify-between gap-4 rounded-lg border border-error/30 bg-error/5 p-4"
      >
        <p class="text-sm text-error">No pudimos cargar el producto. Reintentá nuevamente.</p>
        <UButton label="Reintentar" color="neutral" variant="outline" @click="refetchProduct" />
      </div>

      <div
        v-else-if="!isCreateMode && isLoadingProduct"
        class="rounded-lg border border-default p-6"
      >
        <p class="text-sm text-muted">Cargando datos del producto...</p>
      </div>

      <UForm
        v-else
        id="product-detail-form"
        :schema="productFormSchema"
        :state="formState"
        @submit="handleSubmitMainForm"
      >
        <fieldset :disabled="isFormReadonly" class="space-y-6">
          <UCard :ui="{ root: 'overflow-visible' }">
            <template #header>
              <h2 class="text-lg font-semibold">Datos del producto</h2>
            </template>

            <div class="space-y-4">
              <UFormField label="Tipo de producto" name="type" class="md:col-span-2">
                <URadioGroup
                  v-model="formState.type"
                  orientation="horizontal"
                  variant="card"
                  :items="[
                    {
                      label: 'Producto',
                      description: 'Artículo físico con inventario',
                      value: 'PRODUCT',
                    },
                    {
                      label: 'Servicio',
                      description: 'Sin control de inventario',
                      value: 'SERVICE',
                    },
                  ]"
                />
              </UFormField>

              <USeparator class="my-4" />

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="Nombre" name="name" required class="md:col-span-2">
                  <UInput v-model="formState.name" class="w-full" placeholder="Ej: Jabón de mano" />
                </UFormField>

                <UFormField label="Código de barras" name="barcode">
                  <UInput v-model="formState.barcode" placeholder="Opcional" />
                </UFormField>

                <UFormField label="SKU" name="sku">
                  <UInput v-model="formState.sku" placeholder="Opcional" />
                </UFormField>
              </div>

              <USeparator class="my-4" />

              <div class="space-y-3">
                <USwitch
                  v-model="formState.sellInPos"
                  label="Vender en Punto de Venta"
                  description="Este producto aparecerá en la pantalla del POS"
                />
                <USwitch
                  v-model="formState.includeInOnlineCatalog"
                  label="Incluir en catálogo en línea"
                  description="Visible en la tienda online"
                />
                <USwitch
                  v-model="formState.requiresPrescription"
                  label="Requerir receta médica"
                  description="Exigir receta médica para su venta"
                />
              </div>

              <USeparator class="my-4" />

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="Unidad" name="unit">
                  <USelect
                    v-model="formState.unit"
                    :items="
                      UNIT_OPTIONS.map((unit) => ({
                        label: unit.label.toUpperCase(),
                        value: unit.value,
                      }))
                    "
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField label="Categoría" name="categoryId">
                  <CategorySelect
                    :model-value="formState.categoryId"
                    :items="categoryItems"
                    placeholder="Seleccionar categoría"
                    size="lg"
                    @update:model-value="handleCategorySelectChange"
                    @action="handleCategoryAction"
                  />
                </UFormField>

                <UFormField label="Marca" name="brandId">
                  <CategorySelect
                    :model-value="formState.brandId"
                    :items="brandItems"
                    placeholder="Seleccionar marca"
                    size="lg"
                    @update:model-value="handleBrandSelectChange"
                    @action="handleBrandAction"
                  />
                </UFormField>

                <UFormField label="Ubicación" name="location">
                  <UInput
                    v-model="formState.location"
                    class="w-full"
                    placeholder="Ej: Estante 3B"
                  />
                </UFormField>

                <UFormField label="Descripción" name="description" class="md:col-span-2">
                  <UTextarea
                    v-model="formState.description"
                    :rows="4"
                    class="w-full"
                    placeholder="Agregar una descripción..."
                  />
                </UFormField>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">Precio de Compra</h2>
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
                    class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
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
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                    >por Unidad</span
                  >
                </div>
              </UFormField>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h2 class="text-lg font-semibold">Impuestos</h2>
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

          <UCard v-if="showInventoryCard">
            <template #header>
              <h2 class="text-lg font-semibold">Inventario</h2>
            </template>

            <div class="space-y-4">
              <USwitch
                v-model="formState.useStock"
                label="Controlar inventario"
                description="Activar seguimiento de existencias y cantidad mínima"
              />

              <div v-if="showManualStockFields" class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UFormField label="Existencias" name="quantity">
                  <UInputNumber v-model="formState.quantity" :min="0" class="w-full" />
                  <p class="mt-1 text-xs text-muted">Unidades</p>
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

              <p v-if="showStockByVariantMessage" class="text-sm text-warning">
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

          <UCard v-if="showVariantsSection">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold">Variantes</h2>
                <UButton
                  label="Agregar variante"
                  icon="i-lucide-plus"
                  :disabled="!isCreateMode && !canUpdateProduct"
                  @click="openAddVariantModal"
                />
              </div>
            </template>

            <div v-if="variantGroups.length > 0" class="mb-4 space-y-3">
              <div
                v-for="group in variantGroups"
                :key="group.option"
                class="rounded-md border border-default bg-elevated/20 p-3"
              >
                <p class="text-xs font-semibold uppercase tracking-wide text-muted">
                  {{ group.option }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <UBadge
                    v-for="value in group.values"
                    :key="`${group.option}-${value}`"
                    color="neutral"
                    variant="subtle"
                  >
                    {{ value }}
                  </UBadge>
                </div>
              </div>
            </div>

            <!-- Create mode: pending variants table -->
            <div v-if="isCreateMode" class="overflow-hidden rounded-md border border-default">
              <table class="min-w-full divide-y divide-default text-sm">
                <thead class="bg-elevated/40">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Variante</th>
                    <th v-if="formState.useStock" class="px-4 py-3 text-left font-medium">
                      Existencias
                    </th>
                    <th class="px-4 py-3 text-left font-medium">Precio Público</th>
                    <th class="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-if="pendingVariants.length === 0">
                    <td :colspan="formState.useStock ? 4 : 3" class="px-4 py-3 text-muted">
                      Sin variantes agregadas. Usá el botón "Agregar variante".
                    </td>
                  </tr>
                  <tr v-for="pv in pendingVariants" :key="pv._localId">
                    <td class="px-4 py-3">
                      <div class="font-medium">
                        {{ pv.option ? `${pv.option}: ${pv.value}` : pv.value }}
                      </div>
                      <div class="text-xs text-muted">
                        SKU: {{ pv.sku || '—' }} · Código: {{ pv.barcode || '—' }}
                      </div>
                    </td>
                    <td v-if="formState.useStock" class="px-4 py-3">
                      <UInputNumber
                        v-model="pv.quantity"
                        :min="0"
                        class="w-28"
                      />
                    </td>
                    <td class="px-4 py-3">
                      <div class="relative max-w-[8rem]">
                        <span
                          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                          >$</span
                        >
                        <UInput
                          :model-value="centsToDecimalInput(pv.publicPriceCents)"
                          class="w-full"
                          inputmode="decimal"
                          placeholder="0.00"
                          :ui="{ base: 'pl-7' }"
                          @blur="(e: FocusEvent) => setPendingVariantPublicPrice(pv._localId, decimalInputToCents((e.target as HTMLInputElement).value))"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex justify-end gap-2">
                        <UButton
                          type="button"
                          label="Más Datos"
                          color="neutral"
                          variant="outline"
                          @click="openPendingVariantDetailModal(pv._localId)"
                        />
                        <UButton
                          type="button"
                          label="Editar"
                          color="neutral"
                          variant="outline"
                          @click="openEditVariantModal(pv._localId)"
                        />
                        <UButton
                          type="button"
                          label="Eliminar"
                          color="error"
                          variant="ghost"
                          @click="handleDeleteVariant(pv._localId, pv.value || pv.option)"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Edit mode: backend variants table -->
            <div v-else class="overflow-hidden rounded-md border border-default">
              <table class="min-w-full divide-y divide-default text-sm">
                <thead class="bg-elevated/40">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Variante</th>
                    <th v-if="formState.useStock" class="px-4 py-3 text-left font-medium">
                      Existencias
                    </th>
                    <th class="px-4 py-3 text-left font-medium">Precio Público</th>
                    <th class="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-if="isFetchingVariants">
                    <td :colspan="formState.useStock ? 4 : 3" class="px-4 py-3 text-muted">
                      Actualizando variantes...
                    </td>
                  </tr>
                  <tr v-else-if="variantsList.length === 0">
                    <td :colspan="formState.useStock ? 4 : 3" class="px-4 py-3 text-muted">
                      Sin variantes registradas.
                    </td>
                  </tr>
                  <template v-for="variant in variantsList" :key="variant.id">
                    <tr>
                      <td class="px-4 py-3">
                        <div class="font-medium">{{ getVariantLabel(variant) }}</div>
                        <div class="text-xs text-muted">
                          SKU: {{ variant.sku ?? '—' }} · Código: {{ variant.barcode ?? '—' }}
                        </div>
                      </td>
                      <td v-if="formState.useStock" class="px-4 py-3">
                        <UInputNumber
                          v-model="inlineVariantQuantityInputs[variant.id]"
                          :min="0"
                          class="w-28"
                          :disabled="!canUpdateProduct"
                          @blur="handleInlineVariantQuantityBlur(variant)"
                          @keyup.enter="handleInlineVariantQuantityBlur(variant)"
                        />
                      </td>
                      <td class="px-4 py-3">
                        <div class="relative max-w-[8rem]">
                          <span
                            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                            >$</span
                          >
                          <UInput
                            v-model="inlineVariantPublicPriceInputs[variant.id]"
                            class="w-full"
                            inputmode="decimal"
                            placeholder="0.00"
                            :ui="{ base: 'pl-7' }"
                            :disabled="!canUpdateProduct"
                            @blur="handleInlineVariantPublicPriceBlur(variant)"
                            @keyup.enter="handleInlineVariantPublicPriceBlur(variant)"
                          />
                        </div>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-2">
                          <UButton
                            type="button"
                            label="Más Datos"
                            color="neutral"
                            variant="outline"
                            @click="handleOpenVariantDetailModal(variant)"
                          />
                          <UButton
                            type="button"
                            label="Editar"
                            color="neutral"
                            variant="outline"
                            :disabled="!canUpdateProduct"
                            @click="openEditVariantModal(variant.id)"
                          />
                          <UButton
                            type="button"
                            label="Eliminar"
                            color="error"
                            variant="ghost"
                            :disabled="!canDeleteProduct"
                            :loading="deleteVariantMutation.isPending.value"
                            @click="handleDeleteVariant(variant.id, variant.name)"
                          />
                        </div>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </UCard>

          <UCard v-if="showLotsSection">
            <template #header>
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold">Lotes</h2>
                <UButton
                  label="Agregar Lote"
                  icon="i-lucide-plus"
                  :disabled="!isCreateMode && !canUpdateProduct"
                  @click="isLotModalOpen = true"
                />
              </div>
            </template>

            <div class="space-y-3">
              <!-- Create mode: pending lots table -->
              <div v-if="isCreateMode" class="overflow-hidden rounded-md border border-default">
                <table class="min-w-full divide-y divide-default text-sm">
                  <thead class="bg-elevated/40">
                    <tr>
                      <th class="px-4 py-3 text-left font-medium">Lote</th>
                      <th class="px-4 py-3 text-left font-medium">Caducidad</th>
                      <th class="px-4 py-3 text-left font-medium">Existencias</th>
                      <th class="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-if="pendingLots.length === 0">
                      <td colspan="4" class="px-4 py-3 text-muted">
                        Sin lotes agregados. Usá el botón "Agregar Lote".
                      </td>
                    </tr>
                    <tr v-for="pl in pendingLots" :key="pl._localId">
                      <td class="px-4 py-3">{{ pl.lotNumber }}</td>
                      <td class="px-4 py-3">{{ pl.expirationDate || 'Sin fecha' }}</td>
                      <td class="px-4 py-3">{{ pl.quantity }}</td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-2">
                          <UButton
                            type="button"
                            label="Eliminar"
                            color="error"
                            variant="ghost"
                            @click="handleDeleteLot(pl._localId, pl.lotNumber)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Edit mode: backend lots table -->
              <div v-else class="overflow-hidden rounded-md border border-default">
                <table class="min-w-full divide-y divide-default text-sm">
                  <thead class="bg-elevated/40">
                    <tr>
                      <th class="px-4 py-3 text-left font-medium">Lote</th>
                      <th class="px-4 py-3 text-left font-medium">Caducidad</th>
                      <th class="px-4 py-3 text-left font-medium">Existencias</th>
                      <th class="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-if="isFetchingLots">
                      <td colspan="4" class="px-4 py-3 text-muted">Actualizando lotes...</td>
                    </tr>
                    <tr v-else-if="lotsList.length === 0">
                      <td colspan="4" class="px-4 py-3 text-muted">Sin lotes registrados.</td>
                    </tr>
                    <tr v-for="lot in lotsList" :key="lot.id">
                      <td class="px-4 py-3">{{ lot.lotNumber }}</td>
                      <td class="px-4 py-3">{{ lot.expirationDate ?? 'Sin fecha' }}</td>
                      <td class="px-4 py-3">{{ lot.quantity }}</td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-2">
                          <UButton
                            type="button"
                            label="Editar"
                            color="neutral"
                            variant="link"
                            @click="handleEditLotPlaceholder"
                          />
                          <UButton
                            type="button"
                            label="X"
                            color="error"
                            variant="ghost"
                            :disabled="!canDeleteProduct"
                            :loading="deleteLotMutation.isPending.value"
                            @click="handleDeleteLot(lot.id, lot.lotNumber)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

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
                <h2 class="text-lg font-semibold">Listas de Precios</h2>
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
                  color="primary"
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

              <div v-if="pendingPriceLists.length > 0" class="overflow-hidden rounded-md border border-default">
                <table class="min-w-full divide-y divide-default text-sm">
                  <thead class="bg-elevated/40">
                    <tr>
                      <th class="px-4 py-3 text-left font-medium">Lista de Precios</th>
                      <th class="px-4 py-3 text-left font-medium">
                        <div>Precio de Venta</div>
                        <div class="text-xs font-normal text-muted">(Con Impuestos Incluidos)</div>
                      </th>
                      <th class="px-4 py-3 text-center font-medium">+</th>
                      <th class="px-4 py-3 text-center font-medium">Márgen</th>
                      <th class="px-4 py-3 text-center font-medium">Ganancia</th>
                      <th class="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-default">
                    <tr v-for="ppl in pendingPriceLists" :key="ppl._localId">
                      <td class="px-4 py-3 font-medium">{{ ppl.priceListName }}</td>
                      <td class="px-4 py-3">
                        <div class="relative max-w-[10rem]">
                          <span
                            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                            >$</span
                          >
                          <UInput
                            :model-value="centsToDecimalInput(ppl.priceCents)"
                            class="w-full"
                            inputmode="decimal"
                            placeholder="0.00"
                            :ui="{ base: 'pl-7' }"
                            @blur="(e: FocusEvent) => updatePendingPriceListPrice(ppl._localId, decimalInputToCents((e.target as HTMLInputElement).value))"
                          />
                        </div>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <UButton
                          type="button"
                          icon="i-lucide-plus"
                          color="neutral"
                          variant="ghost"
                          @click="openTierPricesModal(ppl._localId)"
                        />
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          v-if="getPendingCostCents() > 0 && ppl.priceCents > 0"
                          class="font-semibold"
                          :class="ppl.priceCents >= getPendingCostCents() ? 'text-success' : 'text-error'"
                        >
                          {{ Math.round(((ppl.priceCents - getPendingCostCents()) / getPendingCostCents()) * 100) }}%
                        </span>
                        <span v-else class="text-muted">--</span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span
                          v-if="getPendingCostCents() > 0 && ppl.priceCents > 0"
                          class="font-semibold"
                          :class="ppl.priceCents >= getPendingCostCents() ? 'text-success' : 'text-error'"
                        >
                          $ {{ ((ppl.priceCents - getPendingCostCents()) / 100).toFixed(2) }} por Unidad
                        </span>
                        <span v-else class="text-muted">--</span>
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end">
                          <UButton
                            v-if="!isDefaultPriceList(ppl.priceListId)"
                            type="button"
                            label="Quitar"
                            color="error"
                            variant="ghost"
                            @click="removePendingPriceList(ppl._localId)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <UButton
                v-if="availablePriceListOptions.length > 0 && !isAddPriceListPickerOpen"
                type="button"
                icon="i-lucide-plus"
                label="Agregar Lista de Precios"
                color="neutral"
                variant="ghost"
                class="text-primary"
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
        </fieldset>
      </UForm>
    </div>

    <UModal
      v-model:open="isTierPricesModalOpen"
      title="Precios por Cantidad"
      :content="{ class: 'sm:max-w-3xl' }"
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
              <UInput
                v-model="row.price"
                inputmode="decimal"
                placeholder="0.00"
                class="w-full"
              />
              <UButton
                type="button"
                icon="i-lucide-trash"
                color="error"
                variant="ghost"
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
            @click="saveTierRows"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isPendingVariantDetailModalOpen"
      title="Editar variante"
      :content="{ class: 'sm:max-w-4xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <UCard>
            <template #header>
              <h3 class="font-semibold">General</h3>
            </template>
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <UFormField label="SKU">
                <UInput v-model="pendingVariantDetailState.sku" placeholder="SKU" />
              </UFormField>
              <UFormField label="Código de barras / Barcode">
                <UInput v-model="pendingVariantDetailState.barcode" placeholder="Código de barras" />
              </UFormField>
              <UFormField label="Costo (del producto)" class="md:col-span-2">
                <div class="relative">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                    >$</span
                  >
                  <UInput
                    v-model="pendingVariantDetailState.purchaseCost"
                    inputmode="decimal"
                    class="w-full"
                    :ui="{ base: 'pl-7 pr-24' }"
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                    >por Unidad</span
                  >
                </div>
                <p class="mt-1 text-xs text-muted">Ingresá un valor para definir costo propio de esta variante</p>
              </UFormField>
            </div>
          </UCard>

          <UCard>
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
            <div class="overflow-hidden rounded-md border border-default">
              <table class="min-w-full divide-y divide-default text-sm">
                <thead class="bg-elevated/40">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Lista de Precios</th>
                    <th class="px-4 py-3 text-left font-medium">Precio de Venta (Con Impuestos Incluidos)</th>
                    <th class="px-4 py-3 text-center font-medium">+</th>
                    <th class="px-4 py-3 text-center font-medium">Márgen</th>
                    <th class="px-4 py-3 text-center font-medium">Ganancia</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-default">
                  <tr v-for="price in pendingVariantDetailState.prices" :key="price.priceListId">
                    <td class="px-4 py-3">{{ price.priceListName }}</td>
                    <td class="px-4 py-3">
                      <div class="relative max-w-[14rem]">
                        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                          >$</span
                        >
                        <UInput
                          :model-value="centsToDecimalInput(price.priceCents)"
                          class="w-full"
                          inputmode="decimal"
                          placeholder="0.00"
                          :ui="{ base: 'pl-7' }"
                          @blur="(e: FocusEvent) => { price.priceCents = decimalInputToCents((e.target as HTMLInputElement).value) }"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <UButton
                        type="button"
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="ghost"
                        @click="openPendingVariantTierPricesModal(price.priceListId)"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span
                        v-if="(pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0) > 0 && price.priceCents > 0"
                        class="font-semibold"
                        :class="price.priceCents >= (pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0) ? 'text-success' : 'text-error'"
                      >
                        {{ Math.round(((price.priceCents - (pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0)) / (pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 1)) * 100) }}%
                      </span>
                      <span v-else class="text-muted">--</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span
                        v-if="(pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0) > 0 && price.priceCents > 0"
                        class="font-semibold"
                        :class="price.priceCents >= (pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0) ? 'text-success' : 'text-error'"
                      >
                        $ {{ ((price.priceCents - (pendingVariantDetailState.purchaseCost ? decimalInputToCents(pendingVariantDetailState.purchaseCost) : 0)) / 100).toFixed(2) }}
                      </span>
                      <span v-else class="text-muted">--</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton type="button" label="Cancelar" color="neutral" variant="outline" @click="closePendingVariantDetailModal" />
          <UButton type="button" label="Guardar" @click="savePendingVariantDetailModal" />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isPendingVariantTierModalOpen"
      title="Precios por Cantidad"
      :content="{ class: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{ pendingVariantDetailName }}</span>
            <UBadge color="primary" variant="subtle">{{ pendingVariantTierPriceListName }}</UBadge>
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

              <div class="relative">
                <span
                  class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                  >$</span
                >
                <UInput
                  v-model="row.price"
                  inputmode="decimal"
                  class="w-full"
                  :ui="{ base: 'pl-7 pr-24' }"
                />
                <span
                  class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted"
                  >por Unidad</span
                >
              </div>

              <div class="flex justify-end md:justify-center">
                <UButton
                  type="button"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
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
          <UButton type="button" label="Guardar" @click="savePendingVariantTierPricesModal" />
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
      :product-purchase-net-cost-cents="product?.purchaseNetCostCents ?? 0"
      @update:open="handleVariantDetailModalOpenChange"
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

    <UModal
      v-model:open="isCategoryModalOpen"
      title="Nueva categoría"
      :content="{ class: 'sm:max-w-lg' }"
    >
      <template #body>
        <UForm
          id="create-category-modal-form"
          :schema="categorySchema"
          :state="categoryState"
          class="space-y-3"
          @submit="handleCreateCategory"
        >
          <UFormField label="Nombre" name="name">
            <UInput
              v-model="categoryState.name"
              placeholder="Nombre de la categoría"
              :disabled="createCategoryMutation.isPending.value"
            />
          </UFormField>

          <p v-if="categoryCreateError" class="text-sm text-error">{{ categoryCreateError }}</p>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="createCategoryMutation.isPending.value"
            @click="closeCreateCategoryModal"
          />
          <UButton
            label="Guardar"
            type="submit"
            form="create-category-modal-form"
            :loading="createCategoryMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isBrandModalOpen" title="Nueva marca" :content="{ class: 'sm:max-w-lg' }">
      <template #body>
        <UForm
          id="create-brand-modal-form"
          :schema="brandSchema"
          :state="brandState"
          class="space-y-3"
          @submit="handleCreateBrand"
        >
          <UFormField label="Nombre" name="name">
            <UInput
              v-model="brandState.name"
              placeholder="Nombre de la marca"
              :disabled="createBrandMutation.isPending.value"
            />
          </UFormField>

          <p v-if="brandCreateError" class="text-sm text-error">{{ brandCreateError }}</p>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            type="button"
            label="Cancelar"
            color="neutral"
            variant="outline"
            :disabled="createBrandMutation.isPending.value"
            @click="closeCreateBrandModal"
          />
          <UButton
            label="Guardar"
            type="submit"
            form="create-brand-modal-form"
            :loading="createBrandMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isLotModalOpen"
      title="Agregar lote"
      :content="{ class: 'sm:max-w-2xl' }"
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
            :loading="createLotMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isVariantModalOpen"
      :title="variantModalTitle"
      :content="{ class: 'sm:max-w-2xl' }"
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
            <USelect
              v-model="variantState.option"
              :items="variantOptionItems"
              placeholder="Seleccioná una opción"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Valor" name="value">
            <UInput v-model="variantState.value" placeholder="Ej: Mediano" />
          </UFormField>

          <UFormField label="SKU" name="sku">
            <UInput v-model="variantState.sku" placeholder="Opcional" />
          </UFormField>

          <UFormField label="Código de barras" name="barcode">
            <UInput v-model="variantState.barcode" placeholder="Opcional" />
          </UFormField>

          <UFormField label="Existencias" name="quantity">
            <UInputNumber v-model="variantState.quantity" :min="0" class="w-full" />
          </UFormField>

          <UFormField label="Existencias mínimas" name="minQuantity">
            <UInputNumber v-model="variantState.minQuantity" :min="0" class="w-full" />
          </UFormField>

          <UFormField label="Costo de compra (neto)" name="purchaseCost" class="md:col-span-2">
            <div class="relative w-full">
              <span
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
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
            :loading="
              createVariantMutation.isPending.value || updateVariantMutation.isPending.value
            "
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
