/* parts2: shell, states, banners, save bar, dialogs, actions. */
const sidebar = () => `<aside class="side" aria-label="Navegación principal"><div class="brand"><span class="brand-mark">${ic('paw')}</span>HoundFe</div><div class="tenant"><span class="tenant-tile">C</span><div><strong>Sucursal Centro</strong><small>Ciudad de México</small></div></div><nav class="nav" aria-label="Secciones"><ul>
<li><a href="#">${ic('home', 'sm')}Inicio</a></li><li><a href="#">${ic('cart', 'sm')}Ventas</a></li><li><a href="#">${ic('package', 'sm')}Productos</a></li><li><a href="#">${ic('users', 'sm')}Clientes</a></li>
<li class="nav-group">Chatbot</li><li><a href="#">${ic('inbox', 'sm')}Solicitudes<span class="count">5</span></a></li>
<li class="nav-group">Sistema</li><li><a href="#">${ic('bell', 'sm')}Notificaciones</a></li><li><a href="#">${ic('globe', 'sm')}Catálogo online</a></li><li><a href="#">${ic('truck', 'sm')}Envíos</a></li><li><a href="#">${ic('pin', 'sm')}Validaciones de zona</a></li><li><a href="#" aria-current="page">${ic('bot', 'sm')}Atención del chatbot</a></li></ul></nav><div class="side-foot"><span class="avatar">LM</span><div><b>Laura Méndez</b><small>Gerente</small></div></div></aside>`;
const topbar = () => `<header class="topbar"><nav class="crumbs" aria-label="Ruta"><a href="#">Sistema</a>${ic('right', 'xs')}<span aria-current="page">Atención del chatbot</span></nav><span class="spacer"></span><button class="icon-btn" aria-label="Notificaciones, 5 sin leer">${ic('bell')}<span class="dotc">5</span></button><span class="avatar">LM</span></header>`;
const shell = inner => `<div class="app">${sidebar()}<div class="col">${topbar()}<div class="scroll cq" id="scroll">${inner}</div></div></div>`;
const pageHead = () => `<div class="phead"><div><h1 class="page-title">Atención del chatbot</h1><p class="page-sub">Horario, fechas cerradas y plazos con los que se miden las solicitudes del chatbot en Sucursal Centro.</p></div>${can().all ? `<button type="button" class="btn" data-act="applyOpen" id="applyBtn">${ic('building', 'sm')}Aplicar a todas mis sucursales</button>` : ''}</div>`;

/* ---- screen-level states ---- */
const skelSec = n => `<section class="panel" aria-hidden="true"><span class="skel" style="width:30%;height:16px"></span><span class="skel" style="width:55%"></span>${Array.from({ length: n }, () => '<span class="skel" style="height:44px"></span>').join('')}</section>`;
function gate(inner) {
  if (S.mode === 'forbidden') return `<div class="page"><div class="surface"><div class="empty"><svg class="icon" aria-hidden="true"><use href="#i-lock"/></svg><h2>No tienes acceso a esta pantalla</h2><p>Pide a quien administra tu rol el permiso «Ver ajustes del chatbot» (read:ChatbotSettings).</p></div></div></div>`;
  if (S.mode === 'loading') return `<div class="page" role="status" aria-label="Cargando ajustes del chatbot"><span class="skel" style="width:280px;height:32px"></span><span class="skel" style="width:60%"></span>${skelSec(5)}${skelSec(3)}</div>`;
  if (S.mode === 'loaderror') return `<div class="page"><div class="surface"><div class="empty error" role="alert"><svg class="icon" aria-hidden="true"><use href="#i-alert"/></svg><h2>No pudimos cargar los ajustes</h2><p>No se cambió nada. Revisa tu conexión e inténtalo de nuevo.</p><button type="button" class="btn" data-act="retry">${ic('refresh', 'sm')}Reintentar</button></div></div></div>`;
  return inner();
}
const errTarget = k => {
  const p = k.split(':');
  if (p[0] === 'h') return p[1] === 'week' ? ['Horario de atención', 'sec-hours'] : [`${DAY_L[p[1]][0]}: horario`, 'dr-' + p[1]];
  if (p[0] === 's') return [`${SUBS[p[1]][0]}: ${p[2] === 'claim' ? 'atender' : 'resolver'}`, `s-${p[1]}-${p[2]}`];
  return [{ 'x:window': 'Aviso de ventana', 'x:margin': 'Margen de comprobantes', 'x:template': 'Plantilla', 'c:slot': 'Duración de cada horario', 'c:offered': 'Horarios que se ofrecen', 'c:max': 'Máximo por horario' }[k], { 'x:window': 'win', 'x:margin': 'margin', 'x:template': 'tpl', 'c:slot': 'slot', 'c:offered': 'offered', 'c:max': 'maxs' }[k]];
};
const NOTICE = {
  failed: ['warn', 'alert', 'Guardado; los plazos de las solicitudes abiertas se actualizarán más tarde', 'Tus cambios ya están en la versión {v}. No hace falta guardar otra vez ni reintentar.'],
  partial: ['info', 'info', 'Guardado; algunas solicitudes se actualizarán la próxima vez que alguien las toque', 'Estaban cambiando justo ahora. Los plazos nuevos se aplican solos.'],
  500: ['danger', 'alert', 'No se pudo guardar', 'Tus cambios siguen aquí y no se perdió nada. Es seguro volver a intentarlo.'],
  403: ['danger', 'lock', 'Ya no tienes permiso para guardar', 'Tus cambios siguen aquí. Pide el permiso «Cambiar ajustes del chatbot» (update:ChatbotSettings) y vuelve a intentarlo.']
};
function banners() {
  const out = [];
  if (!can().edit) out.push(`<div class="alert info" role="note">${ic('lock', 'sm')}<div><strong>Solo lectura</strong>Puedes ver cómo está configurado, pero no cambiarlo. Pide el permiso «Cambiar ajustes del chatbot» a quien administra tu rol.</div></div>`);
  if (creating() && S.mode !== 'errors') out.push(`<div class="alert info" role="note">${ic('info', 'sm')}<div><strong>Esta sucursal aún no tiene configuración propia</strong>Mostramos los valores recomendados (versión 0). Se vuelven tuyos al presionar «Guardar configuración»; puedes ajustarlos antes.</div></div>`);
  if (S.notice) { const [t, i, ti, de] = NOTICE[S.notice.kind]; out.push(`<div class="alert ${t}" role="${t === 'danger' ? 'alert' : 'status'}">${ic(i, 'sm')}<div><strong>${ti}</strong>${de.replace('{v}', S.cfg.version)}<div class="acts">${S.notice.kind === '500' ? '<button type="button" class="btn sm" data-act="save">Reintentar</button>' : ''}<button type="button" class="btn sm ghost" data-act="noticeClose">Entendido</button></div></div></div>`); }
  if (S.conflict && !S.dialog) out.push(`<div class="alert warn" role="alert">${ic('alert', 'sm')}<div><strong>Otra persona guardó cambios antes que tú</strong>Ya existe la versión ${S.conflict.version}. Tus cambios siguen aquí; no se ha enviado nada.<div class="acts"><button type="button" class="btn sm" data-act="conflictOpen">Revisar y resolver</button></div></div></div>`);
  const ks = Object.keys(S.errors);
  if (S.shown && ks.length) out.push(`<div class="checklist" role="alert"><b>${plural(ks.length, 'campo por corregir', 'campos por corregir')} antes de guardar</b><ul>${ks.map(k => { const [l, id] = errTarget(k); return `<li><a href="#${id}" data-act="goto" data-id="${id}">${esc(l)}</a><span>${esc(S.errors[k])}</span></li>`; }).join('')}</ul></div>`);
  return out.join('');
}

/* ---- save bar ---- */
function saveBar() {
  if (!can().edit) return '';
  const items = dirtyItems(), n = items.length, cr = creating(), ne = Object.keys(S.errors).length;
  if (!n && !cr && !S.savedAt && !S.saving) return '';
  let txt;
  if (S.saving) txt = `<span class="spin" aria-hidden="true"></span><span><b>Guardando…</b><small>Después se recalculan las solicitudes abiertas.</small></span>`;
  else if (S.shown && ne) txt = `<span class="sb-i bad">${ic('alert', 'sm')}</span><span><b>${plural(ne, 'campo por corregir', 'campos por corregir')}</b><small>Revisa la lista de arriba para poder guardar.</small></span>`;
  else if (n) txt = `<span class="sb-i warn">${ic('pencil', 'sm')}</span><span><b>${plural(n, 'cambio sin guardar', 'cambios sin guardar')}</b><small>${esc(items.slice(0, 3).map(i => i.label).join(', ') + (n > 3 ? ` y ${n - 3} más` : ''))}. Al guardar se recalculan los plazos de las solicitudes abiertas.</small></span>`;
  else if (cr) txt = `<span class="sb-i warn">${ic('info', 'sm')}</span><span><b>Sin guardar todavía</b><small>Estos son los valores recomendados; guárdalos para tener configuración propia.</small></span>`;
  else txt = `<span class="sb-i ok">${ic('check-circle', 'sm')}</span><span><b>Todo guardado</b><small>Versión ${S.cfg.version}</small></span>`;
  const btn = n || cr || S.saving;
  return `<div class="sbar" role="region" aria-label="Guardar cambios">${txt}<span class="grow"></span>${btn ? `${n ? `<button type="button" class="btn ghost" data-act="discard" ${S.saving ? 'disabled' : ''}>Descartar cambios</button>` : ''}<button type="button" class="btn primary" data-act="save" ${S.saving ? 'disabled' : ''}>${S.saving ? '<span class="spin"></span>Guardando' : cr && !n ? 'Guardar configuración' : 'Guardar cambios'}</button>` : ''}</div>`;
}

/* ---- dialogs ---- */
const modal = (title, body, foot, o = {}) => `<div class="mod-scrim ${o.frame ? 'inframe' : ''}" ${o.noClose ? '' : 'data-act="dlgClose"'}></div><div class="mod ${o.frame ? 'inframe' : ''}" role="dialog" aria-modal="true" aria-labelledby="mod-t"><div class="mod-h"><h2 id="mod-t">${title}</h2>${o.noClose ? '' : `<button type="button" class="kebab" data-act="dlgClose" aria-label="Cerrar">${ic('x')}</button>`}</div><div class="mod-b">${body}</div><div class="mod-f">${foot}</div></div>`;
const REASON = { NO_PERMISSION: 'No tienes permiso para aplicar ahí', TENANT_INACTIVE: 'Sucursal desactivada' };
const RECOMP = { DONE: ['ok', 'check-circle', 'Aplicada'], PARTIAL: ['warn', 'info', 'Aplicada; algunas solicitudes se actualizan después'], FAILED: ['warn', 'alert', 'Guardada; los plazos de sus solicitudes abiertas se actualizarán más tarde'] };
const brGroup = (title, list, kind, fmt) => list.length ? `<section class="brg"><h3>${title} <span class="fig">${list.length}</span></h3><ul>${list.map(b => { const [cls, icon, t] = fmt(b); return `<li class="br ${cls}"><span class="bn">${ic('building', 'sm')}<b>${esc(b.name)}</b></span><span class="bs">${ic(icon, 'sm')}${t}</span></li>`; }).join('')}</ul></section>` : '';
function applyBody(step, d) {
  const sv = S.cfg.version;
  if (step === 'save-first') { const n = dirtyItems().length; return [`Guardar y revisar`, `<p>Aplicar copia la configuración <b>guardada</b> de Sucursal Centro, y tienes ${plural(n, 'cambio sin guardar', 'cambios sin guardar')}.</p><p class="p2">Primero se guardan tus cambios y luego verás a qué sucursales llegarían, antes de confirmar nada.</p>`, `<button type="button" class="btn" data-act="dlgClose">Cancelar</button><button type="button" class="btn primary" data-act="applySaveFirst">Guardar y revisar</button>`]; }
  if (step === 'loading' || step === 'applying') return [step === 'loading' ? 'Revisando sucursales' : 'Aplicando…', `<div class="wait" role="status"><span class="spin" aria-hidden="true"></span><span>${step === 'loading' ? 'Calculando qué cambiaría en cada sucursal. No se escribe nada todavía.' : 'Copiando la configuración. Cada sucursal se guarda por separado.'}</span></div>`, `<button type="button" class="btn" disabled>${step === 'loading' ? 'Cancelar' : 'Un momento…'}</button>`];
  if (step === 'conflict') return ['La configuración cambió', `<div class="alert warn" role="alert">${ic('alert', 'sm')}<div><strong>Alguien guardó otra versión mientras revisabas</strong>No se copió nada. Recarga la configuración y repite la revisión.</div></div><p class="p2">Tu rol puede aplicar a otras sucursales pero no ver los ajustes de esta, así que no podemos mostrarte qué cambió. Si tienes permiso de lectura, aquí aparecería la comparación.</p>`, `<button type="button" class="btn" data-act="dlgClose">Cerrar</button><button type="button" class="btn primary" data-act="applyRetry">Volver a revisar</button>`];
  if (step === 'review' && !d.tenantsApplied.length) return ['Nada que aplicar', `<div class="alert success" role="status">${ic('check-circle', 'sm')}<div><strong>Tus demás sucursales ya tienen esta configuración</strong>No se cambiaría nada en ${plural(d.tenantsUnchanged.length, 'sucursal', 'sucursales')}.</div></div>${brGroup('Ya igual', d.tenantsUnchanged, 'u', b => ['mute', 'check', b.self ? 'Esta sucursal (origen)' : 'Ya igual'])}`, `<button type="button" class="btn primary" data-act="dlgClose">Entendido</button>`];
  if (step === 'review') {
    const n = d.tenantsApplied.length;
    return [`Aplicar a ${plural(n, 'sucursal', 'sucursales')}`, `<p>Se copia la configuración guardada de <b>Sucursal Centro</b> (versión ${d.source.version}). Esto <b>reemplaza</b> esos valores en las sucursales de abajo y recalcula sus solicitudes abiertas.</p>
<div class="cp2"><div><h3>Se copia</h3><ul><li>Horario y zona horaria</li><li>Fechas cerradas</li><li>Plazos por tipo y margen de comprobantes</li><li>Aviso de ventana</li><li>Conversaciones agendadas</li></ul></div><div><h3>Se queda en cada sucursal</h3><ul><li>Plantilla y su texto de costo</li><li>Tipos de solicitud habilitados</li></ul></div></div>
${brGroup('Cambiarán', d.tenantsApplied, 'a', () => ['go', 'right', 'Recibirá los cambios'])}${brGroup('Ya igual', d.tenantsUnchanged, 'u', b => ['mute', 'check', b.self ? 'Esta sucursal (origen)' : 'Ya igual'])}${brGroup('No se pueden cambiar', d.tenantsSkipped, 's', b => ['warn', 'lock', REASON[b.reason]])}
<p class="p2 foot-note">${ic('info', 'xs')}Solo se incluyen las sucursales donde tienes membresía y permiso. Las demás no aparecen ni se cuentan.</p>`, `<button type="button" class="btn" data-act="dlgClose">Cancelar</button><button type="button" class="btn primary" data-act="applyConfirm">Aplicar a ${plural(n, 'sucursal', 'sucursales')}</button>`];
  }
  const ok = !d.tenantsFailed.length && d.tenantsApplied.every(a => a.recompute === 'DONE');
  return [d.tenantsFailed.length ? 'Se aplicó en algunas sucursales' : 'Configuración aplicada', `<div class="alert ${d.tenantsFailed.length ? 'warn' : 'success'}" role="status">${ic(d.tenantsFailed.length ? 'alert' : 'check-circle', 'sm')}<div><strong>${plural(d.tenantsApplied.length, 'sucursal recibió', 'sucursales recibieron')} los cambios${d.tenantsFailed.length ? ` y ${plural(d.tenantsFailed.length, 'falló', 'fallaron')}` : ''}</strong>${d.tenantsFailed.length ? 'Lo que falló no se guardó en esas sucursales. Es seguro reintentar: la operación se puede repetir.' : ok ? 'Los plazos de sus solicitudes abiertas ya están al día.' : 'Revisa los avisos de abajo.'}</div></div>${brGroup('Aplicadas', d.tenantsApplied, 'a', b => RECOMP[b.recompute])}${brGroup('No se guardó', d.tenantsFailed, 'f', () => ['bad', 'alert', 'No se pudo guardar en esta sucursal'])}${brGroup('No se pueden cambiar', d.tenantsSkipped, 's', b => ['warn', 'lock', REASON[b.reason]])}${brGroup('Sin cambios', d.tenantsUnchanged, 'u', b => ['mute', 'check', b.self ? 'Esta sucursal (origen)' : 'Ya igual'])}`, `${d.tenantsFailed.length ? '<button type="button" class="btn" data-act="applyRetry">Reintentar las que fallaron</button>' : ''}<button type="button" class="btn primary" data-act="dlgClose">Listo</button>`];
}
const valOf = (c, k) => k[0] === 's' ? (() => { const s = c.slas.find(q => q.subtype === k.slice(2)); return `atender ${fmtMin(s.claimMinutes)}, resolver ${fmtMin(s.resolveMinutes)}`; })() : k[0] === 'h' ? rangesText(dayOf(c, k.slice(2)).ranges) : k === 'dates' ? plural(c.closedDates.length, 'fecha', 'fechas') : '';
function conflictModal(o = {}) {
  const mine = diffItems(S.cfg, S.draft), th = diffItems(S.cfg, S.conflict), both = mine.filter(m => th.some(t => t.key === m.key)), onlyMine = mine.filter(m => !both.includes(m)), onlyTh = th.filter(t => !both.some(m => m.key === t.key)), v = S.conflict.version;
  const list = (title, arr, f) => arr.length ? `<section class="brg"><h3>${title} <span class="fig">${arr.length}</span></h3><ul>${arr.map(i => `<li class="br"><span class="bn"><b>${esc(i.label)}</b></span><span class="bs">${f(i)}</span></li>`).join('')}</ul></section>` : '';
  return modal('Otra persona guardó antes que tú', `<p>Mientras editabas se guardó la <b>versión ${v}</b> (la tuya partía de la ${S.cfg.version}). No se envió nada: tus cambios siguen aquí.</p>${list('Solo cambiaste tú', onlyMine, i => 'se conserva')}${list('Solo cambió la otra persona', onlyTh, i => esc(valOf(S.conflict, i.key)) || 'cambió')}${list('Cambiaron los dos', both, i => `tú: ${esc(valOf(S.draft, i.key))} · otra persona: ${esc(valOf(S.conflict, i.key))}`)}<p class="p2 foot-note">${ic('info', 'xs')}Si conservas tus cambios, tus valores reemplazan los de la otra persona donde cambiaron los dos. Revisa y guarda de nuevo.</p>`, `<button type="button" class="btn" data-act="conflictTheirs">Usar la versión ${v} y descartar lo mío</button><button type="button" class="btn primary" data-act="conflictMine">Conservar mis cambios</button>`, o);
}
function overlay() {
  let h = '';
  const dl = S.dialog;
  if (dl) { if (dl.type === 'conflict') h += conflictModal(); else { const [t, b, f] = applyBody(dl.step, dl.data); h += modal(t, b, f); } }
  if (S.toast) h += `<div class="toasts"><div class="toast" role="status"><span class="tile">${ic('check')}</span><div><strong>${esc(S.toast.title)}</strong><p>${esc(S.toast.desc)}</p></div></div></div>`;
  return h;
}

/* ---- actions ---- */
let VIEW = () => '', toastT = 0;
function render(focusId) {
  const root = $('#root'); if (!root) return;
  const active = focusId || document.activeElement?.id, sc = $('.scroll'), top = sc ? sc.scrollTop : 0;
  const had = !!$('.mod'), key = S.dialog ? S.dialog.type + (S.dialog.step || '') : '';
  setHTML(root, VIEW() + overlay());
  const sc2 = $('.scroll'); if (sc2) sc2.scrollTop = top;
  if (S.dialog && (!had || S._k !== key)) ($('.mod .btn.primary:not(:disabled)') || $('.mod button'))?.focus(); else if (active) document.getElementById(active)?.focus({ preventScroll: true });
  S._k = key;
  clearTimeout(toastT); if (S.toast) toastT = setTimeout(() => { S.toast = null; render(); }, 4200);
}
const parseNum = (raw, unit) => { raw = String(raw).trim().replace(',', '.'); if (raw === '') return null; if (unit === 'h') return /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(parseFloat(raw) * 60) : NaN; return /^\d+$/.test(raw) ? parseInt(raw, 10) : NaN; };
function setField(el) {
  const f = el.dataset.f, p = f.split(':'), d = S.draft;
  if (f === 'tz') d.openingHours.timeZone = el.value;
  else if (p[0] === 'h') dayOf(d, p[1]).ranges[+p[2]][p[3]] = el.value;
  else if (f === 'x:templateName') d.templateName = el.value === '' ? null : el.value;
  else if (f === 'x:templateCostText') d.templateCostText = el.value;
  else {
    const us = $(`[data-u="${f}"]`), unit = us ? us.value : null;
    const v = parseNum(el.value, unit);
    if (Number.isNaN(v)) S.raw[f] = el.value; else delete S.raw[f];
    if (p[0] === 's') d.slas.find(s => s.subtype === p[1])[p[2] === 'claim' ? 'claimMinutes' : 'resolveMinutes'] = v;
    else if (f === 'x:window') d.windowWarningMinutes = v == null ? NaN : v;
    else if (f === 'x:margin') d.receiptCloseMarginMinutes = v == null ? NaN : v;
    else if (p[0] === 'c') d.scheduling[{ slot: 'slotMinutes', offered: 'slotsOffered', max: 'maxScheduledPerSlot' }[p[1]]] = v == null ? NaN : v;
  }
  S.savedAt = null; S.errors = validate(d); if (!Object.keys(S.errors).length) S.shown = false;
}
function saveNow(after) {
  if (S.saving || !can().edit) return;
  S.errors = validate(S.draft);
  const ks = Object.keys(S.errors);
  if (ks.length) { S.shown = true; if (window.TABFOR) S.tab = window.TABFOR(errTarget(ks[0])[1]); render(); const id = errTarget(ks[0])[1]; $('#' + id)?.scrollIntoView({ block: 'center' }); ($('#' + id + ' input') || $('#' + id))?.focus?.({ preventScroll: true }); return; }
  S.saving = true; render();
  setTimeout(() => {
    S.saving = false; const o = S.outcome;
    if (o === 'conflict') { S.conflict = theirs(); S.dialog = { type: 'conflict' }; }
    else if (o === 'error') S.notice = { kind: '500' };
    else if (o === 'forbidden') S.notice = { kind: '403' };
    else {
      const changed = dirtyItems().length > 0 || creating(), ver = changed ? S.cfg.version + 1 : S.cfg.version;
      S.cfg = clone(S.draft); S.cfg.version = ver; S.draft = clone(S.cfg); S.savedAt = Date.now(); S.shown = false;
      S.notice = changed && (o === 'failed' || o === 'partial') ? { kind: o } : null;
      S.toast = changed ? { title: 'Cambios guardados', desc: `Versión ${ver}. Las solicitudes abiertas se recalculan.` } : { title: 'No había cambios', desc: 'La configuración ya estaba así; no se creó otra versión.' };
      if (o !== 'error') S.outcome = 'ok';
      if (after) { render(); return after(); }
    }
    render();
  }, 700);
}
function applyStart() {
  S.dialog = { type: 'apply', step: 'loading' }; render();
  setTimeout(() => { if (!S.dialog) return; S.dialog = S.applyOut === 'conflict' ? { type: 'apply', step: 'conflict' } : { type: 'apply', step: 'review', data: S.applyOut === 'none' ? APPLY.none : APPLY.dry }; render(); }, 700);
}
const ACT = {
  noop: (b, e) => e.preventDefault(),
  toggleDay: b => { const r = dayOf(S.draft, b.dataset.day); r.ranges = r.ranges.length ? [] : [{ open: '09:00', close: '19:00' }]; S.copyFrom = null; S.errors = validate(S.draft); S.savedAt = null; render(); },
  addRange: b => { const r = dayOf(S.draft, b.dataset.day).ranges, last = r[r.length - 1], s = last ? Math.min(hm(last.close) + 60, 22 * 60) : 540; r.push({ open: fmtClock(s).padStart(5, '0'), close: fmtClock(Math.min(s + 120, 1439)).padStart(5, '0') }); S.errors = validate(S.draft); S.savedAt = null; render(`t-${b.dataset.day}-${r.length - 1}-open`); },
  delRange: b => { dayOf(S.draft, b.dataset.day).ranges.splice(+b.dataset.i, 1); S.errors = validate(S.draft); S.savedAt = null; render(); },
  copyOpen: b => { S.copyFrom = S.copyFrom === b.dataset.day ? null : b.dataset.day; S.copyTo = []; render(); },
  copyClose: () => { const id = 'cp-' + S.copyFrom; S.copyFrom = null; render(id); },
  copyToggle: b => { const d = b.dataset.day; S.copyTo = S.copyTo.includes(d) ? S.copyTo.filter(x => x !== d) : [...S.copyTo, d]; render(); },
  copyPick: b => { const o = DAYS.filter(d => d !== S.copyFrom), s = b.dataset.set; S.copyTo = s === 'all' ? o : s === 'none' ? [] : o.filter(d => !['SATURDAY', 'SUNDAY'].includes(d)); render(); },
  copyApply: () => { const src = clone(dayOf(S.draft, S.copyFrom).ranges), n = S.copyTo.length, from = S.copyFrom; S.copyTo.forEach(d => { dayOf(S.draft, d).ranges = clone(src); }); S.copyFrom = null; S.copyTo = []; S.errors = validate(S.draft); S.savedAt = null; S.toast = { title: 'Horario copiado', desc: `Del ${DAY_L[from][0].toLowerCase()} a ${plural(n, 'día', 'días')}. Falta guardar.` }; render('cp-' + from); },
  copyPickup: () => { S.draft.openingHours = clone(S.draft.branchOpeningHours); S.errors = validate(S.draft); S.savedAt = null; S.toast = { title: 'Horario de recolección copiado', desc: 'Está en el editor como borrador; falta guardar. No cambia Envíos.' }; render(); },
  dateAdd: () => {
    const v = $('#dateIn').value; S.dateIn = v;
    if (!v) S.dateErr = 'Elige una fecha.'; else if (S.draft.closedDates.includes(v)) S.dateErr = 'Esa fecha ya está en la lista.'; else if (S.draft.closedDates.length >= 400) S.dateErr = 'Llegaste al máximo de 400 fechas.';
    else { S.draft.closedDates = [...S.draft.closedDates, v].sort(); S.dateIn = ''; S.dateErr = ''; S.savedAt = null; }
    render('dateIn');
  },
  dateDel: b => { S.draft.closedDates = S.draft.closedDates.filter(d => d !== b.dataset.d); S.savedAt = null; render('dateIn'); },
  datePast: () => { S.draft.closedDates = S.draft.closedDates.filter(d => d >= TODAY); S.savedAt = null; render(); },
  schedToggle: () => { S.draft.scheduling.enabled = !S.draft.scheduling.enabled; S.savedAt = null; render(); },
  save: () => saveNow(), discard: () => { S.draft = clone(S.cfg); S.errors = {}; S.shown = false; S.raw = {}; S.dateErr = ''; S.notice = null; render(); },
  goto: (b, e) => { e.preventDefault(); const t = document.getElementById(b.dataset.id); t?.scrollIntoView({ block: 'center' }); (t?.querySelector('input,select') || t)?.focus?.({ preventScroll: true }); },
  noticeClose: () => { S.notice = null; render(); }, retry: () => { setMode('normal'); },
  applyOpen: () => { if (dirtyItems().length || creating()) { S.dialog = { type: 'apply', step: 'save-first' }; render(); } else applyStart(); },
  applySaveFirst: () => { S.dialog = null; saveNow(() => { if (!S.dialog && !S.notice) applyStart(); }); },
  applyConfirm: () => { S.dialog = { type: 'apply', step: 'applying' }; render(); setTimeout(() => { if (!S.dialog) return; S.dialog = { type: 'apply', step: 'result', data: S.applyOut === 'partial' ? APPLY.real.partial : APPLY.real.ok }; render(); }, 900); },
  applyRetry: () => { if (S.dialog?.step === 'conflict') S.applyOut = 'ok'; applyStart(); },
  dlgClose: () => { S.dialog = null; render('applyBtn'); },
  conflictOpen: () => { S.dialog = { type: 'conflict' }; render(); },
  conflictTheirs: () => { S.cfg = clone(S.conflict); S.draft = clone(S.conflict); S.conflict = null; S.dialog = null; S.errors = {}; S.toast = { title: `Cargamos la versión ${S.cfg.version}`, desc: 'Tus cambios se descartaron.' }; render(); },
  conflictMine: () => { const c = S.conflict; S.cfg = clone(c); S.conflict = null; S.dialog = null; S.toast = { title: 'Tus cambios siguen aquí', desc: `Ahora parten de la versión ${c.version}. Revisa y guarda de nuevo.` }; render(); }
};
function setMode(m) {
  const keep = { role: S.role, outcome: S.outcome, applyOut: S.applyOut, sim: S.sim, tab: S.tab, day: S.day };
  S = Object.assign(newState(), keep, { mode: m });
  if (m === 'defaults') { S.cfg = clone(DEFAULTS); S.draft = clone(DEFAULTS); }
  if (m === 'errors') {
    const d = S.draft; dayOf(d, 'WEDNESDAY').ranges = [{ open: '09:00', close: '15:00' }, { open: '14:00', close: '19:00' }]; dayOf(d, 'THURSDAY').ranges = [{ open: '19:00', close: '09:00' }];
    const q = d.slas.find(s => s.subtype === 'COMPLAINT'); q.claimMinutes = 60; q.resolveMinutes = 30; d.windowWarningMinutes = 1500; d.scheduling.maxScheduledPerSlot = 60; d.templateName = 'Aviso-Seguimiento';
    S.errors = validate(d); S.shown = true; S.dateIn = '2026-12-25'; S.dateErr = 'Esa fecha ya está en la lista.';
  }
  if (m === 'conflict') { dayOf(S.draft, 'MONDAY').ranges = [{ open: '08:00', close: '19:00' }]; S.draft.slas.find(s => s.subtype === 'COMPLAINT').claimMinutes = 45; S.conflict = theirs(); S.dialog = { type: 'conflict' }; }
  if (m === 'failed') { S.cfg.version = 4; S.draft.version = 4; S.notice = { kind: 'failed' }; S.savedAt = 1; }
  if (m === 'applying') { S.dialog = { type: 'apply', step: 'review', data: APPLY.dry }; }
  render();
}
function bind() {
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACT[b.dataset.act]) ACT[b.dataset.act](b, e); });
  document.addEventListener('change', e => { const t = e.target; if (t.dataset?.f) { setField(t); render(t.id); } else if (t.dataset?.u) { S.units[t.dataset.u] = t.value; const i = $(`[data-f="${t.dataset.u}"]`); setField(i); render(t.id); } });
  document.addEventListener('input', e => { const t = e.target; if (t.id === 'dateIn') S.dateIn = t.value; if (t.id === 'tplc') { const c = t.parentElement.querySelector('.counter'); if (c) c.textContent = `${t.value.length} / 200`; } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (S.dialog) ACT.dlgClose(); else if (S.copyFrom) ACT.copyClose(); } });
}
