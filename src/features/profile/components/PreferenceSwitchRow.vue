<script setup lang="ts">
/**
 * PreferenceSwitchRow — one whole-row switch of «Notificaciones» (selection without checkboxes,
 * design/notifications/02-panel-lateral «Preferencias /perfil»). The title and the description
 * are part of the target; the state is said in words («Activado» / «Desactivado» /
 * «Guardando…»), never by the track alone.
 *
 * Optimistic: `checked` already shows the new value while `saving`. When the change fails the
 * parent has put the value back and sets `failed`: the row says «No se pudo guardar» with the
 * value it kept and a «Reintentar» that repeats the same change (both emit `toggle`).
 */
import { computed, useId } from 'vue'
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

const titleId = useId()
const descriptionId = useId()
const errorId = useId()

const stateLabel = computed(() => {
  if (props.saving) return 'Guardando…'
  return props.checked ? 'Activado' : 'Desactivado'
})
const describedBy = computed(() =>
  props.failed ? `${descriptionId} ${errorId}` : descriptionId,
)
const keptLabel = computed(() => (props.checked ? 'Activado' : 'Desactivado'))
</script>

<template>
  <div class="pf-switch" :class="{ 'is-error': failed }">
    <button
      type="button"
      role="switch"
      class="pf-switch-row"
      :aria-checked="checked"
      :aria-busy="saving ? 'true' : undefined"
      :aria-labelledby="titleId"
      :aria-describedby="describedBy"
      :data-testid="`pref-${prefKey}`"
      @click="emit('toggle')"
    >
      <span class="pf-text">
        <span :id="titleId" class="pf-title">{{ title }}</span>
        <span :id="descriptionId" class="pf-desc">{{ description }}</span>
      </span>
      <span class="pf-state">{{ stateLabel }}</span>
      <span class="pf-track" aria-hidden="true" />
    </button>
    <div
      v-if="failed"
      :id="errorId"
      class="pf-error"
      role="alert"
      :data-testid="`pref-error-${prefKey}`"
    >
      <UIcon name="i-lucide-triangle-alert" class="pf-error__icon" aria-hidden="true" />
      <span>No se pudo guardar. Tu preferencia sigue en «{{ keptLabel }}».</span>
      <UButton
        label="Reintentar"
        size="xs"
        color="neutral"
        variant="outline"
        :data-testid="`pref-retry-${prefKey}`"
        @click="emit('toggle')"
      />
    </div>
  </div>
</template>
