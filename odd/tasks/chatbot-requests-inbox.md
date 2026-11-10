# Chatbot requests inbox (in-system human intervention, FE)
Frontend of the cross-repo program «Intervención humana dentro del sistema». Design: houndfe-chatbot `docs/intervencion-humana-diseno.md` (7e298b4, §7 owner decisions win). Contract: houndfe-backend `docs/proposals/human-intervention-backend-proposal.md` v1.1 (18568eea, §12 answers, §12.14 cancel). FE proposal: `docs/redesign/human-intervention-frontend-proposal.md` (§6 alignment). Branch `feat/chatbot-requests-inbox`.

## Specs
- S1 Permissions. Register the backend codes exactly (houndfe-backend `docs/chatbot-requests-permissions.md`, commit 7cd73b1d): `read:ChatbotRequest`, `update:ChatbotRequest`, `update:ChatbotRequestAssignment`, `read:ChatbotConversation`, `read:ChatbotEscalation`, `read:CustomerPhone`, `read:ChatbotSettings`, `update:ChatbotSettings`, `update:ChatbotSettingsAllBranches`. No new actions; `manage` never on these subjects. Also register `ReceiptEvidence` (today silently dropped). Role screen shows them with es-MX labels.
- S2 Inbox «Chatbot → Solicitudes» grouped by customer (contract §3.8 `/chatbot-requests/groups`, `/counts`, `?customerKey=` for groups over 10), states Nueva / En atención (por X) / Resuelta / Vencida / Cancelada, SLA traffic light, paused SLA out of hours, assignee, folio, scheduled rows «Agendada · mar 10:30». Resolved 7 days, then «Historial».
- S3 Detail page `/chatbot/solicitudes/:id` (email deep link) with customer card (masked phone unless `read:CustomerPhone`), conversation (only with `read:ChatbotConversation`), context, needs, other open requests, audit, per-type action panel from `allowedActions`; claim / release / reassign / resolve DECISION subtypes (RESTOCK, EXPIRATION, DELIVERY_ZONE with impact count, RECEIPT confirm/reject with customerReason) / cancel with optional «Mensaje para el cliente» (≤500). Typed 409s.
- S4 Notifications: bell with unread count and list, browser notification and sound (on by default, server preference) when the tab is hidden; profile `/perfil` with email and sound preferences.
- S5 Realtime: SSE over fetch `GET /realtime/stream` with Last-Event-ID, heartbeat 15 s / dead at 45 s, leader tab shared by BroadcastChannel, `connection-replaced` → no auto reconnect, `auth-expired` → refresh and reconnect, `resync` → reload. Polling fallback until SSE exists.
- S6 Clarification reply, live conversation (chat, media, audio, template button when window closed, finish with complaint outcome), settings screen (hours per branch, apply to all, closed days, SLA per subtype, slots cap), retire Sistema zone queue.

## Tasks
- T1 | S1 | inline/worker | in progress — BE unit 1 merged on feat/human-intervention (7cd73b1d)
- T2 | S2, S3 (decisions) | blocked — waiting BE units 2–4 handoff
- T3 | S4 | blocked — waiting BE unit 6 (notifications)
- T4 | S5 | blocked — waiting BE unit 8 (SSE)
- T5 | S6 | blocked — waiting BE units 7, 9–14

## Log
- L1 User 2026-11-10: «Bien hermano, ya hice push, adelante con los siguientes pasos recomendados.» (after the plan: start the inbox once the backend hands off; contract v1.1 closed)
- L2 BE status 2026-11-10: feat/human-intervention has unit 1 (permissions, 7cd73b1d) and unit 2 model/state machine (3f144abe, ca8fc0f4); no HTTP endpoints or FE handoff yet. FE starts with S1, which only needs the fixed codes.
