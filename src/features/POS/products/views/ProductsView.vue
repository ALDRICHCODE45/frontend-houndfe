<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { z } from 'zod'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { productApi } from '../api/product.api'
import ProductList from '../components/ProductList.vue'
import ProductUpsertSlideover from '../components/ProductUpsertSlideover.vue'
import { productStockError } from '../utils/productStockErrors'
import '../styles/products-visual.css'
import type {
  BrandOption,
  CategoryOption,
  CreateBrandPayload,
  CreateCategoryPayload,
  CreateProductPayload,
  Product,
  ProductDetail,
  UpdateProductPayload,
} from '../interfaces/product.types'

type ProductFormErrors = Partial<
  Record<
    'name' | 'sku' | 'barcode' | 'price' | 'quantity' | 'minQuantity' | 'satKey' | 'useStock',
    string
  >
>

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const router = useRouter()
const queryClient = useQueryClient()
const toast = useToast()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

// ── WU-F · PRODUCT/SERVICE toolbar toggle ────────────────────────────
// filterType drives the queryKey (refetch) and queryFn (?type=) below, so it
// MUST be declared before useServerTable — reading it here before its
// declaration would throw a TDZ ReferenceError during setup.
type ToolbarTypeFilter = 'ALL' | 'PRODUCT' | 'SERVICE'
const ALL_FILTER_VALUE = 'ALL'
const filterType = ref<ToolbarTypeFilter>(ALL_FILTER_VALUE)
const queryTypeParam = computed(() => (filterType.value === 'ALL' ? undefined : filterType.value))

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  columnOrder,
  columnSizing,
  density,
  resetLayout,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useServerTable<Product>({
  queryKey: () => [
    ...productQueryKeys.paginated(tenantId.value),
    { type: queryTypeParam.value ?? 'ALL' },
  ],
  queryFn: (params) => productApi.getPaginated({ ...params, type: queryTypeParam.value }),
  defaultPageSize: 10,
  persistKey: 'pos-products',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

const { data: categories = [] } = useQuery({
  queryKey: computed(() => productQueryKeys.categories(tenantId.value)),
  queryFn: productApi.getCategories,
  refetchOnWindowFocus: false,
})

const { data: brandsList = [] } = useQuery({
  queryKey: computed(() => productQueryKeys.brands(tenantId.value)),
  queryFn: productApi.getBrands,
  refetchOnWindowFocus: false,
})

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedProduct = ref<ProductDetail | null>(null)
const selectedProductId = ref<string | null>(null)
const formErrors = ref<ProductFormErrors>({})
const createdCategoryId = ref<string | null>(null)
const categoryCreateError = ref('')
const isCreateCategoryModalOpen = ref(false)
const createdBrandId = ref<string | null>(null)
const brandCreateError = ref('')
const isCreateBrandModalOpen = ref(false)
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

const createCategorySchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'La categoría debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
})

type CreateCategoryFormValues = z.infer<typeof createCategorySchema>

const createCategoryFormState = reactive<CreateCategoryFormValues>({
  name: '',
})

const createBrandSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es obligatorio' })
    .trim()
    .min(2, 'La marca debe tener al menos 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
})

type CreateBrandFormValues = z.infer<typeof createBrandSchema>

const createBrandFormState = reactive<CreateBrandFormValues>({
  name: '',
})

const canReadProduct = computed(() => authStore.userCan('read', 'Product'))
const canCreateProduct = computed(() => authStore.userCan('create', 'Product'))
const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))

// ── Reset pagination + clear selection when filterType changes ────────
//
// products-list REQ-3: switching PRODUCT/SERVICE/TODOS must reset to page 0
// AND clear bulk selection. Done in a watcher so the toolbar toggle stays
// declarative.
watch(filterType, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
  rowSelection.value = {}
})

const typeFilterItems = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Producto', value: 'PRODUCT' },
  { label: 'Servicio', value: 'SERVICE' },
]

const isFiltered = computed(() => globalFilter.value.trim() !== '' || filterType.value !== ALL_FILTER_VALUE)
const activeFilterCount = computed(() => (filterType.value === ALL_FILTER_VALUE ? 0 : 1))

function clearFilters() {
  globalFilter.value = ''
  filterType.value = ALL_FILTER_VALUE
}

function clearFormContext() {
  selectedProduct.value = null
  selectedProductId.value = null
  formErrors.value = {}
  createdCategoryId.value = null
  categoryCreateError.value = ''
  isCreateCategoryModalOpen.value = false
  createCategoryFormState.name = ''
  createdBrandId.value = null
  brandCreateError.value = ''
  isCreateBrandModalOpen.value = false
  createBrandFormState.name = ''
}

function productMatchesFilter(product: ProductDetail, filter: string): boolean {
  const normalizedFilter = filter.toLowerCase().trim()
  if (!normalizedFilter) return true

  return [
    product.name,
    product.sku ?? '',
    product.barcode ?? '',
    product.categoryName,
    product.brandName,
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedFilter)
}

function resetVisibilityContextAfterCreate(createdProduct: ProductDetail) {
  if (pagination.value.pageIndex !== 0) {
    pagination.value = { ...pagination.value, pageIndex: 0 }
  }

  const activeFilter = globalFilter.value.trim()
  if (activeFilter && !productMatchesFilter(createdProduct, activeFilter)) {
    globalFilter.value = ''
  }
}

function mapDomainError(error: AxiosError<DomainApiError>): {
  message: string
  fields: ProductFormErrors
} {
  const response = error.response?.data
  const fallback = 'No pudimos guardar el producto. Reintenta en unos segundos.'

  if (!response) {
    return { message: fallback, fields: {} }
  }

  const code = response.error
  const fields: ProductFormErrors = {}

  // O1 S7: the stock codes are switched on `error`, never on `message`.
  const stockError = productStockError(error)
  if (stockError) {
    if (stockError.field === 'quantity' || stockError.field === 'useStock') {
      fields[stockError.field] = stockError.message
    }
    return { message: stockError.message, fields }
  }

  const message = response.message ?? fallback
  const normalized = message.toLowerCase()

  if (code === 'ENTITY_ALREADY_EXISTS') {
    if (normalized.includes('sku')) {
      fields.sku = 'Ya existe un producto o variante con ese SKU.'
    }
    if (normalized.includes('barcode')) {
      fields.barcode = 'Ya existe un producto o variante con ese código de barras.'
    }
  }

  if (code === 'INVALID_ARGUMENT') {
    if (normalized.includes('price')) fields.price = message
    if (normalized.includes('quantity')) fields.quantity = message
    if (normalized.includes('minquantity') || normalized.includes('min quantity')) {
      fields.minQuantity = message
    }
  }

  if (code === 'SAT_KEY_NOT_FOUND') {
    fields.satKey = message
  }

  return { message, fields }
}

const createMutation = useMutation({
  mutationFn: (payload: CreateProductPayload) => productApi.create(payload),
  onSuccess: async (createdProduct) => {
    isCreateOpen.value = false
    resetVisibilityContextAfterCreate(createdProduct)
    clearFormContext()
    toast.add({
      title: 'Producto creado',
      description: 'El producto se creó correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated(tenantId.value) })
    await queryClient.refetchQueries({
      queryKey: productQueryKeys.paginated(tenantId.value),
      type: 'active',
    })
  },
  onError: (error) => {
    const { message, fields } = mapDomainError(error as AxiosError<DomainApiError>)
    formErrors.value = fields
    toast.add({ title: 'Error al crear producto', description: message, color: 'error' })
  },
})

const createCategoryMutation = useMutation({
  mutationFn: (payload: CreateCategoryPayload) => productApi.createCategory(payload),
  onMutate: () => {
    categoryCreateError.value = ''
  },
  onSuccess: async (category: CategoryOption) => {
    createdCategoryId.value = category.id
    categoryCreateError.value = ''
    isCreateCategoryModalOpen.value = false
    createCategoryFormState.name = ''

    toast.add({
      title: 'Categoría creada',
      description: `La categoría ${category.name} ya está disponible para seleccionar.`,
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.categories(tenantId.value) })
    await queryClient.refetchQueries({
      queryKey: productQueryKeys.categories(tenantId.value),
      type: 'active',
    })
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    categoryCreateError.value = message
    toast.add({ title: 'Error al crear categoría', description: message, color: 'error' })
  },
})

function openCreateCategoryModal() {
  categoryCreateError.value = ''
  isCreateCategoryModalOpen.value = true
}

function closeCreateCategoryModal() {
  isCreateCategoryModalOpen.value = false
  createCategoryFormState.name = ''
  categoryCreateError.value = ''
}

function handleCreateCategorySubmit(event: FormSubmitEvent<CreateCategoryFormValues>) {
  createCategoryMutation.mutate({ name: event.data.name.trim() })
}

const createBrandMutation = useMutation({
  mutationFn: (payload: CreateBrandPayload) => productApi.createBrand(payload),
  onMutate: () => {
    brandCreateError.value = ''
  },
  onSuccess: async (brand: BrandOption) => {
    createdBrandId.value = brand.id
    brandCreateError.value = ''
    isCreateBrandModalOpen.value = false
    createBrandFormState.name = ''

    toast.add({
      title: 'Marca creada',
      description: `La marca ${brand.name} ya está disponible para seleccionar.`,
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.brands(tenantId.value) })
    await queryClient.refetchQueries({
      queryKey: productQueryKeys.brands(tenantId.value),
      type: 'active',
    })
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    brandCreateError.value = message
    toast.add({ title: 'Error al crear marca', description: message, color: 'error' })
  },
})

function openCreateBrandModal() {
  brandCreateError.value = ''
  isCreateBrandModalOpen.value = true
}

function closeCreateBrandModal() {
  isCreateBrandModalOpen.value = false
  createBrandFormState.name = ''
  brandCreateError.value = ''
}

function handleCreateBrandSubmit(event: FormSubmitEvent<CreateBrandFormValues>) {
  createBrandMutation.mutate({ name: event.data.name.trim() })
}

const updateMutation = useMutation({
  mutationFn: (payload: { productId: string; values: UpdateProductPayload }) =>
    productApi.update(payload.productId, payload.values),
  onSuccess: async (_, variables) => {
    isEditOpen.value = false
    clearFormContext()
    toast.add({
      title: 'Producto actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated(tenantId.value) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.detail(tenantId.value, variables.productId),
      }),
    ])
  },
  onError: (error) => {
    const { message, fields } = mapDomainError(error as AxiosError<DomainApiError>)
    formErrors.value = fields
    toast.add({ title: 'Error al actualizar producto', description: message, color: 'error' })
  },
})

const deleteMutation = useMutation({
  mutationFn: (productId: string) => productApi.remove(productId),
  onSuccess: async () => {
    toast.add({
      title: 'Producto eliminado',
      description: 'El producto fue eliminado correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated(tenantId.value) })
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar producto', description: message, color: 'error' })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    updateMutation.isPending.value ||
    deleteMutation.isPending.value,
)

function handleAdd() {
  if (!canCreateProduct.value) return
  formErrors.value = {}
  createdCategoryId.value = null
  categoryCreateError.value = ''
  isCreateOpen.value = true
}

async function handleOpenEdit(product: Product) {
  if (!canUpdateProduct.value) return

  try {
    formErrors.value = {}
    selectedProduct.value = await productApi.getById(product.id)
    selectedProductId.value = product.id
    isEditOpen.value = true
  } catch {
    toast.add({
      title: 'No se pudo abrir el editor',
      description: 'No pudimos cargar el detalle del producto.',
      color: 'error',
    })
  }
}

async function handleDelete(product: Product) {
  if (!canDeleteProduct.value) return

  openConfirm(`¿Quieres eliminar el producto ${product.name}?`, () => {
    void deleteMutation.mutateAsync(product.id)
  })
}

function openDetails(product: Product) {
  if (!canReadProduct.value) return
  void router.push(`/pos/products/${product.id}`)
}

function handleEditSubmit(values: UpdateProductPayload) {
  if (!selectedProductId.value) return
  updateMutation.mutate({ productId: selectedProductId.value, values })
}

// Error title of the products table: a human sentence, never the server message.
const productsErrorMessage = 'No se pudieron cargar los productos'
</script>

<template>
  <div class="hf-theme hf-ui products-visual flex w-full min-w-0 flex-col gap-6 md:px-10">
    <ProductUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :categories="categories"
      :brands="brandsList"
      :loading="isSubmitting"
      :errors="formErrors"
      :created-category-id="createdCategoryId"
      :created-brand-id="createdBrandId"
      @create="createMutation.mutate"
      @request-create-category="openCreateCategoryModal"
      @request-create-brand="openCreateBrandModal"
      @close="clearFormContext"
    />

    <ProductUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :categories="categories"
      :brands="brandsList"
      :loading="isSubmitting"
      :errors="formErrors"
      :product="selectedProduct"
      @edit="handleEditSubmit"
      @close="clearFormContext"
    />

    <UModal
      v-model:open="isCreateCategoryModalOpen"
      title="Nueva categoría"
      :content="{ class: 'sm:max-w-lg' }"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay hf-shell-products-portal' }"
    >
      <template #body>
        <UForm
          id="create-category-modal-form"
          :schema="createCategorySchema"
          :state="createCategoryFormState"
          class="space-y-3"
          @submit="handleCreateCategorySubmit"
        >
          <UFormField label="Nombre" name="name">
            <UInput
              v-model="createCategoryFormState.name"
              placeholder="Nombre de la categoría"
              :disabled="createCategoryMutation.isPending.value"
              size="lg"
            />
          </UFormField>

          <p v-if="categoryCreateError" class="text-sm text-[var(--hf-danger)]" role="alert">{{ categoryCreateError }}</p>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
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
            color="primary"
            class="hf-primary-control"
            :loading="createCategoryMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="isCreateBrandModalOpen"
      title="Nueva marca"
      :content="{ class: 'sm:max-w-lg' }"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay hf-shell-products-portal' }"
    >
      <template #body>
        <UForm
          id="create-brand-modal-form"
          :schema="createBrandSchema"
          :state="createBrandFormState"
          class="space-y-3"
          @submit="handleCreateBrandSubmit"
        >
          <UFormField label="Nombre" name="name">
            <UInput
              v-model="createBrandFormState.name"
              placeholder="Nombre de la marca"
              :disabled="createBrandMutation.isPending.value"
              size="lg"
            />
          </UFormField>

          <p v-if="brandCreateError" class="text-sm text-[var(--hf-danger)]" role="alert">{{ brandCreateError }}</p>
        </UForm>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
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
            color="primary"
            class="hf-primary-control"
            :loading="createBrandMutation.isPending.value"
          />
        </div>
      </template>
    </UModal>

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="deleteMutation.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay hf-shell-products-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <header class="hf-page-header"><h1 class="hf-page-title">Productos</h1></header>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
      aria-label="Productos"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <ProductList
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:column-order="columnOrder"
          v-model:column-sizing="columnSizing"
          v-model:density="density"
          :persist-layout="true"
          :items="data"
          :can-read="canReadProduct"
          :can-update="canUpdateProduct"
          :can-delete="canDeleteProduct"
          :can-create="canCreateProduct"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="productsErrorMessage"
          :filtered="isFiltered"
          :search-term="globalFilter"
          :active-filter-count="activeFilterCount"
          :total-count="totalCount"
          :page-count="pageCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          @open="openDetails"
          @edit="handleOpenEdit"
          @delete="handleDelete"
          @add="handleAdd"
          @refresh="refresh"
          @clear-filters="clearFilters"
          @reset-columns="resetLayout"
        >
          <template #filters>
            <ToolbarSelectFilter
              v-model="filterType"
              :items="typeFilterItems"
              label="Tipo"
              portal-class="hf-theme hf-ui hf-shell-products-portal"
              test-id="product-type-filter"
            />
          </template>
        </ProductList>
      </div>
    </UCard>
  </div>
</template>
