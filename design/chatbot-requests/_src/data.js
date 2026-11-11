/* Shared helpers and sample data. Field names follow houndfe-backend docs/frontend-handoff/14 (rows, groups, detail). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setHTML = (el, s) => el.replaceChildren(document.createRange().createContextualFragment(s));
const ic = (n, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', 'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', up: '<path d="m18 15-6-6-6 6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>', cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>', users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.3A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', paw: '<circle cx="6" cy="10" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="10" r="2"/><path d="M8 17c0-2.8 1.8-5 4-5s4 2.2 4 5c0 2-1.5 3-4 3s-4-1-4-3Z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>', 'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>', bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 14h.01M15 14h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  merge: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/>', swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  undo: '<path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>',
  back: '<path d="m12 19-7-7 7-7M19 12H5"/>', receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6M16 12H8M13 16H8"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>', image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>', filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>', send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', warn: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>'
};
function injectIcons() {
  // Static icon markup only (no user data), parsed as SVG instead of assigned through innerHTML.
  const src = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  document.body.prepend(document.importNode(doc.documentElement, true));
}

/* ---- time: the artboard's "now" is Wed 11 nov 2026, 11:05 in Guadalajara (-06:00) ---- */
const NOW = new Date('2026-11-11T11:05:00-06:00');
const RESUME = new Date('2026-11-12T09:00:00-06:00');
const at = m => new Date(NOW.getTime() + m * 60000).toISOString();
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'], MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const loc = d => new Date(new Date(d).getTime() - 6 * 3600000); // wall clock in -06:00 via UTC getters
const hhmm = d => { const l = loc(d); return `${l.getUTCHours()}:${String(l.getUTCMinutes()).padStart(2, '0')}`; };
const dayDiff = d => Math.round((Date.UTC(...(x => [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()])(loc(d))) - Date.UTC(...(x => [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()])(loc(NOW)))) / 86400000);
const whenAt = d => { const n = dayDiff(d), l = loc(d); return n === 0 ? `hoy ${hhmm(d)}` : n === 1 ? `mañana ${hhmm(d)}` : n === -1 ? `ayer ${hhmm(d)}` : `${DOW[l.getUTCDay()]} ${l.getUTCDate()} ${MON[l.getUTCMonth()]} ${hhmm(d)}`; };
const shortDate = d => { const l = loc(d); return `${l.getUTCDate()} ${MON[l.getUTCMonth()]}, ${hhmm(d)}`; };
const dur = m => { m = Math.max(1, Math.round(Math.abs(m))); if (m < 60) return `${m} min`; if (m < 1440) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; } const dd = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return h ? `${dd} d ${h} h` : `${dd} d`; };
const ageOf = iso => dur((NOW - new Date(iso)) / 60000);
const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const money = c => mxn.format(c / 100);

/* ---- labels ---- */
const SUB = {
  RESTOCK: ['Reposición', 'package'], EXPIRATION: ['Caducidad', 'calendar'], DELIVERY_ZONE: ['Zona de entrega', 'pin'], TRANSFER_RECEIPT: ['Comprobante', 'receipt'],
  TALK_TO_HUMAN: ['Hablar con una persona', 'message'], COMPLAINT: ['Queja', 'alert'], UNKNOWN_QUESTION: ['Pregunta del bot', 'help'], DISCOUNT: ['Descuento', 'receipt']
};
const KIND = { DECISION: 'Decisión', CLARIFICATION: 'Aclaración', CONVERSATION: 'Conversación' };
const ME = { id: 'u-laura', displayName: 'Laura Méndez' };
const PEOPLE = [{ id: 'u-ana', displayName: 'Ana López' }, { id: 'u-luis', displayName: 'Luis Ortega' }, ME, { id: 'u-diego', displayName: 'Diego Salas' }];
const who = a => a ? (a.id === ME.id ? 'ti' : a.displayName) : null;

/* ---- permission mode (tool switch): Gerente has everything; Cajero has no phone, conversation, reassign or resolve ---- */
const PERM = { mode: 'mgr' };
const can = k => PERM.mode === 'mgr' || !['phone', 'convo', 'assign', 'resolve'].includes(k);

/* ---- rows ---- */
let seq = 0;
function R(o) {
  const st = o.status || 'NEW', W = o.W || (st === 'NEW' && o.claimIn != null ? 60 : 240);
  const dl = st === 'NEW' ? (o.claimIn ?? o.resolveIn) : o.resolveIn;
  const created = o.createdAt || (dl != null ? at(dl - (st === 'NEW' && o.claimIn == null ? 480 : W)) : at(-30));
  const over = o.overdue ? at(dl) : null;
  return {
    id: `rq-${o.n}`, folio: `S-${String(o.n).padStart(6, '0')}`, customerKey: o.key || 'k1.x', kind: o.kind || 'DECISION', subtype: o.subtype,
    status: st, displayStatus: over && st !== 'RESOLVED' ? 'EXPIRED' : st, summary: o.summary, assignee: o.assignee || null, createdAt: created,
    claimDeadlineAt: o.claimIn != null ? at(o.claimIn) : null, resolveDeadlineAt: o.resolveIn != null ? at(o.resolveIn) : (st === 'NEW' && o.claimIn == null && dl != null ? at(dl) : null), overdueAt: over,
    slaPaused: false, slaResumesAt: null, whatsappWindowClosesAt: o.win != null ? at(o.win) : null, unreadCustomerMessages: 0,
    scheduledFor: o.sched || null, requiresTemplateAtStart: !!o.tpl, needsReschedule: false, liveSession: null,
    closedAt: o.closedAgo != null ? at(-o.closedAgo) : null, resolvedBy: o.by || null, version: o.v || 2, _closed: o.closed || null
  };
}
const KEYS = { juan: 'k1.JuanP3r3z', patitas: 'k1.Pat1tas0', mariana: 'k1.Mar14na', roberto: 'k1.Rob3rto', hortensia: 'k1.H0rt3ns', anon: 'k1.Sin0142' };
const ANA = PEOPLE[0], LUIS = PEOPLE[1], DIEGO = PEOPLE[3];
const C = {
  juan: { id: 'c-juan', displayName: 'Juan Pérez', phone: '55 **** 5678', isTrusted: true },
  patitas: { id: 'c-pat', displayName: 'Clínica Veterinaria Patitas', phone: '55 **** 4410', isTrusted: true },
  mariana: { id: 'c-mar', displayName: 'Mariana Solís', phone: '55 **** 9031', isTrusted: false },
  roberto: { id: 'c-rob', displayName: 'Roberto Aguilar', phone: '55 **** 2276', isTrusted: false },
  hortensia: { id: 'c-hor', displayName: 'Hortensia Vega', phone: '33 **** 7714', isTrusted: false },
  anon: { id: null, displayName: null, phone: '55 **** 0142', isTrusted: false }
};
const PAT = [
  [101, 'RESTOCK', 'IN_PROGRESS', ANA, 'Croquetas Cachorro Raza Pequeña 3 kg · 12 piezas', null, -190, 1], [102, 'RESTOCK', 'NEW', null, 'Arena Sanitaria Aglomerante 10 kg · 8 piezas', -45, null, 1],
  [103, 'EXPIRATION', 'NEW', null, 'Antiparasitario en pipeta talla L · caducidad del lote', 12], [104, 'RESTOCK', 'NEW', null, 'Shampoo Antipulgas 500 ml · 6 piezas', 35],
  [105, 'RESTOCK', 'IN_PROGRESS', ME, 'Collar Isabelino talla M · 4 piezas', null, 160], [106, 'EXPIRATION', 'NEW', null, 'Vitaminas Caninas 60 tabletas · caducidad', 50],
  [107, 'RESTOCK', 'NEW', null, 'Correa Retráctil 5 m · 3 piezas', 48], [108, 'RESTOCK', 'IN_PROGRESS', LUIS, 'Comedero de Acero Inoxidable 1.5 L · 10 piezas', null, 40],
  [109, 'EXPIRATION', 'NEW', null, 'Snacks Dentales 12 pzas · caducidad', 55], [110, 'RESTOCK', 'NEW', null, 'Jaula Transportadora Mediana · 2 piezas', 58]
].map(([n, s, st, a, sum, ci, ri, ov]) => R({ n, subtype: s, status: st, assignee: a, summary: sum, claimIn: ci, resolveIn: ri, overdue: !!ov, key: KEYS.patitas, win: n === 104 ? 95 : null }));

const GROUPS = [
  { customerKey: KEYS.patitas, customer: C.patitas, openCount: 14, moreRequests: 4, requests: PAT },
  { customerKey: KEYS.juan, customer: C.juan, openCount: 3, moreRequests: 0, requests: [
    R({ n: 123, subtype: 'RESTOCK', status: 'IN_PROGRESS', assignee: ME, summary: 'Croquetas Premium Adulto 15 kg · 6 piezas. Sin existencias en Centro.', resolveIn: -125, overdue: true, key: KEYS.juan, v: 4 }),
    R({ n: 131, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', summary: '¿El alimento Sensible Piel lleva granos? Tiene un perro con alergias.', claimIn: 9, key: KEYS.juan, win: 100 }),
    R({ n: 134, subtype: 'TRANSFER_RECEIPT', summary: 'Comprobante de transferencia por $1,840.00 para la venta V-1042.', resolveIn: 300, key: KEYS.juan })] },
  { customerKey: KEYS.hortensia, customer: C.hortensia, openCount: 1, moreRequests: 0, requests: [
    R({ n: 136, kind: 'CONVERSATION', subtype: 'COMPLAINT', summary: 'El saco de arena llegó roto y quiere reposición.', claimIn: 4, key: KEYS.hortensia, win: 70 })] },
  { customerKey: KEYS.roberto, customer: C.roberto, openCount: 1, moreRequests: 0, requests: [
    R({ n: 127, subtype: 'DELIVERY_ZONE', status: 'IN_PROGRESS', assignee: ME, summary: 'Pregunta si entregan en la col. Lafayette, CP 44150.', resolveIn: 95, key: KEYS.roberto })] },
  { customerKey: KEYS.anon, customer: C.anon, openCount: 2, moreRequests: 0, requests: [
    R({ n: 138, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', summary: '¿Hacen factura con RFC de persona moral?', claimIn: 41, key: KEYS.anon }),
    R({ n: 141, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', summary: 'Y si pago con transferencia, ¿cuándo se factura?', claimIn: 44, key: KEYS.anon })] },
  { customerKey: KEYS.mariana, customer: C.mariana, openCount: 1, moreRequests: 0, requests: [
    R({ n: 140, kind: 'CONVERSATION', subtype: 'TALK_TO_HUMAN', summary: 'Pidió hablar con una persona fuera de horario; eligió el martes.', claimIn: null, key: KEYS.mariana, sched: '2026-11-17T10:30:00-06:00', tpl: true, W: 60 })] }
];
GROUPS[5].requests[0].createdAt = at(-1100);
const COUNTS = { new: 7, inProgress: 4, mine: 2, overdue: 3, windowClosingSoon: 3, scheduled: 1, needsReschedule: 0 };

const CLOSED = {
  resolved: [
    { customerKey: KEYS.roberto, customer: C.roberto, lastClosedAt: at(-26 * 60), openCount: 0, moreRequests: 0, requests: [R({ n: 119, subtype: 'DELIVERY_ZONE', status: 'RESOLVED', assignee: ME, by: ME, summary: 'Zona CP 45050 aprobada con envío gratis.', closedAgo: 26 * 60, key: KEYS.roberto, v: 5 })] },
    { customerKey: 'k1.Valle', customer: { id: 'c-val', displayName: 'Mascotas del Valle', phone: '33 **** 1180', isTrusted: true }, lastClosedAt: at(-3 * 1440), openCount: 0, moreRequests: 0, requests: [R({ n: 108, subtype: 'RESTOCK', status: 'RESOLVED', assignee: ANA, by: ANA, summary: 'Reposición estimada en 7 días: Alimento Gato Esterilizado 8 kg.', closedAgo: 3 * 1440, v: 4 })] },
    { customerKey: KEYS.mariana, customer: C.mariana, lastClosedAt: at(-5 * 1440), openCount: 1, moreRequests: 0, requests: [R({ n: 110, subtype: 'TRANSFER_RECEIPT', status: 'RESOLVED', assignee: DIEGO, by: DIEGO, summary: 'Comprobante confirmado por $640.00.', closedAgo: 5 * 1440, key: KEYS.mariana, v: 4 })] }],
  cancelled: [
    { customerKey: KEYS.anon, customer: C.anon, lastClosedAt: at(-20 * 60), openCount: 2, moreRequests: 0, requests: [R({ n: 121, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', status: 'CANCELLED', summary: '¿Tienen servicio a domicilio los domingos?', closedAgo: 20 * 60, v: 3 })] },
    { customerKey: KEYS.juan, customer: C.juan, lastClosedAt: at(-2 * 1440), openCount: 3, moreRequests: 0, requests: [R({ n: 99, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', status: 'CANCELLED', summary: 'Ya no necesito la respuesta, gracias.', closedAgo: 2 * 1440, key: KEYS.juan, v: 3 })] }]
};
const HISTORY = [
  R({ n: 92, subtype: 'RESTOCK', status: 'RESOLVED', by: ANA, summary: 'Reposición estimada en 5 días: Croquetas Senior 7 kg.', closedAgo: 9 * 1440 }),
  R({ n: 90, subtype: 'DELIVERY_ZONE', status: 'RESOLVED', by: ME, summary: 'Zona CP 45600 rechazada.', closedAgo: 11 * 1440 }),
  R({ n: 88, subtype: 'TRANSFER_RECEIPT', status: 'RESOLVED', by: DIEGO, summary: 'Comprobante rechazado: monto distinto.', closedAgo: 12 * 1440 }),
  R({ n: 85, kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', status: 'CANCELLED', summary: '¿Aceptan devoluciones de alimento abierto?', closedAgo: 15 * 1440 }),
  R({ n: 81, subtype: 'EXPIRATION', status: 'RESOLVED', by: ANA, summary: 'Caducidad indicada: marzo de 2027.', closedAgo: 21 * 1440 })
];
