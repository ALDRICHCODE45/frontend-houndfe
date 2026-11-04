<script setup lang="ts">
import { computed } from 'vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { CHECKLIST_ID } from '../utils/order-checklist'
const props = withDefaults(defineProps<{ formId: string; savedAt: string | null; dirty: boolean; disabled: boolean; mobile?: boolean; showSave?: boolean; showConfirm: boolean; confirmEnabled: boolean }>(), { showSave: true })
const emit = defineEmits<{ confirm: [] }>()
const saved = computed(() => props.savedAt ? formatShortDateTime(props.savedAt) : '')
// Mobile: the actions live in a bar pinned to the bottom; desktop keeps the save state and the secondary save.
</script>

<template>
  <div v-if="mobile" data-testid="order-footer" class="order-action-bar">
    <UButton v-if="showSave" type="submit" :form="formId" color="neutral" variant="outline" :disabled="disabled">Guardar</UButton>
    <button v-if="showConfirm" type="button" data-testid="confirm-order" class="hf-primary-control" :aria-disabled="confirmEnabled ? undefined : 'true'" :aria-describedby="confirmEnabled ? undefined : CHECKLIST_ID" @click="confirmEnabled && emit('confirm')">Confirmar orden</button>
  </div>
  <footer v-else data-testid="order-footer" class="order-footer">
    <span class="order-save-state" aria-live="polite">
      <template v-if="dirty"><span class="order-save-dot" aria-hidden="true" />Cambios sin guardar</template>
      <template v-else-if="saved"><span class="order-save-ok">Guardado</span> · {{ saved }}</template>
      <template v-else>Sin guardar</template>
    </span>
    <UButton type="submit" :form="formId" color="neutral" variant="outline" :disabled="disabled">Guardar borrador</UButton>
  </footer>
</template>
