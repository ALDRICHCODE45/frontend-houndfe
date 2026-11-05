import { shallowRef } from 'vue'

export interface ConfirmOptions {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` paints the confirm button as destructive (losing work, deleting). */
  tone?: 'danger' | 'default'
}

interface PendingConfirm { options: ConfirmOptions; resolve: (answer: boolean) => void }

// One question at a time for the whole app; ConfirmDialogHost (mounted once in App.vue) renders it.
const pending = shallowRef<PendingConfirm | null>(null)

function settle(answer: boolean) {
  const current = pending.value
  if (!current) return
  pending.value = null
  current.resolve(answer)
}

/**
 * Promise-based confirmation through the app's ConfirmModal, instead of `window.confirm`
 * (design-system.md, Confirmación y salir sin guardar). Resolves `true` on confirm and `false` on
 * cancel, Escape or close. Asking again while a question is open answers the first one `false`.
 */
export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    settle(false)
    return new Promise(resolve => { pending.value = { options, resolve } })
  }
  return { confirm, pending, settle, cancelAll: () => settle(false) }
}
