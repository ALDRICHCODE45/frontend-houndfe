<script setup lang="ts">
/**
 * NotificationPreferencesSection — «Notificaciones»: the two server preferences as switch rows
 * (loading skeleton, error with retry) and, always after them, the per-device browser row. The
 * browser row does not depend on the server, so a failed load never hides it.
 *
 * Presentational: the state lives in the composables of the view; this emits `toggle`, `retry`
 * and `request-browser`.
 */
import { useId } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import BrowserNotificationsRow from './BrowserNotificationsRow.vue'
import PreferenceSwitchRow from './PreferenceSwitchRow.vue'
import type {
  BrowserNotificationState,
  NotificationPreferenceKey,
  NotificationPreferences,
} from '../interfaces/profile.types'

defineProps<{
  preferences: NotificationPreferences | null
  isLoading: boolean
  isError: boolean
  saving: Record<NotificationPreferenceKey, boolean>
  failed: Record<NotificationPreferenceKey, boolean>
  browserState: BrowserNotificationState
}>()

const emit = defineEmits<{
  toggle: [key: NotificationPreferenceKey]
  retry: []
  'request-browser': []
}>()

const headingId = useId()

const ROWS: ReadonlyArray<{ key: NotificationPreferenceKey; title: string; description: string }> = [
  {
    key: 'emailEnabled',
    title: 'Avisos por correo',
    description:
      'Un correo con las solicitudes nuevas (las que llegan en el mismo lapso de 2 minutos van juntas) y otro cuando te reasignan una. Sin nombre ni teléfono del cliente.',
  },
  {
    key: 'soundEnabled',
    title: 'Sonido de avisos',
    description:
      'Suena cuando llega un aviso y la pestaña está oculta. Vale en todos tus dispositivos.',
  },
]
</script>

<template>
  <section class="pf-group" :aria-labelledby="headingId" data-testid="profile-notifications">
    <div class="pf-group-head">
      <div class="grid gap-0.5">
        <h2 :id="headingId" class="pf-group-title">Notificaciones</h2>
        <p class="pf-group-sub">
          Tus preferencias son de tu persona: valen en todas las sucursales y dispositivos, y cada
          cambio se guarda al instante. Los avisos dentro del sistema no se pueden apagar.
        </p>
      </div>
    </div>

    <div class="pf-surface" role="group" aria-label="Canales de aviso">
      <div
        v-if="isLoading"
        class="pf-loading"
        aria-busy="true"
        aria-label="Cargando preferencias"
        data-testid="prefs-loading"
      >
        <div v-for="n in 2" :key="n" class="pf-extra">
          <span class="pf-text pf-text--grow">
            <USkeleton class="h-4 w-2/5" />
            <USkeleton class="h-3.5 w-3/4" />
          </span>
          <USkeleton class="h-[26px] w-11 rounded-full" />
        </div>
      </div>

      <EmptyState
        v-else-if="isError"
        kind="error"
        title="No se pudieron cargar tus preferencias"
        description="No se cambió nada. Inténtalo de nuevo."
        action-label="Reintentar"
        data-testid="prefs-error"
        @action="emit('retry')"
      />

      <template v-else-if="preferences">
        <PreferenceSwitchRow
          v-for="row in ROWS"
          :key="row.key"
          :pref-key="row.key"
          :title="row.title"
          :description="row.description"
          :checked="preferences[row.key]"
          :saving="saving[row.key]"
          :failed="failed[row.key]"
          @toggle="emit('toggle', row.key)"
        />
      </template>

      <BrowserNotificationsRow :state="browserState" @request="emit('request-browser')" />
    </div>
  </section>
</template>
