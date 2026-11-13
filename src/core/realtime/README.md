# Realtime (SSE) client

Client for `GET /realtime/stream` (backend handoff 17, BE bf051a42). Built for
the chatbot requests inbox (spec S5, tasks T4a/T4b). Wired in `src/main.ts` only when the flag is on.

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
(403), `unauthorized` (no token, or a refresh that found the session gone),
`identity-mismatch` (the stored token is not the one of the session the stream was started for) or `error`.

## Lifecycle

`startRealtimeLifecycle(authStore)` (or `app.use(realtimePlugin)` after Pinia) starts
the stream while a user with a tenant is signed in, restarts it on a tenant/user
switch and stops it on logout. It only reads the store. On `access-revoked` it calls the
store's `fetchPermissions` (handoff 17 §7); the permission watch then stops the stream if
`read:ChatbotRequest` is gone, and it never reconnects by itself.

## Behaviour summary

- One leader tab per user + tenant (Web Locks, BroadcastChannel fallback) holds the
  connection and rebroadcasts events and status; followers resume from the last id
  they saw when the leader tab closes.
- Connect timeout: no response headers within 15 s aborts the attempt and retries with backoff.
- Heartbeat every 15 s; no bytes for 45 s = dead, reconnect with `Last-Event-ID`.
- Before every connect (and after every refresh) the stored access token's JWT `sub` / `tenantId`
  must equal the user / tenant the stream was started for (`token-identity.ts`, read-only decode);
  otherwise nothing is sent and the stream halts with `identity-mismatch`. The next user / tenant
  change in the auth store starts a new session; `reconnect()` checks again.
- Backoff 3 s → 30 s with jitter above a 3 s floor (a smaller `retry:` hint never shortens the
  first wait): the first retry is spread over 3–4.5 s, later ones over [base / 2, base], reset on any message (after
  `slow-consumer` only when the connection lived 60 s); `503` honours `Retry-After`;
  `server-unavailable` waits at least 5 s.
- `401` refreshes once and reconnects; a 401 for the refreshed token backs off (3 s → 30 s) and
  retries, it does not stop for good (a token rotated elsewhere earns one new refresh); `auth-expired` refreshes and reconnects at once, but a second
  `auth-expired` for the same token (REST still accepts it) backs off instead of looping.
- Floors from the server (`Retry-After`, `server-unavailable`) are spread upwards by up to 25 %.

## Wiring (T4b)

`main.ts` installs `realtimePlugin` and the two cache syncs only when `isRealtimeEnabled()`:
`features/chatbot/requests/realtime` (request.*, conversation, session.*, ready/resync) and
`features/notifications/realtime` (notification.*). The lifecycle only connects a user with a
tenant and `read:ChatbotRequest`. Polling slows to `REALTIME_OPEN_REFETCH_MS` (5 min; 60 s for the
live thread of a conversation reader) while the stream is `open` and returns to its normal pace when
it is not (`useRealtimeOpen`, `whileStreamOpen`).
- Auth: token from `authStorage`; refresh by sending one cheap GET through the shared
  `http` client so its single private refresh flight runs (see `auth-port.ts`).
