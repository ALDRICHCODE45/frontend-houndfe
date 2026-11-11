<script setup lang="ts">
import { computed, ref } from 'vue'
import CatalogPriceContextSelector from './CatalogPriceContextSelector.vue'
import type { PublicBranchDto } from '../interfaces/catalog.types'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'
import type { CatalogBranchesState } from '../composables/useCatalogBranches'
import type { CatalogPriceContextsState } from '../composables/useCatalogPriceContexts'

const props = defineProps<{
  branches: PublicBranchDto[]
  state: CatalogBranchesState
  selectedBranch: PublicBranchDto | null
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

/**
 * Branch selection is a discreet, closed-by-default dialog owned by the header trigger.
 * `/catalogo` never opens it on its own, and the catalog keeps no permanent hero space for it.
 */
const isChooserOpen = ref(false)
const selectedSlug = computed(() => props.selectedBranch?.slug ?? null)
const isLoading = computed(() => props.state === 'loading' || props.state === 'retry-pending')

/** Neutral absence copy. The catalog never invents an address for a branch that has none. */
const addressFallback = 'Dirección no publicada'
const errorCopy: Record<'empty' | 'rate-limit' | 'server' | 'network', string> = {
  empty: 'No hay sucursales publicadas',
  'rate-limit': 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
  server: 'No pudimos cargar las sucursales.',
  network: 'No se pudo conectar. Inténtalo de nuevo en un momento.',
}
const retryMessage = computed(() =>
  props.state === 'empty' ||
  props.state === 'rate-limit' ||
  props.state === 'server' ||
  props.state === 'network'
    ? errorCopy[props.state]
    : '',
)

/** The real logo leads home: the selected branch's unfiltered first page. */
const homeTo = computed(() =>
  selectedSlug.value
    ? { name: 'public-catalog', params: { branchSlug: selectedSlug.value } }
    : { name: 'public-catalog' },
)

/**
 * The price list is a discreet control only when the visitor has a real choice: more than
 * one list, or a single list that is not the default and must be chosen. Otherwise the
 * listing just says «Precios en MXN». Discovery loading and failures live in the listing.
 */
const showPriceSelector = computed(
  () =>
    props.priceContextsState === 'populated' &&
    (props.priceContextOptions.length > 1 ||
      (props.priceContextOptions.length === 1 && props.selectedPriceListId === null)),
)

/** The dialog closes first, then the route change stays the only visible selection outcome. */
function selectBranch(slug: string) {
  isChooserOpen.value = false
  emit('select', slug)
}
</script>

<template>
  <header class="catalog-header">
    <div
      class="catalog-header-inner catalog-container"
      :class="{ 'catalog-header-inner--lists': showPriceSelector }"
    >
      <RouterLink :to="homeTo" class="catalog-home-link" aria-label="HoundFe, ir al inicio">
        <img
          class="catalog-logo"
          src="/hounfeLogos/primary.png"
          alt="HoundFe"
          width="96"
          height="96"
        />
      </RouterLink>

      <div v-if="$slots.categories" class="catalog-header-categories">
        <slot name="categories" />
      </div>
      <div v-if="$slots.search" class="catalog-header-search">
        <slot name="search" />
      </div>

      <UModal
        v-model:open="isChooserOpen"
        title="Seleccionar sucursal"
        description="Elige la sucursal para ver sus productos."
        :close="false"
        :ui="{
          overlay: 'catalog-branch-overlay z-40 backdrop-blur-sm',
          content: 'catalog-branch-dialog z-50 max-w-md',
          header: 'items-start',
          body: 'flex-1 p-4 overscroll-contain sm:p-5',
        }"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          class="catalog-branch-trigger min-h-11 min-w-0 shrink"
          aria-label="Explorar sucursales"
        >
          <template #leading>
            <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
          </template>
          <span class="catalog-select-text">
            <small>Sucursal</small>
            <strong class="max-w-[9rem] truncate sm:max-w-[12rem]">{{
              selectedBranch?.name ?? 'Elegir sucursal'
            }}</strong>
          </span>
          <template #trailing>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-3.5 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none"
              :class="isChooserOpen ? 'rotate-180' : ''"
            />
          </template>
        </UButton>

        <template #close>
          <button
            type="button"
            aria-label="Cerrar selección de sucursal"
            class="catalog-branch-close ms-auto inline-flex size-11 shrink-0 items-center justify-center text-muted transition-colors duration-150 hover:bg-elevated/70 hover:text-highlighted"
          >
            <UIcon name="i-lucide-x" class="size-5" aria-hidden="true" />
          </button>
        </template>

        <template #body>
          <!-- Every dynamic branch surface lives in this single polite region. -->
          <div
            data-testid="catalog-branch-choices"
            aria-live="polite"
            class="flex min-w-0 flex-col gap-3"
          >
            <template v-if="isLoading">
              <p role="status" aria-busy="true" class="text-sm font-medium text-toned">
                {{ state === 'retry-pending' ? 'Reintentando…' : 'Cargando sucursales…' }}
              </p>
              <div aria-hidden="true" class="flex flex-col gap-2">
                <div
                  v-for="row in 2"
                  :key="row"
                  class="h-14 animate-pulse rounded-xl bg-elevated/70 motion-reduce:animate-none"
                />
              </div>
            </template>

            <template v-else-if="state === 'populated'">
              <ul aria-label="Sucursales disponibles" class="flex min-w-0 flex-col gap-2">
                <li v-for="branch in branches" :key="branch.id" class="min-w-0">
                  <button
                    type="button"
                    :aria-label="branch.name"
                    :aria-current="branch.slug === selectedSlug ? 'page' : undefined"
                    class="catalog-branch-option flex min-h-11 w-full min-w-0 items-center gap-3 px-3 py-2.5 text-left ring-1 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                    :class="
                      branch.slug === selectedSlug
                        ? 'bg-primary/5 ring-primary/40 dark:bg-primary/15'
                        : 'ring-default hover:bg-elevated/60'
                    "
                    @click="selectBranch(branch.slug)"
                  >
                    <UIcon
                      :name="
                        branch.slug === selectedSlug ? 'i-lucide-circle-check' : 'i-lucide-map-pin'
                      "
                      class="size-4 shrink-0"
                      :class="branch.slug === selectedSlug ? 'text-primary' : 'text-dimmed'"
                    />
                    <span class="min-w-0 flex-1">
                      <span
                        class="block break-words text-sm leading-snug font-semibold text-highlighted"
                      >
                        {{ branch.name }}
                      </span>
                      <span class="mt-0.5 block break-words text-xs leading-snug text-toned">
                        {{ branch.address ?? addressFallback }}
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </template>

            <template v-else>
              <p role="status" class="text-sm text-toned">{{ retryMessage }}</p>
              <UButton
                color="neutral"
                variant="outline"
                size="md"
                icon="i-lucide-refresh-cw"
                aria-label="Reintentar sucursales"
                class="min-h-11 self-start"
                @click="emit('retry')"
              >
                Reintentar
              </UButton>
            </template>
          </div>
        </template>
      </UModal>

      <div
        v-if="showPriceSelector"
        data-testid="catalog-header-controls"
        class="catalog-header-controls"
      >
        <CatalogPriceContextSelector
          :options="props.priceContextOptions"
          :state="props.priceContextsState"
          :model-value="props.selectedPriceListId"
          class="w-full min-w-0"
          @select="emit('select-price-context', $event)"
          @retry="emit('retry-price-contexts')"
        />
      </div>
    </div>
  </header>
</template>
