import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

/**
 * A `Date` ref that ticks once a second only while `active` (the live chat has something that
 * depends on time: «Conectando…» elapsed, a message still `QUEUED`). Idle blocks keep no timer.
 * Turning active again refreshes the value at once.
 */
export function useLiveClock(active: MaybeRefOrGetter<boolean>, intervalMs = 1000): Ref<Date> {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  watch(
    () => toValue(active),
    (on) => {
      stop()
      if (!on) return
      now.value = new Date()
      timer = setInterval(() => {
        now.value = new Date()
      }, intervalMs)
    },
    { immediate: true },
  )

  onScopeDispose(stop)
  return now
}
