<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  productToFormInput,
  toCreatePayload,
  toUpdatePayload,
  useProductForm,
  type ProductFormValues,
} from '../composables/useProductForm'
import type {
  CategoryOption,
  CreateProductPayload,
  ProductDetail,
  UpdateProductPayload,
} from '../interfaces/product.types'
import CategorySelect, { type CategorySelectItem } from './CategorySelect.vue'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    loading?: boolean
    product?: ProductDetail | null
    categories?: CategoryOption[]
    errors?: Partial<Record<keyof ProductFormValues, string>>
    createdCategoryId?: string | null
  }>(),
  {
    loading: false,
    product: null,
    categories: () => [],
    errors: () => ({}),
    createdCategoryId: null,
  },
)

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  create: [payload: CreateProductPayload]
  edit: [payload: UpdateProductPayload]
  'request-create-category': []
  close: []
}>()

const router = useRouter()
const { schema, state, resetForm, setState } = useProductForm()

function goToFullEditor() {
  open.value = false
  void router.push('/pos/products/new')
}

const formId = computed(() =>
  props.mode === 'create' ? 'create-product-form' : 'edit-product-form',
)

const categoryItems = computed<CategorySelectItem[]>(() => [
  ...(props.mode === 'create'
    ? [
        {
          label: 'Crear categoría',
          value: '__create__',
          icon: 'i-lucide-plus',
          type: 'action' as const,
        },
        { label: '', value: '__sep__', type: 'separator' as const },
      ]
    : []),
  { label: 'Sin categoría', value: '', icon: 'i-lucide-minus' },
  ...props.categories.map((c) => ({ label: c.name, value: c.id, icon: 'i-lucide-package' })),
])

const title = computed(() => (props.mode === 'create' ? 'Nuevo producto' : 'Editar producto'))

const description = computed(() =>
  props.mode === 'create'
    ? 'Completá los datos básicos del producto para POS.'
    : 'Actualizá los datos base del producto.',
)

watch(
  () => [props.mode, props.product, open.value] as const,
  ([mode, product, isOpen]) => {
    if (!isOpen) return

    if (mode === 'edit' && product) {
      setState(productToFormInput(product))
      return
    }

    resetForm()
  },
  { immediate: true },
)

watch(
  () => props.createdCategoryId,
  (categoryId) => {
    if (!categoryId) return
    if (props.mode !== 'create' || !open.value) return

    state.categoryId = categoryId
  },
)

watch(
  () => open.value,
  (isOpen, wasOpen) => {
    if (wasOpen && !isOpen) {
      emit('close')
    }
  },
)

function onSubmit(event: FormSubmitEvent<ProductFormValues>) {
  if (props.mode === 'create') {
    emit('create', toCreatePayload(event.data))
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
      <UForm
        :id="formId"
        :schema="schema"
        :state="state"
        class="flex flex-col gap-4"
        @submit="onSubmit"
      >
        <UFormField label="Nombre" name="name" :error="errors.name">
          <UInput v-model="state.name" class="w-full" size="lg" placeholder="Ej: Jabón artesanal" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="SKU" name="sku" :error="errors.sku">
            <UInput v-model="state.sku" class="w-full" size="lg" placeholder="Ej: JAB-001" />
          </UFormField>

          <UFormField label="Código de barras" name="barcode" :error="errors.barcode">
            <UInput v-model="state.barcode" class="w-full" size="lg" placeholder="Opcional" />
          </UFormField>
        </div>

        <UFormField label="Categoría" name="categoryId" :error="errors.categoryId">
          <CategorySelect
            :model-value="state.categoryId"
            :items="categoryItems"
            placeholder="Seleccionar categoría"
            size="lg"
            @update:model-value="state.categoryId = $event"
            @action="emit('request-create-category')"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Precio" name="price" :error="errors.price">
            <UInput
              v-model="state.price"
              class="w-full"
              size="lg"
              placeholder="199.90"
              inputmode="decimal"
            />
          </UFormField>

          <UFormField label="Stock" name="quantity" :error="errors.quantity">
            <UInputNumber
              v-model="state.quantity"
              class="w-full"
              :min="0"
              :disabled="!state.useStock"
            />
          </UFormField>
        </div>

        <UFormField label="Stock mínimo" name="minQuantity" :error="errors.minQuantity">
          <UInputNumber
            v-model="state.minQuantity"
            class="w-full"
            :min="0"
            :disabled="!state.useStock"
          />
        </UFormField>

        <UFormField label="Descripción" name="description" :error="errors.description">
          <UTextarea v-model="state.description" class="w-full" :rows="3" placeholder="Opcional" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Ubicación" name="location" :error="errors.location">
            <UInput v-model="state.location" class="w-full" placeholder="Opcional" />
          </UFormField>

          <UFormField label="SAT Key" name="satKey" :error="errors.satKey">
            <UInput v-model="state.satKey" class="w-full" placeholder="Opcional" />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <UCheckbox v-model="state.useStock" label="Usar stock" />
          <UCheckbox v-model="state.sellInPos" label="Vender en POS" />
          <UCheckbox v-model="state.includeInOnlineCatalog" label="Catálogo online" />
          <UCheckbox v-model="state.chargeProductTaxes" label="Cobrar impuestos" />
        </div>

        <!-- Más Opciones -->
        <div v-if="mode === 'create'" class="rounded-lg border border-default bg-elevated/30 p-4">
          <p class="font-semibold">Más Opciones</p>
          <p class="text-sm text-muted">
            Para editar Impuestos, Unidades, Lotes, Variantes, etc.,
            <button
              type="button"
              class="font-medium text-primary hover:underline"
              @click="goToFullEditor"
            >
              ir al editor completo
            </button>
          </p>
        </div>
      </UForm>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancelar" color="neutral" variant="outline" @click="handleCancel" />
        <UButton
          :label="mode === 'create' ? 'Crear producto' : 'Guardar cambios'"
          :loading="loading"
          type="submit"
          :form="formId"
        />
      </div>
    </template>
  </USlideover>
</template>
