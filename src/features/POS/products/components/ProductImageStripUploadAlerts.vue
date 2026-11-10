<script setup lang="ts">
import '../styles/product-images.css'
/**
 * ProductImageStripUploadAlerts — One inline alert per file that did not upload,
 * next to the strip instead of only a toast: «Reintentar» for a failed send,
 * «Elegir otra» for a file the app cannot take, and «Descartar».
 *
 * Events: retry(id), replace(id), discard(id)
 */
import { computed } from 'vue'
import type { UploadItem } from '../composables/useImageUpload'

const props = defineProps<{ uploads: UploadItem[] }>()
const emit = defineEmits<{ retry: [id: string]; replace: [id: string]; discard: [id: string] }>()

const failed = computed(() => props.uploads.filter((item) => item.status === 'failed'))
</script>

<template>
  <div
    v-for="item in failed"
    :key="item.id"
    class="product-images-alert"
    role="alert"
    data-testid="product-images-upload-alert"
  >
    <UIcon name="i-lucide-triangle-alert" class="product-images-alert__icon" aria-hidden="true" />
    <span class="min-w-0"><b>{{ item.name }} no se subió.</b> {{ item.reason }}</span>
    <span class="product-images-alert__actions">
      <button v-if="item.retryable" type="button" class="product-images-link" @click="emit('retry', item.id)">
        Reintentar
      </button>
      <button v-else type="button" class="product-images-link" @click="emit('replace', item.id)">Elegir otra</button>
      <button type="button" class="product-images-link" @click="emit('discard', item.id)">Descartar</button>
    </span>
  </div>
</template>
