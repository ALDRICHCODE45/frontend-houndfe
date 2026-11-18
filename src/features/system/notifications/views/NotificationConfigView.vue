<script setup lang="ts">
/**
 * NotificationConfigView — tenant-admin settings screen at
 * /sistema/configuracion/notificaciones (artboards
 * design/notification-config/01-filas-en-una-columna and 04-movil-y-estados).
 *
 * One 880px column under the canonical page header: «Estado» (master
 * whole-row switch + the effect of the form), «Usuarios a notificar»
 * (selectable rows) and «Acciones a notificar» (one module per registry entry,
 * a label column beside its switch rows), then HfSaveBar.
 *
 * Data flow (unchanged API, payload and permission gates):
 *   1. useNotificationConfigQuery(tenantId) → GET /notification-config, already
 *      mapped to a NotificationConfigForm.
 *   2. useNotificationConfigForm(query.data) hydrates form + pristine itself.
 *   3. Save calls form.save() → toPutBody → PUT + invalidate + re-hydrate.
 *      Discard copies the pristine snapshot back into the form.
 *
 * REQ-3: defaults render as OFF/empty when never configured (no error).
 * REQ-6: zero-recipient error under the users list; without update permission
 *        every control is locked and a notice replaces the save bar.
 * REQ-9: USkeleton shapes while loading; error state with Reintentar.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import {
  useAssignableUsersQuery,
  useNotificationConfigQuery,
} from '../composables/useNotificationConfigQuery'
import { useNotificationConfigForm } from '../composables/useNotificationConfigForm'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import MasterToggle from '../components/MasterToggle.vue'
import RecipientSelect from '../components/RecipientSelect.vue'
import ActionModuleGroup from '../components/ActionModuleGroup.vue'
import { ACTION_REGISTRY } from '../registry/action-registry'
import { detectStaleRecipientIds } from '../components/recipientSelectState'
import {
  computeDeliverySummary,
  countFormChanges,
  describeActionsNeedingRecipients,
} from '../components/notificationRowState'
import type { ActionKey } from '../interfaces/notification-config.types'
import { NOTIFICATION_CONFIG_COPY as COPY } from '../copy'
import '../styles/notifications-visual.css'

// ── Composable wiring ────────────────────────────────────────────────────────

const authStore = useAuthStore()
const query = useNotificationConfigQuery(() => authStore.currentTenantId)
const assignable = useAssignableUsersQuery()
const form = useNotificationConfigForm(query.data)

// ── Page state ───────────────────────────────────────────────────────────────

const isLoading = computed(() => query.isLoading.value)
/** Only replaces the form when nothing is on screen (keepPreviousData). */
const showError = computed(() => query.isError.value && !query.data.value)
const readonly = computed(() => !form.canUpdate.value)

function onRetry() {
  void query.refetch()
}

// ── Derived copy ─────────────────────────────────────────────────────────────

const totalActions = ACTION_REGISTRY.reduce((total, m) => total + m.actions.length, 0)
const actionsCount = computed(() => `${form.form.enabledActions.length} de ${totalActions} activadas`)

const knownRecipients = computed(() => {
  if (assignable.isLoading.value || assignable.isError.value) return form.form.recipientUserIds.length
  return (
    form.form.recipientUserIds.length -
    detectStaleRecipientIds(form.form.recipientUserIds, assignable.users.value).length
  )
})
const summary = computed(() => computeDeliverySummary(form.form, knownRecipients.value))
const dirtyCount = computed(() => countFormChanges(form.form, form.pristine))

const recipientError = computed(() => {
  if (form.fieldErrors.recipients) return form.fieldErrors.recipients
  if (!form.zeroRecipientViolation.value) return ''
  return `${COPY.zeroRecipient}. ${describeActionsNeedingRecipients(form.form.enabledActions)}`.trim()
})

// ── Edits ────────────────────────────────────────────────────────────────────

function setEnabled(value: boolean) {
  if (readonly.value) return
  form.form.enabled = value
}
function setRecipients(ids: string[]) {
  if (readonly.value) return
  form.form.recipientUserIds = ids
}
function setActions(keys: string[]) {
  if (readonly.value) return
  form.form.enabledActions = keys as ActionKey[]
}

// ── Save bar ─────────────────────────────────────────────────────────────────

const saveError = ref<string | null>(null)
const recipientsGroup = useTemplateRef<HTMLElement>('recipientsGroup')

// Any edit clears a previous save failure.
watch(
  () => [form.form.enabled, form.form.recipientUserIds, form.form.enabledActions],
  () => {
    saveError.value = null
  },
  { deep: true },
)

async function focusRecipients() {
  await nextTick()
  recipientsGroup.value?.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus()
}

async function onSave() {
  if (!form.canSave.value) {
    if (form.zeroRecipientViolation.value) {
      saveError.value = COPY.saveBlockedRecipients
      void focusRecipients()
    }
    return
  }
  saveError.value = null
  try {
    await form.save()
  } catch {
    saveError.value = form.fieldErrors.recipients ? COPY.saveFailedRecipients : COPY.saveFailed
  }
}

function onDiscard() {
  form.form.enabled = form.pristine.enabled
  form.form.recipientUserIds = [...form.pristine.recipientUserIds]
  form.form.enabledActions = [...form.pristine.enabledActions]
  saveError.value = null
}
</script>

<template>
  <div class="hf-theme hf-ui notifications-visual nc-page mx-auto flex w-full min-w-0 flex-col px-4 pt-6 sm:px-6 lg:px-10">
    <!-- Canonical page header (design-system §4): title plus one short subtitle. -->
    <header class="hf-page-header">
      <h1 class="hf-page-title">{{ COPY.pageTitle }}</h1>
      <p class="hf-page-subtitle">{{ COPY.pageSubtitle }}</p>
    </header>

    <!-- Error state — nothing to show and no synthetic defaults; one way to retry. -->
    <EmptyState
      v-if="showError"
      data-testid="notifications-error"
      kind="error"
      :title="COPY.loadError"
      description="No se cambió nada. Revisa tu conexión y vuelve a intentarlo."
      :action-label="COPY.retry"
      action-test-id="notifications-retry"
      @action="onRetry"
    />

    <!-- Loading state in the screen's shape: three groups of rows, no controls (REQ-9). -->
    <div
      v-else-if="isLoading"
      data-testid="notifications-loading"
      role="status"
      aria-busy="true"
      class="nc-groups"
    >
      <span class="sr-only">{{ COPY.loading }}</span>
      <div
        v-for="rows in [1, 3, 4]"
        :key="rows"
        data-skeleton="group"
        class="nc-group"
        aria-hidden="true"
      >
        <USkeleton class="h-4 w-40" />
        <div class="nc-surface">
          <div v-for="n in rows" :key="n" class="nc-loading-row">
            <span class="flex flex-1 flex-col gap-2">
              <USkeleton class="h-3.5 w-36" />
              <USkeleton class="h-3 w-3/5" />
            </span>
            <USkeleton class="h-6 w-11 rounded-full" />
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="nc-groups">
        <!-- Estado -->
        <section class="nc-group" aria-labelledby="nc-group-status" data-testid="notifications-group-status">
          <div class="nc-group__head">
            <h2 id="nc-group-status" class="nc-group__title">{{ COPY.statusLabel }}</h2>
          </div>
          <div class="nc-surface">
            <MasterToggle
              :model-value="form.form.enabled"
              :disabled="readonly"
              @update:model-value="setEnabled"
            />
            <p class="nc-notice" :data-tone="summary.tone" aria-live="polite" data-testid="delivery-summary">
              <UIcon :name="summary.icon" class="nc-notice__icon" aria-hidden="true" />
              <span class="nc-notice__text">
                <span v-if="dirtyCount > 0" class="nc-notice__pending">{{ COPY.pendingPrefix }}</span>
                <b>{{ summary.title }}</b>
                <template v-if="summary.detail">{{ summary.tone === 'ok' ? ' · ' : ' ' }}{{ summary.detail }}</template>
              </span>
            </p>
          </div>
        </section>

        <!-- Usuarios a notificar -->
        <section
          ref="recipientsGroup"
          class="nc-group"
          aria-labelledby="nc-group-recipients"
          data-testid="notifications-group-recipients"
        >
          <div class="nc-group__head">
            <div>
              <h2 id="nc-group-recipients" class="nc-group__title">{{ COPY.recipientsLabel }}</h2>
              <p class="nc-group__desc">{{ COPY.recipientsHint }}</p>
            </div>
          </div>
          <RecipientSelect
            :model-value="form.form.recipientUserIds"
            :assignable="assignable.users.value"
            :disabled="readonly"
            :error="recipientError"
            :loading="assignable.isLoading.value"
            :load-error="assignable.isError.value"
            @retry="assignable.refetch()"
            @update:model-value="setRecipients"
          />
        </section>

        <!-- Acciones a notificar -->
        <section class="nc-group" aria-labelledby="nc-group-actions" data-testid="notifications-group-actions">
          <div class="nc-group__head">
            <div>
              <h2 id="nc-group-actions" class="nc-group__title">{{ COPY.actionsLabel }}</h2>
              <p class="nc-group__desc">{{ COPY.actionsHint }}</p>
            </div>
            <span class="nc-group__count hf-figure" data-testid="actions-count">{{ actionsCount }}</span>
          </div>
          <div class="nc-surface">
            <div v-if="!form.form.enabled" class="nc-notice nc-notice--top" data-tone="off" data-testid="actions-paused">
              <UIcon name="i-lucide-pause" class="nc-notice__icon" aria-hidden="true" />
              <span class="nc-notice__text">
                <b>{{ COPY.pausedTitle }}</b> {{ COPY.pausedDetail }}
              </span>
              <UButton
                v-if="!readonly"
                variant="link"
                color="neutral"
                size="sm"
                class="nc-notice__action"
                :label="COPY.reactivate"
                data-testid="actions-reactivate"
                @click="setEnabled(true)"
              />
            </div>
            <ActionModuleGroup
              v-for="module in ACTION_REGISTRY"
              :key="module.moduleKey"
              :module="module"
              :model-value="form.form.enabledActions"
              :master-enabled="form.form.enabled"
              :readonly="readonly"
              @update:model-value="setActions"
            />
          </div>
        </section>
      </div>

      <HfSaveBar
        v-if="!readonly"
        class="nc-save-bar"
        :dirty-count="dirtyCount"
        :saving="form.isPending.value"
        :error="saveError"
        :save-label="COPY.save"
        @save="onSave"
        @discard="onDiscard"
      />
      <p v-else class="nc-readonly" data-testid="no-update-perm-notice">
        <UIcon name="i-lucide-lock" class="nc-readonly__icon" aria-hidden="true" />
        {{ COPY.noUpdatePerm }}
      </p>
    </template>
  </div>
</template>
