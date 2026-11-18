<script setup lang="ts">
/**
 * RecipientSelect — users to notify as selectable rows with a round mark
 * (HfSelectableRows: `role="listbox" aria-multiselectable`, Space toggles,
 * live count), per artboard notification-config/01 and 04.
 *
 * Behaviour (spec REQ-5):
 *   - A search filters the rows; selected users that the search hides stay
 *     selected (HfSelectableRows keeps values outside `items`).
 *   - A selected id that is no longer assignable is drawn under the list as
 *     «Usuario no disponible» with «Quitar». It is NEVER removed on its own.
 *   - While the users load, or when their read fails, no unavailable row is
 *     drawn: an unresolved id is not an unavailable user. A failed read says
 *     so with Reintentar (`retry`).
 *   - `error` (required or server field error) shows under the list, linked
 *     with `aria-describedby`, and marks the list invalid.
 */
import { computed, ref } from 'vue'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'
import { HfSelectableRows, type HfSelectableRowItem } from '@/core/shared/components/selection'
import { computeRecipientOptions, detectStaleRecipientIds } from './recipientSelectState'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    assignable: readonly AssignableUser[]
    disabled?: boolean
    error?: string
    loading?: boolean
    loadError?: boolean
  }>(),
  { disabled: false, error: '', loading: false, loadError: false },
)

const emit = defineEmits<{ 'update:modelValue': [next: string[]]; retry: [] }>()

const search = ref('')

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

const items = computed<HfSelectableRowItem[]>(() => {
  const query = normalize(search.value.trim())
  return computeRecipientOptions(props.assignable)
    .filter((option) => !query || normalize(option.label).includes(query))
    .map((option) => ({ value: option.value, label: option.label }))
})

const staleIds = computed(() =>
  props.loading || props.loadError ? [] : detectStaleRecipientIds(props.modelValue, props.assignable),
)
const knownCount = computed(() => props.modelValue.length - detectStaleRecipientIds(props.modelValue, props.assignable).length)
const countLabel = computed(
  () => () => `${knownCount.value} de ${props.assignable.length} seleccionados`,
)

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function removeStale(id: string) {
  emit('update:modelValue', props.modelValue.filter((existing) => existing !== id))
}
</script>

<template>
  <div class="nc-recipients">
    <!-- Loading: the rows' shape, no controls. -->
    <div
      v-if="loading"
      class="nc-recipients__loading"
      role="status"
      aria-busy="true"
      data-testid="recipient-loading"
    >
      <span class="sr-only">{{ NOTIFICATION_CONFIG_COPY.loadingRecipients }}</span>
      <div v-for="n in 3" :key="n" class="nc-recipients__loading-row" aria-hidden="true">
        <USkeleton class="size-8 rounded-full" />
        <USkeleton class="h-3 w-40 max-w-full" />
      </div>
    </div>

    <!-- The users could not be read: say so, one way out. -->
    <div
      v-else-if="loadError"
      role="alert"
      class="nc-notice"
      data-tone="error"
      data-testid="recipient-load-error"
    >
      <UIcon name="i-lucide-circle-alert" class="nc-notice__icon" aria-hidden="true" />
      <span class="nc-notice__text">
        <b>{{ NOTIFICATION_CONFIG_COPY.usersLoadError }}.</b>
        {{ NOTIFICATION_CONFIG_COPY.usersLoadErrorDetail }}
      </span>
      <UButton
        size="sm"
        variant="outline"
        color="neutral"
        icon="i-lucide-rotate-cw"
        data-testid="recipient-retry"
        @click="emit('retry')"
      >
        {{ NOTIFICATION_CONFIG_COPY.retry }}
      </UButton>
    </div>

    <template v-else>
      <p v-if="assignable.length === 0" class="nc-recipients__empty">
        {{ NOTIFICATION_CONFIG_COPY.noAssignableUsers }}
      </p>
      <template v-else>
        <div class="nc-recipients__search" data-testid="recipient-search">
          <UInput
            v-model="search"
            type="search"
            icon="i-lucide-search"
            autocomplete="off"
            class="w-full"
            :placeholder="NOTIFICATION_CONFIG_COPY.searchRecipients"
            :aria-label="NOTIFICATION_CONFIG_COPY.searchRecipientsLabel"
            :disabled="disabled"
          />
        </div>
        <p v-if="items.length === 0" class="nc-recipients__empty">
          Ningún usuario para «{{ search }}».
          <UButton
            variant="link"
            color="neutral"
            size="sm"
            :label="NOTIFICATION_CONFIG_COPY.clearSearch"
            @click="search = ''"
          />
        </p>
      </template>

      <HfSelectableRows
        v-if="assignable.length > 0"
        :items="items"
        :model-value="modelValue"
        :label="NOTIFICATION_CONFIG_COPY.recipientsLabel"
        :disabled="disabled"
        :count-label="countLabel"
        :error="error || undefined"
        @update:model-value="(ids: string[]) => emit('update:modelValue', ids)"
      >
        <template #option="{ item }">
          <span class="nc-recipients__option">
            <span class="nc-recipients__avatar" aria-hidden="true">{{ initials(item.label) }}</span>
            <span class="truncate">{{ item.label }}</span>
          </span>
        </template>
      </HfSelectableRows>
      <p v-else-if="error" class="nc-recipients__error" role="alert">
        <UIcon name="i-lucide-circle-alert" aria-hidden="true" />
        {{ error }}
      </p>

      <!-- Selected but no longer in the account: marked, removed only by hand. -->
      <ul v-if="staleIds.length > 0" class="nc-recipients__stale-list">
        <li
          v-for="id in staleIds"
          :key="id"
          class="nc-recipients__stale"
          :data-testid="`recipient-stale-${id}`"
        >
          <span class="nc-recipients__avatar" data-stale="true" aria-hidden="true">
            <UIcon name="i-lucide-user" />
          </span>
          <span class="nc-recipients__stale-text">
            <span class="nc-recipients__stale-title">{{ NOTIFICATION_CONFIG_COPY.staleRecipient }}</span>
            <small>{{ NOTIFICATION_CONFIG_COPY.staleRecipientDetail }}</small>
          </span>
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-lucide-x"
            :label="NOTIFICATION_CONFIG_COPY.removeStale"
            :aria-label="`${NOTIFICATION_CONFIG_COPY.removeStale} ${NOTIFICATION_CONFIG_COPY.staleRecipient.toLowerCase()}`"
            :disabled="disabled"
            @click="removeStale(id)"
          />
        </li>
      </ul>
    </template>
  </div>
</template>
