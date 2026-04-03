<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { z } from 'zod'
import { AppDataTable, SortableHeader, SelectColumn } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { productApi } from '../api/product.api'
import ProductUpsertSlideover from '../components/ProductUpsertSlideover.vue'
import { useProductColumns } from '../composables/useProductColumns'
import type {
  CategoryOption,
  CreateCategoryPayload,
  CreateProductPayload,
  Product,
  ProductDetail,
  UpdateProductPayload,
} from '../interfaces/product.types'
import { getStockColor, productStatusConfig } from '../utils/productStatusConfig.utils'

type ProductFormErrors = Partial<
  Record<'name' | 'sku' | 'barcode' | 'price' | 'quantity' | 'minQuantity', string>
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
const { columns, currencyFormatter } = useProductColumns()
const authStore = useAuthStore()

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useServerTable<Product>({
  queryKey: productQueryKeys.paginated(),
  queryFn: (params) => productApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'pos-products',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

const { data: categories = [] } = useQuery({
  queryKey: productQueryKeys.categories(),
  queryFn: productApi.getCategories,
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

const canReadProduct = computed(() => authStore.userCan('read', 'Product'))
const canCreateProduct = computed(() => authStore.userCan('create', 'Product'))
const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))
const canManageProductActions = computed(
  () => canReadProduct.value || canUpdateProduct.value || canDeleteProduct.value,
)

function clearFormContext() {
  selectedProduct.value = null
  selectedProductId.value = null
  formErrors.value = {}
  createdCategoryId.value = null
  categoryCreateError.value = ''
  isCreateCategoryModalOpen.value = false
  createCategoryFormState.name = ''
}

function productMatchesFilter(product: ProductDetail, filter: string): boolean {
  const normalizedFilter = filter.toLowerCase().trim()
  if (!normalizedFilter) return true

  return [product.name, product.sku ?? '', product.barcode ?? '', product.categoryName]
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
  const fallback = 'No pudimos guardar el producto. Reintentá en unos segundos.'

  if (!response) {
    return { message: fallback, fields: {} }
  }

  const message = response.message ?? fallback
  const code = response.error
  const fields: ProductFormErrors = {}
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

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated() })
    await queryClient.refetchQueries({ queryKey: productQueryKeys.paginated(), type: 'active' })
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

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.categories() })
    await queryClient.refetchQueries({ queryKey: productQueryKeys.categories(), type: 'active' })
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
      queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated() }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(variables.productId) }),
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

    await queryClient.invalidateQueries({ queryKey: productQueryKeys.paginated() })
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

  openConfirm(`¿Querés eliminar el producto ${product.name}?`, () => {
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

function getRowItems(product: Product) {
  const mainActions = [
    ...(canReadProduct.value ? [{ label: 'Detalles', onSelect: () => openDetails(product) }] : []),
    ...(canUpdateProduct.value
      ? [{ label: 'Editar', onSelect: () => handleOpenEdit(product) }]
      : []),
  ]

  const destructiveActions = canDeleteProduct.value
    ? [
        {
          label: 'Eliminar',
          color: 'error' as const,
          onSelect: () => handleDelete(product),
        },
      ]
    : []

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}

const bulkActions = computed<BulkAction<Product>[]>(() => [])
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <ProductUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :categories="categories"
      :loading="isSubmitting"
      :errors="formErrors"
      :created-category-id="createdCategoryId"
      @create="createMutation.mutate"
      @request-create-category="openCreateCategoryModal"
      @close="clearFormContext"
    />

    <ProductUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :categories="categories"
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

          <p v-if="categoryCreateError" class="text-sm text-error">{{ categoryCreateError }}</p>
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
            :loading="createCategoryMutation.isPending.value"
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
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <TableHeaderDescription
          description="Gestión de inventario y catálogo de productos"
          title="Productos"
        />
      </template>
      <div class="px-6 py-5">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :bulk-actions="bulkActions"
          :show-add-button="canCreateProduct"
          search-placeholder="Buscar productos..."
          add-button-text="Nuevo Producto"
          add-button-icon="i-lucide-package-plus"
          enable-column-visibility
          :enable-row-selection="false"
          empty="No se encontraron productos"
          @add="handleAdd"
          @refresh="refresh"
        >
          <template #select-header="{ table }">
            <SelectColumn mode="header" :table="table" />
          </template>

          <template #select-cell="{ row }">
            <SelectColumn mode="cell" :row="row" />
          </template>

          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #categoryName-header="{ column }">
            <SortableHeader :column="column" label="Categoría" />
          </template>

          <template #priceCents-header="{ column }">
            <SortableHeader :column="column" label="Precio" />
          </template>

          <template #quantity-header="{ column }">
            <SortableHeader :column="column" label="Stock" />
          </template>

          <template #name-cell="{ row }">
            <span>{{ row.original.name }}</span>
          </template>

          <template #sku-cell="{ row }">
            <span class="font-mono text-xs text-muted">{{ row.original.sku ?? '—' }}</span>
          </template>

          <template #categoryName-cell="{ row }">
            <span>{{ row.original.categoryName }}</span>
          </template>

          <template #priceCents-cell="{ row }">
            <span class="font-medium tabular-nums">
              {{ currencyFormatter.format(row.original.priceCents / 100) }}
            </span>
          </template>

          <template #quantity-cell="{ row }">
            <UBadge
              v-if="
                (row.original as Product).hasVariants &&
                (row.original as Product).variantStockTotal != null
              "
              :color="getStockColor((row.original as Product).variantStockTotal ?? 0)"
              variant="subtle"
              size="sm"
              class="font-semibold"
            >
              {{ (row.original as Product).variantStockTotal }} unidades en
              {{ (row.original as Product).variantCount }}
              {{ (row.original as Product).variantCount === 1 ? 'variante' : 'variantes' }}
            </UBadge>
            <UBadge
              v-else-if="(row.original as Product).hasVariants"
              color="neutral"
              variant="subtle"
              size="sm"
              class="font-semibold"
            >
              En variantes
            </UBadge>
            <UBadge
              v-else
              :color="getStockColor(row.original.quantity, row.original.minQuantity)"
              variant="subtle"
              size="sm"
              class="font-mono font-semibold"
            >
              {{ row.original.quantity }}
            </UBadge>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="productStatusConfig[(row.original as Product).status].color"
              variant="outline"
              size="sm"
            >
              {{ productStatusConfig[(row.original as Product).status].label }}
            </UBadge>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManageProductActions"
              :items="getRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-7"
              />
            </UDropdownMenu>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
