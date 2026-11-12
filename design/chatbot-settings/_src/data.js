/* Contract-shaped sample data: houndfe-backend docs/frontend-handoff/16-chatbot-settings.md at 8c12ae09 (GET/PUT /chatbot-settings, POST /chatbot-settings/apply-to-all-tenants).
   The artboard's "now" is Thu 12 nov 2026, 11:05 in Ciudad de México (UTC-6, no DST). */
Object.assign(ICONS, {
  plus: '<path d="M5 12h14M12 5v14"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  store: '<path d="m3 9 1.5-5h15L21 9M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"/>',
  timer: '<path d="M10 2h4M12 14V9"/><circle cx="12" cy="14" r="8"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>', building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>', eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  dollar: '<path d="M12 2v20M17 6.5C16 5 14.3 4.5 12 4.5c-2.8 0-4.5 1.2-4.5 3s1.6 2.6 4.5 3 4.5 1.2 4.5 3.2-1.8 3.3-4.5 3.3c-2.5 0-4.2-.7-5.2-2.3"/>'
});
const clone = o => JSON.parse(JSON.stringify(o));
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_L = { MONDAY: ['Lunes', 'lun'], TUESDAY: ['Martes', 'mar'], WEDNESDAY: ['Miércoles', 'mié'], THURSDAY: ['Jueves', 'jue'], FRIDAY: ['Viernes', 'vie'], SATURDAY: ['Sábado', 'sáb'], SUNDAY: ['Domingo', 'dom'] };
const SUBS = {
  RESTOCK: ['Reposición', 'package', 'Un cliente pide que vuelva un producto.'], EXPIRATION: ['Caducidad', 'calendar', 'Se consulta una fecha de caducidad.'],
  DELIVERY_ZONE: ['Zona de entrega', 'pin', 'Se valida una dirección fuera de las zonas.'], TRANSFER_RECEIPT: ['Comprobante', 'receipt', 'Comprobante de transferencia por confirmar.'],
  TALK_TO_HUMAN: ['Hablar con una persona', 'message', 'El cliente pide atención en vivo.'], COMPLAINT: ['Queja', 'alert', 'Una queja que requiere seguimiento.'],
  UNKNOWN_QUESTION: ['Pregunta del bot', 'help', 'Una pregunta que el bot no supo contestar.'], DISCOUNT: ['Descuento', 'receipt', 'El cliente pide un descuento.']
};
const SUB_ORDER = Object.keys(SUBS);
const TZ = { 'America/Mexico_City': 'Ciudad de México (GMT−6)', 'America/Monterrey': 'Monterrey (GMT−6)', 'America/Tijuana': 'Tijuana (GMT−8)', 'America/Hermosillo': 'Hermosillo (GMT−7)', 'America/Cancun': 'Cancún (GMT−5)' };
const wk = (r, over = {}) => ({ timeZone: 'America/Mexico_City', days: DAYS.map(d => ({ day: d, ranges: (over[d] || r[d] || []).map(([open, close]) => ({ open, close })) })) });
const FULL = [['09:00', '19:00']];
const sla = (s, c, r) => ({ subtype: s, claimMinutes: c, resolveMinutes: r });
const SERVER = {
  version: 3,
  openingHours: wk({ MONDAY: FULL, TUESDAY: FULL, WEDNESDAY: [['09:00', '14:00'], ['16:00', '19:00']], THURSDAY: FULL, FRIDAY: FULL, SATURDAY: [['09:00', '14:00']] }),
  closedDates: ['2026-09-16', '2026-11-16', '2026-12-25', '2027-01-01'],
  slas: [sla('RESTOCK', 60, 240), sla('EXPIRATION', 60, 240), sla('DELIVERY_ZONE', 60, 240), sla('TRANSFER_RECEIPT', null, null), sla('TALK_TO_HUMAN', 10, null), sla('COMPLAINT', 30, 240), sla('UNKNOWN_QUESTION', 30, 120), sla('DISCOUNT', 30, 120)],
  windowWarningMinutes: 120, templateName: null, templateCostText: 'Enviar la plantilla tiene un costo para el negocio.',
  enabledSubtypes: SUB_ORDER.slice(), receiptCloseMarginMinutes: 60,
  scheduling: { enabled: false, slotMinutes: 30, slotsOffered: 3, maxScheduledPerSlot: 3 },
  branchOpeningHours: wk({ MONDAY: [['10:00', '18:00']], TUESDAY: [['10:00', '18:00']], WEDNESDAY: [['10:00', '18:00']], THURSDAY: [['10:00', '18:00']], FRIDAY: [['10:00', '18:00']], SATURDAY: [['10:00', '14:00']] })
};
/* what a sucursal with no row gets (version 0) */
const DEFAULTS = Object.assign(clone(SERVER), {
  version: 0, closedDates: [], openingHours: wk({ MONDAY: FULL, TUESDAY: FULL, WEDNESDAY: FULL, THURSDAY: FULL, FRIDAY: FULL, SATURDAY: FULL })
});
DEFAULTS.slas = [sla('RESTOCK', 60, 240), sla('EXPIRATION', 60, 240), sla('DELIVERY_ZONE', 60, 240), sla('TRANSFER_RECEIPT', null, null), sla('TALK_TO_HUMAN', 10, null), sla('COMPLAINT', 30, 240), sla('UNKNOWN_QUESTION', 30, 120), sla('DISCOUNT', 30, 120)];
/* response of POST /apply-to-all-tenants (dryRun true / false); only branches with a membership are ever listed */
const APPLY = {
  dry: { dryRun: true, source: { tenantId: 't-centro', version: 3 },
    tenantsApplied: [{ tenantId: 't-norte', name: 'Sucursal Norte' }, { tenantId: 't-poniente', name: 'Sucursal Poniente' }],
    tenantsUnchanged: [{ tenantId: 't-centro', name: 'Sucursal Centro', self: true }, { tenantId: 't-aeropuerto', name: 'Sucursal Aeropuerto' }],
    tenantsSkipped: [{ tenantId: 't-sur', name: 'Sucursal Sur', reason: 'NO_PERMISSION' }, { tenantId: 't-bodega', name: 'Sucursal Bodega', reason: 'TENANT_INACTIVE' }], tenantsFailed: [] },
  real: { ok: { dryRun: false, source: { tenantId: 't-centro', version: 3 },
      tenantsApplied: [{ tenantId: 't-norte', name: 'Sucursal Norte', recompute: 'DONE' }, { tenantId: 't-poniente', name: 'Sucursal Poniente', recompute: 'DONE' }],
      tenantsUnchanged: [{ name: 'Sucursal Centro', self: true }, { name: 'Sucursal Aeropuerto' }], tenantsSkipped: [{ name: 'Sucursal Sur', reason: 'NO_PERMISSION' }, { name: 'Sucursal Bodega', reason: 'TENANT_INACTIVE' }], tenantsFailed: [] },
    partial: { dryRun: false, source: { tenantId: 't-centro', version: 3 },
      tenantsApplied: [{ tenantId: 't-norte', name: 'Sucursal Norte', recompute: 'FAILED' }],
      tenantsUnchanged: [{ name: 'Sucursal Centro', self: true }, { name: 'Sucursal Aeropuerto' }], tenantsSkipped: [{ name: 'Sucursal Sur', reason: 'NO_PERMISSION' }, { name: 'Sucursal Bodega', reason: 'TENANT_INACTIVE' }],
      tenantsFailed: [{ tenantId: 't-poniente', name: 'Sucursal Poniente' }] } },
  none: { dryRun: true, source: { tenantId: 't-centro', version: 3 }, tenantsApplied: [], tenantsUnchanged: [{ name: 'Sucursal Centro', self: true }, { name: 'Sucursal Norte' }, { name: 'Sucursal Poniente' }, { name: 'Sucursal Aeropuerto' }], tenantsSkipped: [], tenantsFailed: [] }
};
/* what someone else saved first (409 VERSION_CONFLICT body.current) */
const theirs = () => { const c = clone(SERVER); c.version = 4; c.slas.find(s => s.subtype === 'COMPLAINT').claimMinutes = 20; c.closedDates.push('2027-01-06'); c.closedDates.sort(); return c; };

/* ---- formatting ---- */
const TODAY = '2026-11-12', MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const U = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const dowOf = s => new Date(U(s)).getUTCDay(); // 0 = domingo
const WDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const dlabel = s => { const [y, m, d] = s.split('-').map(Number); return `${WDAYS[dowOf(s)]} ${d} ${MON[m - 1]} ${y}`; };
const dshort = s => { const [, m, d] = s.split('-').map(Number); return `${WDAYS[dowOf(s)]} ${d} ${MON[m - 1]}`; };
const rel = s => { const n = Math.round((U(s) - U(TODAY)) / 864e5); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 0 ? `en ${n} días` : n === -1 ? 'ayer' : `hace ${-n} días`; };
const hm = t => { const m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; };
const fmtMin = m => m == null ? 'Sin plazo' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`;
const fmtClock = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
const dayTotal = ranges => ranges.reduce((a, r) => (hm(r.open) != null && hm(r.close) != null && hm(r.close) > hm(r.open) ? a + hm(r.close) - hm(r.open) : a), 0);
const weekTotal = oh => oh.days.reduce((a, d) => a + dayTotal(d.ranges), 0);
const rangesText = r => r.length ? r.map(x => `${x.open}–${x.close}`).join(' y ') : 'Cerrado';
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const dayOf = (cfg, d) => cfg.openingHours.days.find(x => x.day === d);

/* business time: the same idea the server applies (stops outside hours and on closed dates). Local, illustrative: the server's answer is the one that counts. */
function dueAt(cfg, arrival, minutes) { // arrival 'YYYY-MM-DDTHH:mm' local to the sucursal
  let [date, t] = arrival.split('T'); let cur = hm(t), left = minutes;
  for (let i = 0; i < 400; i++) {
    if (!cfg.closedDates.includes(date)) {
      const d = dayOf(cfg, DAYS[(dowOf(date) + 6) % 7]);
      for (const r of [...d.ranges].sort((a, b) => hm(a.open) - hm(b.open))) {
        const o = hm(r.open), c = hm(r.close); if (o == null || c == null || c <= o) continue;
        const from = Math.max(o, cur); if (from >= c) continue;
        if (left <= c - from) return { date, min: from + left };
        left -= c - from;
      }
    }
    date = new Date(U(date) + 864e5).toISOString().slice(0, 10); cur = 0;
  }
  return null;
}
const fmtDue = d => d ? `${dshort(d.date)}, ${fmtClock(d.min)}` : 'Sin horario abierto';

/* ---- validation: mirrors the server rules (the server answers 400 without saying which day or field) ---- */
function validate(c) {
  const e = {};
  let any = false;
  for (const d of c.openingHours.days) {
    const rs = d.ranges; if (rs.length) any = true;
    const bad = rs.findIndex(r => hm(r.open) == null || hm(r.close) == null);
    if (bad >= 0) { e['h:' + d.day] = 'Completa la hora de apertura y de cierre.'; continue; }
    const inv = rs.find(r => hm(r.close) <= hm(r.open));
    if (inv) { e['h:' + d.day] = `El cierre (${inv.close}) debe ser después de la apertura (${inv.open}).`; continue; }
    const s = [...rs].sort((a, b) => hm(a.open) - hm(b.open));
    for (let i = 1; i < s.length; i++) if (hm(s[i].open) <= hm(s[i - 1].close)) { e['h:' + d.day] = `${s[i - 1].open}–${s[i - 1].close} y ${s[i].open}–${s[i].close} se empalman o se tocan. Únelos en un solo horario.`; break; }
  }
  if (!any) e['h:week'] = 'Deja al menos un día con horario abierto.';
  for (const s of c.slas) {
    if (s.subtype === 'TRANSFER_RECEIPT') continue;
    const chk = (v, k) => { if (v != null && (!Number.isInteger(v) || v < 1 || v > 10080)) e[`s:${s.subtype}:${k}`] = 'Usa un número entre 1 min y 168 h.'; };
    chk(s.claimMinutes, 'claim'); chk(s.resolveMinutes, 'resolve');
    if (s.claimMinutes != null && s.resolveMinutes != null && s.resolveMinutes < s.claimMinutes && !e[`s:${s.subtype}:resolve`]) e[`s:${s.subtype}:resolve`] = `Resolver no puede ser antes que atender (${fmtMin(s.claimMinutes)}).`;
  }
  const rng = (v, lo, hi, k, msg) => { if (!Number.isInteger(v) || v < lo || v > hi) e[k] = msg; };
  rng(c.windowWarningMinutes, 0, 1440, 'x:window', 'Usa un valor entre 0 min y 24 h.');
  rng(c.receiptCloseMarginMinutes, 0, 1440, 'x:margin', 'Usa un valor entre 0 min y 24 h.');
  if (c.templateName != null && !/^[a-z0-9_]{1,512}$/.test(c.templateName)) e['x:template'] = 'Solo minúsculas, números y guion bajo (_).';
  rng(c.scheduling.slotMinutes, 5, 240, 'c:slot', 'Entre 5 y 240 minutos.');
  rng(c.scheduling.slotsOffered, 1, 10, 'c:offered', 'Entre 1 y 10 horarios.');
  rng(c.scheduling.maxScheduledPerSlot, 1, 50, 'c:max', 'Entre 1 y 50 conversaciones.');
  return e;
}
const SECTION_OF = k => k === 'x:margin' ? 'sla' : k[0] === 'h' ? 'hours' : k[0] === 's' ? 'sla' : k[0] === 'x' ? 'extras' : k[0] === 'c' ? 'sched' : 'dates';
const SEC_NAME = { hours: 'Horario de atención', dates: 'Fechas cerradas', sla: 'Plazos por tipo', extras: 'Ventana y plantilla', sched: 'Conversaciones agendadas' };
