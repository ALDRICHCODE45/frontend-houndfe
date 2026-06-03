<script setup lang="ts">
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { useCatalogCart } from '../composables/useCatalogCart'
import { useCatalogStore } from '../composables/useCatalogStore'

const cart = useCatalogCart()
const catalog = useCatalogStore()

function increment(productId: string, variantId: string | null) {
  const item = cart.items.find((i) => i.productId === productId && i.variantId === variantId)
  if (item) {
    cart.updateQuantity(productId, variantId, item.quantity + 1)
  }
}

function decrement(productId: string, variantId: string | null) {
  const item = cart.items.find((i) => i.productId === productId && i.variantId === variantId)
  if (item) {
    cart.updateQuantity(productId, variantId, item.quantity - 1)
  }
}

function openWhatsApp() {
  if (cart.whatsappUrl) {
    window.open(cart.whatsappUrl, '_blank')
  }
}
</script>

<template>
  <USlideover
    :open="cart.isCartOpen"
    side="right"
    :ui="{
      overlay: 'bg-black/60 backdrop-blur-sm !z-50',
      content: 'sm:max-w-md bg-white !z-50',
    }"
    @update:open="(val: boolean) => { if (!val) cart.closeCart() }"
  >
    <template #content>
      <div class="flex h-full flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-gray-100 p-5">
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-gray-900">Tu pedido</h2>
            <UBadge
              v-if="cart.itemCount > 0"
              color="primary"
              size="xs"
              class="rounded-full"
            >
              {{ cart.itemCount }}
            </UBadge>
          </div>
          <button
            class="flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            @click="cart.closeCart()"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>

        <!-- Branch info -->
        <div class="flex items-center gap-2 border-b border-gray-50 bg-orange-50/50 px-5 py-3">
          <UIcon name="i-lucide-map-pin" class="size-4 text-orange-500" />
          <span class="text-sm text-gray-600">
            Recoger en <span class="font-medium text-gray-900">{{ catalog.selectedBranch?.name ?? 'Sucursal' }}</span>
          </span>
        </div>

        <!-- Cart items -->
        <div class="flex-1 overflow-y-auto">
          <!-- Empty state -->
          <div v-if="cart.isEmpty" class="flex flex-col items-center justify-center gap-3 py-16">
            <div class="flex size-14 items-center justify-center rounded-2xl bg-gray-100">
              <UIcon name="i-lucide-shopping-bag" class="size-7 text-gray-300" />
            </div>
            <p class="text-sm text-gray-500">Tu pedido esta vacio</p>
            <UButton
              color="primary"
              variant="ghost"
              size="sm"
              @click="cart.closeCart()"
            >
              Seguir comprando
            </UButton>
          </div>

          <!-- Items list -->
          <div v-else class="divide-y divide-gray-50 p-4">
            <div
              v-for="item in cart.items"
              :key="`${item.productId}-${item.variantId}`"
              class="flex gap-3 py-3 first:pt-0 last:pb-0"
            >
              <!-- Color placeholder -->
              <div
                class="flex size-14 shrink-0 items-center justify-center rounded-xl"
                :class="item.colorKey"
              >
                <UIcon name="i-lucide-package" class="size-5 text-gray-400/20" />
              </div>

              <!-- Details -->
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <p
                  v-if="item.brandName"
                  class="text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                >
                  {{ item.brandName }}
                </p>
                <p class="truncate text-sm font-semibold text-gray-900">
                  {{ item.productName }}
                </p>
                <p v-if="item.variantName" class="text-xs text-gray-500">
                  {{ item.variantName }}
                </p>

                <div class="mt-1 flex items-center justify-between">
                  <!-- Quantity controls -->
                  <div class="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
                    <button
                      class="flex size-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-white"
                      @click="decrement(item.productId, item.variantId)"
                    >
                      <UIcon name="i-lucide-minus" class="size-3" />
                    </button>
                    <span class="min-w-[1.5rem] text-center text-xs font-semibold text-gray-900">
                      {{ item.quantity }}
                    </span>
                    <button
                      class="flex size-6 items-center justify-center rounded-md text-gray-500 transition hover:bg-white"
                      @click="increment(item.productId, item.variantId)"
                    >
                      <UIcon name="i-lucide-plus" class="size-3" />
                    </button>
                  </div>

                  <!-- Price -->
                  <p v-if="!item.priceHidden" class="text-sm font-bold text-gray-900">
                    {{ formatCentsMXN(item.unitPriceCents! * item.quantity) }}
                  </p>
                  <p v-else class="text-xs text-gray-500 italic">
                    Consultar
                  </p>
                </div>
              </div>

              <!-- Delete -->
              <button
                class="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                @click="cart.removeItem(item.productId, item.variantId)"
              >
                <UIcon name="i-lucide-trash-2" class="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Footer with total + WhatsApp button -->
        <div
          v-if="!cart.isEmpty"
          class="border-t border-gray-100 bg-white p-5"
        >
          <div class="mb-4 flex items-center justify-between">
            <span class="text-sm text-gray-500">Total estimado</span>
            <span class="text-xl font-bold text-gray-900">
              {{ cart.formattedTotal }}
            </span>
          </div>

          <UButton
            block
            size="lg"
            class="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            @click="openWhatsApp"
          >
            <template #leading>
              <UIcon name="i-lucide-send" class="size-4" />
            </template>
            Enviar pedido por WhatsApp
          </UButton>

          <p class="mt-3 text-center text-[11px] text-gray-400">
            Te contactamos para confirmar precio final y disponibilidad
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
