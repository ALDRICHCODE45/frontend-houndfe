<script setup lang="ts">
/**
 * PreferenceSwitchRow — one whole-row switch of «Notificaciones» (selection without checkboxes,
 * design/notifications/02-panel-lateral «Preferencias /perfil»). A thin wrapper over the shared
 * HfSwitchRow that keeps the profile test ids and copy.
 *
 * Optimistic: `checked` already shows the new value while `saving`. When the change fails the
 * parent has put the value back and sets `failed`: the row says «No se pudo guardar» with the
 * value it kept and a «Reintentar» that repeats the same change (both emit `toggle`).
 */
import { computed } from 'vue'
import HfSwitchRow from '@/core/shared/components/selection/HfSwitchRow.vue'
import type { NotificationPreferenceKey } from '../interfaces/profile.types'

const props = withDefaults(
  defineProps<{
    prefKey: NotificationPreferenceKey
    title: string
    description: string
    checked: boolean
    saving?: boolean
    failed?: boolean
  }>(),
  { saving: false, failed: false },
)

const emit = defineEmits<{ toggle: [] }>()

const error = computed(() =>
  props.failed
    ? `No se pudo guardar. Tu preferencia sigue en «${props.checked ? 'Activado' : 'Desactivado'}».`
    : undefined,
)
</script>

<template>
  <HfSwitchRow
    class="pf-switch"
    :model-value="checked"
    :label="title"
    :description="description"
    :saving="saving"
    :error="error"
    :test-id="`pref-${prefKey}`"
    :error-test-id="`pref-error-${prefKey}`"
    :retry-test-id="`pref-retry-${prefKey}`"
    @update:model-value="emit('toggle')"
    @retry="emit('toggle')"
  />
</template>
