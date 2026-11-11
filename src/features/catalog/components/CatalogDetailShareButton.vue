<script setup lang="ts">
import { onBeforeUnmount, shallowRef } from 'vue'

/**
 * «Compartir». The desktop control (`copy`) copies the link and confirms it; the mobile control
 * (`native`) opens the system share sheet when the browser has one and copies otherwise.
 */
const props = defineProps<{
  url: string
  title: string
  mode: 'copy' | 'native'
}>()

const FEEDBACK_MS = 2500
const feedback = shallowRef<string | null>(null)
let feedbackTimer: ReturnType<typeof setTimeout> | undefined

function announce(message: string) {
  feedback.value = message
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    feedback.value = null
  }, FEEDBACK_MS)
}

async function copyLink() {
  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(props.url)
    announce('Enlace copiado')
  } catch {
    announce('No se pudo copiar el enlace')
  }
}

async function share() {
  if (props.mode === 'native' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: props.title, url: props.url })
    } catch (error) {
      // Dismissing the sheet is a choice, not a failure; any other refusal still gets the link.
      if (!(error instanceof DOMException && error.name === 'AbortError')) await copyLink()
    }
    return
  }
  await copyLink()
}

onBeforeUnmount(() => clearTimeout(feedbackTimer))
</script>

<template>
  <button
    :data-testid="mode === 'copy' ? 'catalog-detail-share-copy' : 'catalog-detail-share-native'"
    class="catalog-pdp-button catalog-pdp-share"
    :class="mode === 'copy' ? 'catalog-pdp-share--desktop' : 'catalog-pdp-share--mobile'"
    type="button"
    @click="share"
  >
    <UIcon name="i-lucide-share-2" class="size-4" aria-hidden="true" />
    Compartir
  </button>
  <Teleport to="body">
    <div
      v-if="feedback"
      data-testid="catalog-detail-share-feedback"
      class="catalog-pdp-toast"
      role="status"
    >
      {{ feedback }}
    </div>
  </Teleport>
</template>
