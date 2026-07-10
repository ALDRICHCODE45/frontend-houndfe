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
import MasterToggle from '../components/MasterToggle.vue'
import RecipientSelect from '../components/RecipientSelect.vue'
import ActionsAccordion from '../components/ActionsAccordion.vue'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

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

/** Whether to render the "no update perm" notice (REQ-6). */
const showNoUpdatePerm = computed(() => !form.canUpdate.value)

/** Whether to disable Save — composable already encodes the gate. */
const isSaveDisabled = computed(() => !form.canSave.value)

function onSave() {
  void form.save()
}
</script>

<template>
  <div class="flex flex-col gap-6 p-6">
    <!-- Loading state — placeholders for the three cards (REQ-9). -->
    <template v-if="isLoading">
      <div
        v-for="i in 3"
        :key="i"
        class="rounded-lg border border-default bg-default p-6"
      >
        <USkeleton class="mb-3 h-5 w-1/3" />
        <USkeleton class="h-4 w-2/3" />
      </div>
    </template>

    <template v-else>
      <!-- Card 1 — Master toggle. -->
      <section
        class="rounded-lg border border-default bg-default p-6"
        data-testid="notifications-card-master"
      >
        <header class="mb-4">
          <h2 class="text-lg font-semibold text-default">
            {{ NOTIFICATION_CONFIG_COPY.masterLabel }}
          </h2>
        </header>
        <MasterToggle
          :model-value="form.form.enabled"
          :label="NOTIFICATION_CONFIG_COPY.masterLabel"
          :description="NOTIFICATION_CONFIG_COPY.masterDescription"
          @update:model-value="(v: boolean) => (form.form.enabled = v)"
        />
      </section>

      <!-- Card 2 — Recipients. -->
      <section
        class="rounded-lg border border-default bg-default p-6"
        data-testid="notifications-card-recipients"
      >
        <header class="mb-4">
          <h2 class="text-lg font-semibold text-default">
            {{ NOTIFICATION_CONFIG_COPY.recipientsLabel }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ NOTIFICATION_CONFIG_COPY.recipientsDescription }}
          </p>
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
        class="rounded-lg border border-default bg-default p-6"
        data-testid="notifications-card-actions"
      >
        <header class="mb-4">
          <h2 class="text-lg font-semibold text-default">
            {{ NOTIFICATION_CONFIG_COPY.actionsLabel }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ NOTIFICATION_CONFIG_COPY.actionsDescription }}
          </p>
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
      v-if="!isLoading"
      class="sticky bottom-0 flex items-center justify-end gap-3 py-4"
      data-testid="notifications-footer"
    >
      <p
        v-if="showNoUpdatePerm"
        class="mr-auto text-xs text-warning"
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