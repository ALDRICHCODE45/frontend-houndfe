/* parts1: state and section builders (hours, closed dates, SLA, extras, scheduling). Each returns an HTML string; S is the artboard state. */
const newState = () => ({
  role: 'manager', mode: 'normal', cfg: clone(SERVER), draft: clone(SERVER), errors: {}, shown: false, saving: false, savedAt: null,
  units: {}, raw: {}, copyFrom: null, copyTo: [], dateIn: '', dateErr: '', outcome: 'ok', applyOut: 'ok', dialog: null, conflict: null, notice: null, toast: null, tab: 'hours', day: 'THURSDAY', sim: '2026-11-13T18:30'
});
let S = newState();
const can = () => ({ edit: S.role === 'manager' || S.role === 'admin', all: S.role === 'admin' });
const creating = () => S.cfg.version === 0;
const sub = i => SUBS[i];
const short = s => s.length > 200 ? s.slice(0, 197) + '…' : s;

/* ---- change tracking, shared by the save bar and the 409 comparison ---- */
function diffItems(a, b) {
  const out = [];
  DAYS.forEach(d => { if (JSON.stringify(dayOf(a, d).ranges) !== JSON.stringify(dayOf(b, d).ranges)) out.push({ sec: 'hours', key: 'h:' + d, label: DAY_L[d][0] }); });
  if (a.openingHours.timeZone !== b.openingHours.timeZone) out.push({ sec: 'hours', key: 'tz', label: 'Zona horaria' });
  if (JSON.stringify(a.closedDates) !== JSON.stringify(b.closedDates)) out.push({ sec: 'dates', key: 'dates', label: 'Fechas cerradas' });
  SUB_ORDER.forEach(s => { const x = a.slas.find(q => q.subtype === s), y = b.slas.find(q => q.subtype === s); if (x.claimMinutes !== y.claimMinutes || x.resolveMinutes !== y.resolveMinutes) out.push({ sec: 'sla', key: 's:' + s, label: 'Plazo de ' + SUBS[s][0].toLowerCase() }); });
  [['receiptCloseMarginMinutes', 'Margen de comprobantes', 'sla'], ['windowWarningMinutes', 'Aviso de ventana', 'extras'], ['templateName', 'Nombre de plantilla', 'extras'], ['templateCostText', 'Texto de costo', 'extras']].forEach(([k, l, sec]) => { if (a[k] !== b[k]) out.push({ sec, key: 'x:' + k, label: l }); });
  if (JSON.stringify(a.scheduling) !== JSON.stringify(b.scheduling)) out.push({ sec: 'sched', key: 'sched', label: 'Conversaciones agendadas' });
  return out;
}
const dirtyItems = () => diffItems(S.cfg, S.draft);
const errCount = sec => Object.keys(S.errors).filter(k => !sec || SECTION_OF(k) === sec).length;

/* ---- small pieces ---- */
const swBtn = (on, label, attrs, texts = ['Abierto', 'Cerrado']) => `<button type="button" class="swb" role="switch" aria-checked="${on}" aria-label="${esc(label)}" ${attrs}><span class="track" aria-hidden="true">${ic('check')}</span><span class="sl" aria-hidden="true">${on ? texts[0] : texts[1]}</span></button>`;
const pending = () => `<span class="badge dot pend" title="Se guarda, pero todavía no cambia lo que hace el chatbot">${ic('clock', 'xs')}Aún sin efecto</span>`;
const gap = t => `<span class="mock-flag" title="${esc(t)}">${ic('info', 'xs')}No está en el contrato</span>`;
const errLine = (id, m) => m ? `<span class="err" id="${id}-e" role="alert">${ic('alert', 'sm')}<span>${esc(m)}</span></span>` : '';
const secBadges = sec => {
  const n = S.shown ? errCount(sec) : 0, d = dirtyItems().filter(i => i.sec === sec).length;
  return (n ? `<span class="badge danger">${ic('alert', 'xs')}${plural(n, 'campo por corregir', 'campos por corregir')}</span>` : '') + (d ? `<span class="badge info dot">Modificado</span>` : '');
};
const secCard = (id, title, desc, body, o = {}) => `<section class="panel sec" id="sec-${id}" aria-labelledby="h-${id}"><div class="ph sec-h"><div class="phl"><h2 id="h-${id}">${title}</h2>${desc ? `<p class="p2">${desc}</p>` : ''}</div><div class="phr">${o.tag || ''}${secBadges(id)}${o.actions || ''}</div></div>${body}</section>`;

/* number with optional unit (min / h); the stored value is always minutes */
function numField(path, id, label, v, o = {}) {
  const ed = can().edit, err = S.errors[path];
  if (!ed) return `<span class="rov fig">${o.unit === false ? (v ?? '—') : fmtMin(v)}</span>`;
  if (o.unit === false) return `<input class="ctl fig" inputmode="numeric" id="${id}" data-f="${path}" value="${esc(S.raw[path] ?? v ?? '')}" aria-label="${esc(label)}" ${err ? 'aria-invalid="true"' : ''} aria-describedby="${id}-e">`;
  const unit = S.units[path] ?? (v != null && v >= 60 && v % 60 === 0 ? 'h' : 'min');
  const text = S.raw[path] ?? (v == null ? '' : unit === 'h' ? v / 60 : v);
  return `<div class="numg"><input class="ctl fig" inputmode="numeric" id="${id}" data-f="${path}" value="${esc(text)}" placeholder="${o.ph || 'Sin plazo'}" aria-label="${esc(label)}" ${err ? 'aria-invalid="true"' : ''} aria-describedby="${id}-e ${id}-r"><select class="ctl u" data-u="${path}" aria-label="Unidad de ${esc(label)}"><option value="min" ${unit === 'min' ? 'selected' : ''}>min</option><option value="h" ${unit === 'h' ? 'selected' : ''}>h</option></select></div>`;
}

/* ---- weekly attention hours ---- */
function dayRow(d) {
  const ed = can().edit, [long, sh] = DAY_L[d.day], open = d.ranges.length > 0, err = S.errors['h:' + d.day], lower = long.toLowerCase();
  const sw = ed ? swBtn(open, `${long}: ${open ? 'abierto' : 'cerrado'}`, `data-act="toggleDay" data-day="${d.day}"`) : `<span class="badge dot ${open ? 'success' : ''}">${open ? 'Abierto' : 'Cerrado'}</span>`;
  let rg;
  if (!open) rg = `<span class="muted">Sin atención este día</span>`;
  else if (!ed) rg = `<span class="fig">${d.ranges.map(r => `${r.open} – ${r.close}`).join('<span class="muted"> · </span>')}</span>`;
  else rg = d.ranges.map((r, i) => `<div class="rng"><input type="time" class="ctl t" max="23:59" id="t-${d.day}-${i}-open" data-f="h:${d.day}:${i}:open" value="${r.open}" aria-label="${long}, horario ${i + 1}: abre" ${err ? 'aria-invalid="true"' : ''}><span class="muted" aria-hidden="true">a</span><input type="time" class="ctl t" max="23:59" id="t-${d.day}-${i}-close" data-f="h:${d.day}:${i}:close" value="${r.close}" aria-label="${long}, horario ${i + 1}: cierra" ${err ? 'aria-invalid="true"' : ''}><button type="button" class="kebab sm" data-act="delRange" data-day="${d.day}" data-i="${i}" aria-label="Quitar horario ${i + 1} del ${lower}">${ic('x', 'sm')}</button></div>`).join('')
    + (d.ranges.length < 6 ? `<button type="button" class="link-btn" data-act="addRange" data-day="${d.day}" aria-label="Agregar horario al ${lower}">${ic('plus', 'xs')}Agregar horario</button>` : '');
  const tot = open ? dayTotal(d.ranges) : 0;
  const cp = ed && open ? `<button type="button" class="btn ghost sm" data-act="copyOpen" data-day="${d.day}" aria-haspopup="dialog" aria-expanded="${S.copyFrom === d.day}" id="cp-${d.day}" aria-label="Copiar el horario del ${lower} a otros días">${ic('copy', 'sm')}<span class="cplbl">Copiar a…</span></button>` : '';
  return `<li class="dr ${open ? '' : 'closed'} ${err ? 'bad' : ''}" id="dr-${d.day}"><div class="dn"><b>${long}</b></div><div class="dsw">${sw}</div><div class="rg">${rg}</div><div class="tot fig">${open && tot ? fmtMin(tot) : ''}</div><div class="ac">${cp}${S.copyFrom === d.day ? copyPop(d.day) : ''}</div>${err ? `<div class="derr">${errLine('t-' + d.day, err)}</div>` : ''}</li>`;
}
function copyPop(from) {
  const long = DAY_L[from][0], others = DAYS.filter(d => d !== from);
  return `<div class="pop2" role="dialog" aria-label="Copiar el horario del ${long.toLowerCase()}" id="copyPop"><h3>Copiar el horario del ${long.toLowerCase()} a…</h3><p class="p2">${esc(rangesText(dayOf(S.draft, from).ranges))}. Reemplaza el horario de los días que elijas.</p><div class="chips" role="group" aria-label="Días de destino">${others.map(d => `<button type="button" class="chip" data-act="copyToggle" data-day="${d}" aria-pressed="${S.copyTo.includes(d)}">${DAY_L[d][1]}</button>`).join('')}</div><div class="quick"><button type="button" class="link-btn" data-act="copyPick" data-set="wk">Lun–vie</button><button type="button" class="link-btn" data-act="copyPick" data-set="all">Todos</button><button type="button" class="link-btn" data-act="copyPick" data-set="none">Ninguno</button></div><div class="pop2f"><button type="button" class="btn sm" data-act="copyClose">Cancelar</button><button type="button" class="btn sm primary" data-act="copyApply" ${S.copyTo.length ? '' : 'disabled'}>Copiar a ${plural(S.copyTo.length, 'día', 'días')}</button></div></div>`;
}
function tzField() {
  const ed = can().edit, z = S.draft.openingHours.timeZone;
  if (!ed) return `<div class="field"><span class="lbl">Zona horaria</span><span class="rov">${TZ[z] || z}</span></div>`;
  return `<div class="field tzf"><label class="lbl" for="tz">Zona horaria ${gap('El contrato recibe la zona IANA; la lista de opciones es de ejemplo')}</label><select class="ctl" id="tz" data-f="tz">${Object.entries(TZ).map(([k, v]) => `<option value="${k}" ${k === z ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
}
const pickupNote = () => `<div class="alert info" role="note">${ic('info', 'sm')}<div><strong>Este horario es solo para el chatbot</strong>Mide los plazos y pausa los tiempos fuera de horario. No cambia el horario de recolección en tienda, que se edita en <a href="#" data-act="noop">Sistema › Envíos › Horario</a>.</div></div>`;
function pickupCopy() {
  const has = !!S.draft.branchOpeningHours;
  return `<div class="pickrow"><button type="button" class="btn sm" data-act="copyPickup" ${has ? '' : 'disabled aria-describedby="pickWhy"'}>${ic('store', 'sm')}Copiar horario de recolección</button><span class="help" id="pickWhy">${has ? 'Trae el horario de Envíos como punto de partida. Después los dos horarios son independientes; se guarda con «Guardar».' : 'Esta sucursal no tiene horario de recolección en Envíos, así que no hay nada que copiar.'}</span></div>`;
}
function hoursBody(o = {}) {
  const ed = can().edit, e = S.errors['h:week'];
  const wtotal = weekTotal(S.draft.openingHours);
  return `${o.noNote ? '' : pickupNote()}<div class="hrow-top">${tzField()}${ed ? pickupCopy() : ''}</div>${e ? `<div class="alert danger" role="alert">${ic('alert', 'sm')}<div><strong>${esc(e)}</strong>El chatbot necesita al menos un horario para calcular plazos.</div></div>` : ''}<ul class="days" aria-label="Horario de atención por día">${S.draft.openingHours.days.map(dayRow).join('')}</ul><p class="p2 foot-note">${ic('clock', 'xs')}${wtotal ? `${fmtMin(wtotal)} de atención por semana.` : 'Sin horas de atención esta semana.'} Fuera de este horario los plazos se pausan y las solicitudes muestran «se reanuda…».</p>`;
}

/* ---- closed dates (contract: array of YYYY-MM-DD, sorted, unique, up to 400; no reason field) ---- */
function datesBody() {
  const ed = can().edit, list = S.draft.closedDates, past = list.filter(d => d < TODAY);
  const add = ed ? `<div class="dadd"><div class="field"><label class="lbl" for="dateIn">Nueva fecha cerrada</label><input type="date" class="ctl" id="dateIn" value="${esc(S.dateIn)}" ${S.dateErr ? 'aria-invalid="true"' : ''} aria-describedby="dateIn-e dateIn-h"></div><button type="button" class="btn" data-act="dateAdd">${ic('plus', 'sm')}Agregar fecha</button></div>${errLine('dateIn', S.dateErr)}<span class="help" id="dateIn-h">Día completo sin atención, en la zona horaria del horario. El contrato guarda solo la fecha, sin motivo ${gap('No hay campo de motivo en el contrato')}</span>` : '';
  const rows = list.length ? `<ul class="dates" aria-label="Fechas cerradas">${list.map(d => `<li class="date ${d < TODAY ? 'past' : ''}"><span class="dd"><b>${dlabel(d)}</b><small>${d < TODAY ? 'Pasada · ' : ''}${rel(d)}</small></span>${d < TODAY ? '<span class="badge">Pasada</span>' : ''}${ed ? `<button type="button" class="kebab" data-act="dateDel" data-d="${d}" aria-label="Quitar ${dlabel(d)}">${ic('x', 'sm')}</button>` : ''}</li>`).join('')}</ul><div class="dfoot"><span class="p2 fig">${plural(list.length, 'fecha', 'fechas')} · máximo 400</span>${ed && past.length ? `<button type="button" class="link-btn" data-act="datePast">Quitar ${plural(past.length, 'pasada', 'pasadas')}</button>` : ''}</div>`
    : `<div class="empty"><svg class="icon" aria-hidden="true"><use href="#i-calendar"/></svg><h2>Sin fechas cerradas</h2><p>Agrega los días en que no habrá atención (feriados, inventario). En esas fechas los plazos se pausan todo el día.</p></div>`;
  return add + rows;
}

/* ---- SLA per subtype, business minutes in human units ---- */
function slaRow(s) {
  const ed = can().edit, [name, icon, hint] = SUBS[s.subtype], id = 's-' + s.subtype, ec = S.errors[`s:${s.subtype}:claim`], er = S.errors[`s:${s.subtype}:resolve`];
  const lbl = `<div class="sn"><span class="sico">${ic(icon, 'sm')}</span><span><b>${name}</b><small>${hint}</small></span></div>`;
  if (s.subtype === 'TRANSFER_RECEIPT') {
    const m = S.draft.receiptCloseMarginMinutes, em = S.errors['x:margin'];
    return `<div class="slr fixed" role="row">${lbl}<div class="sc fx"><span class="fxv">No tiene plazo para atender</span></div><div class="sc fx"><span class="fxv">Al cierre del día en que llega</span><small>Si llega con menos de ${ed ? '' : fmtMin(m)} de margen antes del cierre, vence al cierre del siguiente día hábil.</small>${ed ? `<div class="marg"><label class="lbl" for="margin">Margen antes del cierre</label>${numField('x:margin', 'margin', 'Margen antes del cierre', m)}<span class="help" id="margin-r">${fmtMin(m)} de atención</span>${errLine('margin', em)}</div>` : ''}</div></div>`;
  }
  const cell = (k, v, e, ro) => `<div class="sc">${ro ? `<span class="fxv">${ro}</span>` : `${numField(`s:${s.subtype}:${k}`, `${id}-${k}`, `${k === 'claim' ? 'Atender' : 'Resolver'} ${name.toLowerCase()}`, v)}<small class="rd" id="${id}-${k}-r">${v == null ? 'Sin límite de tiempo' : fmtMin(v) + ' de atención'}</small>${errLine(`${id}-${k}`, e)}`}</div>`;
  const cl = ed ? cell('claim', s.claimMinutes, ec) : `<div class="sc"><span class="fxv fig">${fmtMin(s.claimMinutes)}</span></div>`;
  const rs = s.subtype === 'TALK_TO_HUMAN' ? `<div class="sc fx"><span class="fxv">En vivo</span><small>Sin plazo para resolver: se atiende en la conversación.</small></div>` : ed ? cell('resolve', s.resolveMinutes, er) : `<div class="sc"><span class="fxv fig">${fmtMin(s.resolveMinutes)}</span></div>`;
  return `<div class="slr" role="row">${lbl}${cl}${rs}</div>`;
}
function slaBody(o = {}) {
  return `<div class="sla-note p2">${ic('timer', 'sm')}<span><b>Atender</b> es el tiempo para que alguien tome la solicitud; <b>resolver</b>, para cerrarla. Se cuentan desde que llega y <b>solo dentro del horario de atención</b> (minutos hábiles).</span></div><div class="slat" role="table" aria-label="Plazos por tipo de solicitud"><div class="sh" role="row"><span role="columnheader">Tipo</span><span role="columnheader">Atender en</span><span role="columnheader">Resolver en</span></div>${S.draft.slas.map(slaRow).join('')}</div><ul class="notes2 p2"><li>Al liberar una solicitud, el plazo para atender vuelve a empezar; el de resolver no se reinicia.</li><li>Al guardar se recalculan las solicitudes abiertas. Las cerradas no cambian.</li></ul>`;
}

/* ---- window warning + template (stored only today) ---- */
function extrasBody() {
  const ed = can().edit, d = S.draft, et = S.errors['x:template'], ew = S.errors['x:window'];
  const tname = ed ? `<input class="ctl mono" id="tpl" data-f="x:templateName" value="${esc(d.templateName ?? '')}" placeholder="p. ej. aviso_seguimiento" ${et ? 'aria-invalid="true"' : ''} aria-describedby="tpl-h tpl-e" autocomplete="off" spellcheck="false">` : `<span class="rov mono">${d.templateName ? esc(d.templateName) : 'Sin configurar'}</span>`;
  const cost = ed ? `<textarea class="ctl" id="tplc" data-f="x:templateCostText" maxlength="200" rows="2" aria-describedby="tplc-h">${esc(d.templateCostText)}</textarea><span class="counter fig">${d.templateCostText.length} / 200</span>` : `<span class="rov">${esc(d.templateCostText)}</span>`;
  return `<div class="fgrid"><div class="field"><label class="lbl" for="win">Avisar antes de que se cierre la ventana de WhatsApp ${pending()}</label>${numField('x:window', 'win', 'Avisar antes de que se cierre la ventana de WhatsApp', d.windowWarningMinutes, { ph: '0' })}<span class="help" id="win-r">La ventana de 24 h permite escribir sin plantilla. Hoy el filtro «Ventana por cerrar» de la bandeja usa 2 h fijas.</span>${errLine('win', ew)}</div>
<div class="field"><label class="lbl" for="tpl">Plantilla de WhatsApp ${pending()}</label>${tname}<span class="help" id="tpl-h">Minúsculas, números y _. Sin nombre, «Enviar plantilla» no estará disponible (422 TEMPLATE_NOT_CONFIGURED).</span>${errLine('tpl', et)}</div>
<div class="field wide"><label class="lbl" for="tplc">Texto de costo al enviar una plantilla</label>${cost}<span class="help" id="tplc-h">Se muestra tal cual en la confirmación de «Enviar plantilla».</span></div></div><p class="p2 foot-note">${ic('info', 'xs')}La plantilla y su texto de costo son por sucursal: «Aplicar a todas» no los copia.</p>`;
}

/* ---- scheduled conversations: the «slots cap» lives here (stored only) ---- */
function schedBody() {
  const ed = can().edit, c = S.draft.scheduling, e = k => S.errors['c:' + k];
  const f = (k, id, label, help, v) => `<div class="field"><label class="lbl" for="${id}">${label}</label>${numField('c:' + k, id, label, v, { unit: false })}<span class="help">${help}</span>${errLine(id, e(k))}</div>`;
  return `<div class="alert info" role="note">${ic('info', 'sm')}<div><strong>Se guarda, pero todavía no cambia al chatbot</strong>Las conversaciones agendadas llegan en una versión posterior. Puedes dejar los valores listos.</div></div><div class="srow">${ed ? swBtn(c.enabled, 'Permitir conversaciones agendadas', 'data-act="schedToggle"', ['Activadas', 'Desactivadas']) : `<span class="badge dot">${c.enabled ? 'Activadas' : 'Desactivadas'}</span>`}<div class="srt"><b>Permitir conversaciones agendadas</b><small>El cliente elige un horario para que una persona lo atienda.</small></div></div><div class="fgrid three">${f('slot', 'slot', 'Duración de cada horario (min)', 'De 5 a 240.', c.slotMinutes)}${f('offered', 'offered', 'Horarios que se ofrecen', 'De 1 a 10 opciones.', c.slotsOffered)}${f('max', 'maxs', 'Máximo por horario', 'Conversaciones a la vez, de 1 a 50.', c.maxScheduledPerSlot)}</div>`;
}
