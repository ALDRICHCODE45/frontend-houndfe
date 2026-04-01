<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AxiosError } from 'axios'
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { productApi } from '../api/product.api'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type {
  CreateLotPayload,
  CreateVariantPayload,
  DomainApiError,
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

const productId = computed(() => String(route.params.id ?? ''))

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const {
  data: product,
  isLoading,
  isError,
  refetch,
} = useQuery({
  queryKey: computed(() => productQueryKeys.detail(productId.value)),
  queryFn: () => productApi.getById(productId.value),
  enabled: computed(() => productId.value.length > 0),
  refetchOnWindowFocus: false,
})

const { data: variants, isFetching: isFetchingVariants } = useQuery({
  queryKey: computed(() => productQueryKeys.variants(productId.value)),
  queryFn: () => productApi.getVariants(productId.value),
  enabled: computed(() => productId.value.length > 0),
  refetchOnWindowFocus: false,
})

const { data: lots, isFetching: isFetchingLots } = useQuery({
  queryKey: computed(() => productQueryKeys.lots(productId.value)),
  queryFn: () => productApi.getLots(productId.value),
  enabled: computed(() => productId.value.length > 0),
  refetchOnWindowFocus: false,
})

const variantsList = computed(() => variants.value ?? [])
const lotsList = computed(() => lots.value ?? [])

const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))

const variantSchema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
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

const variantState = reactive<VariantFormState>({
  name: '',
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

const canCreateLots = computed(
  () => !product.value?.hasVariants && Boolean(product.value?.useLotsAndExpirations),
)

function mapDomainError(error: AxiosError<DomainApiError>): string {
  const response = error.response?.data
  if (!response) return 'No pudimos completar la operación. Reintentá en unos segundos.'
  return response.message ?? 'No pudimos completar la operación. Reintentá en unos segundos.'
}

function resetVariantForm() {
  Object.assign(variantState, {
    name: '',
    sku: '',
    barcode: '',
    quantity: 0,
  })
}

function resetLotForm() {
  Object.assign(lotState, {
    lotNumber: '',
    quantity: 0,
    manufactureDate: '',
    expirationDate: '',
  })
}

const createVariantMutation = useMutation({
  mutationFn: (payload: CreateVariantPayload) => productApi.createVariant(productId.value, payload),
  onSuccess: async () => {
    resetVariantForm()
    toast.add({
      title: 'Variante creada',
      description: 'La variante se creó correctamente.',
      color: 'success',
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(productId.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear variante', description: message, color: 'error' })
  },
})

const deleteVariantMutation = useMutation({
  mutationFn: (variantId: string) => productApi.removeVariant(productId.value, variantId),
  onSuccess: async () => {
    toast.add({
      title: 'Variante eliminada',
      description: 'La variante fue eliminada correctamente.',
      color: 'success',
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(productId.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar variante', description: message, color: 'error' })
  },
})

const createLotMutation = useMutation({
  mutationFn: (payload: CreateLotPayload) => productApi.createLot(productId.value, payload),
  onSuccess: async () => {
    resetLotForm()
    toast.add({
      title: 'Lote creado',
      description: 'El lote se creó correctamente.',
      color: 'success',
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(productId.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al crear lote', description: message, color: 'error' })
  },
})

const deleteLotMutation = useMutation({
  mutationFn: (lotId: string) => productApi.removeLot(productId.value, lotId),
  onSuccess: async () => {
    toast.add({
      title: 'Lote eliminado',
      description: 'El lote fue eliminado correctamente.',
      color: 'success',
    })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.detail(productId.value) }),
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lots(productId.value) }),
    ])
  },
  onError: (error) => {
    const message = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar lote', description: message, color: 'error' })
  },
})

function handleCreateVariant(event: FormSubmitEvent<VariantFormState>) {
  createVariantMutation.mutate({
    name: event.data.name,
    ...(event.data.sku ? { sku: event.data.sku } : {}),
    ...(event.data.barcode ? { barcode: event.data.barcode } : {}),
    quantity: event.data.quantity,
  })
}

function handleCreateLot(event: FormSubmitEvent<LotFormState>) {
  if (!canCreateLots.value) return

  createLotMutation.mutate({
    lotNumber: event.data.lotNumber,
    quantity: event.data.quantity,
    expirationDate: event.data.expirationDate,
    ...(event.data.manufactureDate ? { manufactureDate: event.data.manufactureDate } : {}),
  })
}

async function handleDeleteVariant(variantId: string, variantName: string) {
  if (!canDeleteProduct.value) return
  const confirmed = window.confirm(`¿Querés eliminar la variante ${variantName}?`)
  if (!confirmed) return
  await deleteVariantMutation.mutateAsync(variantId)
}

async function handleDeleteLot(lotId: string, lotNumber: string) {
  if (!canDeleteProduct.value) return
  const confirmed = window.confirm(`¿Querés eliminar el lote ${lotNumber}?`)
  if (!confirmed) return
  await deleteLotMutation.mutateAsync(lotId)
}

const formattedPrice = computed(() =>
  currencyFormatter.format((product.value?.priceCents ?? 0) / 100),
)
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <UButton
      label="Volver a productos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      class="w-fit"
      @click="router.push('/pos/products')"
    />

    <UCard>
      <template #header>
        <div>
          <h2 class="text-2xl font-semibold">Detalle de producto</h2>
          <p class="text-sm text-muted">Información base del producto para POS.</p>
        </div>
      </template>

      <div v-if="isLoading" class="py-8 text-sm text-muted">Cargando detalle...</div>

      <div v-else-if="isError || !product" class="flex items-center justify-between gap-4 py-8">
        <p class="text-sm text-error">No pudimos cargar el detalle del producto.</p>
        <UButton label="Reintentar" variant="outline" color="neutral" @click="refetch" />
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <p class="text-xs uppercase text-muted">Nombre</p>
          <p class="font-medium">{{ product.name }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">SKU</p>
          <p class="font-mono">{{ product.sku ?? '—' }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Categoría</p>
          <p>{{ product.categoryName }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Precio</p>
          <p class="font-semibold">{{ formattedPrice }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Stock</p>
          <p>{{ product.quantity }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Stock mínimo</p>
          <p>{{ product.minQuantity }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Descripción</p>
          <p>{{ product.description ?? '—' }}</p>
        </div>

        <div>
          <p class="text-xs uppercase text-muted">Ubicación</p>
          <p>{{ product.location ?? '—' }}</p>
        </div>

        <div class="md:col-span-2 flex flex-wrap gap-2 pt-2">
          <UBadge :color="product.useStock ? 'success' : 'neutral'" variant="soft">
            {{ product.useStock ? 'Usa stock' : 'Sin control de stock' }}
          </UBadge>
          <UBadge :color="product.sellInPos ? 'success' : 'neutral'" variant="soft">
            {{ product.sellInPos ? 'POS activo' : 'POS inactivo' }}
          </UBadge>
          <UBadge :color="product.includeInOnlineCatalog ? 'primary' : 'neutral'" variant="soft">
            {{ product.includeInOnlineCatalog ? 'Visible online' : 'No visible online' }}
          </UBadge>
          <UBadge :color="product.chargeProductTaxes ? 'warning' : 'neutral'" variant="soft">
            {{ product.chargeProductTaxes ? 'Aplica impuestos' : 'Sin impuestos' }}
          </UBadge>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="text-xl font-semibold">Variantes</h3>
          <p class="text-sm text-muted">Creá y administrá variantes del producto.</p>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <UForm
          :schema="variantSchema"
          :state="variantState"
          class="grid grid-cols-1 gap-3 md:grid-cols-5"
          @submit="handleCreateVariant"
        >
          <UFormField label="Nombre" name="name" class="md:col-span-2">
            <UInput
              v-model="variantState.name"
              :disabled="!canUpdateProduct"
              placeholder="Ej: Talle M"
            />
          </UFormField>
          <UFormField label="SKU" name="sku">
            <UInput
              v-model="variantState.sku"
              :disabled="!canUpdateProduct"
              placeholder="Opcional"
            />
          </UFormField>
          <UFormField label="Código de barras" name="barcode">
            <UInput
              v-model="variantState.barcode"
              :disabled="!canUpdateProduct"
              placeholder="Opcional"
            />
          </UFormField>
          <UFormField label="Stock" name="quantity">
            <UInput
              v-model.number="variantState.quantity"
              :disabled="!canUpdateProduct"
              type="number"
              :min="0"
            />
          </UFormField>

          <div class="md:col-span-5 flex justify-end">
            <UButton
              type="submit"
              label="Crear variante"
              icon="i-lucide-plus"
              :loading="createVariantMutation.isPending.value"
              :disabled="!canUpdateProduct"
            />
          </div>
        </UForm>

        <div v-if="isFetchingVariants" class="text-sm text-muted">Actualizando variantes...</div>
        <div v-if="variantsList.length === 0" class="text-sm text-muted">
          Sin variantes registradas.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="variant in variantsList"
            :key="variant.id"
            class="flex items-center justify-between gap-4 rounded-md border border-default p-3"
          >
            <div>
              <p class="font-medium">{{ variant.name }}</p>
              <p class="text-sm text-muted">
                SKU: {{ variant.sku ?? '—' }} · Código: {{ variant.barcode ?? '—' }} · Stock:
                {{ variant.quantity }}
              </p>
            </div>
            <UButton
              v-if="canDeleteProduct"
              label="Eliminar"
              color="error"
              variant="ghost"
              :loading="deleteVariantMutation.isPending.value"
              @click="handleDeleteVariant(variant.id, variant.name)"
            />
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div>
          <h3 class="text-xl font-semibold">Lotes</h3>
          <p class="text-sm text-muted">Gestioná lotes y vencimientos del producto.</p>
        </div>
      </template>

      <div class="flex flex-col gap-4">
        <p v-if="product?.hasVariants" class="text-sm text-warning">
          Este producto tiene variantes activas. La gestión por lotes queda deshabilitada.
        </p>
        <p v-else-if="!product?.useLotsAndExpirations" class="text-sm text-muted">
          Activá “Usar lotes y vencimientos” para poder crear lotes.
        </p>

        <UForm
          :schema="lotSchema"
          :state="lotState"
          class="grid grid-cols-1 gap-3 md:grid-cols-4"
          @submit="handleCreateLot"
        >
          <UFormField label="Lote" name="lotNumber">
            <UInput
              v-model="lotState.lotNumber"
              :disabled="!canCreateLots || !canUpdateProduct"
              placeholder="Ej: LOTE-2026-04"
            />
          </UFormField>
          <UFormField label="Cantidad" name="quantity">
            <UInput
              v-model.number="lotState.quantity"
              :disabled="!canCreateLots || !canUpdateProduct"
              type="number"
              :min="0"
            />
          </UFormField>
          <UFormField label="Fabricación" name="manufactureDate">
            <UInput
              v-model="lotState.manufactureDate"
              :disabled="!canCreateLots || !canUpdateProduct"
              type="date"
            />
          </UFormField>

          <UFormField label="Vencimiento" name="expirationDate">
            <UInput
              v-model="lotState.expirationDate"
              :disabled="!canCreateLots || !canUpdateProduct"
              type="date"
            />
          </UFormField>

          <div class="md:col-span-4 flex justify-end">
            <UButton
              type="submit"
              label="Crear lote"
              icon="i-lucide-plus"
              :loading="createLotMutation.isPending.value"
              :disabled="!canCreateLots || !canUpdateProduct"
            />
          </div>
        </UForm>

        <div v-if="isFetchingLots" class="text-sm text-muted">Actualizando lotes...</div>
        <div v-if="lotsList.length === 0" class="text-sm text-muted">Sin lotes registrados.</div>

        <div v-else class="space-y-2">
          <div
            v-for="lot in lotsList"
            :key="lot.id"
            class="flex items-center justify-between gap-4 rounded-md border border-default p-3"
          >
            <div>
              <p class="font-medium">{{ lot.lotNumber }}</p>
              <p class="text-sm text-muted">
                Cantidad: {{ lot.quantity }} · Fab: {{ lot.manufactureDate ?? '—' }} · Vence:
                {{ lot.expirationDate ?? 'Sin fecha' }}
              </p>
            </div>
            <UButton
              v-if="canDeleteProduct"
              label="Eliminar"
              color="error"
              variant="ghost"
              :loading="deleteLotMutation.isPending.value"
              :disabled="product?.hasVariants"
              @click="handleDeleteLot(lot.id, lot.lotNumber)"
            />
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
