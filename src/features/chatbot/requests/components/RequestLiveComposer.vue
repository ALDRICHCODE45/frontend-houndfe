<script setup lang="ts">
/**
 * RequestLiveComposer — the box the attendee writes in (handoff 20 §3, §3b). Design
 * 01-chat-en-la-pagina `composerHTML` and 04-movil-y-estados (attach sheet, caption, limits).
 *
 * Presentational: the draft, the attachment and the limits come from `useLiveChat`. Enter sends,
 * Shift+Enter adds a line (owner decision), Enter while an input method is composing does neither.
 * The text goes to the customer as written, so the box says so. The clip opens the file picker
 * (desktop) or a bottom sheet with «Foto o imagen» / «Documento PDF» (below 1024 px, design 04).
 */
import { computed, ref, useId, useTemplateRef } from 'vue'
import type { LiveAttachment } from '../composables/useLiveChat'
import { formatBytes } from '../utils/conversation-format'
import { ATTACH_ACCEPT } from '../utils/live-attachments'
import RequestCommandSheet from './RequestCommandSheet.vue'

const props = defineProps<{
  modelValue: string
  attachment: LiveAttachment | null
  /** 4,096 for text, 1,024 for a caption. */
  limit: number
  overLimit: boolean
  canSend: boolean
  /** Waiting for the bot («Conectando…»): nothing can be typed or attached. */
  disabled?: boolean
  disabledText?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  pick: [file: File]
  'clear-attachment': []
}>()

const uid = useId()
const input = useTemplateRef<HTMLInputElement>('file')
const accept = ref(ATTACH_ACCEPT)
const sheetOpen = ref(false)

const fmt = (n: number) => n.toLocaleString('en-US')
const length = computed(() => props.modelValue.length)
const placeholder = computed(() => {
  if (props.disabled) return props.disabledText ?? ''
  return props.attachment ? 'Pie de foto (opcional)' : 'Escribe un mensaje para el cliente…'
})
const labelText = computed(() => (props.attachment ? 'Pie de foto para el cliente' : 'Mensaje para el cliente'))
const attachmentIcon = computed(() => (props.attachment?.kind === 'DOCUMENT' ? 'i-lucide-file-text' : 'i-lucide-image'))

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  // Plain Enter never adds a line: it sends, or does nothing when there is nothing to send.
  event.preventDefault()
  if (props.canSend && !props.disabled) emit('send')
}

function smallScreen(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(max-width: 1023px)').matches
}

function openPicker(accepts: string): void {
  accept.value = accepts
  sheetOpen.value = false
  // The attribute is read when the dialog opens: let the DOM take the new `accept` first.
  void Promise.resolve().then(() => input.value?.click())
}

function onAttach(): void {
  if (props.disabled) return
  if (smallScreen()) sheetOpen.value = true
  else input.value?.click()
}

function onPicked(event: Event): void {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  if (file) emit('pick', file)
  el.value = ''
  accept.value = ATTACH_ACCEPT
}
</script>

<template>
  <form class="lc" aria-label="Escribir al cliente" data-testid="live-composer" novalidate @submit.prevent="emit('send')">
    <div
      v-if="attachment"
      class="lc-att"
      :class="`lc-att--${attachment.status}`"
      data-testid="composer-attachment"
    >
      <span class="lc-att__thumb" aria-hidden="true"><UIcon :name="attachmentIcon" /></span>
      <span class="lc-att__text">
        <b class="lc-att__name">{{ attachment.name }}</b>
        <template v-if="attachment.status === 'uploading'">
          <span
            class="lc-att__bar"
            role="progressbar"
            :aria-label="`Subiendo ${attachment.name}`"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="attachment.progress"
          ><i :style="{ width: `${attachment.progress}%` }" /></span>
          <small>Subiendo… {{ attachment.progress }} %</small>
        </template>
        <small v-else-if="attachment.status === 'error'" class="lc-att__error" data-testid="composer-attachment-error">
          <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ attachment.error }}
        </small>
        <small v-else class="lc-att__ok">
          <UIcon name="i-lucide-circle-check" aria-hidden="true" />Listo para enviar · {{ formatBytes(attachment.size) }}
        </small>
      </span>
      <button
        type="button"
        class="lc-iconbtn"
        :aria-label="`Quitar ${attachment.name}`"
        data-testid="composer-attachment-remove"
        @click="emit('clear-attachment')"
      >
        <UIcon name="i-lucide-x" aria-hidden="true" />
      </button>
    </div>

    <div class="lc-box" :class="{ 'lc-box--bad': overLimit, 'lc-box--off': disabled }">
      <label class="rc-sr" :for="uid">{{ labelText }}</label>
      <textarea
        :id="uid"
        class="lc-ta"
        rows="2"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="overLimit ? 'true' : undefined"
        :aria-describedby="`${uid}-help`"
        data-testid="composer-text"
        @input="onInput"
        @keydown="onKeydown"
      />
      <div class="lc-row">
        <button
          type="button"
          class="lc-iconbtn"
          aria-label="Adjuntar imagen o PDF"
          :disabled="disabled"
          data-testid="composer-attach"
          @click="onAttach"
        >
          <UIcon name="i-lucide-paperclip" aria-hidden="true" />
        </button>
        <span :id="`${uid}-help`" class="lc-hint">
          Enter envía · Shift+Enter agrega una línea · Se envía tal cual, sin formato
        </span>
        <span
          class="lc-counter"
          :class="{ 'lc-counter--near': length > limit - 300, 'lc-counter--over': overLimit }"
          aria-live="polite"
          data-testid="composer-counter"
        >{{ fmt(length) }} / {{ fmt(limit) }}</span>
        <UButton
          type="submit"
          color="primary"
          icon="i-lucide-send"
          label="Enviar"
          :disabled="!canSend || disabled"
          data-testid="composer-send"
        />
      </div>
    </div>

    <p v-if="overLimit" class="lc-error" role="alert" data-testid="composer-over">
      <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
      <span>Máximo {{ fmt(limit) }} caracteres. Quita {{ fmt(length - limit) }} para enviarlo.</span>
    </p>
    <p class="lc-help">Los mensajes no se pueden editar ni borrar después de enviarse.</p>

    <input ref="file" class="rc-sr" type="file" tabindex="-1" aria-hidden="true" :accept="accept" @change="onPicked" />

    <RequestCommandSheet
      v-model:open="sheetOpen"
      title="Adjuntar"
      short
      description="Imagen JPG, PNG o WebP, o un PDF. Hasta 10 MB."
    >
      <div class="lc-pick" data-testid="attach-sheet">
        <p class="lc-help">Imagen JPG, PNG o WebP, o un PDF. Hasta 10 MB.</p>
        <button
          type="button"
          class="lc-pick__row"
          data-testid="attach-pick-image"
          @click="openPicker('image/jpeg,image/png,image/webp')"
        >
          <UIcon name="i-lucide-image" aria-hidden="true" />
          <span><b>Foto o imagen</b><small>De la galería o la cámara</small></span>
        </button>
        <button type="button" class="lc-pick__row" data-testid="attach-pick-pdf" @click="openPicker('application/pdf')">
          <UIcon name="i-lucide-file-text" aria-hidden="true" />
          <span><b>Documento PDF</b><small>De tus archivos</small></span>
        </button>
        <p class="lc-help">Se envía una sola cosa por mensaje; el texto que escribas va como pie.</p>
      </div>
    </RequestCommandSheet>
  </form>
</template>
