<script setup lang="ts">
/**
 * RequestConversationMedia — the file of one message (handoff 18 §3, §5.4). The media route needs
 * the Bearer token, so every kind goes through `useChatbotMedia` (blob → object URL, revoked on
 * unmount):
 *  - image / sticker: fetched when the bubble scrolls into view, shown as a thumbnail; click opens
 *    a larger view (there are no server thumbnails, the original is shown).
 *  - PDF: a chip; the file is fetched on click and opened in a new tab.
 *  - voice note: «Escuchar nota de voz» loads it on demand, then a native `<audio controls>`.
 * A purged file (`media.purged` or a 410) shows the retention copy and never retries.
 */
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useChatbotMedia } from '../composables/useChatbotMedia'
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'
import { formatBytes, type MediaKind } from '../utils/conversation-format'

const props = defineProps<{
  message: ChatbotMessage
  kind: MediaKind
}>()

const media = computed(() => props.message.media)
const isImage = computed(() => props.kind === 'image' || props.kind === 'sticker')

// Images load when visible; PDFs and voice notes only when the user asks.
const visible = ref(typeof IntersectionObserver === 'undefined')
const requested = ref(false)
const enabled = computed(() => (isImage.value ? visible.value : requested.value))
const purged = computed(() => media.value?.purged === true)

const { url, isLoading, isError, isPurged, errorMessage, refetch } = useChatbotMedia(
  () => media.value?.id,
  { enabled, purged },
)

const root = useTemplateRef<HTMLElement>('root')
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (visible.value || !root.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      visible.value = true
      observer?.disconnect()
      observer = null
    }
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  pendingTab?.close()
})

const size = computed(() => formatBytes(media.value?.sizeBytes))
const imageAlt = computed(() =>
  props.kind === 'sticker' ? 'Sticker enviado en el chat' : (props.message.text?.trim() || 'Imagen enviada en el chat'),
)

// ─── Larger view ──────────────────────────────────────────────────────────────
const viewerOpen = ref(false)

// ─── PDF: open a tab synchronously (popup rules), point it at the blob when it arrives ──
let pendingTab: Window | null = null

function flushTab(): void {
  if (pendingTab && url.value) {
    pendingTab.location.href = url.value
    pendingTab = null
  }
}

function openPdf(): void {
  if (isPurged.value) return
  pendingTab?.close()
  pendingTab = window.open('', '_blank')
  if (pendingTab) pendingTab.opener = null
  if (requested.value && isError.value) void refetch()
  requested.value = true
  flushTab()
}

watch(url, flushTab)
watch(isError, (failed) => {
  if (failed && pendingTab) {
    pendingTab.close()
    pendingTab = null
  }
})

const showError = computed(() => isError.value && errorMessage.value !== null)
const canRetry = computed(() => showError.value && !isPurged.value)
</script>

<template>
  <div ref="root" class="rc-media" :data-kind="kind" :data-testid="kind === 'sticker' ? 'media-sticker' : undefined">
    <template v-if="isImage">
      <div v-if="isLoading || (!url && !showError)" class="rc-media__loading" data-testid="media-loading" aria-busy="true">
        <UIcon name="i-lucide-image" aria-hidden="true" />
        <span class="rc-sr">Cargando imagen…</span>
      </div>
      <button
        v-else-if="url"
        type="button"
        class="rc-thumb"
        :class="{ 'rc-thumb--sticker': kind === 'sticker' }"
        data-testid="media-open-image"
        aria-label="Ver imagen más grande"
        @click="viewerOpen = true"
      >
        <img :src="url" :alt="imageAlt" loading="lazy" />
      </button>
      <UModal v-model:open="viewerOpen" title="Imagen del chat" :ui="{ content: 'hf-theme hf-ui' }">
        <template #body>
          <img v-if="url" :src="url" :alt="imageAlt" class="mx-auto max-h-[75vh] max-w-full rounded-md" />
        </template>
      </UModal>
    </template>

    <template v-else-if="kind === 'pdf'">
      <button
        type="button"
        class="rc-chip"
        data-testid="media-pdf"
        :disabled="isPurged"
        :aria-busy="isLoading"
        @click="openPdf"
      >
        <UIcon :name="isLoading ? 'i-lucide-loader-circle' : 'i-lucide-file-text'" aria-hidden="true" />
        <span class="rc-chip__label">
          <b>Documento PDF</b>
          <small>{{ isLoading ? 'Abriendo…' : size || 'Abrir en una pestaña nueva' }}</small>
        </span>
        <UIcon v-if="!isPurged" name="i-lucide-external-link" class="rc-chip__go" aria-hidden="true" />
      </button>
    </template>

    <template v-else-if="kind === 'audio'">
      <audio v-if="url" :src="url" controls preload="metadata" class="rc-audio" data-testid="media-audio" />
      <button
        v-else-if="!isPurged && !showError"
        type="button"
        class="rc-chip"
        data-testid="media-load-audio"
        :aria-busy="isLoading"
        @click="requested = true"
      >
        <UIcon :name="isLoading ? 'i-lucide-loader-circle' : 'i-lucide-mic'" aria-hidden="true" />
        <span class="rc-chip__label">
          <b>{{ isLoading ? 'Cargando nota de voz…' : 'Escuchar nota de voz' }}</b>
          <small v-if="size">{{ size }}</small>
        </span>
      </button>
    </template>

    <p v-if="showError" class="rc-media__error" role="status" data-testid="media-error">
      <UIcon name="i-lucide-file-x" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
      <button v-if="canRetry" type="button" class="rc-linkbtn" data-testid="media-retry" @click="refetch()">
        Reintentar
      </button>
    </p>
  </div>
</template>
