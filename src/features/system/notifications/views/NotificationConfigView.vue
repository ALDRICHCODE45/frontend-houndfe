<script setup lang="ts">
/**
 * NotificationConfigView — tenant-admin settings screen at
 * /sistema/configuracion/notificaciones.
 *
 * Composition surface (per vue-best-practices). Owns the composables,
 * passes reactive state into the three cards (master / recipients /
 * actions), and renders a Save footer. All business logic lives in the
 * composables — the view is intentionally thin.
 *
 * Data flow:
 *   1. useNotificationConfigQuery(tenantId) → GET /notification-config
 *      data is `NotificationConfigForm | undefined` (already mapped by
 *      fromConfigResponse — recipients → recipientUserIds).
 *   2. Pass `data` as `source` into useNotificationConfigForm — it
 *      auto-hydrates form + pristine via an internal watch(immediate:true).
 *      Do NOT call hydrate() manually.
 *   3. The form composable owns form state + canSave + field errors.
 *      View reads those refs and renders the Save footer.
 *
 * REQ-3: defaults render as OFF/empty when never configured (no error).
 * REQ-9: USkeleton while isLoading; controls stay disabled.
 * REQ-6: zero-recipient inline message + update-perm gate.
 * REQ-7: Save calls form.save() which sends PUT + invalidates + re-hydrates.
 */
import { computed } from 'vue'
import {
  useAssignableUsersQuery,
  useNotificationConfigQuery,
} from '../composables/useNotificationConfigQuery'
import { useNotificationConfigForm } from '../composables/useNotificationConfigForm'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import MasterToggle from '../components/MasterToggle.vue'
import RecipientSelect from '../components/RecipientSelect.vue'
import ActionsAccordion from '../components/ActionsAccordion.vue'
import { NOTIFICATION_CONFIG_COPY } from '../copy'
import '../styles/notifications-visual.css'

// ── Composable wiring ────────────────────────────────────────────────────────

const authStore = useAuthStore()
const query = useNotificationConfigQuery(() => authStore.currentTenantId)
const assignable = useAssignableUsersQuery()

// Form composable takes the query data ref as `source` and hydrates
// internally via watch(source, ..., { immediate: true }).
const form = useNotificationConfigForm(query.data)

// ── Derived state (just JS, no business logic) ──────────────────────────────

const isLoading = computed(() => query.isLoading.value)

/**
 * Whether to render the inline zero-recipient hint. Per spec REQ-6:
 * shown when enabledActions > 0 AND recipientUserIds === 0.
 * `zeroRecipientViolation` already encodes that predicate.
 */
const showZeroRecipientHint = computed(() => form.zeroRecipientViolation.value)

/**
 * The error state only replaces the form when nothing is on screen; a refetch
 * that fails while data is shown keeps the form (keepPreviousData).
 */
const showError = computed(() => query.isError.value && !query.data.value)

function onRetry() {
  void query.refetch()
}

/** Whether to render the "no update perm" notice (REQ-6). */
const showNoUpdatePerm = computed(() => !form.canUpdate.value)

/** Whether to disable Save — composable already encodes the gate. */
const isSaveDisabled = computed(() => !form.canSave.value)

function onSave() {
  void form.save()
}
</script>

<template>
  <div class="hf-theme hf-ui notifications-visual mx-auto flex w-full min-w-0 max-w-[1320px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
    <!-- Canonical page header (design-system §4), on the page background. -->
    <div class="hf-page-header">
      <h1 class="hf-page-title">{{ NOTIFICATION_CONFIG_COPY.pageTitle }}</h1>
    </div>

    <!-- Error state — nothing to show and no synthetic defaults; one way to retry. -->
    <EmptyState
      v-if="showError"
      data-testid="notifications-error"
      kind="error"
      :title="NOTIFICATION_CONFIG_COPY.loadError"
      action-label="Reintentar"
      action-test-id="notifications-retry"
      @action="onRetry"
    />

    <!-- Loading state — the same three cards, with the shapes of their content (REQ-9). -->
    <div
      v-else-if="isLoading"
      data-testid="notifications-loading"
      role="status"
      aria-busy="true"
      class="flex flex-col gap-6"
    >
      <span class="sr-only">Cargando la configuración de notificaciones…</span>
      <section class="notifications-section animate-pulse rounded-lg p-6" aria-hidden="true">
        <div data-skeleton="master" class="flex items-center gap-3">
          <span class="notifications-skeleton-bar h-5 w-9 rounded-full" />
          <span class="notifications-skeleton-bar h-4 w-32" />
        </div>
      </section>
      <section class="notifications-section animate-pulse rounded-lg p-6" aria-hidden="true">
        <span class="notifications-skeleton-bar mb-4 block h-5 w-40" />
        <span data-skeleton="recipients" class="notifications-skeleton-bar block h-11 w-full" />
        <span class="notifications-skeleton-bar mt-2 block h-3 w-24" />
      </section>
      <section class="notifications-section animate-pulse rounded-lg p-6" aria-hidden="true">
        <span class="notifications-skeleton-bar mb-4 block h-5 w-44" />
        <div class="flex flex-col gap-2">
          <span
            v-for="n in 4"
            :key="n"
            data-skeleton="module-row"
            class="notifications-skeleton-bar block h-11 w-full"
          />
        </div>
      </section>
    </div>

    <template v-else>
      <!-- Card 1 — Master toggle. -->
      <section
        class="notifications-section rounded-lg p-6"
        data-testid="notifications-card-master"
        :aria-label="NOTIFICATION_CONFIG_COPY.masterLabel"
      >
        <MasterToggle
          :model-value="form.form.enabled"
          :label="NOTIFICATION_CONFIG_COPY.masterLabel"
          @update:model-value="(v: boolean) => (form.form.enabled = v)"
        />
      </section>

      <!-- Card 2 — Recipients. -->
      <section
        class="notifications-section rounded-lg p-6"
        data-testid="notifications-card-recipients"
      >
        <header class="mb-4">
          <h2 class="text-base font-semibold text-default">
            {{ NOTIFICATION_CONFIG_COPY.recipientsLabel }}
          </h2>
        </header>
        <RecipientSelect
          :model-value="form.form.recipientUserIds"
          :assignable="assignable.users.value"
          :error="form.fieldErrors.recipients ?? ''"
          @update:model-value="
            (ids: string[]) => (form.form.recipientUserIds = ids)
          "
        />
        <p
          v-if="showZeroRecipientHint"
          class="mt-3 text-xs text-warning"
          data-testid="zero-recipient-hint"
        >
          {{ NOTIFICATION_CONFIG_COPY.zeroRecipient }}
        </p>
      </section>

      <!-- Card 3 — Actions. -->
      <section
        class="notifications-section rounded-lg p-6"
        data-testid="notifications-card-actions"
      >
        <header class="mb-4">
          <h2 class="text-base font-semibold text-default">
            {{ NOTIFICATION_CONFIG_COPY.actionsLabel }}
          </h2>
        </header>
        <ActionsAccordion
          :model-value="form.form.enabledActions"
          :master-enabled="form.form.enabled"
          @update:model-value="
            (keys: string[]) => (form.form.enabledActions = keys as typeof form.form.enabledActions)
          "
        />
      </section>
    </template>

    <!-- Footer — Save action bar.
         Aligned to the same width and horizontal rhythm as the cards above
         (no negative margins, no card border): the Save button floats
         cleanly to the right within the page flow. sticky-to-bottom keeps it
         within reach when the actions card scrolls past the viewport. -->
    <footer
      v-if="!isLoading && !showError"
      class="sticky bottom-0 flex items-center justify-end gap-3 py-4"
      data-testid="notifications-footer"
    >
      <p
        v-if="showNoUpdatePerm"
        class="mr-auto text-xs text-muted"
        data-testid="no-update-perm-notice"
      >
        {{ NOTIFICATION_CONFIG_COPY.noUpdatePerm }}
      </p>
      <UButton
        :disabled="isSaveDisabled"
        :loading="form.isPending.value"
        color="primary"
        data-testid="save-button"
        @click="onSave"
      >
        {{ form.isPending.value
          ? NOTIFICATION_CONFIG_COPY.saving
          : NOTIFICATION_CONFIG_COPY.save }}
      </UButton>
    </footer>
  </div>
</template>