/* Helpers and sample data. Shapes follow houndfe-backend docs/frontend-handoff/13-notifications.md (items: id, type, title, body, requestId, createdAt, readAt)
   with the titles the server builds in src/notifications/domain/chatbot-request-notice.ts (86f9b6b7). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setHTML = (el, s) => el.replaceChildren(document.createRange().createContextualFragment(s));
const ic = (n, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>', 'check-all': '<path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  'bell-off': '<path d="M8.7 3A6 6 0 0 1 18 8c0 2.7.6 4.7 1.2 6M17 17H3s3-2 3-9c0-.8.1-1.6.4-2.3M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.3A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  paw: '<circle cx="6" cy="10" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="10" r="2"/><path d="M8 17c0-2.8 1.8-5 4-5s4 2.2 4 5c0 2-1.5 3-4 3s-4-1-4-3Z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>', merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', play: '<path d="m6 4 14 8-14 8Z"/>', external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
};
function injectIcons() {
  // Static icon markup only (no user data), parsed as SVG.
  const src = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  document.body.prepend(document.importNode(doc.documentElement, true));
}

/* ---- time: the artboard's "now" is Wed 11 nov 2026, 11:05 in Guadalajara (-06:00); grouping runs in the runtime zone (gap: no tenant zone source) ---- */
const NOW = new Date('2026-11-11T11:05:00-06:00');
const at = m => new Date(NOW.getTime() + m * 60000).toISOString();
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const loc = d => new Date(new Date(d).getTime() - 6 * 3600000);
const hhmm = d => { const l = loc(d); return `${String(l.getUTCHours()).padStart(2, '0')}:${String(l.getUTCMinutes()).padStart(2, '0')}`; };
const dayKey = d => { const l = loc(d); return Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()); };
const dayDiff = d => Math.round((dayKey(d) - dayKey(NOW)) / 864e5);
function when(iso) { // short label for the row
  const n = dayDiff(iso), l = loc(iso), mins = Math.round((NOW - new Date(iso)) / 60000);
  if (n === 0) return mins < 1 ? 'ahora' : mins < 60 ? `hace ${mins} min` : hhmm(iso);
  return n === -1 ? `ayer ${hhmm(iso)}` : `${DOW[l.getUTCDay()]} ${l.getUTCDate()} ${MON[l.getUTCMonth()]}`;
}
function whenFull(iso) { const l = loc(iso); return `${DOW[l.getUTCDay()]} ${l.getUTCDate()} ${MON[l.getUTCMonth()]}, ${hhmm(iso)}`; }

/* ---- types the contract has (13-notifications §2 + 7c) → icon and tone; the client derives them from `type` ---- */
const TYPE = {
  REQUEST_CREATED: { icon: 'inbox', tone: 'info', label: 'Nueva' },
  REQUEST_REASSIGNED: { icon: 'swap', tone: 'info', label: 'Reasignada a ti' },
  REQUEST_CANCELLED: { icon: 'ban', tone: 'none', label: 'Cerrada' },
  REQUEST_CLAIM_REMINDER: { icon: 'clock', tone: 'warn', label: 'Sin tomar' },
  REQUEST_ESCALATION: { icon: 'alert', tone: 'warn', label: 'Por vencer' },
  REQUEST_OVERDUE: { icon: 'alert', tone: 'bad', label: 'Vencida' }
};
const RID = n => `2b7c1a90-6f3e-4d2a-8b1c-0d9e8f7a6b${String(n).padStart(2, '0')}`;
const NID = n => `6f1d3a2e-0b7c-4e55-9a31-2c7d8e9f0a${String(n).padStart(2, '0')}`;
const N = (n, type, title, body, req, min, read) => ({ id: NID(n), type, title, body, requestId: RID(req), createdAt: at(min), readAt: read ? at(min + 30) : null });
const SEED = () => [
  N(11, 'REQUEST_OVERDUE', 'Solicitud vencida', 'Zona de entrega · S-000118', 18, -7),
  N(10, 'REQUEST_ESCALATION', 'Solicitud por vencer', 'Comprobante de transferencia · S-000121', 21, -24),
  N(9, 'REQUEST_CREATED', 'Nueva solicitud', 'Pregunta sin respuesta · S-000123', 23, -62),
  N(8, 'REQUEST_REASSIGNED', 'Te reasignaron una solicitud', 'Reposición de producto · S-000119', 19, -85),
  N(7, 'REQUEST_ESCALATION', 'Solicitud por vencer', 'Caducidad · S-000115', 15, -125, true),
  N(6, 'REQUEST_CLAIM_REMINDER', 'Solicitud sin tomar', 'Conversación en vivo · S-000117', 17, -125, true),
  N(5, 'REQUEST_CANCELLED', 'El cliente canceló la solicitud', 'Reposición de producto · S-000112', 12, -1073, true),
  N(4, 'REQUEST_CANCELLED', 'Se resolvió junto con otras de su zona', 'Zona de entrega · S-000109', 9, -1175, true)
];
const OLDER = () => [
  N(3, 'REQUEST_CANCELLED', 'Otra persona canceló la solicitud', 'Comprobante de transferencia · S-000101', 1, -2821, true),
  N(2, 'REQUEST_CANCELLED', 'Otra persona la unió con otra solicitud del cliente', 'Pregunta sin respuesta · S-000104', 4, -2990, true),
  N(1, 'REQUEST_CREATED', 'Nueva solicitud', 'Caducidad · S-000098', 98, -4365, true)
];
const FRESH = () => N(12, 'REQUEST_CREATED', 'Nueva solicitud', 'Queja · S-000124', 24, 0);
const unreadN = items => items.filter(n => !n.readAt).length;
const countLabel = n => n > 99 ? '99+' : String(n);
const detailUrl = id => `/chatbot/solicitudes/${id}`;
