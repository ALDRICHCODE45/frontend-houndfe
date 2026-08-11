<script setup lang="ts">
import { computed } from 'vue'
import DotBadge from '@/core/shared/components/DotBadge.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import type { Product } from '../interfaces/product.types'
import {
  getProductStockDisplay,
  getProductStockDotClass,
  productStatusConfig,
} from '../utils/productStatusConfig.utils'

const props = defineProps<{
  product: Product
  currencyFormatter: Intl.NumberFormat
  canRead?: boolean
  canUpdate?: boolean
  canDelete?: boolean
}>()

const emit = defineEmits<{
  details: [product: Product]
  edit: [product: Product]
  delete: [product: Product]
  click: [product: Product]
}>()

const statusConfig = computed(() => productStatusConfig[props.product.status])
const priceLabel = computed(() => props.currencyFormatter.format(props.product.priceCents / 100))
const canOpenDetails = computed(() => props.canRead ?? false)
const updatedAtLabel = computed(() => new Date(props.product.updatedAt).toLocaleDateString())
const stockLabel = computed(() => getProductStockDisplay(props.product).label)
const stockDotClass = computed(() => getProductStockDotClass(props.product))
const rowActions = computed(() => {
  const mainActions = [
    ...(props.canRead ? [{ label: 'Detalles', onSelect: () => emit('details', props.product) }] : []),
    ...(props.canUpdate ? [{ label: 'Editar', onSelect: () => emit('edit', props.product) }] : []),
  ]

  const destructiveActions = props.canDelete
    ? [{ label: 'Eliminar', color: 'error' as const, onSelect: () => emit('delete', props.product) }]
    : []

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
})

function handleClick(): void {
  if (!canOpenDetails.value) return
  emit('click', props.product)
}

function handleCardKeydown(event: KeyboardEvent): void {
  if (!canOpenDetails.value) return
  if (event.key !== 'Enter' && event.key !== ' ') return

  event.preventDefault()
  emit('click', props.product)
}
</script>

<template>
  <article
    class="group relative flex min-h-[220px] flex-col rounded-xl border border-default bg-default px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
    :class="canOpenDetails ? 'cursor-pointer' : 'cursor-default'"
    :role="canOpenDetails ? 'button' : undefined"
    :tabindex="canOpenDetails ? 0 : undefined"
    @click="handleClick"
    @keydown="handleCardKeydown"
  >
    <div v-if="rowActions.length > 0" class="absolute right-3 top-3 z-10" @click.stop @keydown.stop>
      <UDropdownMenu :items="rowActions" :content="{ align: 'end' }">
        <UButton
          icon="i-lucide-ellipsis"
          color="neutral"
          variant="ghost"
          class="size-7 opacity-60 transition-opacity hover:opacity-100"
          aria-label="Acciones del producto"
        />
      </UDropdownMenu>
    </div>

    <div class="flex items-start gap-3 pr-7">
      <EntityAvatar
        :name="product.name"
        :seed="product.id"
        :show-dot="product.status === 'active'"
        size="lg"
      />

      <div class="min-w-0 flex-1 space-y-1">
        <p class="line-clamp-2 text-sm font-semibold leading-tight text-highlighted">
          {{ product.name }}
        </p>
        <p class="font-mono text-xs text-muted">
          {{ product.sku ?? 'Sin SKU' }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex min-h-6 flex-wrap items-center gap-1.5">
      <DotBadge
        v-if="product.categoryName"
        :label="product.categoryName"
        dot-class="bg-violet-500"
        :truncate="true"
        :compact="true"
      />

      <StatusDotBadge :tone="statusConfig.tone" :label="statusConfig.label" :compact="true" />
    </div>

    <div class="my-3 border-t border-dashed border-default" />

    <div class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <div class="min-w-0">
        <p class="text-muted">Marca</p>
        <p class="mt-1 truncate font-medium text-default">{{ product.brandName || 'Sin marca' }}</p>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Precio</p>
        <p class="mt-1 truncate font-semibold text-default">{{ priceLabel }}</p>
      </div>
      <div class="min-w-0">
        <p class="text-muted">Stock</p>
        <div class="mt-1">
          <DotBadge :label="stockLabel" :dot-class="stockDotClass" :truncate="true" :compact="true" />
        </div>
      </div>
      <div class="min-w-0 text-right">
        <p class="text-muted">Actualizado</p>
        <p class="mt-1 truncate font-medium text-default">{{ updatedAtLabel }}</p>
      </div>
    </div>
  </article>
</template>
