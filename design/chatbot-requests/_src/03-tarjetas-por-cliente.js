/* Direction C behaviour */
const V = { view: 'list', sim: 'ok', drill: null, tab: 'sum', pages: {} };
const SCC = { RESTOCK: 'restock', EXPIRATION: 'expiration', DELIVERY_ZONE: 'zone', TRANSFER_RECEIPT: 'receipt', UNKNOWN_QUESTION: 'unknown', TALK_TO_HUMAN: 'unknown', COMPLAINT: 'unknown' };
const closedLine = r => r.status === 'RESOLVED' ? `<span class="sla ok">${ic('check-circle', 'xs')}<span><b>Resuelta ${whenAt(r.closedAt)}</b></span></span>` : `<span class="sla none">${ic('ban', 'xs')}<span><b>Cancelada ${whenAt(r.closedAt)}</b></span></span>`;
function crHTML(r) {
  const open = r.status === 'NEW' || r.status === 'IN_PROGRESS';
  return `<button type="button" class="cr" data-open="${r.id}"><span class="l1">${ic(SUB[r.subtype][1], 'sm')}<span class="name ell">${esc(r.summary)}</span></span><span class="l2"><span class="folio">${r.folio}</span>${statusHTML(r, true)}${open ? slaHTML(r, true) : closedLine(r)}</span>${windowTag(r) ? `<span class="l2">${windowTag(r)}</span>` : ''}</button>`;
}
function cardHTML(g) {
  const tone = groupTone(g), over = g.requests.filter(r => r.overdueAt).length, show = g.requests.slice(0, 4), rest = g.openCount > 4 ? (g.openCount || g.requests.length) : 0;
  const n = INB.tab === 'open' || INB.tab === 'scheduled' ? `${g.openCount} abiertas` : `${g.requests.length} ${INB.tab === 'resolved' ? 'resueltas' : 'canceladas'}`;
  return `<article class="cc ${over ? 'hot' : ''}" aria-label="${esc(cname(g.customer))}"><div class="stripe ${tone}" aria-hidden="true"></div><div class="cc-head"><span class="avatar" aria-hidden="true">${g.customer.id ? initials(g.customer.displayName) : '?'}</span>
  <div class="tx"><div class="cn ell">${esc(cname(g.customer))}</div><div class="ph2 fig">${ic('phone', 'xs')}${esc(phoneOf(g.customer))}${g.customer.isTrusted ? '<span class="badge success" style="height:20px">De confianza</span>' : ''}</div></div>
  <div class="cnt"><div class="fig">${n}</div>${over ? `<div style="color:var(--hf-danger)">${over} vencida${over > 1 ? 's' : ''}</div>` : ''}</div></div>
  <div class="cc-ul">${show.map(crHTML).join('')}</div>${rest ? `<div class="cc-foot"><button type="button" class="btn ghost sm" data-drill="${g.customerKey}">Ver las ${g.openCount}${ic('right', 'sm')}</button></div>` : ''}</article>`;
}
function listBody() {
  if (V.sim === 'loading') return `<div class="cgrid">${[1, 2, 3].map(() => `<div class="cc">${skelRows(3)}</div>`).join('')}</div>`;
  if (V.sim === 'error') return `<section class="surface">${stateHTML('error')}</section>`;
  if (V.sim === 'forbidden') return `<section class="surface">${stateHTML('forbidden')}</section>`;
  if (V.sim === 'empty') return `<section class="surface">${stateHTML('empty')}</section>`;
  const gs = queryGroups();
  if (!gs.length) return `<section class="surface">${stateHTML(anyFilter() ? 'nomatch' : 'empty')}</section>`;
  return `<div class="cgrid">${gs.map(cardHTML).join('')}</div>${INB.tab === 'open' ? `<section class="surface">${legendHTML()}</section>` : ''}<div style="display:flex;justify-content:center"><button type="button" class="btn" data-noop>Cargar más clientes</button></div>`;
}
function drillHTML() {
  const g = GROUPS.find(x => x.customerKey === V.drill), more = g.moreRequests;
  return `<div class="drill"><div><button type="button" class="btn sm" data-undrill>${ic('back', 'sm')}Volver a las tarjetas</button></div>
  <div class="title-row"><h1 class="page-title" style="font-size:24px">${esc(cname(g.customer))}</h1><span class="badge warning dot fig">${g.openCount} abiertas</span><span class="p2 fig">${ic('phone', 'xs')} ${esc(phoneOf(g.customer))}</span></div>
  <section class="surface" aria-label="Solicitudes del cliente">${g.requests.map(crHTML).join('')}${more ? `<div class="cc-foot" style="display:flex;justify-content:space-between;align-items:center"><span class="p2">Mostrando ${g.requests.length} de ${g.openCount}</span>${V.pages[g.customerKey] ? '<span class="p2">Restantes cargadas</span>' : `<button type="button" class="btn sm" data-more="${g.customerKey}">${ic('down', 'sm')}Ver las ${more} restantes</button>`}</div>` : ''}</section></div>`;
}
function listHTML() {
  const total = COUNTS.new + COUNTS.inProgress;
  const content = `<div class="scroll"><main class="page" aria-labelledby="ptitle"><div style="display:grid;gap:6px"><div class="title-row"><h1 class="page-title" id="ptitle" tabindex="-1">Solicitudes</h1><span class="badge warning dot fig">${total} abiertas</span></div><p class="page-sub">${countLine()}. Una tarjeta por cliente; las más urgentes primero.</p></div>
  ${hoursBanner()}${V.drill ? '' : `<section class="surface"><div class="toolbar">${filterBarHTML()}</div><div class="toolbar">${filterRowHTML()}</div></section>`}
  <div id="results" aria-live="polite">${V.drill ? drillHTML() : listBody()}</div></main></div>`;
  return shell('<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><span aria-current="page">Solicitudes</span>', content, { list: true });
}
function barHTML(d) {
  const r = d.row, A = allowedActions(d), s = slaOf(r), closed = r.status === 'RESOLVED' || r.status === 'CANCELLED';
  const btn = (a, p) => `<button type="button" class="btn ${p ? 'primary' : a === 'CANCEL' ? 'danger' : ''}" data-act="${a}">${ic((PRIMARY[a] || SECOND[a])[1], 'sm')}${(PRIMARY[a] || SECOND[a])[0]}</button>`;
  const prim = A.includes('CLAIM') ? 'CLAIM' : A.includes('RESOLVE') ? 'RESOLVE' : null;
  const rest = A.filter(a => a !== prim && (SECOND[a] || a === 'RESOLVE'));
  const note = closed ? `<span class="p2">${ic('lock', 'xs')} Cerrada: sin acciones</span>` : !A.length ? `<span class="p2">${ic('lock', 'xs')} ${r.assignee && r.assignee.id !== ME.id ? 'La atiende ' + esc(r.assignee.displayName) + ': solo lectura' : 'Tu rol no tiene acciones aquí'}</span>` : '';
  return `<div class="bar" role="toolbar" aria-label="Acciones de la solicitud">${s ? slaHTML(r, false).replace('<small>', '<small>') : '<span class="sla none"><b>Sin límite</b></span>'}${note}${rest.map(a => btn(a)).join('')}${prim ? btn(prim, true) : ''}</div>`;
}
function tabBody(d) {
  if (V.tab === 'conv') return `<div class="tabbody">${convoHTML(d)}</div>`;
  if (V.tab === 'act') return `<div class="tabbody">${auditHTML(d)}</div>`;
  return `<div class="tabbody"><section class="panel"><h2>Resumen del bot</h2><p class="quote">${esc(d.row.summary)}</p></section>${decisionHTML(d)}<div class="two">${customerCardHTML(d)}${needsHTML(d)}</div>${otherHTML(d)}</div>`;
}
function sheetHTML(d) {
  const A = allowedActions(d); if (!U.form || !A.length) return '';
  return `<div class="sheet-scrim" data-back></div><aside class="sheet" role="dialog" aria-modal="true" aria-label="Acción sobre ${d.row.folio}"><div class="sheet-head"><div class="t"><p class="meta">${d.row.folio} · ${esc(cname(d.customer))}</p><h2>${{ resolve: 'Resolver', cancel: 'Cancelar', reassign: 'Reasignar', merge: 'Unir', link: 'Vincular cliente' }[U.form]}</h2></div><button type="button" class="icon-btn" style="margin:-8px -10px 0 0" data-back aria-label="Cerrar panel">${ic('x')}</button></div>
  <div class="sheet-body" id="act">${U.conflict ? conflictHTML() : ''}${formHTML(d)}</div></aside>`;
}
function detailHTML() {
  const d = cur(), r = d.row, A = allowedActions(d);
  const tab = (k, l, n) => `<button type="button" role="tab" data-tab2="${k}" aria-selected="${V.tab === k}">${l}${n ? ` <span class="badge fig">${n}</span>` : ''}</button>`;
  const content = `<div class="dcol"><header class="dh"><div class="back"><button type="button" class="icon-btn" data-list aria-label="Volver a Solicitudes">${ic('back')}</button><div class="meta">${statusHTML(r, true)}<span class="folio">${r.folio}</span><span>${KIND[r.kind]} · ${SUB[r.subtype][0]}</span><span>Creada ${shortDate(r.createdAt)}</span></div></div>
  <h1>${esc(SUB[r.subtype][0])} · ${esc(cname(d.customer))}</h1><div class="tabs" role="tablist">${tab('sum', 'Resumen')}${tab('conv', 'Conversación')}${tab('act', 'Actividad', d.audit.length)}</div></header>
  ${barHTML(d)}<div class="dscroll">${!U.form && U.conflict ? `<div class="tabbody" style="padding-bottom:0">${conflictHTML()}</div>` : ''}${tabBody(d)}</div></div>${sheetHTML(d)}`;
  return shell(`<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><a href="#" data-list>Solicitudes</a><span aria-hidden="true">/</span><span aria-current="page">${r.folio}</span>`, content);
}
window.redraw = function () {
  const wrap = $('#root'), sc = $('.scroll, .dscroll', wrap), top = sc ? sc.scrollTop : 0, id = document.activeElement && document.activeElement.id;
  setHTML(wrap, V.view === 'list' ? listHTML() : detailHTML());
  const s2 = $('.scroll, .dscroll', wrap); if (s2) s2.scrollTop = top;
  if (id && $('#' + id)) $('#' + id).focus();
};
document.addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest('[data-tab]'); if (tab) { INB.tab = tab.dataset.tab; window.redraw(); return; }
  const t2 = t.closest('[data-tab2]'); if (t2) { V.tab = t2.dataset.tab2; window.redraw(); return; }
  const ch = t.closest('[data-chip]'); if (ch) { INB[ch.dataset.chip] = !INB[ch.dataset.chip]; window.redraw(); return; }
  const dr = t.closest('[data-drill]'); if (dr) { V.drill = dr.dataset.drill; window.redraw(); return; }
  if (t.closest('[data-undrill]')) { V.drill = null; window.redraw(); return; }
  const mo = t.closest('[data-more]'); if (mo) { V.pages[mo.dataset.more] = true; toast('Se cargaron las solicitudes restantes', 'GET /chatbot-requests?customerKey=…'); window.redraw(); return; }
  if (t.closest('[data-clear]')) { Object.assign(INB, { mine: false, none: false, over: false, win: false, sub: '', q: '' }); window.redraw(); return; }
  if (t.closest('[data-retry]')) { V.sim = 'ok'; $('#t-list').value = 'ok'; window.redraw(); return; }
  const op = t.closest('[data-open]'); if (op) { const all = GROUPS.concat(CLOSED.resolved, CLOSED.cancelled).flatMap(g => g.requests), r = all.find(x => x.id === op.dataset.open); U.sc = SCC[r.subtype] || 'restock'; U.form = null; U.f = {}; U.conflict = null; V.tab = 'sum'; V.view = 'detail'; $('#t-view').value = 'detail'; $('#t-sc').value = U.sc; if (!rowById(r.id)) toast('Detalle de ejemplo', 'Las solicitudes cerradas abren el mismo detalle de muestra.', 'info'); window.redraw(); return; }
  if (t.closest('[data-list]')) { V.view = 'list'; $('#t-view').value = 'list'; window.redraw(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && U.form) { U.form = null; window.redraw(); } });
document.addEventListener('input', e => { if (e.target.id === 'q') { INB.q = e.target.value; const pos = e.target.selectionStart; window.redraw(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); } });
document.addEventListener('change', e => { if (e.target.id === 'subf') { INB.sub = e.target.value; window.redraw(); } });
const extra = `<label>Vista <select id="t-view"><option value="list">Bandeja</option><option value="detail">Detalle</option></select></label>
<label>Lista <select id="t-list"><option value="ok">Con datos</option><option value="loading">Cargando</option><option value="empty">Vacía</option><option value="error">Error</option><option value="forbidden">Sin permiso</option></select></label>${scToolHTML()}${simToolHTML()}`;
mountTools(extra);
injectIcons();
$('#t-view').addEventListener('change', e => { V.view = e.target.value; window.redraw(); });
$('#t-list').addEventListener('change', e => { V.sim = e.target.value; window.redraw(); });
initTools(() => window.redraw());
initDetailTools();
window.redraw();
