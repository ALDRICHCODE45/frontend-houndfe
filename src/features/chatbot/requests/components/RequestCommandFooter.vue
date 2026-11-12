<script setup lang="ts">
/** RequestCommandFooter — «Volver» and the submit button of a command form (danger for cancel). */
defineProps<{ label: string; danger?: boolean; pending?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <div class="rc-footer">
    <UButton
      data-testid="command-back"
      type="button"
      color="neutral"
      variant="ghost"
      label="Volver"
      :disabled="pending"
      @click="emit('back')"
    />
    <UButton
      data-testid="command-submit"
      type="submit"
      :color="danger ? 'error' : 'primary'"
      :label="label"
      :loading="pending"
      :disabled="disabled || pending"
    />
  </div>
</template>
