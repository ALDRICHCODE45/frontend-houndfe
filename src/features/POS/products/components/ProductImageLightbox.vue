<script setup lang="ts">
/**
 * ProductImageLightbox — A centered modal that shows a product image whole
 * (`object-contain`, never cropped). Esc, the scrim and the close button close
 * it. Its title and description are visually hidden, for assistive tech. The
 * optional `footer` slot holds context such as badges or actions.
 */
defineProps<{
  open: boolean
  src: string | null
  alt: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <UModal
    :open="open"
    :title="alt"
    description="Vista completa de la imagen"
    :ui="{ content: 'hf-theme hf-ui' }"
    @update:open="(val: boolean) => { if (!val) emit('close') }"
  >
    <template #content>
      <div class="relative flex flex-col items-center">
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="lg"
          aria-label="Cerrar vista previa"
          class="absolute top-3 right-3 z-10"
          @click="emit('close')"
        />

        <img v-if="src" :src="src" :alt="alt" class="max-h-[80vh] w-full object-contain rounded-lg" />

        <slot name="footer" />
      </div>
    </template>
  </UModal>
</template>
