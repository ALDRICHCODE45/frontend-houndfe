import { computed, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { BrowserNotificationState } from '../interfaces/profile.types'

function readPermission(): BrowserNotificationState {
  if (typeof Notification === 'undefined' || Notification === null) return 'unsupported'
  return Notification.permission
}

/**
 * The browser-notification permission of THIS device (owner decision: no server field).
 *
 * `state` is the current `Notification.permission`, or `unsupported` when the browser has no
 * Notification API. `request()` asks the browser and adopts its answer; it must run from a user
 * gesture (the «Permitir avisos» button). The permission can change outside the page (the
 * lock icon of the address bar), so it is read again when the window regains focus.
 */
export function useBrowserNotificationPermission() {
  const state = ref<BrowserNotificationState>(readPermission())
  const supported = computed(() => state.value !== 'unsupported')

  function refresh(): void {
    state.value = readPermission()
  }

  async function request(): Promise<void> {
    if (!supported.value) return
    try {
      state.value = (await Notification.requestPermission()) as BrowserNotificationState
    } catch {
      refresh()
    }
  }

  useEventListener(window, 'focus', refresh)

  return { state, supported, request, refresh }
}
