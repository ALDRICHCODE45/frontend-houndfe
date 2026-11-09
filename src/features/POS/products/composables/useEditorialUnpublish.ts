import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { editorialErrorMessage, type useEditorialEditor } from './useEditorialEditor'

export interface EditorialUnpublishOptions {
  productId: MaybeRefOrGetter<string>
  /** Asks before unpublishing: the product may leave the online catalog. */
  confirm: () => Promise<boolean>
  notify: (title: string) => void
}

const MESSAGES = {
  ambiguous: 'No pudimos confirmar si se despublicó. Reintenta: si ya se despublicó, no pasa nada.',
  keep: 'No pudimos guardar el contenido como borrador, así que no se despublicó. Inténtalo de nuevo.',
  request: 'No pudimos despublicar. Recarga la página e inténtalo de nuevo.',
  forbidden: 'No tienes permiso para despublicar este contenido.',
  conflict: 'Alguien más cambió el contenido. Cargamos la versión más reciente; revísala y vuelve a despublicar.',
  vocabulary: 'El catálogo de datos cambió mientras despublicabas. Recarga la página e inténtalo de nuevo.',
} as const

/**
 * «Despublicar» (handoff 07 §6). The Published version goes away; the draft and the cycle stay. Without a
 * draft the content is kept first: `initialize` copies Published into a draft, then the unpublish runs (L2),
 * so a user who cannot write and has no draft is not offered it. One Idempotency-Key per attempt, reused only
 * to retransmit an ambiguous one; a 409 CONFLICT or VOCABULARY_CHANGED reloads and retries once with a new key.
 */
export function useEditorialUnpublish(editor: ReturnType<typeof useEditorialEditor>, options: EditorialUnpublishOptions) {
  const { lifecycle } = editor
  const forbidden = shallowRef(false)
  const busy = shallowRef(false)
  const message = shallowRef<string | null>(null)

  const visible = computed(() => {
    const state = lifecycle.authoritative.value
    return lifecycle.canPublish.value && !forbidden.value && Boolean(state?.published) && (Boolean(state?.draft) || lifecycle.canWrite.value)
  })
  const canUnpublish = computed(() => visible.value && !busy.value &&
    (lifecycle.authoritative.value?.draft ? editor.canUnpublish.value : editor.canInitialize.value))
  const retryable = computed(() => lifecycle.pendingIntent.value?.kind === 'unpublish' && lifecycle.outcome.value === 'ambiguous' && !busy.value)
  const refreshChoice = () => (editor.hasUnsavedChanges.value ? 'retain' : 'discard') as 'retain' | 'discard'
  watch(() => toValue(options.productId), () => { forbidden.value = false; message.value = null })

  async function done(title: string) {
    options.notify(title)
    // An acknowledged unpublish installs nothing: read the state once, keeping unsaved edits.
    await editor.refresh(refreshChoice(), { quiet: true })
    return true
  }
  /** Copies Published into a draft, so nothing is lost; any refusal leaves Published in place. */
  async function keepContent(): Promise<boolean> {
    if (!(await editor.initialize())) lifecycle.dismissRejection()
    // Also after a refusal: someone else may have started the draft meanwhile.
    await editor.refresh('discard', { quiet: true })
    if (lifecycle.authoritative.value?.draft && editor.canUnpublish.value) return true
    message.value = MESSAGES.keep
    return false
  }
  async function refused(mayRetry: boolean): Promise<boolean> {
    const error = lifecycle.error.value
    if (lifecycle.outcome.value === 'ambiguous' || !error) { message.value = MESSAGES.ambiguous; return false }
    lifecycle.dismissRejection()
    if (error.status === 403) {
      forbidden.value = true; message.value = MESSAGES.forbidden
    } else if (error.code === 'VOCABULARY_CHANGED') {
      await editor.refresh(refreshChoice(), { quiet: true })
      if (mayRetry && editor.canUnpublish.value) return attempt(false)
      message.value = MESSAGES.vocabulary
    } else if (error.code === 'CONFLICT') {
      await editor.refresh(refreshChoice(), { quiet: true })
      if (!lifecycle.authoritative.value?.published) return done('Ya estaba despublicado.')
      if (mayRetry && editor.canUnpublish.value) return attempt(false)
      message.value = MESSAGES.conflict
    } else {
      message.value = error.status === 400 ? MESSAGES.request : editorialErrorMessage(error.status)
    }
    return false
  }
  async function attempt(mayRetry: boolean): Promise<boolean> {
    return (await editor.unpublish()) ? done('Despublicado.') : refused(mayRetry)
  }
  async function unpublish(): Promise<boolean> {
    if (!canUnpublish.value || !(await options.confirm())) return false
    // The answer may come after the state changed.
    if (!canUnpublish.value) return false
    busy.value = true; message.value = null
    try {
      if (!lifecycle.authoritative.value?.draft && !(await keepContent())) return false
      return await attempt(true)
    } finally { busy.value = false }
  }
  /** Retransmits the ambiguous attempt: the same key, body and headers, without asking again. */
  async function retry(): Promise<boolean> {
    if (!retryable.value) return false
    busy.value = true; message.value = null
    try {
      return (await editor.retransmit()) ? await done('Despublicado.') : await refused(false)
    } finally { busy.value = false }
  }
  const reload = () => editor.refresh(refreshChoice())

  return { visible, canUnpublish, retryable, busy, message, unpublish, retry, reload }
}
