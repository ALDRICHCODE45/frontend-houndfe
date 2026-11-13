/* Components shared by the three directions. Every builder is a pure function of a state object s (see mk in core.js),
   so the static boards of artboard 04 reuse them. Interactive wiring (S, paint, events) is at the bottom. */
const NAMEOF = (m, s) => m.author === 'CUSTOMER' ? CF : m.author === 'BOT' ? 'Bot' : `${assignee(s)}${mine(s) ? ' (tú)' : ''}`;
const fmtN = n => n.toLocaleString('en-US');
const lastCustLabel = s => { const a = lastCustAbs(s); return `${a < 0 ? 'ayer' : 'hoy'} a las ${hm(((a % 1440) + 1440) % 1440)}`; };

/* ---- delivery state: icon plus words, color only reinforces ---- */
function dlHTML(m, o = {}) {
  const k = dlKey(m), [i, t, tone] = DL[k];
  if (o.compact && !tone.match(/warn|bad/)) return `<span class="dl ${tone}" title="${t}">${ic(i, 'xs')}<span class="sr">${t}</span></span>`;
  return `<span class="dl ${tone}">${ic(i, 'xs')}<span>${t}</span></span>`;
}
function dlExtra(m) {
  const k = dlKey(m);
  if (m.retried) return `<p class="dl-note">Reenviado como mensaje nuevo.</p>`;
  if (k === 'PENDING') return `<p class="dl-note warn">Sigue en cola desde hace ${m.age} s. Todavía no sale; no hace falta escribirlo otra vez.</p>`;
  if (k === 'DEFERRED') return `<p class="dl-note warn">WhatsApp cerró la ventana. Se reenvía solo si ${CF} vuelve a escribir; si la conversación termina antes, queda como «No enviado».</p>`;
  if (k === 'FAILED') return m.type === 'TEMPLATE' ? `<p class="dl-note bad">La plantilla no se entregó. Puedes reintentar desde el recuadro de abajo.</p>` : `<p class="dl-note bad">No se pudo enviar. ${CF} no lo recibió.</p><button type="button" class="btn sm" data-retry="${m.id}">${ic('refresh', 'sm')}Reintentar</button>`;
  if (k === 'UNKNOWN') return m.type === 'TEMPLATE' ? `<p class="dl-note warn">Puede que ya se haya enviado y costado. No se puede reenviar: espera la respuesta de ${CF}.</p>` : `<p class="dl-note warn">Puede que ${CF} ya lo haya recibido. Reenviarlo crea un mensaje nuevo.</p><button type="button" class="btn sm" data-resend="${m.id}">${ic('send', 'sm')}Enviar como mensaje nuevo</button>`;
  return '';
}

/* ---- bubbles and thread ---- */
function mediaHTML(m) {
  const md = m.media || {};
  if (md.purged) return `<div class="media gone">${ic('ban')}<span>Archivo eliminado</span></div>`;
  if (m.type === 'IMAGE') return `<div class="media" role="img" aria-label="Foto ${esc(md.name)}"><span class="ph-art" aria-hidden="true"></span>${ic('image')}<span class="mn">${esc(md.name)} · ${md.size}</span></div>`;
  return `<div class="doc">${ic('file')}<span class="tx"><b class="ell">${esc(md.name)}</b><small>PDF · ${md.size}</small></span></div>`;
}
function bubbleHTML(m, s, o = {}) {
  const out = m.dir === 'OUT', cls = m.author === 'CUSTOMER' ? 'them' : m.author === 'BOT' ? 'bot' : 'staff';
  let body = '';
  if (m.type === 'TEXT') body = `<p class="bt">${esc(m.text)}</p>`;
  else if (m.type === 'AUDIO') body = `<div class="aud"><button type="button" class="aud-btn" aria-label="Reproducir nota de voz de ${m.dur.replace(':', ' minutos ')} segundos" data-noop>${ic('play', 'sm')}</button><span class="wave" aria-hidden="true">${[6, 12, 8, 16, 10, 14, 6, 12, 18, 9, 13, 7, 11, 15, 8, 10].map(h => `<i style="height:${h}px"></i>`).join('')}</span><span class="fig">${m.dur}</span></div>`;
  else if (m.type === 'TEMPLATE') body = `<p class="bt tplmsg">${ic('receipt', 'sm')}<span>Plantilla «${m.templateName}»</span></p><p class="tn">Mensaje aprobado de WhatsApp, enviado con costo.</p>`;
  else body = `${mediaHTML(m)}${m.text ? `<p class="bt">${esc(m.text)}</p>` : ''}`;
  const showName = o.author === false ? false : o.author === 'other' ? (m.author === 'BOT' || (m.author === 'STAFF' && !mine(s))) : true;
  const name = showName ? `<div class="bwho">${NAMEOF(m, s)}</div>` : '';
  return `<li class="msg ${out ? 'out' : 'in'}"><div class="bub ${cls}${m.status === 'FAILED' || m.status === 'DEFERRED' ? ' attn' : ''}">${name}${body}<div class="bmeta"><time>${hm(m.at)}</time>${out && m.status ? dlHTML(m, o) : ''}</div>${out && m.status && !o.compact ? dlExtra(m) : out && m.status && o.compact && /FAILED|UNKNOWN|DEFERRED|QUEUED/.test(m.status) ? dlExtra(m) : ''}</div></li>`;
}
function threadHTML(s, o = {}) {
  const its = items(s);
  let day = null, html = '';
  const older = s.role !== 'me-scoped' && its.length ? `<li class="older"><button type="button" class="btn ghost sm" data-noop>${ic('history', 'sm')}Cargar mensajes anteriores</button></li>` : '';
  its.forEach(m => {
    if (m.day !== day) { day = m.day; html += `<li class="day"><span>${DAYLBL[m.day]}</span></li>`; }
    if (m.kind === 'mark') html += `<li class="mk"><span>${m.plain ? '' : ic('user', 'xs')}${m.text.replace('{who}', assignee(s))}</span><time>${hm(m.at)}</time></li>`;
    else html += bubbleHTML(m, s, o);
  });
  return `<ol class="thread-list" role="log" aria-live="polite" aria-label="Mensajes con ${CF}">${older}${html}</ol>${o.newPill ? `<button type="button" class="newpill" data-pill>${ic('arrow-down', 'xs')}${o.newPill} mensajes nuevos</button>` : ''}`;
}

/* ---- header chips and badges ---- */
function sessBadge(s) {
  return ({
    STARTING: `<span class="badge info"><span class="spin sm" aria-hidden="true"></span>Conectando…</span>`,
    ACTIVE: `<span class="badge success dot">En vivo</span>`,
    ENDING: `<span class="badge warning dot">Terminando…</span>`,
    ENDED: `<span class="badge dot">Terminada</span>`,
    WAITING: `<span class="badge warning dot">Sin confirmar</span>`
  })[s.session];
}
function reqBadge(s) {
  if (s.session === 'WAITING') return `<span class="badge warning dot">Nueva</span>`;
  if (s.session === 'ENDING' || s.session === 'ENDED') return `<span class="badge success dot">Resuelta</span>`;
  return `<span class="badge info dot"><span class="t">En atención · por ${mine(s) ? 'ti' : OTHER}</span></span>`;
}
function winChip(s) {
  if (s.session === 'ENDED' || s.session === 'WAITING' || s.session === 'ENDING') return '';
  const w = winLabel(s);
  return `<span class="tag wc ${w.tone}">${ic(w.icon, 'xs')}${w.t}</span>`;
}
const staffActLine = s => s.session === 'ACTIVE' && mine(s) ? `<span class="tag">${ic('message', 'xs')}Tu última respuesta: hace ${Math.max(1, nowM(s) - (items(s).filter(m => m.author === 'STAFF').pop() || { at: nowM(s) - 1 }).at)} min</span>` : '';

/* ---- banners above the thread ---- */
const al = (tone, icon, title, body, acts = '') => `<div class="alert ${tone}" role="${tone === 'danger' ? 'alert' : 'status'}">${icon}<div><strong>${title}</strong>${body}${acts ? `<div class="acts">${acts}</div>` : ''}</div></div>`;
function bannerHTML(s, o = {}) {
  const out = [];
  if (s.conn === 'lost') out.push(al('warn', ic('wifi-off', 'sm'), 'Sin conexión en tiempo real', 'Seguimos consultando cada 5 s. Los mensajes que ya enviaste no se pierden.'));
  if (s.role === 'me-scoped') out.push(al('info', ic('lock', 'sm'), 'Solo ves los mensajes de tu sesión', `Empiezan cuando la tomaste. Para ver toda la conversación necesitas el permiso «Ver conversaciones del chatbot». Los avances de entrega llegan con un retraso de unos segundos.`));
  const canFin = mine(s) || s.role === 'reassigner';
  const fin = canFin && o.fin !== false ? `<button type="button" class="btn sm" data-finish-open>${ic('check-circle', 'sm')}Finalizar conversación</button>` : '';
  if (s.session === 'STARTING') out.push(al('info', `<span class="spin" aria-hidden="true"></span>`, 'Conectando…', `Esperando a que el bot confirme que se calló. Van <span class="fig" data-elapsed>${Math.floor((s.elapsed ?? 42) / 60)}:${pad((s.elapsed ?? 42) % 60)}</span>. Si no confirma a tiempo, la solicitud vuelve a Nueva y no se envía nada a ${CF}.`));
  else if (s.session === 'WAITING') out.push(al('warn', ic('alert', 'sm'), 'El bot no confirmó a tiempo', `Pasaron 2 min sin respuesta del bot, así que la solicitud volvió a Nueva y nadie la tiene. No se envió nada a ${CF}.`, o.fin === false ? '' : `<button type="button" class="btn sm primary" data-claim>${ic('user', 'sm')}Atender de nuevo</button>`));
  else if (s.session === 'ENDING') out.push(al('info', `<span class="spin" aria-hidden="true"></span>`, 'Terminando…', `El bot se despide de ${CF} y retoma la conversación. Puede tardar hasta 10 min; no hace falta esperar aquí.`));
  else if (s.session === 'ENDED') out.push(`<div class="alert" role="status">${ic('check-circle', 'sm')}<div><strong>Conversación terminada a las ${hm(nowM(s) + 1)}</strong>${CF} vuelve a hablar con el bot.<dl class="kv sumkv"><dt>Nota interna</dt><dd>${esc(s.note || 'Se mandó reposición de la bolsa; el cliente confirmó por WhatsApp.')}</dd>${s.sub === 'COMPLAINT' ? `<dt>Clasificación</dt><dd>${s.outcome === 'none' ? 'Sin clasificar (se cerró sola)' : (OUTCOMES.find(o => o[0] === (s.outcome || 'REPLACEMENT')) || [])[1]}</dd>` : ''}</dl></div></div>`);
  else if (s.session === 'ACTIVE') {
    if (s.deferred) out.push(al('warn', ic('lock', 'sm'), 'WhatsApp cerró la ventana', `Tu último mensaje quedó como «No enviado, ventana cerrada» y se reenvía solo si ${CF} vuelve a escribir. Mientras tanto solo puedes enviar la plantilla.`));
    else if (winEff(s) === 'soon' || (winEff(s) === 'open' && closesIn(s) <= 120)) out.push(al('warn', ic('clock', 'sm'), `La ventana cierra en ${dur(closesIn(s))}`, 'Después solo podrás enviar la plantilla, que tiene costo. Si ya resolviste, puedes finalizar.'));
    if (idle(s) && winEff(s) === 'open' && canFin) out.push(al('info', ic('clock', 'sm'), `${CF} no escribe desde hace ${dur(silentMin(s))}`, `Puedes finalizar ahora sin más pasos. Si pasan 2 h sin respuesta, la conversación se finaliza sola con una nota automática.`, fin));
  }
  return out.join('');
}

/* ---- composer ---- */
const FILES = {
  img: { kind: 'IMAGE', name: 'foto-reposicion.jpg', size: '1.4 MB' }, pdf: { kind: 'PDF', name: 'politica-de-cambios.pdf', size: '218 KB' },
  video: { kind: 'VIDEO', name: 'empaque-bolsa.mp4', size: '6.2 MB', err: `No se puede enviar empaque-bolsa.mp4. Solo imágenes (JPG, PNG, WebP) y PDF.` },
  big: { kind: 'IMAGE', name: 'foto-original.jpg', size: '14.2 MB', err: `foto-original.jpg pesa 14.2 MB. El máximo es 10 MB.` }
};
function attachHTML(a) {
  if (!a) return '';
  const icn = a.kind === 'PDF' ? 'file' : a.kind === 'VIDEO' ? 'file' : 'image';
  const st = a.status === 'uploading' ? `<span class="prog" role="progressbar" aria-label="Subiendo ${esc(a.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${a.pct}"><i style="width:${a.pct}%"></i></span><small>Subiendo… ${a.pct} %</small>`
    : a.status === 'error' ? `<small class="bad">${ic('alert', 'xs')}${esc(a.err)}</small>`
      : `<small class="ok">${ic('check-circle', 'xs')}Listo para enviar · ${a.size}</small>`;
  return `<div class="att ${a.status}"><span class="thumb ${a.kind === 'IMAGE' ? 'img' : ''}" aria-hidden="true">${ic(icn)}</span><span class="tx"><b class="ell">${esc(a.name)}</b>${st}</span><button type="button" class="icon-btn sm" data-attach-clear aria-label="Quitar ${esc(a.name)}">${ic('x', 'sm')}</button></div>`;
}
function attachMenuHTML() {
  return `<div class="amenu" role="menu" aria-label="Adjuntar archivo"><p class="am-h">Simulación del selector de archivos</p>
  <button type="button" role="menuitem" data-pick="img">${ic('image', 'sm')}<span><b>foto-reposicion.jpg</b><small>JPG · 1.4 MB</small></span></button>
  <button type="button" role="menuitem" data-pick="pdf">${ic('file', 'sm')}<span><b>politica-de-cambios.pdf</b><small>PDF · 218 KB</small></span></button>
  <button type="button" role="menuitem" data-pick="video">${ic('file', 'sm')}<span><b>empaque-bolsa.mp4</b><small>Video · 6.2 MB · no permitido</small></span></button>
  <button type="button" role="menuitem" data-pick="big">${ic('image', 'sm')}<span><b>foto-original.jpg</b><small>JPG · 14.2 MB · muy grande</small></span></button></div>`;
}
const notice = (cls, icon, title, body, acts = '') => `<div class="comp bar ${cls}">${icon}<div class="tx"><strong>${title}</strong>${body}</div>${acts}</div>`;
function offHTML(title, body) {
  return `<div class="comp off"><div class="comp-box"><label class="sr" for="draft-off">Mensaje para ${CF}</label><textarea class="cta" id="draft-off" rows="2" disabled placeholder="${title}"></textarea><div class="comp-row"><button type="button" class="icon-btn sm" disabled aria-label="Adjuntar imagen o PDF">${ic('paperclip')}</button><span class="hint">${body}</span><button type="button" class="btn primary" disabled>${ic('send', 'sm')}Enviar</button></div></div></div>`;
}
function composerHTML(s, o = {}) {
  if (s.role === 'other-noconv') return '';
  if (s.session === 'ENDED' || s.session === 'ENDING') return notice('end', ic('check-circle'), 'La conversación terminó', 'Ya no se pueden enviar mensajes. Si el cliente vuelve a escribir, lo atiende el bot.');
  if (!mine(s)) {
    const re = s.role === 'reassigner' ? `<div class="bar-acts"><button type="button" class="btn sm" data-noop>${ic('swap', 'sm')}Reasignar…</button><button type="button" class="btn sm" data-finish-open>${ic('check-circle', 'sm')}Finalizar en su lugar…</button></div>` : '';
    return notice('ro', ic('lock'), `Atiende ${OTHER}`, `Solo quien la atiende puede escribirle a ${CF}. Tú puedes leer la conversación${s.role === 'reassigner' ? ' y reasignarla o finalizarla si hace falta' : ''}.`, re);
  }
  if (s.session === 'STARTING') return offHTML('Conectando…', 'Podrás escribir cuando el bot confirme que se calló.');
  if (s.session === 'WAITING') return offHTML('Atiende la solicitud para escribir', 'Nadie la tiene todavía.');
  if (winEff(s) === 'closed') return blockedHTML(s, o);
  const a = s.attach, n = s.draft.length, lim = a ? 1024 : 4096, over = n > lim;
  const can = !over && ((a && a.status === 'ready') || (!a && s.draft.trim()));
  return `<form class="comp" id="comp" data-form aria-label="Escribir a ${CF}" novalidate>${attachHTML(a)}
  <div class="comp-box${over ? ' bad' : ''}"><label class="sr" for="draft">${a ? 'Pie de foto' : 'Mensaje'} para ${CF}</label>
  <textarea class="cta" id="draft" rows="${o.rows || 2}" placeholder="${a ? 'Pie de foto (opcional)' : `Escribe un mensaje para ${CF}…`}" aria-describedby="draft-help" aria-invalid="${over}">${esc(s.draft)}</textarea>
  <div class="comp-row"><div class="menu-wrap"><button type="button" class="icon-btn sm" data-attach-toggle aria-haspopup="menu" aria-expanded="${s.menu}" aria-label="Adjuntar imagen o PDF">${ic('paperclip')}</button>${s.menu ? attachMenuHTML() : ''}</div>
  <span class="hint" id="draft-help">${o.mobile ? 'Se envía tal cual, sin formato.' : 'Enter envía · Shift+Enter agrega una línea · Se envía tal cual, sin formato'}</span>
  <span class="counter fig${n > lim - 300 ? ' near' : ''}${over ? ' over' : ''}" id="cnt" aria-live="polite">${fmtN(n)} / ${fmtN(lim)}</span>
  <button type="submit" class="btn primary" id="send" ${can ? '' : 'disabled'}>${ic('send', 'sm')}Enviar</button></div></div>
  ${over ? `<p class="err" id="over-err">${ic('alert', 'xs')}<span>Máximo ${fmtN(lim)} caracteres. Quita ${fmtN(n - lim)} para enviarlo.</span></p>` : ''}
  <p class="help">Los mensajes no se pueden editar ni borrar después de enviarse.</p></form>`;
}
function blockedHTML(s, o = {}) {
  const t = s.tpl;
  const cost = `<div class="cost">${ic('receipt', 'sm')}<div><b>Plantilla «${TPL.name}»</b><span>${TPL.cost}</span><small>Se manda solo cuando tú lo confirmas, una sola vez por ventana cerrada. Cuando ${CF} responda, la ventana se abre y podrás escribir aquí.</small></div></div>`;
  let act;
  if (t === 'pending') act = `${al('info', ic('check-circle', 'sm'), `Plantilla enviada a las ${hm(965)} · Entregada`, `Esperamos la respuesta de ${CF}. Solo se envía una por ventana cerrada.`)}<button type="button" class="btn" disabled>${ic('receipt', 'sm')}Plantilla enviada</button>`;
  else if (t === 'failed') act = `${al('danger', ic('alert', 'sm'), 'La plantilla no se pudo entregar', 'Reintentar crea un envío nuevo. Antes de confirmar vuelves a ver el costo.')}<button type="button" class="btn primary" data-tpl-open>${ic('refresh', 'sm')}Reintentar plantilla…</button>`;
  else if (t === 'unknown') act = `${al('warn', ic('help', 'sm'), 'Entrega dudosa', 'Puede que la plantilla ya se haya enviado y costado. No se puede reenviar: espera la respuesta de ' + CF + '.')}<button type="button" class="btn" disabled>${ic('receipt', 'sm')}Plantilla enviada</button>`;
  else if (t === 'none') act = `${al('warn', ic('alert', 'sm'), 'No hay plantilla configurada', 'Esta sucursal no tiene una plantilla en Ajustes del chatbot. Pide a un administrador que la configure.', `<a href="#" class="btn sm" data-noop>Ir a Ajustes del chatbot</a>`)}<button type="button" class="btn" disabled>${ic('receipt', 'sm')}Enviar plantilla…</button>`;
  else act = `<button type="button" class="btn primary" data-tpl-open>${ic('receipt', 'sm')}Enviar plantilla…</button>`;
  return `<section class="comp blocked" aria-labelledby="blk-t"><div class="blk-h">${ic('lock')}<div><h3 id="blk-t">La ventana de 24 h está cerrada</h3><p>WhatsApp solo deja escribir libremente durante 24 h después del último mensaje del cliente. ${CF} escribió por última vez ${lastCustLabel(s)}.</p></div></div>
  ${s.draft ? `<div class="kept"><span class="lbl">Tu borrador, sin enviar</span><p class="bt">${esc(s.draft)}</p></div>` : ''}
  ${t === 'ready' || t === 'failed' || t === 'none' || t === 'pending' || t === 'unknown' ? cost : ''}<div class="blk-act">${act}</div></section>`;
}

/* ---- dialogs: finish and template ---- */
const radios = (key, rows, val, lbl) => `<div class="rgroup" role="radiogroup" aria-label="${lbl}">${rows.map(([v, t, sub]) => `<button type="button" role="radio" class="rrow" aria-checked="${val === v}" data-radio="${key}" data-val="${v}"><span class="mark">${ic('check')}</span><span class="tx"><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</span></button>`).join('')}</div>`;
function finishBody(s) {
  const f = s.fin, complaint = s.sub === 'COMPLAINT', n = f.note.length;
  const forced = s.role === 'reassigner';
  return `${forced ? al('warn', ic('users', 'sm'), `Vas a finalizar la conversación de ${OTHER}`, `${OTHER} ya no podrá escribirle a ${CF}. El bot se despide y retoma la conversación.`) : ''}
  ${!forced && !idle(s) ? al('info', ic('message', 'sm'), `${CF} escribió hace ${Math.max(1, silentMin(s))} min`, 'Al finalizar, el bot se despide y retoma la conversación. Si falta algo, escríbelo antes.') : ''}
  ${!forced && idle(s) ? `<p class="p2">${CF} no escribe desde hace ${winEff(s) === 'closed' ? 'más de 24 h' : dur(silentMin(s))}. El bot se despide y retoma la conversación.</p>` : ''}
  <div class="field"><label class="lbl" for="f-note">Nota interna</label>
  <textarea class="ctl" id="f-note" data-fnote rows="3" aria-invalid="${!!f.err?.note}" aria-describedby="f-note-h">${esc(f.note)}</textarea>
  <div class="row-between"><span class="help" id="f-note-h">Solo la ve el personal. No se envía a ${CF}.</span><span class="counter fig" id="f-cnt">${n} / 1,000</span></div>
  ${f.err?.note ? `<p class="err">${ic('alert', 'xs')}<span>${f.err.note}</span></p>` : ''}</div>
  ${complaint ? `<fieldset class="field fs"><legend class="lbl">¿Cómo se resolvió la queja?</legend><p class="help">Solo se registra para las métricas. No crea la devolución, el reemplazo ni el reembolso: eso se hace en Ventas.</p>${radios('outcome', OUTCOMES, f.outcome, 'Resultado de la queja')}${f.err?.outcome ? `<p class="err" id="f-out-err">${ic('alert', 'xs')}<span>${f.err.outcome}</span></p>` : ''}</fieldset>` : ''}`;
}
const finishFoot = (s, cancel = 'Cancelar') => `<button type="button" class="btn ghost" data-dlg-close>${cancel}</button><button type="button" class="btn primary" data-finish-submit ${s.fin.busy ? 'disabled' : ''}>${s.fin.busy ? '<span class="spin" aria-hidden="true"></span>Finalizando…' : `${ic('check-circle', 'sm')}${s.role === 'reassigner' ? 'Finalizar en su lugar' : 'Finalizar conversación'}`}</button>`;
const finishSub = s => s.role === 'reassigner' ? `Solicitud S-000412 · la atiende ${OTHER}` : `Solicitud S-000412 · ${SUBT[s.sub]} de ${CUST}`;
function tplBody(s) {
  return `<p>Vas a enviarle a ${CF} una <b>plantilla aprobada de WhatsApp</b>, porque la ventana de 24 h está cerrada.</p>
  <dl class="kv tplkv"><dt>Plantilla</dt><dd><b>${TPL.name}</b><br><span class="p2">El texto lo define la plantilla aprobada en WhatsApp; aquí no se edita.</span></dd><dt>Costo</dt><dd>${TPL.cost}</dd><dt>Cuántas</dt><dd>Una sola por ventana cerrada.</dd></dl>
  ${al('info', ic('info', 'sm'), 'Qué pasa después', `No podrás escribirle hasta que ${CF} responda. Cuando lo haga, la ventana se abre y el cuadro de mensaje vuelve a funcionar.`)}`;
}
const tplFoot = s => `<button type="button" class="btn ghost" data-dlg-close>Cancelar</button><button type="button" class="btn primary" data-tpl-confirm ${s.tplBusy ? 'disabled' : ''}>${s.tplBusy ? '<span class="spin" aria-hidden="true"></span>Enviando…' : `${ic('receipt', 'sm')}Enviar plantilla`}</button>`;

/* ---- actions (rail, header or bar, depending on the direction) ---- */
function actionsHTML(s) {
  if (s.session === 'WAITING') return `<button type="button" class="btn primary block" data-claim>${ic('user', 'sm')}Atender</button><p class="help">Atender la toma y el bot se calla. Si no confirma a tiempo, vuelve a Nueva.</p>`;
  if (s.session === 'STARTING') return al('info', ic('clock', 'sm'), 'Conectando…', 'Las acciones se habilitan cuando el bot confirme. Mientras hay una sesión no se puede liberar ni cancelar.');
  if (s.session === 'ENDING' || s.session === 'ENDED') return al('success', ic('check-circle', 'sm'), 'Solicitud resuelta', `Finalizó ${assignee(s)}${mine(s) ? ' (tú)' : ''}.`);
  if (mine(s)) return `<button type="button" class="btn primary block" data-finish-open>${ic('check-circle', 'sm')}Finalizar conversación</button>${s.role === 'me' ? `<button type="button" class="btn block" data-noop>${ic('swap', 'sm')}Reasignar…</button>` : ''}<p class="help">${ic('info', 'xs')} Liberar no está disponible con una conversación en vivo: la salida es finalizarla o reasignarla.</p>`;
  if (s.role === 'reassigner') return `${al('info', ic('lock', 'sm'), `La atiende ${OTHER}`, 'Solo esa persona puede escribir.')}<button type="button" class="btn block" data-noop>${ic('swap', 'sm')}Reasignar…</button><button type="button" class="btn block" data-finish-open>${ic('check-circle', 'sm')}Finalizar en su lugar…</button>`;
  return `${al('info', ic('lock', 'sm'), `La atiende ${OTHER}`, 'Solo puedes verla. Reasignar o finalizar por otra persona requiere el permiso de reasignación.')}`;
}

/* ---- app shell and artboard tools ---- */
const COUNTNEW = 4;
function shell(crumbs, content) {
  const nav = (i, l) => `<li><a href="#" data-noop>${ic(i, 'sm')}${l}</a></li>`;
  return `<div class="app"><aside class="side" aria-label="Menú principal"><div class="brand"><span class="brand-mark" aria-hidden="true">${ic('paw', 'sm')}</span>HoundFe</div>
  <div class="tenant"><span class="tenant-tile" aria-hidden="true">C</span><span><strong>Sucursal Centro</strong><small>Guadalajara</small></span></div>
  <nav class="nav" aria-label="Módulos"><ul>${nav('home', 'Resumen')}</ul><p class="nav-group">POS</p><ul>${nav('cart', 'Ventas')}${nav('package', 'Productos')}${nav('users', 'Clientes')}${nav('truck', 'Rutas de entrega')}</ul>
  <p class="nav-group">Chatbot</p><ul><li><a href="#" data-noop aria-current="page" class="sub">${ic('inbox', 'sm')}Solicitudes<span class="count fig" aria-label="${COUNTNEW} nuevas">${COUNTNEW}</span></a></li></ul></nav>
  <div class="side-foot"><span class="avatar" aria-hidden="true">LM</span><span>${ME}<small>Gerente</small></span></div></aside>
  <div class="col"><header class="topbar"><nav class="crumbs" aria-label="Ruta">${crumbs}</nav><span class="spacer"></span><button type="button" class="icon-btn" aria-label="Notificaciones, 3 sin leer">${ic('bell')}<span class="dotc fig" aria-hidden="true">3</span></button></header>${content}</div></div>`;
}
const crumbs = () => `<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><a href="#" data-noop>Solicitudes</a><span aria-hidden="true">/</span><span aria-current="page">S-000412</span>`;
const opt = (v, t, cur) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${t}</option>`;
function toolsHTML(extra = '') {
  return `<div class="tools" role="group" aria-label="Opciones del artboard"><button type="button" id="t-theme"></button>
  <label>Sesión <select id="t-session">${opt('STARTING', 'Conectando…', S.session)}${opt('ACTIVE', 'Activa', S.session)}${opt('ENDING', 'Terminando…', S.session)}${opt('ENDED', 'Terminada', S.session)}${opt('WAITING', 'Sin confirmar (volvió a Nueva)', S.session)}</select></label>
  <label>Ventana <select id="t-win">${opt('open', 'Abierta', S.win)}${opt('soon', 'Cierra en 1 h 24 min', S.win)}${opt('closed', 'Cerrada', S.win)}</select></label>
  <label>Cliente <select id="t-cust">${opt('active', 'Escribió hace 1 min', S.cust)}${opt('idle', 'Sin escribir 38 min', S.cust)}</select></label>
  <label>Rol <select id="t-role">${opt('me', 'La atiendes tú', S.role)}${opt('me-scoped', 'La atiendes tú, sin ver todo el chat', S.role)}${opt('other', 'La atiende otra persona', S.role)}${opt('reassigner', 'Otra persona; puedes reasignar', S.role)}${opt('other-noconv', 'Otra persona; sin permiso de conversación', S.role)}</select></label>
  <label>Tipo <select id="t-sub">${opt('COMPLAINT', 'Queja', S.sub)}${opt('TALK_TO_HUMAN', 'Hablar con una persona', S.sub)}</select></label>
  <label>Hilo <select id="t-thread">${opt('normal', 'Conversación normal', S.thread)}${opt('states', 'Todos los estados de entrega', S.thread)}</select></label>
  <label>Próximo envío <select id="t-next">${opt('ok', 'Sale bien', S.next)}${opt('stuck', 'Se queda en cola', S.next)}${opt('deferred', 'WhatsApp cierra la ventana', S.next)}${opt('failed', 'Falla', S.next)}</select></label>
  <label>Plantilla <select id="t-tpl">${opt('ready', 'Disponible', S.tpl)}${opt('pending', 'Ya enviada', S.tpl)}${opt('failed', 'Falló', S.tpl)}${opt('unknown', 'Entrega dudosa', S.tpl)}${opt('none', 'Sin configurar', S.tpl)}</select></label>
  <button type="button" id="t-in">${ic('message', 'sm')}El cliente escribe</button><button type="button" id="t-conn" aria-pressed="false">${ic('wifi-off', 'sm')}Sin conexión</button>${extra}<span class="grow"></span><button type="button" id="t-notes" aria-pressed="false">${ic('info', 'sm')}Notas</button></div>`;
}
function toast(title, desc, icon = 'check-circle') {
  const t = document.createElement('div'); t.className = 'toast';
  setHTML(t, `<span class="tile">${ic(icon)}</span><div><strong>${esc(title)}</strong>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`);
  let host = $('#toasts'); if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
  host.appendChild(t); setTimeout(() => t.remove(), 4500);
}

/* ---- interactive wiring (boards 01 to 03) ---- */
let S = mk(), seq = 0;
const HOSTS = {};
function paint(...ids) {
  const th = $('#h-thread'), was = th ? th.scrollHeight - th.scrollTop - th.clientHeight < 60 : true;
  (ids.length ? ids : Object.keys(HOSTS)).forEach(id => {
    const el = $('#h-' + id); if (!el || !HOSTS[id]) return;
    const keep = id === 'comp' && document.activeElement && document.activeElement.id === 'draft' ? [document.activeElement.selectionStart, document.activeElement.selectionEnd] : null;
    setHTML(el, HOSTS[id](S));
    if (keep && $('#draft')) { $('#draft').focus(); $('#draft').setSelectionRange(...keep); }
    if (id === 'comp') grow();
  });
  const t2 = $('#h-thread'); if (t2 && (was || S.stick)) t2.scrollTop = t2.scrollHeight;
  S.stick = false;
}
const grow = () => { const t = $('#draft'); if (t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 168) + 'px'; } };
function syncComposer() {
  const t = $('#draft'); if (!t) return;
  S.draft = t.value; const n = S.draft.length, lim = S.attach ? 1024 : 4096, over = n > lim;
  const c = $('#cnt'); c.textContent = `${fmtN(n)} / ${fmtN(lim)}`; c.classList.toggle('near', n > lim - 300); c.classList.toggle('over', over);
  $('#send').disabled = over || !((S.attach && S.attach.status === 'ready') || (!S.attach && S.draft.trim()));
  $('.comp-box').classList.toggle('bad', over);
  const had = $('#over-err'); if (over && !had) paint('comp'); else if (!over && had) paint('comp');
  grow();
}
function deliver(m) {
  const set = (st, ms, extra) => setTimeout(() => { m.status = st; if (extra) extra(); paint('thread'); }, ms);
  if (S.next === 'stuck') setTimeout(() => { m.age = 48; paint('thread'); }, 2500);
  else if (S.next === 'failed') set('FAILED', 900);
  else if (S.next === 'deferred') { set('SENT', 700); set('DEFERRED', 1800, () => { S.deferred = true; paint('banner', 'comp', 'head', 'rail'); }); }
  else { set('SENT', 700); set('DELIVERED', 1700); set('READ', 3200); }
}
function sendNow(txt, att, retryOf) {
  const m = { id: 'n' + (++seq), dir: 'OUT', author: 'STAFF', type: att ? (att.kind === 'PDF' ? 'DOCUMENT' : 'IMAGE') : 'TEXT', text: txt, media: att ? { name: att.name, size: att.size } : null, at: nowM(S), day: 0, status: 'QUEUED', age: 0 };
  S.sent.push(m); S.stick = true; paint('thread'); deliver(m);
}
function submitMsg() {
  const a = S.attach, t = S.draft.trim();
  if ((a && a.status !== 'ready') || (!a && !t) || t.length > (a ? 1024 : 4096)) return;
  sendNow(t, a); S.draft = ''; S.attach = null; paint('comp');
}
function dlgClose() { S.dlg = null; S.tplBusy = false; S.fin.busy = false; paint('dlg', 'comp', 'rail'); }
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-noop]')) { e.preventDefault(); return; }
  const rt = t.closest('[data-retry]'); if (rt) { const m = S.sent.concat(items(S)).find(x => x.id === rt.dataset.retry); if (m) { m.retried = true; sendNow(m.text, m.media ? { kind: m.type === 'DOCUMENT' ? 'PDF' : 'IMAGE', ...m.media } : null); } return; }
  const rs = t.closest('[data-resend]'); if (rs) { const m = items(S).find(x => x.id === rs.dataset.resend); if (m) { m.retried = true; sendNow(m.text, null); } return; }
  if (t.closest('[data-attach-toggle]')) { S.menu = !S.menu; paint('comp'); return; }
  const pk = t.closest('[data-pick]'); if (pk) {
    const f = FILES[pk.dataset.pick]; S.menu = false;
    if (f.err) S.attach = { ...f, status: 'error', pct: 0 };
    else { S.attach = { ...f, status: 'uploading', pct: 55 }; setTimeout(() => { if (S.attach && S.attach.name === f.name) { S.attach.status = 'ready'; S.attach.pct = 100; paint('comp'); } }, 1400); }
    paint('comp'); return;
  }
  if (t.closest('[data-attach-clear]')) { S.attach = null; paint('comp'); return; }
  if (S.menu && !t.closest('.menu-wrap')) { S.menu = false; paint('comp'); }
  if (t.closest('[data-tpl-open]')) { S.dlg = 'tpl'; paint('dlg'); const b = $('[data-tpl-confirm]'); if (b) b.focus(); return; }
  if (t.closest('[data-tpl-confirm]')) {
    S.tplBusy = true; paint('dlg');
    setTimeout(() => { S.tplBusy = false; S.dlg = null; S.tpl = 'pending'; S.stick = true; paint('dlg', 'thread', 'comp'); toast('Plantilla enviada', `Esperamos la respuesta de ${CF}.`, 'receipt'); }, 900); return;
  }
  if (t.closest('[data-finish-open]')) { S.fin = { note: '', outcome: '', err: null, busy: false }; S.dlg = 'finish'; paint('dlg'); const b = $('#f-note'); if (b) b.focus(); return; }
  if (t.closest('[data-dlg-close]')) { dlgClose(); return; }
  const rd = t.closest('[data-radio]'); if (rd) { S.fin.outcome = rd.dataset.val; S.fin.err = { ...(S.fin.err || {}), outcome: null }; paint('dlg'); const r = $(`[data-val="${rd.dataset.val}"]`); if (r) r.focus(); return; }
  if (t.closest('[data-finish-submit]')) {
    const err = {}; if (!S.fin.note.trim()) err.note = 'Escribe una nota interna para cerrar la conversación.';
    if (S.sub === 'COMPLAINT' && !S.fin.outcome) err.outcome = 'Elige cómo se resolvió la queja. Es obligatorio para finalizar una queja.';
    if (Object.keys(err).length) { S.fin.err = err; paint('dlg'); const f = $(err.note ? '#f-note' : '[data-radio]'); if (f) f.focus(); return; }
    S.fin.busy = true; paint('dlg');
    setTimeout(() => {
      S.note = S.fin.note.trim(); S.outcome = S.sub === 'COMPLAINT' ? S.fin.outcome : null; S.fin.busy = false; S.dlg = null; S.session = 'ENDING'; S.stick = true;
      paint(); toast('Conversación finalizada', `El bot se despide de ${CF} y retoma la conversación.`);
      setTimeout(() => { if (S.session === 'ENDING') { S.session = 'ENDED'; paint(); const sel = $('#t-session'); if (sel) sel.value = 'ENDED'; } }, 3500);
    }, 900); return;
  }
  if (t.closest('[data-claim]')) { S.session = 'STARTING'; S.elapsed = 0; S.claimed = true; paint(); const sel = $('#t-session'); if (sel) sel.value = 'STARTING'; return; }
  if (t.closest('[data-pill]')) { const n = $('.scroll-t'); if (n) n.scrollTop = n.scrollHeight; return; }
  if (t.closest('#t-theme')) { document.documentElement.classList.toggle('dark'); paintTheme(); return; }
  if (t.closest('#t-in')) {
    if (winEff(S) === 'closed' && S.win === 'closed' && S.tpl === 'pending') { S.winOpened = true; S.tpl = 'pending'; }
    else if (winEff(S) === 'closed') { toast('Con la ventana cerrada, el cliente no escribe sola', 'Envía la plantilla y luego simula la respuesta.', 'info'); return; }
    S.extra.push(cIn('x' + (++seq), nowM(S), 'Perdón, ¿a qué hora me lo traen?')); S.stick = true; S.cust = 'active'; paint(); return;
  }
  if (t.closest('#t-conn')) { const b = t.closest('#t-conn'); S.conn = S.conn === 'lost' ? 'ok' : 'lost'; b.setAttribute('aria-pressed', String(S.conn === 'lost')); paint('banner'); return; }
  if (t.closest('#t-notes')) { const n = $('#notes'), b = t.closest('#t-notes'); n.hidden = !n.hidden; b.setAttribute('aria-pressed', String(!n.hidden)); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'draft') syncComposer();
  if (e.target.id === 'f-note') { S.fin.note = e.target.value; $('#f-cnt').textContent = `${fmtN(S.fin.note.length)} / 1,000`; }
});
document.addEventListener('submit', e => { if (e.target.matches('[data-form]')) { e.preventDefault(); submitMsg(); } });
document.addEventListener('keydown', e => {
  if (e.target.id === 'draft' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitMsg(); }
  if (e.key === 'Escape') { if (S.menu) { S.menu = false; paint('comp'); } else if (S.dlg) dlgClose(); }
});
const RESET = ['win', 'thread'];
document.addEventListener('change', e => {
  const m = { 't-session': 'session', 't-win': 'win', 't-cust': 'cust', 't-role': 'role', 't-sub': 'sub', 't-thread': 'thread', 't-next': 'next', 't-tpl': 'tpl' }[e.target.id];
  if (!m) return;
  S[m] = e.target.value;
  if (RESET.includes(m)) Object.assign(S, { sent: [], extra: [], deferred: false, winOpened: false });
  if (m === 'session') { S.elapsed = 42; S.claimed = false; }
  S.fin = { note: '', outcome: '', err: null, busy: false }; S.dlg = null; paint();
});
function paintTheme() { const d = document.documentElement.classList.contains('dark'); setHTML($('#t-theme'), `${ic(d ? 'moon' : 'sun', 'sm')}${d ? 'Oscuro' : 'Claro'}`); }
function measureTools() { document.documentElement.style.setProperty('--tools-h', $('.tools').offsetHeight + 'px'); }
function mountTools(extra) { const h = document.createElement('div'); setHTML(h, toolsHTML(extra)); document.body.prepend(h.firstElementChild); paintTheme(); measureTools(); addEventListener('resize', measureTools); }
setInterval(() => { if (S.session === 'STARTING') { S.elapsed = (S.elapsed ?? 42) + 1; $$('[data-elapsed]').forEach(n => { n.textContent = `${Math.floor(S.elapsed / 60)}:${pad(S.elapsed % 60)}`; }); if (S.elapsed === 3 && S.claimed) { S.claimed = false; S.session = 'ACTIVE'; paint(); const sel = $('#t-session'); if (sel) sel.value = 'ACTIVE'; } } }, 1000);
