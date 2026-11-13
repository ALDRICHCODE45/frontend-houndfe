import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue'
import { createDefaultAuthPort } from './auth-port'
import { createRealtimeService, type RealtimeService } from './realtime-service'
import type {
  RealtimeEnvelope,
  RealtimeEventMap,
  RealtimeHandler,
  RealtimeStatus,
  SessionEventPayload,
  SessionEventType,
} from './types'

let service: RealtimeService | null = null

/** The app-wide realtime service (created on first use, never connects while the flag is off). */
export function getRealtimeService(): RealtimeService {
  service ??= createRealtimeService({ auth: createDefaultAuthPort() })
  return service
}

/** Test seam: replace (or reset with `null`) the app-wide service. */
export function setRealtimeServiceForTests(next: RealtimeService | null) {
  service = next
}

export interface UseRealtime {
  /** Subscribe; the handler is removed automatically when the calling scope is disposed. */
  on<K extends keyof RealtimeEventMap>(type: K, handler: RealtimeHandler<RealtimeEventMap[K]>): () => void
  on(type: SessionEventType, handler: RealtimeHandler<SessionEventPayload>): () => void
  onAny(handler: (event: RealtimeEnvelope) => void): () => void
  /** Called on every status change (and removed with the scope). */
  onStatus(handler: (status: RealtimeStatus) => void): () => void
  /** Reactive status: `open` means events are flowing (so polling can slow down or pause). */
  status: Readonly<Ref<RealtimeStatus>>
  /** For the «Abierto en otra ventana» button (`status.reason === 'replaced'`). */
  reconnect(): void
}

export function useRealtime(): UseRealtime {
  const realtime = getRealtimeService()
  const status = ref<RealtimeStatus>(realtime.getStatus())
  const disposers: Array<() => void> = []

  function own(unsubscribe: () => void): () => void {
    let done = false
    const dispose = () => {
      if (done) return
      done = true
      unsubscribe()
    }
    if (getCurrentScope()) onScopeDispose(dispose)
    disposers.push(dispose)
    return dispose
  }

  own(
    realtime.onStatus((next) => {
      status.value = next
    }),
  )

  function on(type: string, handler: RealtimeHandler<never>): () => void {
    return own((realtime.on as (t: string, h: RealtimeHandler<never>) => () => void)(type, handler))
  }

  return {
    on: on as UseRealtime['on'],
    onAny: (handler) => own(realtime.onAny(handler)),
    onStatus: (handler) => own(realtime.onStatus(handler)),
    status: readonly(status) as Readonly<Ref<RealtimeStatus>>,
    reconnect: () => realtime.reconnect(),
  }
}
