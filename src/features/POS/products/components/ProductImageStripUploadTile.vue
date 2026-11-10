<script setup lang="ts">
import '../styles/product-images.css'
/**
 * ProductImageStripUploadTile — A file on its way: its own progress («64 %»),
 * «En cola» while it waits, or «No se subió» when it failed (the alert under the
 * strip names it and offers what to do).
 */
import type { UploadItem } from '../composables/useImageUpload'

defineProps<{ item: UploadItem }>()
</script>

<template>
  <div
    v-if="item.status === 'failed'"
    class="product-images-tile is-failed"
    :title="item.name"
    data-testid="product-image-upload-failed"
  >
    <UIcon name="i-lucide-triangle-alert" class="size-5" aria-hidden="true" />
    No se subió
  </div>
  <div
    v-else
    class="product-images-tile is-uploading"
    role="progressbar"
    :aria-label="`${item.status === 'queued' ? 'En cola' : 'Subiendo'} ${item.name}`"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="item.progress"
  >
    <img v-if="item.previewUrl" :src="item.previewUrl" alt="" aria-hidden="true" />
    <span class="product-images-tile__pct">
      <span>{{ item.status === 'queued' ? 'En cola' : `${item.progress} %` }}</span>
    </span>
    <span v-if="item.status === 'uploading'" class="product-images-tile__bar">
      <i :style="{ width: `${item.progress}%` }" />
    </span>
  </div>
</template>
