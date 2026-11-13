/* Shared helpers, icons, sample data and the live-session model.
   Field names and rules follow houndfe-backend docs/frontend-handoff/20-live-conversation.md (sessions, messages, template, finish)
   and 18-conversation.md (thread, media). The artboard's "now" is Friday 13 Nov 2026, 16:06 in Guadalajara. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setHTML = (el, s) => el.replaceChildren(document.createRange().createContextualFragment(s));
const ic = (n, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const ICONS = {
  x: '<path d="M18 6 6 18M6 6l12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', check2: '<path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  down: '<path d="m6 9 6 6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>', up: '<path d="m18 15-6-6-6 6"/>', back: '<path d="m12 19-7-7 7-7M19 12H5"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.7a1 1 0 0 0-.2-.6l-3.5-4.3A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  paw: '<circle cx="6" cy="10" r="2"/><circle cx="10" cy="5.5" r="2"/><circle cx="14" cy="5.5" r="2"/><circle cx="18" cy="10" r="2"/><path d="M12 11c-3 0-5 3-5 5.5 0 1.7 1.3 2.5 3 2.5 1 0 1.3-.5 2-.5s1 .5 2 .5c1.7 0 3-.8 3-2.5C17 14 15 11 12 11Z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>', bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 14h.01M15 14h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>', swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1Z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h4"/>',
  paperclip: '<path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', play: '<path d="M7 4v16l13-8Z"/>', dots: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6M16 12H8M13 16H8"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>', 'wifi-off': '<path d="M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5-2.7M2 8.8a15 15 0 0 1 4.2-2.7M19 12.9a10 10 0 0 0-1.8-.9M22 8.8a15 15 0 0 0-6.4-3.5M2 2l20 20"/>',
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>', phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  'arrow-down': '<path d="M12 5v14M19 12l-7 7-7-7"/>'
};
function injectIcons() {
  // Static icon markup only (no user data), parsed as SVG instead of assigned through innerHTML.
  const src = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute" aria-hidden="true">${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('')}</svg>`;
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  document.body.prepend(document.importNode(doc.documentElement, true));
}

/* ---- time helpers (minutes of the day; day 0 = hoy, -1 = ayer) ---- */
const pad = n => String(n).padStart(2, '0');
const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const dur = m => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
const DAYLBL = { 0: 'Hoy · viernes 13 nov', '-1': 'Ayer · jueves 12 nov' };

/* ---- people and settings ---- */
const ME = 'Laura Méndez', OTHER = 'Diego Ramírez', CUST = 'Mariana Ortega', CF = 'Mariana';
const PHONE = '55 **** 4417';
const TPL = { name: 'seguimiento_pedido', cost: 'Cada plantilla se cobra a la tarifa de WhatsApp Business (aprox. $0.62 MXN), aunque el cliente no la lea.' };
const SUBT = { COMPLAINT: 'Queja', TALK_TO_HUMAN: 'Hablar con una persona' };
const OUTCOMES = [
  ['RETURN', 'Devolución', 'El cliente regresa el producto.'],
  ['REPLACEMENT', 'Reemplazo', 'Se le entrega un producto nuevo.'],
  ['REFUND', 'Reembolso', 'Se le regresa el dinero.'],
  ['NO_ACTION', 'Sin acción', 'No hubo nada que corregir o el cliente no lo pidió.']
];

/* ---- state: one object per rendered chat (the interactive boards use S, the static boards build their own) ---- */
const mk = (o = {}) => ({
  session: 'ACTIVE', win: 'open', cust: 'active', role: 'me', sub: 'COMPLAINT', thread: 'normal', next: 'ok', tpl: 'ready',
  draft: '', attach: null, menu: false, dlg: null, fin: { note: '', outcome: '', err: null, busy: false, ok: false }, sent: [], extra: [], deferred: false, winOpened: false,
  conn: 'ok', outcome: null, note: '', ...o
});
const mine = s => s.role === 'me' || s.role === 'me-scoped';
const assignee = s => mine(s) ? ME : OTHER;
const idle = s => s.winOpened ? false : (s.win !== 'open' || s.cust === 'idle');
const nowM = s => idle(s) && s.win === 'open' ? 1001 : 966;
const winEff = s => s.winOpened ? 'open' : s.deferred ? 'closed' : s.win;

const cIn = (id, at, text, x = {}) => ({ id, dir: 'IN', author: 'CUSTOMER', type: 'TEXT', text, at, day: 0, ...x });
const bot = (id, at, text, x = {}) => ({ id, dir: 'OUT', author: 'BOT', type: 'TEXT', text, at, day: 0, status: 'READ', ...x });
const st = (id, at, text, status, x = {}) => ({ id, dir: 'OUT', author: 'STAFF', type: 'TEXT', text, at, day: 0, status, ...x });
const mark = (id, at, text, x = {}) => ({ id, kind: 'mark', at, day: 0, text, ...x });
const PHOTO = { name: 'bolsa-rota.jpg', size: '1.8 MB' };
const PRE_TODAY = () => [
  cIn('c1', 941, 'Hola, buenas tardes. Me llegó mi pedido y una de las bolsas de croquetas venía rota, ya se había salido casi la mitad.'),
  cIn('c2', 942, 'Así llegó', { type: 'IMAGE', media: PHOTO }),
  bot('b1', 942, 'Lamento lo que pasó, Mariana. Voy a pedir que una persona del equipo te atienda por aquí mismo.')
];
const PRE_YDAY = (t) => [
  cIn('c1', t, 'Hola, buenas tardes. Me llegó mi pedido y una de las bolsas de croquetas venía rota, ya se había salido casi la mitad.', { day: -1 }),
  cIn('c2', t + 1, 'Así llegó', { type: 'IMAGE', media: PHOTO, day: -1 }),
  bot('b1', t + 1, 'Lamento lo que pasó, Mariana. Voy a pedir que una persona del equipo te atienda por aquí mismo.', { day: -1 })
];
const CLAIM = (at = 958) => mark('m1', at, `${'{who}'} tomó la conversación. El bot ya no responde.`, { claim: true });

/* a thread is { pre: before the claim, live: from the claim on } */
function threadParts(s) {
  const id = idle(s);
  if (s.thread === 'states') {
    return { pre: PRE_TODAY(), live: [CLAIM(),
      st('s1', 959, 'Hola Mariana, soy Laura de HoundFe Centro. Siento mucho lo de tu pedido V-1042.', 'READ'),
      st('s2', 960, 'Ya revisé tu foto. ¿La otra bolsa llegó sellada?', 'DELIVERED'),
      st('s3', 961, 'Así se ve la bolsa de reposición.', 'SENT', { type: 'IMAGE', media: { name: 'reposicion-croquetas.jpg', size: '1.4 MB' } }),
      st('s4', 963, '¿Te la llevamos hoy antes de las 6 p. m.?', 'QUEUED', { age: 4 }),
      st('s5', 964, 'Te confirmo en un momento.', 'QUEUED', { age: 48 }),
      st('s6', 964, 'Te escribo en cuanto pueda.', 'DEFERRED'),
      st('s7', 965, 'Tu folio de queja es S-000412.', 'FAILED'),
      st('s8', 965, 'Gracias por tu paciencia, Mariana.', 'UNKNOWN')] };
  }
  if (s.win === 'closed') return { pre: PRE_YDAY(826).concat([cIn('c3', 828, 'Sigo esperando, ¿alguien me puede ayudar?', { day: -1 })]), live: [CLAIM(963)] };
  if (s.win === 'soon') return { pre: PRE_YDAY(1041).concat([cIn('c3', 1050, '¿Alguien me puede atender? Quiero resolver esto hoy.', { day: -1 })]), live: [CLAIM(),
    st('s1', 959, 'Hola Mariana, soy Laura de HoundFe Centro. Ya tengo tu foto y tu pedido V-1042.', 'DELIVERED'),
    st('s2', 962, 'Cuando puedas, ¿me confirmas si la otra bolsa llegó sellada?', 'SENT')] };
  const live = [CLAIM(),
    st('s1', 959, 'Hola Mariana, soy Laura de HoundFe Centro. Siento mucho lo de tu pedido V-1042.', 'READ'),
    cIn('c3', 960, '', { type: 'AUDIO', dur: '0:14' }),
    st('s2', 962, 'Escuché tu audio, gracias. ¿La otra bolsa de Croquetas Premium Adulto 15 kg sí llegó sellada?', 'READ'),
    cIn('c4', 963, 'Sí, esa viene bien. Solo la otra tiene un corte en la orilla.'),
    st('s3', 964, 'Aquí está nuestra política de cambios.', 'READ', { type: 'DOCUMENT', media: { name: 'politica-de-cambios.pdf', size: '218 KB' } }),
    st('s4', 964, 'Te puedo mandar una bolsa nueva hoy mismo. ¿Te late?', id ? 'DELIVERED' : 'READ')];
  if (!id) live.push(cIn('c5', 965, 'Sí, por favor. La necesito para el fin de semana.'));
  return { pre: PRE_TODAY(), live };
}
function tplItems(s) {
  if (winEff(s) !== 'closed' && !(s.winOpened && s.win === 'closed' && s.tpl !== 'ready')) return [];
  const m = x => ({ id: 'tpl1', dir: 'OUT', author: 'STAFF', type: 'TEMPLATE', text: '', templateName: TPL.name, at: 965, day: 0, ...x });
  if (s.tpl === 'pending') return [m({ status: 'DELIVERED' })];
  if (s.tpl === 'failed') return [m({ status: 'FAILED' })];
  if (s.tpl === 'unknown') return [m({ status: 'UNKNOWN' })];
  return [];
}
function items(s, full) {
  const p = threadParts(s);
  let out;
  if (s.session === 'STARTING') out = p.pre.concat([mark('m1', 958, 'Tomaste la conversación. Esperando a que el bot confirme que se calló…', { claim: true, plain: true })]);
  else if (s.session === 'WAITING') out = p.pre;
  else {
    const live = p.live.concat(tplItems(s), s.sent, s.extra);
    if (s.session === 'ENDING') live.push(mark('m2', nowM(s), `${assignee(s)} finalizó la conversación. El bot se despide de ${CF}.`, { plain: true }));
    if (s.session === 'ENDED') live.push(mark('m2', nowM(s), `${assignee(s)} finalizó la conversación.`, { plain: true }), mark('m3', nowM(s) + 1, `El bot retomó la conversación con ${CF}.`, { plain: true }));
    out = (s.role === 'me-scoped' && !full ? [] : p.pre).concat(live);
  }
  return out;
}
const lastCustAbs = s => {
  const p = threadParts(s);
  const c = p.pre.concat(p.live, s.extra).filter(m => m.dir === 'IN');
  const l = c[c.length - 1];
  return l ? l.at + 1440 * l.day : 0;
};
const closesIn = s => lastCustAbs(s) + 1440 - nowM(s);
const silentMin = s => nowM(s) - lastCustAbs(s);
const winLabel = s => {
  const w = winEff(s);
  if (w === 'closed') return { tone: 'bad', icon: 'lock', t: 'Ventana de 24 h cerrada' };
  const c = closesIn(s);
  return { tone: c <= 120 ? 'warn' : 'ok', icon: 'clock', t: `Ventana de 24 h: cierra en ${dur(c)}` };
};
const DL = {
  QUEUED: ['clock', 'En cola', ''], SENT: ['check', 'Enviado', ''], DELIVERED: ['check2', 'Entregado', ''], READ: ['check2', 'Leído', 'read'],
  PENDING: ['alert', 'Pendiente de envío', 'warn'], DEFERRED: ['alert', 'No enviado, ventana cerrada', 'warn'], FAILED: ['alert', 'No enviado', 'bad'], UNKNOWN: ['help', 'Entrega dudosa', 'warn']
};
const dlKey = m => m.status === 'QUEUED' && (m.age || 0) >= 30 ? 'PENDING' : m.status;
