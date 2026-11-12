<script setup lang="ts">
/**
 * NotificationsHost — what the dashboard topbar mounts. Renders nothing (and sends nothing) unless
 * there is an authenticated user with a tenant: notices belong to a person in a branch.
 */
import { useNotificationsAccess } from '../composables/useNotificationsAccess'
import NotificationsCenter from './NotificationsCenter.vue'

const { enabled } = useNotificationsAccess()
</script>

<template>
  <NotificationsCenter v-if="enabled" />
</template>
