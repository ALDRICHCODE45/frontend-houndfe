<script setup lang="ts">
/**
 * ProfileView — «Mi perfil» (route `profile`, `/perfil`; any authenticated user, no permission).
 *
 * design/notifications/02-panel-lateral «Preferencias /perfil» and its mobile frame. Composition
 * surface only: the account block (name and email from the session, read-only) and the
 * notifications block (server preferences as switch rows + the per-device browser permission).
 */
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import ProfileAccountSection from '../components/ProfileAccountSection.vue'
import NotificationPreferencesSection from '../components/NotificationPreferencesSection.vue'
import { useBrowserNotificationPermission } from '../composables/useBrowserNotificationPermission'
import { useNotificationPreferences } from '../composables/useNotificationPreferences'
import '../styles/profile.css'

const auth = useAuthStore()
const name = computed(() => auth.user?.name ?? '')
const email = computed(() => auth.user?.email ?? '')

const preferences = useNotificationPreferences()
const browser = useBrowserNotificationPermission()
</script>

<template>
  <div class="hf-theme hf-ui profile-visual mx-auto flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <header class="hf-page-header">
      <h1 id="profile-title" class="hf-page-title">Mi perfil</h1>
      <p class="hf-page-subtitle">Tus datos y cómo quieres que te avisemos.</p>
    </header>

    <ProfileAccountSection :name="name" :email="email" />

    <NotificationPreferencesSection
      :preferences="preferences.preferences.value"
      :is-loading="preferences.isLoading.value"
      :is-error="preferences.isError.value"
      :saving="preferences.saving"
      :failed="preferences.failed"
      :browser-state="browser.state.value"
      @toggle="preferences.toggle"
      @retry="preferences.refetch()"
      @request-browser="browser.request()"
    />
  </div>
</template>
