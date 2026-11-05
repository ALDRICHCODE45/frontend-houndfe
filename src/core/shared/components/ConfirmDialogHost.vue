<script setup lang="ts">
import { computed } from 'vue'
import ConfirmModal from './ConfirmModal.vue'
import { useConfirm } from '../composables/useConfirm'

/** The single app-level dialog behind `useConfirm()`. Mounted once, inside UApp, in App.vue.
 * It is teleported before any slideover opened later, so it gets its own layer above every other
 * overlay: a confirmation asked from inside a slideover must paint on top and receive the clicks. */
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
    :ui="{ overlay: 'z-[100]', content: 'hf-theme hf-ui hf-form-overlay z-[101]' }"
    @update:open="value => { if (!value) settle(false) }"
    @confirm="settle(true)"
  />
</template>
