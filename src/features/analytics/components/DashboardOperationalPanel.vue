<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  id: string
  title: string
  description: string
  icon: string
  hasItems: boolean
  isInitialLoading: boolean
  isRefetching: boolean
  isError: boolean
  loadingMessage: string
  emptyMessage: string
  errorMessage: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const headingId = computed(() => `${props.id}-heading`)
const showFatalError = computed(() => props.isError && !props.hasItems)
const showInitialLoading = computed(
  () => props.isInitialLoading && !props.hasItems && !showFatalError.value,
)
const showEmpty = computed(
  () => !props.hasItems && !showFatalError.value && !showInitialLoading.value,
)
const showRefreshError = computed(() => props.isError && props.hasItems)
const showRefreshing = computed(
  () => props.isRefetching && props.hasItems && !showRefreshError.value,
)
const isBusy = computed(() => props.isInitialLoading || props.isRefetching)
</script>

<template>
  <article
    data-testid="dashboard-operational-panel"
    class="min-w-0 overflow-hidden rounded-2xl border border-default bg-default shadow-sm"
    :aria-labelledby="headingId"
    :aria-busy="isBusy"
  >
    <header class="flex min-w-0 items-start gap-3 border-b border-default px-4 py-4 sm:px-5">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-toned"
        aria-hidden="true"
      >
        <UIcon :name="icon" class="size-5" />
      </span>
      <div class="min-w-0">
        <h2 :id="headingId" class="text-base font-semibold text-highlighted">
          {{ title }}
        </h2>
        <p class="mt-1 text-sm leading-5 text-muted">
          {{ description }}
        </p>
      </div>
    </header>

    <div class="min-w-0 p-4 sm:p-5">
      <div
        v-if="showFatalError"
        data-testid="dashboard-operational-error"
        class="rounded-xl border border-error/30 bg-error/5 p-4"
        role="alert"
      >
        <div class="flex items-start gap-3">
          <UIcon
            name="i-lucide-circle-alert"
            class="mt-0.5 size-5 shrink-0 text-error"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="font-medium text-highlighted">No disponible</p>
            <p class="mt-1 text-sm leading-5 text-muted">{{ errorMessage }}</p>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              class="mt-3 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :disabled="isRefetching"
              @click="emit('retry')"
            >
              Reintentar
            </UButton>
          </div>
        </div>
      </div>

      <div
        v-else-if="showInitialLoading"
        data-testid="dashboard-operational-loading"
        class="space-y-3"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">{{ loadingMessage }}</span>
        <div
          v-for="index in 3"
          :key="index"
          class="h-16 animate-pulse rounded-xl bg-elevated"
          aria-hidden="true"
        />
      </div>

      <div
        v-else-if="showEmpty"
        data-testid="dashboard-operational-empty"
        class="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-default px-4 py-8 text-center"
        role="status"
      >
        <UIcon name="i-lucide-inbox" class="size-6 text-dimmed" aria-hidden="true" />
        <p class="mt-3 text-sm leading-5 text-muted">{{ emptyMessage }}</p>
      </div>

      <template v-else>
        <div
          v-if="showRefreshError"
          data-testid="dashboard-operational-refresh-error"
          class="mb-3 rounded-xl border border-error/30 bg-error/5 p-3"
          role="alert"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="min-w-0 flex-1 text-sm leading-5 text-muted">{{ errorMessage }}</p>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-refresh-cw"
              class="min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :disabled="isRefetching"
              @click="emit('retry')"
            >
              Reintentar
            </UButton>
          </div>
        </div>

        <p
          v-if="showRefreshing"
          data-testid="dashboard-operational-refreshing"
          class="sr-only"
          role="status"
          aria-live="polite"
        >
          Actualizando {{ title.toLocaleLowerCase('es-MX') }}.
        </p>

        <ul
          data-testid="dashboard-operational-list"
          class="min-w-0 divide-y divide-default"
          :aria-label="title"
        >
          <slot />
        </ul>
      </template>
    </div>
  </article>
</template>
