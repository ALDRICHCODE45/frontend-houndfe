<script setup lang="ts">
import { computed } from 'vue'
import '../styles/dashboard-panels.css'

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
    class="dashboard-operations min-w-0"
    :aria-labelledby="headingId"
    :aria-busy="isBusy"
  >
    <header class="dashboard-operation-header">
      <span
        class="dashboard-operation-icon"
        aria-hidden="true"
      >
        <UIcon :name="icon" class="size-[18px]" />
      </span>
      <div class="min-w-0">
        <h2 :id="headingId">
          {{ title }}
        </h2>
        <p>
          {{ description }}
        </p>
      </div>
    </header>

    <div class="min-w-0">
      <div
        v-if="showFatalError"
        data-testid="dashboard-operational-error"
        class="dashboard-error-block"
        role="alert"
      >
        <div class="dashboard-error-content">
          <UIcon
            name="i-lucide-circle-alert"
            class="size-6 text-error"
            aria-hidden="true"
          />
          <div class="dashboard-error-content">
            <p class="font-medium text-highlighted">No disponible</p>
            <p class="mt-1 text-sm leading-5 text-muted">{{ errorMessage }}</p>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              class="dashboard-retry min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :loading="isRefetching"
              :disabled="isBusy"
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
        class="dashboard-loading-block"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">{{ loadingMessage }}</span>
        <USkeleton class="dashboard-state-skeleton h-5 w-40" aria-hidden="true" />
        <USkeleton class="dashboard-state-skeleton h-10 w-56 max-w-full" aria-hidden="true" />
        <USkeleton class="dashboard-state-skeleton w-full flex-1" aria-hidden="true" />
      </div>

      <div
        v-else-if="showEmpty"
        data-testid="dashboard-operational-empty"
        class="dashboard-empty-block"
        role="status"
      >
        <span class="dashboard-empty-icon" aria-hidden="true">
          <UIcon name="i-lucide-inbox" class="size-[26px]" />
        </span>
        <strong>{{ emptyMessage }}</strong>
      </div>

      <template v-else>
        <div
          v-if="showRefreshError"
          data-testid="dashboard-operational-refresh-error"
          class="dashboard-stale-alert"
          role="alert"
        >
          <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
          <div class="dashboard-stale-content">
            <p class="min-w-0 flex-1 text-sm leading-5 text-muted">{{ errorMessage }}</p>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-refresh-cw"
              class="dashboard-retry min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :loading="isRefetching"
              :disabled="isBusy"
              @click="emit('retry')"
            >
              Reintentar
            </UButton>
          </div>
        </div>

        <p
          v-if="showRefreshing"
          data-testid="dashboard-operational-refreshing"
          class="dashboard-refresh-note"
          role="status"
          aria-live="polite"
        >
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          Actualizando {{ title.toLocaleLowerCase('es-MX') }}.
        </p>

        <ul
          data-testid="dashboard-operational-list"
          class="dashboard-state-content min-w-0"
          :class="{ 'dashboard-state-refreshing': isRefetching }"
          :aria-label="title"
        >
          <slot />
        </ul>
      </template>
    </div>
  </article>
</template>
