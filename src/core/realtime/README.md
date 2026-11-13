# Realtime (SSE) client

Client for `GET /realtime/stream` (backend handoff 17, BE bf051a42). Built for
the chatbot requests inbox (spec S5, task T4a). **Not wired into any query yet**
(T4b): nothing imports it outside this folder.

## Flag

| Variable | Default | Effect |
| --- | --- | --- |
| `VITE_REALTIME_SSE` | off | `true` or `1` enables the stream. Anything else, or unset: nothing connects (no fetch, no lock, no channel). |

Keep it off until the production Traefik/Swarm check of handoff 17 passes; polling
stays the source of truth meanwhile. (`env.d.ts` at the repo root types the other
`VITE_` variables; `VITE_REALTIME_SSE` is read untyped through `config.ts`.)

## Public API (`@/core/realtime`)

```ts
const rt = useRealtime()               // inside a component/composable; unsubscribes with the scope
rt.on('request.updated', (payload, { id }) => { /* RequestEventPayload */ })
rt.on('notification.created', ({ notification, unreadCount }) => {})
rt.on('resync', ({ reason }) => { /* refetch lists, counts, unread count, open detail */ })
rt.on('ready', () => { /* first connection without cursor: fetch the lists */ })
rt.onStatus((s) => {})                 // RealtimeStatus
rt.status.value                        // { state, role, reason? }
rt.reconnect()                         // «Abierto en otra ventana» button
```

Events: `ready`, `resync`, `request.created|claimed|released|reassigned|resolved|cancelled|overdue|updated`,
`notification.created|read`, `conversation.message`, `message.status`, and `session.*`
(payload open until BE unit 11). Heartbeats and unknown names never reach handlers.

Status `state`: `idle | connecting | open | reconnecting | stopped`. When `stopped`,
`reason` is `replaced` (connection-replaced, no auto reconnect), `revoked`
(access-revoked: refetch permissions, restart only if still allowed), `forbidden`
(403), `unauthorized` (401 after one refresh) or `error`.

## Lifecycle

`startRealtimeLifecycle(authStore)` (or `app.use(realtimePlugin)` after Pinia) starts
the stream while a user with a tenant is signed in, restarts it on a tenant/user
switch and stops it on logout. It only reads the store.

## Behaviour summary

- One leader tab per user + tenant (Web Locks, BroadcastChannel fallback) holds the
  connection and rebroadcasts events and status; followers resume from the last id
  they saw when the leader tab closes.
- Heartbeat every 15 s; no bytes for 45 s = dead, reconnect with `Last-Event-ID`.
- Backoff 3 s → 30 s with up to 25 % jitter, reset on any message (after
  `slow-consumer` only when the connection lived 60 s); `503` honours `Retry-After`;
  `server-unavailable` waits at least 5 s.
- `401` refreshes once and reconnects; `auth-expired` refreshes and reconnects at once.
- Auth: token from `authStorage`; refresh by sending one cheap GET through the shared
  `http` client so its single private refresh flight runs (see `auth-port.ts`).
