<script setup lang="ts">
import { computed } from 'vue'
import ConfirmModal from './ConfirmModal.vue'
import { useConfirm } from '../composables/useConfirm'

/** The single app-level dialog behind `useConfirm()`. Mounted once, inside UApp, in App.vue. */
const { pending, settle } = useConfirm()
const options = computed(() => pending.value?.options)
</script>

<template>
  <ConfirmModal
    :open="pending !== null"
    :title="options?.title"
    :description="options?.description ?? ''"
    :confirm-label="options?.confirmLabel"
    :cancel-label="options?.cancelLabel"
    :confirm-color="options?.tone === 'danger' ? 'error' : 'primary'"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay' }"
    @update:open="value => { if (!value) settle(false) }"
    @confirm="settle(true)"
  />
</template>
