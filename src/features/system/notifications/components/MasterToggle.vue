<script setup lang="ts">
/**
 * MasterToggle — the master «Notificaciones por correo» switch as a whole-row
 * switch (HfSwitchRow, docs/design-system.md §Selección sin checkboxes) with
 * the Activadas / Desactivadas state word (artboard notification-config/01).
 *
 * Props ↓ / Events ↑:
 *   - modelValue: boolean
 *   - disabled?:  no update permission → `aria-disabled`, still focusable
 *   - Emits @update:modelValue with the next boolean
 */
import { computed } from 'vue'
import { HfSwitchRow } from '@/core/shared/components/selection'
import { computeMasterBadgeState } from './masterToggleState'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

const props = withDefaults(defineProps<{ modelValue: boolean; disabled?: boolean }>(), {
  disabled: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const stateWord = computed(() => computeMasterBadgeState(props.modelValue).label)
</script>

<template>
  <div class="nc-master" data-testid="master-toggle" :data-enabled="modelValue">
    <HfSwitchRow
      :model-value="modelValue"
      :label="NOTIFICATION_CONFIG_COPY.masterLabel"
      :description="NOTIFICATION_CONFIG_COPY.masterDescription"
      :on-label="stateWord"
      :off-label="stateWord"
      :disabled="disabled"
      @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    />
  </div>
</template>
