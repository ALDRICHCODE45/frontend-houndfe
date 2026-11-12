/* 04: static mobile frames built from the same builders (data.js, parts.js, detail.js) */
const withState = (mode, sc, fn, st = {}) => {
  const keep = { m: PERM.mode, sc: U.sc, form: U.form, conflict: U.conflict, f: U.f, err: U.err, h: HRS.closed };
  PERM.mode = mode; U.sc = sc; U.form = st.form || null; U.conflict = st.conflict || null; U.f = st.f || {}; U.err = st.err || {}; if (st.closed != null) HRS.closed = st.closed;
  try { return fn(); } finally { PERM.mode = keep.m; U.sc = keep.sc; U.form = keep.form; U.conflict = keep.conflict; U.f = keep.f; U.err = keep.err; HRS.closed = keep.h; }
};
const mtop = (title, sub, back) => `<div class="mbar">${back ? `<button type="button" class="icon-btn" aria-label="Volver">${ic('back')}</button>` : `<button type="button" class="icon-btn" aria-label="Abrir menú">${ic('menu')}</button>`}<div class="t">${sub ? `<div class="meta">${sub}</div>` : ''}<b class="ell">${title}</b></div><button type="button" class="icon-btn" aria-label="${back ? 'Más opciones' : 'Notificaciones, 3 sin leer'}">${ic(back ? 'dots' : 'bell')}${back ? '' : '<span class="dotc fig" aria-hidden="true">3</span>'}</button></div>`;
function mcard(r) {
  const open = r.status === 'NEW' || r.status === 'IN_PROGRESS';
  const end = open ? slaHTML(r, true) : (r.status === 'RESOLVED' ? `<span class="sla ok">${ic('check-circle', 'xs')}<span><b>Resuelta ${whenAt(r.closedAt)}</b></span></span>` : `<span class="sla none">${ic('ban', 'xs')}<span><b>Cancelada ${whenAt(r.closedAt)}</b></span></span>`);
  return `<article class="mc"><a href="#" class="stretch" data-noop>${esc(r.summary)}</a><div class="row2">${statusHTML(r, true)}<span class="folio">${r.folio}</span>${subHTML(r)}</div>${windowTag(r) ? `<div>${windowTag(r)}</div>` : ''}<div class="foot">${end}<span class="age fig">${ageOf(r.createdAt)}</span></div></article>`;
}
function mgroup(g, max) {
  const over = g.requests.filter(r => r.overdueAt).length;
  const show = g.requests.slice(0, max || 3);
  return `<section class="mgroup" aria-label="${esc(cname(g.customer))}"><div class="mgh"><span class="tone ${groupTone(g)}" aria-hidden="true"></span><span class="cn ell">${esc(cname(g.customer))}</span><span class="n fig">${g.openCount} abiertas${over ? ` · <b style="color:var(--hf-danger)">${over} vencidas</b>` : ''}</span></div>${show.map(mcard).join('')}${g.requests.length > show.length || g.moreRequests ? `<button type="button" class="btn sm mmore">${ic('down', 'sm')}Ver las ${g.openCount - show.length} restantes</button>` : ''}</section>`;
}
function inboxScreen(sim, closed) {
  return withState('mgr', 'restock', () => {
    let body;
    if (sim === 'loading') body = `<div class="mgroup">${[1, 2, 3].map(() => `<div class="mc"><span class="skel" style="width:75%"></span><span class="skel" style="width:45%"></span><span class="skel" style="width:30%;margin-top:8px"></span></div>`).join('')}</div><p class="sr">Cargando solicitudes</p>`;
    else if (sim === 'empty') body = `<section class="surface">${stateHTML('empty')}</section>`;
    else if (sim === 'error') body = `<section class="surface">${stateHTML('error')}</section>`;
    else body = [GROUPS[1], GROUPS[2], GROUPS[0]].map((g, i) => mgroup(g, i === 2 ? 2 : 3)).join('') + (closed ? '' : `<section class="surface" style="padding:12px">${legendM()}</section>`);
    const tab = (l, p, n) => `<button type="button" aria-pressed="${p}">${l}${n != null ? ` <span class="fig">${n}</span>` : ''}</button>`;
    return `${mtop('Solicitudes', 'Chatbot')}<div class="mscroll">${sim === 'error' || sim === 'empty' ? '' : ''}<p class="p2">${countLine()}</p>${closed ? `<div class="alert info" role="status">${ic('moon', 'sm')}<div><strong>Fuera de horario</strong>Los tiempos están en pausa y se reanudan ${whenAt(RESUME)}.</div></div>` : ''}
    <div class="mtabs"><div class="seg" role="group" aria-label="Estado">${tab('Abiertas', true, 11)}${tab('Agendadas', false, 1)}${tab('Resueltas', false)}${tab('Canceladas', false)}</div></div>
    <div class="search"><label class="sr" for="mq">Buscar</label>${ic('search', 'sm')}<input class="ctl" id="mq" type="search" placeholder="Folio o nombre del cliente" autocomplete="off"></div>
    <div class="mchips" role="group" aria-label="Filtros"><button type="button" class="chip" aria-pressed="true">Mías <span class="n">2</span></button><button type="button" class="chip" aria-pressed="false">Vencidas <span class="n">3</span></button><button type="button" class="chip" aria-pressed="false">Sin responsable</button><button type="button" class="chip" aria-pressed="false">Ventana por cerrar <span class="n">3</span></button></div>${body}</div>`;
  }, { closed: !!closed });
}
const legendM = () => `<div class="legendm"><span class="sla ok">${ic('clock', 'xs')}<b>Más de la mitad del tiempo</b></span><span class="sla warn">${ic('clock', 'xs')}<b>Menos de la mitad</b></span><span class="sla bad">${ic('alert', 'xs')}<b>Cerca de vencer o vencida</b></span><span class="sla pause">${ic('pause', 'xs')}<b>En pausa · se reanuda mañana 9:00</b></span><span class="sla sched">${ic('calendar', 'xs')}<b>Agendada · mar 10:30</b></span></div>`;

function detailScreen(mode, sc, st = {}) {
  return withState(mode, sc, () => {
    const d = cur(), r = d.row, A = allowedActions(d), s = slaOf(r);
    const prim = A.includes('CLAIM') ? 'CLAIM' : A.includes('RESOLVE') ? 'RESOLVE' : null;
    const rest = A.filter(a => a !== prim && (SECOND[a] || a === 'RESOLVE'));
    const bar = prim ? `<div class="sbar ${rest.length ? '' : 'one'}">${rest.length ? `<button type="button" class="btn" aria-label="Más acciones" style="padding:0">${ic('dots', 'sm')}</button>` : ''}<button type="button" class="btn primary">${ic(PRIMARY[prim][1], 'sm')}${PRIMARY[prim][0]}</button></div>`
      : rest.length ? `<div class="sbar one"><button type="button" class="btn">${ic('dots', 'sm')}Acciones (${rest.length})</button></div>` : '';
    const limited = mode === 'cashier' ? `<div class="alert info" role="note">${ic('lock', 'sm')}<div><strong>Vista limitada por tu rol</strong>Sin teléfono completo, conversación ni «Resolver». El resumen y las acciones permitidas siguen disponibles.</div></div>` : '';
    const cons = st.conflict ? conflictHTML() : '';
    const sheet = st.form ? `<div class="msheet"><div class="in"><div class="grab" aria-hidden="true"></div><div class="hd"><h2>${{ cancel: 'Cancelar solicitud', resolve: 'Resolver', merge: 'Unir', link: 'Vincular cliente', reassign: 'Reasignar' }[st.form]}</h2><button type="button" class="icon-btn" aria-label="Cerrar">${ic('x')}</button></div><div class="bd">${formHTML(d)}</div></div></div>` : '';
    return `${mtop(`${esc(SUB[r.subtype][0])} · ${esc(cname(d.customer))}`, `${statusHTML(r, true)}<span class="folio">${r.folio}</span>`, true)}<div class="mscroll">${limited}${cons}
    <div class="slastrip"><div>${s ? slaHTML(r) : '<span class="p2">Cerrada</span>'}</div>${r.assignee ? `<span class="p2 ell">${esc(r.assignee.id === ME.id ? 'La atiendes tú' : 'La atiende ' + r.assignee.displayName)}</span>` : '<span class="p2">Sin responsable</span>'}</div>
    <section class="panel"><h2>Resumen del bot</h2><p class="quote">${esc(r.summary)}</p></section>${decisionHTML(d)}${customerCardHTML(d)}${needsHTML(d)}${convoHTML(d)}${otherHTML(d)}${auditHTML(d)}</div>${st.form ? '' : bar}${sheet}`;
  }, st);
}
const frame = (cap, sub, inner) => `<figure class="phone"><figcaption>${cap}<small>${sub}</small></figcaption><div class="screen">${inner}</div></figure>`;
function build() {
  const gal = [
    frame('1 · Bandeja', 'GET /groups + /counts · tarjetas por grupo', inboxScreen('ok')),
    frame('2 · Detalle', 'Reposición vencida, en atención por ti', detailScreen('mgr', 'restock')),
    frame('3 · Acción: cancelar con mensaje', 'Pregunta del bot · «Mensaje para el cliente» ≤ 500', detailScreen('mgr', 'unknown', { form: 'cancel', f: { crs: 'NOT_ACTIONABLE', cn: 'Por ahora no podemos ayudarte con eso, gracias por escribirnos.' } })),
    frame('4 · Cargando', 'Esqueletos con el espacio final', inboxScreen('loading')),
    frame('5 · Vacía', 'Sin solicitudes abiertas', inboxScreen('empty')),
    frame('6 · Error de carga', 'Nada se perdió; solo lectura', inboxScreen('error')),
    frame('7 · Vista limitada', 'Cajero: teléfono enmascarado, sin conversación ni Resolver', detailScreen('cashier', 'zone')),
    frame('8 · Conflicto 409', 'REQUEST_CLAIMED_BY_OTHER con lo escrito conservado', detailScreen('mgr', 'unknown', { conflict: 'REQUEST_CLAIMED_BY_OTHER' })),
    frame('9 · Fuera de horario', 'slaPaused: «se reanuda mañana 9:00»', inboxScreen('ok', true))
  ];
  setHTML($('#root'), gal.join(''));
}
window.redraw = build;
mountTools('');
injectIcons();
$('#t-perm').closest('label').hidden = true; $('#t-hours').closest('label').hidden = true;
initTools(build);
$('#root').addEventListener('click', e => { const b = e.target.closest('button,a'); if (b) { e.preventDefault(); e.stopPropagation(); } }, false);
build();
