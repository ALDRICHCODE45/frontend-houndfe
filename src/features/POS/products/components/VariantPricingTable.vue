<script setup lang="ts">
import type { AxiosError } from 'axios'
import { computed, reactive, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { productApi } from '../api/product.api'
import { currencyFormatter } from '@/core/shared/utils/currency.utils'
import { mapDomainError, type DomainApiError } from '@/core/shared/utils/error.utils'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { centsToDecimalInput, decimalInputToCents } from '../composables/useProductForm'
import type {
  ProductVariant,
  UpsertVariantPricePayload,
  VariantPrice,
} from '../interfaces/product.types'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface TierRow {
  key: number
  minQuantity: number | string
  price: string
}

const props = defineProps<{
  productId: string
  variant: ProductVariant
  canUpdate: boolean
}>()

const toast = useToast()
const queryClient = useQueryClient()
const tenantId = useSafeTenantId()

const salePriceInputs = reactive<Record<string, string>>({})

function syncSalePriceInputs(prices: VariantPrice[]) {
  for (const key of Object.keys(salePriceInputs)) {
    delete salePriceInputs[key]
  }

  for (const variantPrice of prices) {
    salePriceInputs[variantPrice.priceListId] = centsToDecimalInput(variantPrice.priceCents)
  }
}

watch(
  () => props.variant.variantPrices,
  (prices) => {
    syncSalePriceInputs(prices)
  },
  { immediate: true },
)

const upsertVariantPriceMutation = useMutation({
  mutationFn: (params: { priceListId: string; payload: UpsertVariantPricePayload }) =>
    productApi.upsertVariantPrice(
      props.productId,
      props.variant.id,
      params.priceListId,
      params.payload,
    ),
  onSuccess: async () => {
    toast.add({
      title: 'Precio de variante actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: productQueryKeys.variants(tenantId.value, props.productId) }),
      queryClient.invalidateQueries({
        queryKey: productQueryKeys.variantPrices(tenantId.value, props.productId, props.variant.id),
      }),
    ])
  },
  onError: (error) => {
    toast.add({
      title: 'Error al guardar precio',
      description: mapDomainError(error as AxiosError<DomainApiError>),
      color: 'error',
    })
  },
})

function getTierPricesPayload(variantPrice: VariantPrice) {
  return variantPrice.tierPrices.map((tier) => ({
    minQuantity: tier.minQuantity,
    priceCents: tier.priceCents,
  }))
}

function handleInlinePriceSave(variantPrice: VariantPrice) {
  if (!props.canUpdate) return

  const rawInput =
    salePriceInputs[variantPrice.priceListId] ?? centsToDecimalInput(variantPrice.priceCents)
  const nextPriceCents = decimalInputToCents(rawInput)

  if (nextPriceCents === variantPrice.priceCents) return

  upsertVariantPriceMutation.mutate({
    priceListId: variantPrice.priceListId,
    payload: {
      priceCents: nextPriceCents,
      ...(variantPrice.tierPrices.length > 0
        ? { tierPrices: getTierPricesPayload(variantPrice) }
        : {}),
    },
  })
}

function shouldShowMargin(variantPrice: VariantPrice): boolean {
  return variantPrice.priceCents > 0 && Boolean(variantPrice.margin)
}

function marginClass(variantPrice: VariantPrice): string {
  return (variantPrice.margin?.amountCents ?? 0) >= 0 ? 'text-success' : 'text-error'
}

function actionsFor(variantPrice: VariantPrice): RowAction[] {
  return [
    {
      key: 'tiers',
      label: variantPrice.tierPrices.length > 0 ? 'Editar cantidades' : 'Precios por cantidad',
      icon: 'i-lucide-layers',
      disabled: !props.canUpdate,
    },
  ]
}

function formatMarginPercent(variantPrice: VariantPrice): string {
  if (!shouldShowMargin(variantPrice)) return '--'
  return `${variantPrice.margin?.percent ?? 0}%`
}

function formatMarginAmount(variantPrice: VariantPrice): string {
  if (!shouldShowMargin(variantPrice)) return '--'
  return `${currencyFormatter.format(variantPrice.margin?.amountDecimal ?? 0)} por Unidad`
}

const isTierModalOpen = ref(false)
const selectedVariantPrice = ref<VariantPrice | null>(null)
const tierRows = ref<TierRow[]>([])
let tierRowKeyCounter = 0

const selectedPriceListName = computed(() => selectedVariantPrice.value?.priceListName ?? '')

function openTierPricesModal(variantPrice: VariantPrice) {
  selectedVariantPrice.value = variantPrice
  tierRowKeyCounter = 0
  tierRows.value = variantPrice.tierPrices.map((tier) => ({
    key: tierRowKeyCounter++,
    minQuantity: tier.minQuantity,
    price: centsToDecimalInput(tier.priceCents),
  }))

  if (tierRows.value.length === 0) {
    tierRows.value.push({
      key: tierRowKeyCounter++,
      minQuantity: 0,
      price: centsToDecimalInput(variantPrice.priceCents),
    })
  }

  isTierModalOpen.value = true
}

function closeTierPricesModal() {
  isTierModalOpen.value = false
  selectedVariantPrice.value = null
  tierRows.value = []
}

function addTierRow() {
  tierRows.value.push({ key: tierRowKeyCounter++, minQuantity: '', price: '' })
}

function removeTierRow(index: number) {
  tierRows.value.splice(index, 1)

  if (tierRows.value.length === 0) {
    addTierRow()
  }
}

function handleSaveTierPrices() {
  if (!props.canUpdate || !selectedVariantPrice.value) return

  const filledRows = tierRows.value
    .filter((row) => String(row.minQuantity).trim() !== '' && row.price.trim() !== '')
    .map((row) => ({
      minQuantity:
        typeof row.minQuantity === 'string'
          ? Number.parseInt(row.minQuantity, 10)
          : row.minQuantity,
      priceCents: decimalInputToCents(row.price),
    }))
    .sort((a, b) => a.minQuantity - b.minQuantity)

  const hasInvalidQty = filledRows.some(
    (row) => !Number.isInteger(row.minQuantity) || row.minQuantity < 0,
  )

  if (hasInvalidQty) {
    toast.add({
      title: 'Cantidad inválida',
      description: 'Las cantidades mínimas deben ser números enteros mayores o iguales a 0.',
      color: 'warning',
    })
    return
  }

  const quantitySet = new Set(filledRows.map((row) => row.minQuantity))
  if (quantitySet.size !== filledRows.length) {
    toast.add({
      title: 'Cantidades repetidas',
      description: 'No se pueden repetir cantidades mínimas en precios por cantidad.',
      color: 'warning',
    })
    return
  }

  const currentPrice = selectedVariantPrice.value
  const currentPriceInput =
    salePriceInputs[currentPrice.priceListId] ?? centsToDecimalInput(currentPrice.priceCents)

  upsertVariantPriceMutation.mutate(
    {
      priceListId: currentPrice.priceListId,
      payload: {
        priceCents: decimalInputToCents(currentPriceInput),
        tierPrices: filledRows,
      },
    },
    {
      onSuccess: () => {
        closeTierPricesModal()
      },
    },
  )
}
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-default">
    <table class="min-w-full divide-y divide-default text-sm">
      <thead class="bg-elevated/40">
        <tr>
          <th class="px-4 py-3 text-left font-semibold">Lista de precios</th>
          <th class="px-4 py-3 text-right font-semibold">
            Precio de venta
            <span class="block text-xs font-normal text-muted">Con impuestos</span>
          </th>
          <th class="px-4 py-3 text-right font-semibold">Margen</th>
          <th class="px-4 py-3 text-right font-semibold">Ganancia</th>
          <th class="w-16 px-4 py-3"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>

      <tbody class="divide-y divide-default">
        <tr v-if="variant.variantPrices.length === 0">
          <td colspan="5" class="px-4 py-3 text-muted">
            Sin listas de precios para esta variante.
          </td>
        </tr>

        <template v-for="variantPrice in variant.variantPrices" :key="variantPrice.id">
          <!-- Main price row -->
          <tr>
            <td class="px-4 py-3 font-semibold text-highlighted">
              {{ variantPrice.priceListName }}
            </td>

            <td class="px-4 py-3 text-right">
              <div class="relative ml-auto max-w-xs">
                <span
                  class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                  >$</span
                >
                <UInput
                  v-model="salePriceInputs[variantPrice.priceListId]"
                  class="w-full"
                  inputmode="decimal"
                  placeholder="0.00"
                  :ui="{ base: 'hf-figure pl-7 text-right' }"
                  :disabled="!canUpdate"
                  :aria-label="`Precio de venta de ${variantPrice.priceListName}, con impuestos incluidos`"
                  @blur="handleInlinePriceSave(variantPrice)"
                  @keyup.enter="handleInlinePriceSave(variantPrice)"
                />
              </div>
            </td>

            <td
              class="hf-figure px-4 py-3 text-right"
              :class="shouldShowMargin(variantPrice) ? marginClass(variantPrice) : 'text-muted'"
            >
              {{ formatMarginPercent(variantPrice) }}
            </td>

            <td
              class="hf-figure px-4 py-3 text-right"
              :class="shouldShowMargin(variantPrice) ? marginClass(variantPrice) : 'text-muted'"
            >
              {{ formatMarginAmount(variantPrice) }}
            </td>

            <td class="px-4 py-3 text-right">
              <RowActionsMenu
                :actions="actionsFor(variantPrice)"
                :row-label="`la lista ${variantPrice.priceListName}`"
                @select="openTierPricesModal(variantPrice)"
              />
            </td>
          </tr>

          <!-- Tier prices sub-rows -->
          <tr v-for="tier in variantPrice.tierPrices" :key="tier.id" class="bg-elevated/20">
            <td class="py-2 pl-8 pr-4 text-sm text-muted">{{ tier.minQuantity }} o más</td>
            <td class="hf-figure px-4 py-2 text-right text-sm">
              $ {{ centsToDecimalInput(tier.priceCents) }}
              <span class="text-xs text-muted">por unidad</span>
            </td>
            <td
              class="hf-figure px-4 py-2 text-right text-sm"
              :class="tier.margin ? (tier.margin.amountCents >= 0 ? 'text-success' : 'text-error') : 'text-muted'"
            >
              {{ tier.margin ? `${tier.margin.percent}%` : '--' }}
            </td>
            <td
              class="hf-figure px-4 py-2 text-right text-sm"
              :class="tier.margin ? (tier.margin.amountCents >= 0 ? 'text-success' : 'text-error') : 'text-muted'"
            >
              {{
                tier.margin
                  ? `${currencyFormatter.format(tier.margin.amountDecimal)} por unidad`
                  : '--'
              }}
            </td>
            <td />
          </tr>
        </template>
      </tbody>
    </table>
  </div>

  <UModal
    v-model:open="isTierModalOpen"
    title="Precios por cantidad"
    :content="{ class: 'hf-theme hf-ui sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-medium">{{ variant.name }}</span>
          <span class="rounded-md bg-elevated px-2 py-0.5 text-xs font-medium">{{ selectedPriceListName }}</span>
        </div>

        <div class="space-y-3">
          <div
            v-for="(row, index) in tierRows"
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
                aria-label="Quitar este precio por cantidad"
                :disabled="tierRows.length === 1 && index === 0"
                @click="removeTierRow(index)"
              />
            </div>
          </div>
        </div>

        <UButton
          type="button"
          label="+ Agregar"
          color="neutral"
          variant="outline"
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
          :disabled="upsertVariantPriceMutation.isPending.value"
          @click="closeTierPricesModal"
        />
        <UButton
          type="button"
          label="Guardar"
          color="primary"
          class="hf-primary-control"
          :loading="upsertVariantPriceMutation.isPending.value"
          @click="handleSaveTierPrices"
        />
      </div>
    </template>
  </UModal>
</template>
