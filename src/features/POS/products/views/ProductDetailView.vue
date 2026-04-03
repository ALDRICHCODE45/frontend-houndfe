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
  CategoryOption,
  CreateLotPayload,
  CreateVariantPayload,
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

const variantSchema = z.object({
  option: z.string().trim().min(1, 'Seleccioná una opción'),
  value: z.string().trim().min(1, 'El valor es obligatorio').max(100),
  sku: z.string().trim().max(100),
  barcode: z.string().trim().max(100),
  quantity: z.number().int().min(0),
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
})

const lotState = reactive<LotFormState>({
  lotNumber: '',
  quantity: 0,
  manufactureDate: '',
  expirationDate: '',
})

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
const inlineVariantQuantityInputs = reactive<Record<string, number>>({})
const inlineVariantPublicPriceInputs = reactive<Record<string, string>>({})

const variantGroups = computed(() => {
  const grouped = new Map<string, { option: string; values: string[] }>()

  for (const variant of variantsList.value) {
    const optionName = variant.option?.trim() || 'Sin opción'
    const valueName = variant.value?.trim() || variant.name
    const existing = grouped.get(optionName)

    if (!existing) {
      grouped.set(optionName, { option: optionName, values: [valueName] })
      continue
    }

    if (!existing.values.includes(valueName)) {
      existing.values.push(valueName)
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

const showLotsCheckbox = computed(() => formState.useStock && !formState.hasVariants)
const showStockByVariantMessage = computed(() => formState.hasVariants)
const showInventoryCard = computed(() => formState.type === 'PRODUCT')
const showManualStockFields = computed(
  () => formState.useStock && !formState.useLotsAndExpirations && !formState.hasVariants,
)
const showLotsSection = computed(
  () => formState.useStock && formState.useLotsAndExpirations && !formState.hasVariants,
)
const showVariantsSection = computed(() => !isCreateMode.value && !formState.useLotsAndExpirations)
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

watch(
  () => formState.type,
  (type) => {
    if (type === 'SERVICE') {
      formState.useStock = false
      formState.useLotsAndExpirations = false
      formState.hasVariants = false
      formState.quantity = 0
      formState.minQuantity = 0
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

function resetVariantForm() {
  Object.assign(variantState, {
    option: '',
    value: '',
    sku: '',
    barcode: '',
    quantity: 0,
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

const createMutation = useMutation({
  mutationFn: (payload: MainFormValues) => productApi.create(toCreatePayload(payload)),
  onSuccess: async (createdProduct) => {
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

function openAddVariantModal() {
  resetVariantForm()
  isVariantModalOpen.value = true
}

function openEditVariantModal(variantId: string) {
  const variant = variantsList.value.find((item) => item.id === variantId)
  if (!variant) return

  editingVariantId.value = variant.id
  Object.assign(variantState, {
    option: variant.option ?? '',
    value: variant.value ?? variant.name,
    sku: variant.sku ?? '',
    barcode: variant.barcode ?? '',
    quantity: variant.quantity,
  })

  isVariantModalOpen.value = true
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

function handleCreateLot(event: FormSubmitEvent<LotFormState>) {
  if (isCreateMode.value) return
  if (!showLotsSection.value) return

  createLotMutation.mutate({
    lotNumber: event.data.lotNumber,
    quantity: event.data.quantity,
    expirationDate: event.data.expirationDate,
    ...(event.data.manufactureDate ? { manufactureDate: event.data.manufactureDate } : {}),
  })
}

function handleSubmitVariant(event: FormSubmitEvent<VariantFormState>) {
  if (isCreateMode.value) return

  const payload: CreateVariantPayload = {
    option: event.data.option,
    value: event.data.value,
    ...(event.data.sku ? { sku: event.data.sku } : {}),
    ...(event.data.barcode ? { barcode: event.data.barcode } : {}),
    quantity: event.data.quantity,
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
          <UCard>
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
                  :disabled="!canUpdateProduct"
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

            <div class="overflow-hidden rounded-md border border-default">
              <table class="min-w-full divide-y divide-default text-sm">
                <thead class="bg-elevated/40">
                  <tr>
                    <th class="px-4 py-3 text-left font-medium">Variante</th>
                    <th v-if="formState.useStock" class="px-4 py-3 text-left font-medium">
                      Existencias
                    </th>
                    <th class="px-4 py-3 text-left font-medium">Precio Público</th>
                    <th class="px-4 py-3 text-right font-medium">Actions</th>
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
                  v-if="!isCreateMode"
                  label="Agregar Lote"
                  icon="i-lucide-plus"
                  :disabled="!canUpdateProduct"
                  @click="isLotModalOpen = true"
                />
              </div>
            </template>

            <div v-if="!isCreateMode" class="space-y-3">
              <div class="overflow-hidden rounded-md border border-default">
                <table class="min-w-full divide-y divide-default text-sm">
                  <thead class="bg-elevated/40">
                    <tr>
                      <th class="px-4 py-3 text-left font-medium">Lote</th>
                      <th class="px-4 py-3 text-left font-medium">Caducidad</th>
                      <th class="px-4 py-3 text-left font-medium">Existencias</th>
                      <th class="px-4 py-3 text-right font-medium">Actions</th>
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

            <p v-else class="text-sm text-muted">
              Guardá el producto para empezar a cargar lotes y vencimientos.
            </p>
          </UCard>

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

    <VariantDetailModal
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

          <UFormField label="Existencias" name="quantity" class="md:col-span-2">
            <UInputNumber v-model="variantState.quantity" :min="0" class="w-full" />
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
