/**
 * Realtime service: the typed event bus the features subscribe to.
 *
 * One stream per browser. Tabs of the same user + tenant elect a leader
 * (`leader.ts`); only the leader runs the stream client and rebroadcasts what
 * it receives on a BroadcastChannel, so followers get the same events and the
 * same status. When the leader tab closes a follower takes over and resumes
 * from the last id every tab has seen.
 *
 * Nothing connects while the feature flag is off.
 */
import { getRealtimeBaseUrl, isRealtimeEnabled } from './config'
import {
  createLeaderElection,
  type ChannelLike,
  type LeaderElection,
  type LockManagerLike,
} from './leader'
import { createStreamClient, type StreamClient, type StreamStatus } from './stream-client'
import type {
  RealtimeAuthPort,
  RealtimeEnvelope,
  RealtimeEventMap,
  RealtimeHandler,
  RealtimeIdentity,
  RealtimeStatus,
  SessionEventPayload,
  SessionEventType,
} from './types'

export interface RealtimeServiceOptions {
  auth: RealtimeAuthPort
  /** Defaults to the `VITE_REALTIME_SSE` flag. */
  enabled?: () => boolean
  /** Defaults to the API client's base URL. */
  baseUrl?: string
  fetch?: typeof fetch
  /** `undefined` → `navigator.locks` when present; `null` → force the fallback. */
  locks?: LockManagerLike | null
  /** `undefined` → `BroadcastChannel` when present; `null` → none. */
  createChannel?: ((name: string) => ChannelLike) | null
  random?: () => number
}

export interface RealtimeService {
  /** Start for this user + tenant. No-op when the flag is off; restarts on a different identity. */
  start(identity: RealtimeIdentity): void
  /** Stop and forget the cursor. Safe to call when idle. */
  stop(): void
  /** After `connection-replaced` / `access-revoked`: try again (from any tab). */
  reconnect(): void
  on<K extends keyof RealtimeEventMap>(type: K, handler: RealtimeHandler<RealtimeEventMap[K]>): () => void
  on(type: SessionEventType, handler: RealtimeHandler<SessionEventPayload>): () => void
  /** Every delivered event (control events `ready` / `resync` included, heartbeats never). */
  onAny(handler: (event: RealtimeEnvelope) => void): () => void
  onStatus(handler: (status: RealtimeStatus) => void): () => void
  getStatus(): RealtimeStatus
}

const KNOWN_TYPES = new Set<string>([
  'ready',
  'resync',
  'request.created',
  'request.claimed',
  'request.released',
  'request.reassigned',
  'request.resolved',
  'request.cancelled',
  'request.overdue',
  'request.updated',
  'notification.created',
  'notification.read',
  'conversation.message',
  'message.status',
] satisfies Array<keyof RealtimeEventMap>)

function isDeliverable(type: string): boolean {
  return KNOWN_TYPES.has(type) || type.startsWith('session.')
}

type TabMessage =
  | { k: 'event'; envelope: RealtimeEnvelope }
  | { k: 'status'; status: StreamStatus }
  | { k: 'command'; command: 'reconnect' }
  | { k: 'hello' }

interface Session {
  identity: RealtimeIdentity
  election: LeaderElection | null
  channel: ChannelLike | null
  client: StreamClient | null
  /** Last id any tab has seen: a follower that becomes leader resumes from it. */
  cursor: string | null
}

const IDLE: RealtimeStatus = { state: 'idle', role: 'none' }

export function createRealtimeService(options: RealtimeServiceOptions): RealtimeService {
  const enabled = options.enabled ?? isRealtimeEnabled
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))

  function resolveLocks(): LockManagerLike | null {
    if (options.locks !== undefined) return options.locks
    return typeof navigator !== 'undefined' && navigator.locks
      ? // SAFETY: LockManager.request accepts the narrower signature LockManagerLike declares.
        (navigator.locks as unknown as LockManagerLike)
      : null
  }
  function resolveChannelFactory(): ((name: string) => ChannelLike) | null {
    if (options.createChannel !== undefined) return options.createChannel
    return typeof BroadcastChannel !== 'undefined'
      ? // SAFETY: BroadcastChannel provides onmessage/postMessage/close, which is all ChannelLike uses.
        (name) => new BroadcastChannel(name) as unknown as ChannelLike
      : null
  }

  const handlers = new Map<string, Set<RealtimeHandler<never>>>()
  const anyHandlers = new Set<(event: RealtimeEnvelope) => void>()
  const statusHandlers = new Set<(status: RealtimeStatus) => void>()

  let session: Session | null = null
  let status: RealtimeStatus = IDLE

  function setStatus(next: RealtimeStatus) {
    if (status.state === next.state && status.role === next.role && status.reason === next.reason) {
      return
    }
    status = next
    for (const handler of [...statusHandlers]) {
      try {
        handler({ ...status })
      } catch {
        /* a subscriber bug must not break the others */
      }
    }
  }

  function dispatch(envelope: RealtimeEnvelope) {
    const meta = { id: envelope.id }
    for (const handler of [...(handlers.get(envelope.type) ?? [])]) {
      try {
        ;(handler as RealtimeHandler<unknown>)(envelope.data, meta)
      } catch {
        /* isolate subscriber errors */
      }
    }
    for (const handler of [...anyHandlers]) {
      try {
        handler(envelope)
      } catch {
        /* isolate subscriber errors */
      }
    }
  }

  function post(current: Session, message: TabMessage) {
    try {
      current.channel?.postMessage(message)
    } catch {
      /* channel closed */
    }
  }

  function followerStatus(from: StreamStatus): RealtimeStatus {
    return { state: from.state, role: 'follower', ...(from.reason ? { reason: from.reason } : {}) }
  }

  function becomeLeader(current: Session) {
    const client = createStreamClient({
      baseUrl: options.baseUrl ?? getRealtimeBaseUrl(),
      fetch: fetchImpl,
      auth: options.auth,
      identity: current.identity,
      random: options.random,
      initialCursor: current.cursor,
      onEvent: (envelope) => {
        if (session !== current) return
        if (envelope.id !== null) current.cursor = envelope.id
        if (!isDeliverable(envelope.type)) return
        dispatch(envelope)
        post(current, { k: 'event', envelope })
      },
      onStatus: (streamStatus) => {
        if (session !== current) return
        setStatus({
          state: streamStatus.state,
          role: 'leader',
          ...(streamStatus.reason ? { reason: streamStatus.reason } : {}),
        })
        post(current, { k: 'status', status: streamStatus })
      },
    })
    current.client = client
    client.start()
  }

  function onLeaderChange(current: Session, isLeader: boolean) {
    if (session !== current) return
    if (isLeader) {
      becomeLeader(current)
      return
    }
    if (current.client) {
      current.cursor = current.client.getCursor() ?? current.cursor
      current.client.stop()
      current.client = null
    }
    setStatus({ state: 'connecting', role: 'follower' })
    post(current, { k: 'hello' })
  }

  function onTabMessage(current: Session, data: unknown) {
    if (session !== current || !data || typeof data !== 'object') return
    const message = data as TabMessage
    switch (message.k) {
      case 'event':
        if (current.client) return // a leader is fed by its own stream
        if (message.envelope.id !== null) current.cursor = message.envelope.id
        dispatch(message.envelope)
        break
      case 'status':
        if (!current.client) setStatus(followerStatus(message.status))
        break
      case 'command':
        if (current.client && message.command === 'reconnect') current.client.reconnect()
        break
      case 'hello':
        if (current.client) {
          const s = status
          post(current, {
            k: 'status',
            status: { state: s.state as StreamStatus['state'], ...(s.reason ? { reason: s.reason } : {}) },
          })
        }
        break
    }
  }

  function teardown() {
    const current = session
    session = null
    if (!current) return
    current.client?.stop()
    current.client = null
    current.election?.stop()
    if (current.channel) {
      current.channel.onmessage = null
      current.channel.close()
      current.channel = null
    }
  }

  function subscribe(type: string, handler: RealtimeHandler<never>): () => void {
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    set.add(handler)
    return () => {
      set.delete(handler)
    }
  }

  return {
    start(identity) {
      if (!enabled()) return
      if (
        session &&
        session.identity.userId === identity.userId &&
        session.identity.tenantId === identity.tenantId
      ) {
        return
      }
      teardown()
      const key = `${identity.userId}:${identity.tenantId}`
      const createChannel = resolveChannelFactory()
      const current: Session = {
        identity: { ...identity },
        election: null,
        channel: null,
        client: null,
        cursor: null,
      }
      session = current
      current.channel = createChannel ? createChannel(`houndfe:realtime:events:${key}`) : null
      if (current.channel) current.channel.onmessage = (event) => onTabMessage(current, event.data)
      current.election = createLeaderElection({
        name: `houndfe:realtime:leader:${key}`,
        locks: resolveLocks(),
        createChannel,
        onChange: (isLeader) => onLeaderChange(current, isLeader),
      })
      setStatus({ state: 'connecting', role: 'follower' })
      current.election.start()
      // Ask a live leader (if any) for its status so a late follower is not stuck on «connecting».
      post(current, { k: 'hello' })
    },

    stop() {
      teardown()
      setStatus(IDLE)
    },

    reconnect() {
      const current = session
      if (!current) return
      if (current.client) current.client.reconnect()
      else post(current, { k: 'command', command: 'reconnect' })
    },

    on(type: string, handler: RealtimeHandler<never>) {
      return subscribe(type, handler)
    },

    onAny(handler) {
      anyHandlers.add(handler)
      return () => {
        anyHandlers.delete(handler)
      }
    },

    onStatus(handler) {
      statusHandlers.add(handler)
      return () => {
        statusHandlers.delete(handler)
      }
    },

    getStatus: () => ({ ...status }),
  } as RealtimeService
}
