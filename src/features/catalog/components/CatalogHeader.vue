<script setup lang="ts">
import { computed, ref } from 'vue'
import { useColorMode } from '@vueuse/core'
import CatalogPriceContextSelector from './CatalogPriceContextSelector.vue'
import type { PublicBranchDto } from '../interfaces/catalog.types'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'
import type { CatalogBranchesState } from '../composables/useCatalogBranches'
import type { CatalogPriceContextsState } from '../composables/useCatalogPriceContexts'

const props = defineProps<{
  branches: PublicBranchDto[]
  state: CatalogBranchesState
  selectedSlug: string | null
  priceContextOptions: PublicCatalogPriceContextDto[]
  priceContextsState: CatalogPriceContextsState
  selectedPriceListId: string | null
}>()
const emit = defineEmits<{
  retry: []
  select: [slug: string]
  'select-price-context': [priceListId: string]
  'retry-price-contexts': []
}>()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const isChooserOpen = ref(true)

const errorCopy: Record<'empty' | 'rate-limit' | 'server' | 'network', string> = {
  empty: 'No hay sucursales publicadas',
  'rate-limit': 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  server: 'No pudimos cargar las sucursales.',
  network: 'No se pudo conectar. Revisa tu conexión.',
}
const retryMessage = computed(() =>
  props.state === 'empty' ||
  props.state === 'rate-limit' ||
  props.state === 'server' ||
  props.state === 'network'
    ? errorCopy[props.state]
    : '',
)

function toggleDarkMode() {
  colorMode.value = isDark.value ? 'light' : 'dark'
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default/80 backdrop-blur-xl">
    <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6">
      <div class="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
        <div class="flex shrink-0 items-center gap-2">
          <div
            class="flex size-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm"
          >
            <UIcon name="i-lucide-store" class="size-5" />
          </div>
          <span class="hidden text-lg font-bold tracking-tight text-highlighted sm:block"
            >Catálogo</span
          >
        </div>

        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="shrink-0"
          aria-controls="catalog-branch-chooser"
          :aria-expanded="isChooserOpen"
          aria-label="Explorar sucursales"
          @click="isChooserOpen = !isChooserOpen"
        >
          <template #leading
            ><UIcon name="i-lucide-map-pin" class="size-3.5 text-orange-500"
          /></template>
          <span class="hidden text-xs font-medium uppercase tracking-wide sm:inline">Sucursal</span>
          <span class="text-xs font-medium uppercase tracking-wide sm:hidden">...</span>
        </UButton>

        <div
          data-testid="catalog-header-controls"
          class="order-last flex w-full min-w-0 flex-col gap-2 sm:order-none sm:w-auto sm:flex-1 sm:flex-row sm:items-center sm:gap-3"
        >
          <div class="relative min-w-0 flex-1">
            <UInput
              placeholder="Buscar en el catálogo"
              icon="i-lucide-search"
              size="sm"
              class="w-full min-w-0 sm:flex-1"
              :ui="{ root: 'w-full' }"
              disabled
              aria-label="Buscar en el catálogo"
            />
          </div>

          <CatalogPriceContextSelector
            :options="props.priceContextOptions"
            :state="props.priceContextsState"
            :model-value="props.selectedPriceListId"
            class="w-full min-w-0 sm:w-56"
            @select="emit('select-price-context', $event)"
            @retry="emit('retry-price-contexts')"
          />
        </div>

        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          aria-label="Cambiar tema"
          @click="toggleDarkMode"
        >
          <UIcon :name="isDark ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-4" />
        </UButton>

        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="shrink-0"
          disabled
          aria-label="Ver carrito"
        >
          <template #leading><UIcon name="i-lucide-shopping-bag" class="size-5" /></template>
        </UButton>
      </div>

      <section
        v-if="isChooserOpen"
        id="catalog-branch-chooser"
        class="mt-3 max-h-56 overflow-y-auto rounded-lg border border-default bg-default p-3"
        aria-live="polite"
      >
        <p
          v-if="props.state === 'loading'"
          role="status"
          aria-busy="true"
          class="text-sm text-muted"
        >
          Cargando sucursales…
        </p>
        <p
          v-else-if="props.state === 'retry-pending'"
          role="status"
          aria-busy="true"
          class="text-sm text-muted"
        >
          Reintentando…
        </p>
        <template v-else-if="props.state === 'populated'">
          <h2 class="text-sm font-semibold text-highlighted">Sucursales disponibles</h2>
          <p class="mt-1 text-xs text-muted">Elige una sucursal para ver sus productos.</p>
          <ul class="mt-2 space-y-2" aria-label="Sucursales disponibles">
            <li v-for="branch in props.branches" :key="branch.id">
              <button
                class="w-full break-words rounded-md border border-default px-3 py-2 text-left text-sm text-highlighted transition-colors hover:bg-elevated"
                type="button"
                :aria-label="branch.name"
                :aria-current="branch.slug === props.selectedSlug ? 'page' : undefined"
                @click="emit('select', branch.slug)"
              >
                {{ branch.name }}
              </button>
            </li>
          </ul>
        </template>
        <template
          v-else-if="
            props.state === 'empty' ||
            props.state === 'rate-limit' ||
            props.state === 'server' ||
            props.state === 'network'
          "
        >
          <p class="text-sm text-muted">{{ retryMessage }}</p>
          <button
            class="mt-2 text-sm font-medium text-primary"
            type="button"
            aria-label="Reintentar sucursales"
            @click="emit('retry')"
          >
            Reintentar
          </button>
        </template>
      </section>
    </div>
  </header>
</template>
