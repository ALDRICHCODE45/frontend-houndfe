/* Direction B behaviour */
const V = { view: 'list', sim: 'ok', sel: 'rq-123', pages: {} };
const SCB = { RESTOCK: 'restock', EXPIRATION: 'expiration', DELIVERY_ZONE: 'zone', TRANSFER_RECEIPT: 'receipt', UNKNOWN_QUESTION: 'unknown', TALK_TO_HUMAN: 'unknown', COMPLAINT: 'unknown' };
const allOpen = () => GROUPS.flatMap(g => g.requests);
const closedOf = r => r.status === 'RESOLVED' ? `<span class="sla ok">${ic('check-circle', 'xs')}<b>${whenAt(r.closedAt)}</b></span>` : `<span class="sla none">${ic('ban', 'xs')}<b>${whenAt(r.closedAt)}</b></span>`;
function qiHTML(r) {
  const open = r.status === 'NEW' || r.status === 'IN_PROGRESS';
  return `<button type="button" class="qi" data-sel="${r.id}" aria-current="${V.sel === r.id}"><span class="l1">${ic(SUB[r.subtype][1], 'sm')}<span class="name ell">${esc(r.summary)}</span></span><span>${open ? slaHTML(r, true) : closedOf(r)}</span>
  <span class="l2"><span class="folio">${r.folio}</span>${statusHTML(r, true)}${windowTag(r)}</span></button>`;
}
function groupBlock(g) {
  const tone = groupTone(g), over = g.requests.filter(r => r.overdueAt).length;
  const more = g.moreRequests ? (V.pages[g.customerKey] ? '<p class="gsub" style="padding:8px 16px">Restantes cargadas</p>' : `<button type="button" class="btn ghost sm" style="margin:6px 12px" data-more="${g.customerKey}">${ic('down', 'sm')}Ver las ${g.moreRequests} restantes</button>`) : '';
  return `<section class="gblock" aria-label="${esc(cname(g.customer))}"><div class="gtop"><span class="tone ${tone}" aria-hidden="true"></span><span class="cn ell">${esc(cname(g.customer))}</span>${g.customer.isTrusted ? '<span class="badge success">De confianza</span>' : ''}<span class="spacer"></span><span class="p2 fig">${g.openCount || g.requests.length}</span></div>
  <div class="gsub"><span class="fig">${ic('phone', 'xs')} ${esc(phoneOf(g.customer))}</span>${over ? `<span class="tag" style="color:var(--hf-danger);font-weight:600">${ic('alert', 'xs')}${over} vencida${over > 1 ? 's' : ''}</span>` : ''}</div>${g.requests.map(qiHTML).join('')}${more}</section>`;
}
function listPane() {
  let body;
  if (V.sim === 'loading') body = skelRows(7); else if (V.sim === 'error') body = stateHTML('error'); else if (V.sim === 'forbidden') body = stateHTML('forbidden'); else if (V.sim === 'empty') body = stateHTML('empty');
  else { const gs = queryGroups(); body = gs.length ? gs.map(groupBlock).join('') : stateHTML(anyFilter() ? 'nomatch' : 'empty'); }
  const tab = (k, l, n) => `<button type="button" data-tab="${k}" aria-pressed="${INB.tab === k}">${l}${n != null ? ` <span class="fig">${n}</span>` : ''}</button>`;
  return `<section class="lpane" aria-label="Solicitudes por cliente"><div class="lhead"><div class="title-row"><h1 id="ptitle" tabindex="-1">Solicitudes</h1><span class="badge warning dot fig">${COUNTS.new + COUNTS.inProgress} abiertas</span><span class="spacer"></span><a href="#" data-noop class="btn ghost sm">${ic('history', 'sm')}Historial</a></div>
  <p class="p2">${countLine()}</p>
  <div class="seg" role="group" aria-label="Estado" style="height:40px;overflow-x:auto">${tab('open', 'Abiertas', COUNTS.new + COUNTS.inProgress)}${tab('scheduled', 'Agendadas', COUNTS.scheduled)}${tab('resolved', 'Resueltas')}${tab('cancelled', 'Canceladas')}</div>
  <div class="search"><label class="sr" for="q">Buscar</label>${ic('search', 'sm')}<input class="ctl" id="q" type="search" value="${esc(INB.q)}" placeholder="${can('phone') ? 'Folio, cliente o teléfono' : 'Folio o nombre del cliente'}" autocomplete="off"></div>
  <div class="chips" role="group" aria-label="Filtros">${[['mine', 'Mías', COUNTS.mine], ['none', 'Sin responsable'], ['over', 'Vencidas', COUNTS.overdue], ['win', 'Ventana por cerrar', COUNTS.windowClosingSoon]].map(([k, l, n]) => `<button type="button" class="chip" data-chip="${k}" aria-pressed="${INB[k]}">${l}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>${hoursBanner()}</div>
  <div class="lscroll" id="lscroll" aria-live="polite">${body}</div>
  <div class="lfoot">${INB.tab === 'open' ? legendLine() : '<span>Resueltas y canceladas: últimos 7 días</span>'}<button type="button" class="btn ghost sm" data-noop>Cargar más clientes</button></div></section>`;
}
const legendLine = () => `<span style="display:flex;gap:10px;flex-wrap:wrap"><span class="sla ok">${ic('clock', 'xs')}Holgado</span><span class="sla warn">${ic('clock', 'xs')}Por la mitad</span><span class="sla bad">${ic('alert', 'xs')}Crítico</span><span class="sla pause">${ic('pause', 'xs')}Pausa · se reanuda mañana 9:00</span></span>`;

function nowHTML(d) {
  const r = d.row, sla = slaOf(r);
  return `<section class="panel" aria-label="Qué hacer ahora"><div class="now"><div><h2 style="font-size:14px;margin-bottom:6px">Tiempo límite</h2>${sla ? slaHTML(r) : '<p class="p2">Cerrada</p>'}${r.overdueAt ? `<p class="help">Venció ${whenAt(r.overdueAt)}. Sigue abierta.</p>` : ''}</div>
  <div><h2 style="font-size:14px;margin-bottom:6px">Qué hacer ahora</h2><div id="act">${actionHTML(d)}</div></div></div></section>`;
}
function body(d, wide) {
  return `${nowHTML(d)}<section class="panel"><h2>Resumen del bot</h2><p class="quote">${esc(d.row.summary)}</p></section>${decisionHTML(d)}<div class="two">${customerCardHTML(d)}${needsHTML(d)}</div>${convoHTML(d)}${otherHTML(d)}${auditHTML(d)}`;
}
function head(d, closeBtn) {
  const r = d.row;
  return `<div class="rhead">${closeBtn || ''}<div class="t"><div class="meta">${statusHTML(r, true)}<span class="folio">${r.folio}</span><span>${KIND[r.kind]} · ${SUB[r.subtype][0]}</span><span>Creada ${shortDate(r.createdAt)}</span></div><h2>${esc(SUB[r.subtype][0])} · ${esc(cname(d.customer))}</h2></div></div>`;
}
function splitHTML() {
  const d = cur();
  const content = `<div class="split">${listPane()}<section class="rpane" aria-label="Detalle de la solicitud"><div class="rscroll">${head(d, `<button type="button" class="btn sm" data-fullpage>${ic('right', 'sm')}Abrir página completa</button>`.replace('class="rhead"', ''))}${body(d)}</div></section></div>`;
  return shell('<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><span aria-current="page">Solicitudes</span>', content, { list: true });
}
function pageHTML() {
  const d = cur(), r = d.row, list = allOpen(), i = list.findIndex(x => x.id === r.id);
  const sibs = [r.id, ...d.other].map(rowById).filter(Boolean);
  const content = `<div class="dpage"><aside class="qrail" aria-label="Cola de solicitudes"><button type="button" class="btn sm" data-list style="justify-self:start">${ic('back', 'sm')}Volver a Solicitudes</button>
  <div class="nav2"><button type="button" class="btn sm" data-step="-1" ${i <= 0 ? 'disabled' : ''}>${ic('up', 'sm')}Anterior</button><button type="button" class="btn sm" data-step="1" ${i < 0 || i >= list.length - 1 ? 'disabled' : ''}>Siguiente${ic('down', 'sm')}</button></div>
  <p class="help">Orden de la bandeja cargada, la más urgente primero.</p>
  <h2>Solicitudes de ${esc(cname(d.customer))}</h2><ul style="display:grid;gap:6px">${sibs.map(x => `<li><button type="button" class="rrow" style="min-height:64px" role="link" data-goto="${x.id}" ${x.id === r.id ? 'aria-current="page"' : ''}><span class="tx"><span style="display:flex;gap:6px;align-items:center">${ic(SUB[x.subtype][1], 'xs')}<span class="folio">${x.folio}</span></span><span class="ell">${esc(x.summary)}</span>${slaHTML(x, true)}</span></button></li>`).join('')}</ul></aside>
  <div class="dcenter" style="max-width:none"><div style="max-width:1000px;display:grid;gap:16px">${head(d)}${body(d)}</div></div></div>`;
  return shell(`<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><a href="#" data-list>Solicitudes</a><span aria-hidden="true">/</span><span aria-current="page">${r.folio}</span>`, content);
}
window.redraw = function () {
  const wrap = $('#root'), ls = $('#lscroll'), rs = $('.rscroll, .dcenter', wrap), lt = ls ? ls.scrollTop : 0, rt = rs ? rs.scrollTop : 0, id = document.activeElement && document.activeElement.id;
  setHTML(wrap, V.view === 'list' ? splitHTML() : pageHTML());
  const l2 = $('#lscroll'); if (l2) l2.scrollTop = lt; const r2 = $('.rscroll, .dcenter', wrap); if (r2) r2.scrollTop = rt;
  if (id && $('#' + id)) $('#' + id).focus();
};
function pick(id, keepForm) {
  const r = allOpen().concat(CLOSED.resolved.concat(CLOSED.cancelled).flatMap(g => g.requests)).find(x => x.id === id);
  V.sel = id; U.sc = SCB[r.subtype] || 'restock'; if (!keepForm) { U.form = null; U.f = {}; U.err = {}; U.conflict = null; } $('#t-sc').value = U.sc;
  if (!rowById(id)) toast('Detalle de ejemplo', 'Las solicitudes cerradas abren el mismo detalle de muestra.', 'info');
}
document.addEventListener('click', e => {
  const t = e.target;
  const s = t.closest('[data-sel]'); if (s) { pick(s.dataset.sel); window.redraw(); return; }
  const g = t.closest('[data-goto]'); if (g) { pick(g.dataset.goto); window.redraw(); return; }
  const st = t.closest('[data-step]'); if (st) { const l = allOpen(), i = l.findIndex(x => x.id === V.sel) + +st.dataset.step; if (l[i]) { pick(l[i].id); window.redraw(); } return; }
  const tab = t.closest('[data-tab]'); if (tab) { INB.tab = tab.dataset.tab; window.redraw(); return; }
  const ch = t.closest('[data-chip]'); if (ch) { INB[ch.dataset.chip] = !INB[ch.dataset.chip]; window.redraw(); return; }
  const mo = t.closest('[data-more]'); if (mo) { V.pages[mo.dataset.more] = true; toast('Se cargaron las solicitudes restantes', 'GET /chatbot-requests?customerKey=…'); window.redraw(); return; }
  if (t.closest('[data-clear]')) { Object.assign(INB, { mine: false, none: false, over: false, win: false, sub: '', q: '' }); window.redraw(); return; }
  if (t.closest('[data-retry]')) { V.sim = 'ok'; $('#t-list').value = 'ok'; window.redraw(); return; }
  if (t.closest('[data-fullpage]')) { V.view = 'detail'; $('#t-view').value = 'detail'; window.redraw(); return; }
  if (t.closest('[data-list]')) { V.view = 'list'; $('#t-view').value = 'list'; window.redraw(); }
});
document.addEventListener('input', e => { if (e.target.id === 'q') { INB.q = e.target.value; const pos = e.target.selectionStart; window.redraw(); const q = $('#q'); q.focus(); q.setSelectionRange(pos, pos); } });
const extra = `<label>Vista <select id="t-view"><option value="list">Bandeja con panel</option><option value="detail">Página de detalle</option></select></label>
<label>Lista <select id="t-list"><option value="ok">Con datos</option><option value="loading">Cargando</option><option value="empty">Vacía</option><option value="error">Error</option><option value="forbidden">Sin permiso</option></select></label>${scToolHTML()}${simToolHTML()}`;
mountTools(extra);
injectIcons();
$('#t-view').addEventListener('change', e => { V.view = e.target.value; window.redraw(); });
$('#t-list').addEventListener('change', e => { V.sim = e.target.value; window.redraw(); });
initTools(() => window.redraw());
initDetailTools();
window.redraw();
