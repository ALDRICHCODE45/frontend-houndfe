<script setup lang="ts">
/**
 * ActionModuleGroup — one ACTION_REGISTRY module (artboard
 * notification-config/01): a label column (icon, name and, only with two or
 * more actions, a mixed «Activar todas» button) beside its switch rows. Below
 * 600px of page width the label becomes a band above the rows.
 *
 * «Activar todas» is a native button with `aria-pressed` true / false / mixed;
 * on a single-action module it would duplicate the row, so it is not drawn.
 * While the master is off or without update permission it is `aria-disabled`.
 *
 * Props ↓ / Events ↑:
 *   - module, modelValue (enabledActions), masterEnabled, readonly?
 *   - Emits @update:modelValue with the next enabledActions array
 */
import { computed, useId } from 'vue'
import HfSelectionMark from '@/core/shared/components/selection/HfSelectionMark.vue'
import type { ModuleDescriptor } from '../interfaces/notification-config.types'
import { computeModuleToggleState, setModuleActions } from './notificationRowState'
import ActionRow from './ActionRow.vue'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

const props = withDefaults(
  defineProps<{
    module: ModuleDescriptor
    modelValue: readonly string[]
    masterEnabled: boolean
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{ 'update:modelValue': [next: string[]] }>()

const headingId = useId()
const hasAll = computed(() => props.module.actions.length >= 2)
const toggle = computed(() => computeModuleToggleState(props.module, props.modelValue))
const allDisabled = computed(() => !props.masterEnabled || props.readonly)
const allMark = computed(() =>
  toggle.value.pressed === 'true' ? 'checked' : toggle.value.pressed === 'mixed' ? 'mixed' : 'unchecked',
)
const allText = computed(() =>
  toggle.value.pressed === 'true'
    ? NOTIFICATION_CONFIG_COPY.deactivateAll
    : NOTIFICATION_CONFIG_COPY.activateAll,
)
const allLabel = computed(
  () =>
    `Todas las acciones de ${props.module.moduleLabel}, ${toggle.value.on} de ${toggle.value.total} activadas`,
)

function onAll() {
  if (allDisabled.value) return
  emit('update:modelValue', setModuleActions(props.module, props.modelValue, toggle.value.pressed !== 'true'))
}
</script>

<template>
  <div
    class="nc-mod"
    role="group"
    :aria-labelledby="headingId"
    :data-testid="`module-group-${module.moduleKey}`"
  >
    <div class="nc-mod__label">
      <span v-if="module.icon" class="nc-mod__icon" aria-hidden="true">
        <UIcon :name="module.icon" />
      </span>
      <h3 :id="headingId" class="nc-mod__name">{{ module.moduleLabel }}</h3>
      <button
        v-if="hasAll"
        type="button"
        class="nc-mod__all"
        :aria-pressed="toggle.pressed"
        :aria-disabled="allDisabled ? 'true' : undefined"
        :aria-label="allLabel"
        :data-testid="`module-all-${module.moduleKey}`"
        @click="onAll"
      >
        <HfSelectionMark :state="allMark" />
        <span>{{ allText }}</span>
        <span class="nc-mod__all-count hf-figure">{{ toggle.on }} de {{ toggle.total }}</span>
      </button>
    </div>
    <div class="nc-mod__rows">
      <ActionRow
        v-for="action in module.actions"
        :key="action.key"
        :action="action"
        :model-value="modelValue"
        :master-enabled="masterEnabled"
        :readonly="readonly"
        @toggle="(next: string[]) => emit('update:modelValue', next)"
      />
    </div>
  </div>
</template>
