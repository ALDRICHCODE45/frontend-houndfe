import { getCurrentInstance, onBeforeUnmount, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm, type ConfirmOptions } from './useConfirm'

/** Default «salir sin guardar» copy; a feature may say what is unsaved in its own description. */
export const LEAVE_COPY = {
  title: '¿Salir sin guardar?',
  description: 'Tienes cambios sin guardar. Si sales ahora, se pierden.',
  confirmLabel: 'Salir sin guardar',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
} as const satisfies ConfirmOptions

export type LeaveCopy = Partial<Omit<ConfirmOptions, 'tone'>>

/** Asks whether to drop unsaved changes; for in-page exits such as closing an editor. */
export function confirmLeave(copy?: LeaveCopy): Promise<boolean> {
  return useConfirm().confirm({ ...LEAVE_COPY, ...copy })
}

function holdUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

/**
 * While `isDirty`, a route change asks through the app dialog and closing the tab gets the
 * browser's own prompt (the only one a page may show there). Standalone mounts without a router
 * keep just the browser prompt.
 */
export function useLeaveGuard(isDirty: MaybeRefOrGetter<boolean>, copy?: LeaveCopy) {
  if (getCurrentInstance()?.appContext.config.globalProperties.$router) {
    onBeforeRouteLeave(() => !toValue(isDirty) || confirmLeave(copy))
  }
  watch(() => toValue(isDirty), dirty => {
    if (dirty) window.addEventListener('beforeunload', holdUnload)
    else window.removeEventListener('beforeunload', holdUnload)
  }, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', holdUnload))
}
