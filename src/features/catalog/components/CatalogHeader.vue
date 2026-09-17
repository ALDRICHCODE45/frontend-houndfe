<script setup lang="ts">
import { computed, ref } from 'vue'
import { useColorMode } from '@vueuse/core'
import type { PublicBranchDto } from '../interfaces/catalog.types'
import type { CatalogBranchesState } from '../composables/useCatalogBranches'

const props = defineProps<{
  branches: PublicBranchDto[]
  state: CatalogBranchesState
  selectedBranch: PublicBranchDto | null
}>()
const emit = defineEmits<{ retry: []; select: [slug: string] }>()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const isChooserOpen = ref(true)
const selectedSlug = computed(() => props.selectedBranch?.slug ?? null)

/** Neutral absence copy. The catalog never invents an address for a branch that has none. */
const addressFallback = 'Dirección no publicada'
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
  <header class="sticky top-0 z-40 border-b border-default bg-default/85 backdrop-blur-xl">
    <div
      class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-3"
    >
      <div class="flex shrink-0 items-center gap-2">
        <span
          class="flex size-9 items-center justify-center rounded-full bg-primary text-white shadow-sm"
        >
          <UIcon name="i-lucide-store" class="size-5" />
        </span>
        <span class="hidden text-lg font-bold tracking-tight text-highlighted sm:block"
          >Catálogo</span
        >
      </div>

      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        class="min-w-0 shrink rounded-full"
        aria-controls="catalog-branch-chooser"
        :aria-expanded="isChooserOpen"
        aria-label="Explorar sucursales"
        @click="isChooserOpen = !isChooserOpen"
      >
        <template #leading>
          <UIcon name="i-lucide-map-pin" class="size-3.5 shrink-0 text-primary" />
        </template>
        <span class="max-w-[6.5rem] truncate sm:max-w-[12rem]">{{
          selectedBranch?.name ?? 'Elegir sucursal'
        }}</span>
        <template #trailing>
          <UIcon
            name="i-lucide-chevron-down"
            class="size-3.5 shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none"
            :class="isChooserOpen ? 'rotate-180' : ''"
          />
        </template>
      </UButton>

      <div class="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
        <UInput
          placeholder="Buscar en el catálogo"
          icon="i-lucide-search"
          size="sm"
          class="w-full"
          :ui="{ root: 'w-full' }"
          disabled
          aria-label="Buscar en el catálogo"
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
        class="shrink-0 rounded-full"
        disabled
        aria-label="Ver carrito"
      >
        <UIcon name="i-lucide-shopping-bag" class="size-4" />
      </UButton>
    </div>
  </header>

  <section
    v-show="isChooserOpen"
    id="catalog-branch-chooser"
    data-testid="catalog-branch-hero"
    aria-live="polite"
    class="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6"
  >
    <div
      class="rounded-[28px] bg-coco-500 p-4 text-white shadow-xl shadow-coco-900/20 sm:p-6 dark:bg-coco-600 dark:shadow-black/40"
    >
      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
        Sucursales disponibles
      </p>
      <h2 class="mt-1.5 max-w-lg text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
        Elige una sucursal para ver sus productos
      </h2>

      <p
        v-if="state === 'loading'"
        role="status"
        aria-busy="true"
        class="mt-4 text-sm text-white/85"
      >
        Cargando sucursales…
      </p>
      <p
        v-else-if="state === 'retry-pending'"
        role="status"
        aria-busy="true"
        class="mt-4 text-sm text-white/85"
      >
        Reintentando…
      </p>
      <template v-else-if="state === 'populated'">
        <ul
          aria-label="Sucursales disponibles"
          class="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <li v-for="branch in branches" :key="branch.id" class="min-w-0">
            <button
              type="button"
              :aria-label="branch.name"
              :aria-current="branch.slug === selectedSlug ? 'page' : undefined"
              class="flex w-full min-w-0 items-start gap-3 rounded-2xl px-3.5 py-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
              :class="
                branch.slug === selectedSlug
                  ? 'bg-white text-coco-950 shadow-sm dark:bg-coco-50'
                  : 'bg-white/10 text-white ring-1 ring-white/20 ring-inset hover:bg-white/20'
              "
              @click="emit('select', branch.slug)"
            >
              <span
                class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2"
                :class="branch.slug === selectedSlug ? 'border-coco-500' : 'border-white/50'"
              >
                <span
                  v-if="branch.slug === selectedSlug"
                  class="size-1.5 rounded-full bg-coco-500"
                />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block break-words text-sm font-semibold leading-snug">
                  {{ branch.name }}
                </span>
                <span
                  class="mt-0.5 block break-words text-xs"
                  :class="branch.slug === selectedSlug ? 'text-coco-950/70' : 'text-white/95'"
                >
                  {{ branch.address ?? addressFallback }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </template>
      <template v-else>
        <p class="mt-4 text-sm text-white/85">{{ retryMessage }}</p>
        <button
          type="button"
          class="mt-3 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
          aria-label="Reintentar sucursales"
          @click="emit('retry')"
        >
          Reintentar
        </button>
      </template>
    </div>
  </section>
</template>
