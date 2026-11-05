<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import '../styles/dashboard-panels.css'

const props = defineProps<{
  id: string
  title: string
  icon: string
  hasItems: boolean
  isInitialLoading: boolean
  isRefetching: boolean
  isError: boolean
  loadingMessage: string
  emptyMessage: string
  errorMessage: string
  /** Optional «Ver todos» link to the module's full list. */
  linkTo?: string
  linkLabel?: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const headingId = computed(() => `${props.id}-heading`)
// A retry from the no-data error keeps the error in place with a busy button
// (`actionLoading`); the skeleton is only for the first load.
const showFatalError = computed(() => props.isError && !props.hasItems && !props.isInitialLoading)
const showInitialLoading = computed(
  () => !props.hasItems && !showFatalError.value && props.isInitialLoading,
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
      <h2 :id="headingId">
        {{ title }}
      </h2>
      <RouterLink
        v-if="linkTo && linkLabel"
        :to="linkTo"
        class="dashboard-operation-link"
        data-testid="dashboard-operational-link"
      >
        {{ linkLabel }}
        <UIcon name="i-lucide-chevron-right" class="size-4" aria-hidden="true" />
      </RouterLink>
    </header>

    <div class="min-w-0">
      <EmptyState
        v-if="showFatalError"
        data-testid="dashboard-operational-error"
        class="dashboard-compact-error"
        kind="error"
        :title="errorMessage"
        action-label="Reintentar"
        :action-loading="isRefetching"
        @action="emit('retry')"
      />

      <div
        v-else-if="showInitialLoading"
        data-testid="dashboard-operational-loading"
        class="dashboard-loading-block"
        role="status"
        aria-live="polite"
      >
        <span class="sr-only">{{ loadingMessage }}</span>
        <div v-for="row in 3" :key="row" class="dashboard-skeleton-row" aria-hidden="true">
          <div class="dashboard-skeleton-lines">
            <USkeleton class="dashboard-state-skeleton h-4 w-32 max-w-full" />
            <USkeleton class="dashboard-state-skeleton h-3 w-24 max-w-full" />
          </div>
          <USkeleton class="dashboard-state-skeleton h-5 w-16" />
        </div>
      </div>

      <EmptyState
        v-else-if="showEmpty"
        data-testid="dashboard-operational-empty"
        kind="empty"
        :title="emptyMessage"
      />

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
