/**
 * One leader tab per name (the caller builds it from user + tenant).
 *
 * - Web Locks when available: the browser grants an exclusive lock to one tab,
 *   queues the others, and releases it when the leader tab closes or crashes,
 *   which hands the leadership to the next tab with no extra protocol.
 * - BroadcastChannel fallback: leader pings every 2 s, followers elect a new
 *   leader (lowest random id wins) when pings stop for 5 s or on a goodbye.
 * - Neither available: the tab leads on its own (one connection per tab).
 */

export interface LockManagerLike {
  request(
    name: string,
    options: { mode?: 'exclusive'; signal?: AbortSignal },
    callback: () => Promise<unknown>,
  ): Promise<unknown>
}

export interface ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(data: unknown): void
  close(): void
}

export interface LeaderElectionOptions {
  /** Identifies the group of competing tabs, for example `houndfe:realtime:<user>:<tenant>`. */
  name: string
  locks: LockManagerLike | null
  createChannel: ((name: string) => ChannelLike) | null
  onChange: (isLeader: boolean) => void
  makeId?: () => string
  pingMs?: number
  silenceMs?: number
  electionMs?: number
}

export interface LeaderElection {
  start(): void
  /** Steps down, withdraws from the queue and closes the channel. Safe to call twice. */
  stop(): void
  isLeader(): boolean
}

type ElectionMessage =
  | { t: 'claim'; id: string }
  | { t: 'ping'; id: string }
  | { t: 'bye'; id: string }

function defaultMakeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createLeaderElection(options: LeaderElectionOptions): LeaderElection {
  const pingMs = options.pingMs ?? 2_000
  const silenceMs = options.silenceMs ?? 5_000
  const electionMs = options.electionMs ?? 300
  const myId = (options.makeId ?? defaultMakeId)()

  let running = false
  let leader = false
  let abort: AbortController | null = null
  let releaseLock: (() => void) | null = null
  let channel: ChannelLike | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null
  let silenceTimer: ReturnType<typeof setTimeout> | null = null
  let electionTimer: ReturnType<typeof setTimeout> | null = null

  function setLeader(value: boolean) {
    if (leader === value) return
    leader = value
    options.onChange(value)
  }

  // ── Web Locks ────────────────────────────────────────────────────────────────
  function startWithLocks(locks: LockManagerLike) {
    abort = new AbortController()
    const mine = abort
    locks
      .request(options.name, { mode: 'exclusive', signal: mine.signal }, () => {
        if (!running || mine.signal.aborted) return Promise.resolve()
        return new Promise<void>((resolve) => {
          releaseLock = resolve
          setLeader(true)
        })
      })
      .catch(() => {
        /* aborted while waiting: nothing to do */
      })
      .finally(() => {
        if (abort === mine) setLeader(false)
      })
  }

  // ── BroadcastChannel fallback ────────────────────────────────────────────────
  function send(message: ElectionMessage) {
    try {
      channel?.postMessage(message)
    } catch {
      /* channel closed */
    }
  }

  function clearTimers() {
    if (pingTimer) clearInterval(pingTimer)
    if (silenceTimer) clearTimeout(silenceTimer)
    if (electionTimer) clearTimeout(electionTimer)
    pingTimer = silenceTimer = electionTimer = null
  }

  function watchLeader() {
    if (silenceTimer) clearTimeout(silenceTimer)
    if (electionTimer) clearTimeout(electionTimer)
    electionTimer = null
    silenceTimer = setTimeout(() => {
      silenceTimer = null
      elect()
    }, silenceMs)
  }

  function becomeFollower() {
    if (pingTimer) clearInterval(pingTimer)
    pingTimer = null
    setLeader(false)
    watchLeader()
  }

  function becomeLeader() {
    if (electionTimer) clearTimeout(electionTimer)
    if (silenceTimer) clearTimeout(silenceTimer)
    electionTimer = silenceTimer = null
    setLeader(true)
    send({ t: 'ping', id: myId })
    pingTimer = setInterval(() => send({ t: 'ping', id: myId }), pingMs)
  }

  function elect() {
    if (!running) return
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = null
    send({ t: 'claim', id: myId })
    if (electionTimer) clearTimeout(electionTimer)
    electionTimer = setTimeout(() => {
      electionTimer = null
      if (running) becomeLeader()
    }, electionMs)
  }

  function onMessage(event: { data: unknown }) {
    if (!running) return
    const message = event.data as ElectionMessage | null
    if (!message || typeof message !== 'object' || message.id === myId) return
    switch (message.t) {
      case 'claim':
        if (leader) send({ t: 'ping', id: myId })
        else if (electionTimer && message.id < myId) {
          // A lower id is also claiming: it wins.
          watchLeader()
        }
        break
      case 'ping':
        if (leader) {
          if (message.id < myId) becomeFollower() // two leaders: the lowest id keeps it
        } else {
          watchLeader()
        }
        break
      case 'bye':
        if (!leader) elect()
        break
    }
  }

  function startWithChannel(create: (name: string) => ChannelLike) {
    channel = create(options.name)
    channel.onmessage = onMessage
    elect()
  }

  return {
    start() {
      if (running) return
      running = true
      if (options.locks) startWithLocks(options.locks)
      else if (options.createChannel) startWithChannel(options.createChannel)
      else setLeader(true)
    },
    stop() {
      if (!running) return
      running = false
      const wasLeader = leader
      clearTimers()
      if (channel) {
        if (wasLeader) send({ t: 'bye', id: myId })
        channel.onmessage = null
        channel.close()
        channel = null
      }
      setLeader(false)
      releaseLock?.()
      releaseLock = null
      abort?.abort()
      abort = null
    },
    isLeader: () => leader,
  }
}
