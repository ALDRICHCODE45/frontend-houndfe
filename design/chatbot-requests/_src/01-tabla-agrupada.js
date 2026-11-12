/* Direction A behaviour */
const V = { view: 'list', sim: 'ok', pages: {} };
const SC_BY_SUB = { RESTOCK: 'restock', EXPIRATION: 'expiration', DELIVERY_ZONE: 'zone', TRANSFER_RECEIPT: 'receipt', UNKNOWN_QUESTION: 'unknown', TALK_TO_HUMAN: 'unknown', COMPLAINT: 'unknown' };

function closedCell(r) {
  if (r.status === 'RESOLVED') return `<div class="sla ok">${ic('check-circle', 'sm')}<span><b>Resuelta ${whenAt(r.closedAt)}</b><small>por ${esc(who(r.resolvedBy) === 'ti' ? 'ti' : r.resolvedBy.displayName)}</small></span></div>`;
  return `<div class="sla none">${ic('ban', 'sm')}<span><b>Cancelada ${whenAt(r.closedAt)}</b><small>motivo en el historial</small></span></div>`;
}
function rowHTML(r, g) {
  const open = r.status === 'NEW' || r.status === 'IN_PROGRESS';
  return `<tr class="rq" tabindex="0" data-open="${r.id}" aria-label="${esc(r.folio)}, ${esc(SUB[r.subtype][0])}, ${esc(cname(g.customer))}. Abrir detalle">
  <td><div class="prim">${ic(SUB[r.subtype][1], 'sm')}<span class="name">${esc(r.summary)}</span></div><div class="sec"><span class="folio">${r.folio}</span><span>${SUB[r.subtype][0]}</span>${windowTag(r)}</div></td>
  <td>${statusHTML(r, true)}</td><td>${open ? slaHTML(r) : closedCell(r)}</td><td class="fig">${ageOf(r.createdAt)}</td><td style="padding:0 10px"><button type="button" class="kebab" aria-label="Abrir ${r.folio}" data-open="${r.id}">${ic('right', 'sm')}</button></td></tr>`;
}
function groupHTML(g) {
  const k = g.customerKey, exp = INB.open[k] !== false, tone = groupTone(g), over = g.requests.filter(r => r.overdueAt).length;
  const label = INB.tab === 'open' || INB.tab === 'scheduled' ? `${g.openCount} abiertas` : `${g.requests.length} ${INB.tab === 'resolved' ? 'resueltas' : 'canceladas'}`;
  const rows = exp ? g.requests.map(r => rowHTML(r, g)).join('') : '';
  const more = exp && g.moreRequests ? `<tr class="more"><td colspan="5">${V.pages[k] ? `<span class="p2">Se cargaron las ${g.moreRequests} restantes con <code>?customerKey=</code></span>` : `<button type="button" class="btn ghost sm" data-more="${k}">${ic('down', 'sm')}Ver las ${g.moreRequests} restantes</button>`}</td></tr>` : '';
  return `<tbody data-g="${k}"><tr class="ghead"><td colspan="5"><div class="gh"><button type="button" class="tg" data-toggle="${k}" aria-expanded="${exp}" aria-label="${exp ? 'Contraer' : 'Expandir'} solicitudes de ${esc(cname(g.customer))}">${ic('down', 'sm')}</button>
  <span class="tone ${tone}" title="Urgencia del grupo" aria-hidden="true"></span><span class="cn">${esc(cname(g.customer))}</span>${g.customer.isTrusted ? '<span class="badge success">De confianza</span>' : ''}<span class="p2 fig">${ic('phone', 'xs')} ${esc(phoneOf(g.customer))}</span>
  <span class="cnt"><span class="fig">${label}</span>${over ? `<span class="tag" style="color:var(--hf-danger);font-weight:600">${ic('alert', 'xs')}${over} vencida${over > 1 ? 's' : ''}</span>` : ''}</span></div></td></tr>${rows}${more}</tbody>`;
}
function resultsHTML() {
  if (V.sim === 'loading') return skelRows(6);
  if (V.sim === 'error') return stateHTML('error');
  if (V.sim === 'forbidden') return stateHTML('forbidden');
  if (V.sim === 'empty') return stateHTML('empty');
  const gs = queryGroups();
  if (!gs.length) return stateHTML(anyFilter() ? 'nomatch' : 'empty');
  const head = `<colgroup><col><col style="width:240px"><col style="width:220px"><col style="width:96px"><col style="width:64px"></colgroup><thead><tr><th scope="col">Solicitud</th><th scope="col">Estado</th><th scope="col">${INB.tab === 'open' || INB.tab === 'scheduled' ? 'Tiempo' : 'Cierre'}</th><th scope="col">Antigüedad</th><th scope="col"><span class="sr">Abrir</span></th></tr></thead>`;
  return `<table>${head}${gs.map(groupHTML).join('')}</table>
  ${INB.tab === 'open' ? legendHTML() : ''}<div class="foot"><span class="fig">${gs.length} clientes en esta página · ordenados por la solicitud más urgente</span><button type="button" class="btn sm" data-noop>Cargar más clientes</button></div>`;
}
function listHTML() {
  const total = COUNTS.new + COUNTS.inProgress;
  const content = `<div class="scroll"><main class="page" aria-labelledby="ptitle">
  <div class="pageh"><div style="display:grid;gap:6px"><div class="title-row"><h1 class="page-title" id="ptitle" tabindex="-1">Solicitudes</h1><span class="badge warning dot fig">${total} abiertas</span></div><p class="page-sub">${countLine()}. Las solicitudes del mismo cliente van juntas; las más urgentes primero.</p></div></div>
  ${hoursBanner()}
  <section class="surface" aria-label="Solicitudes por cliente"><div class="toolbar" id="tb1">${filterBarHTML()}</div><div class="toolbar" id="tb2">${filterRowHTML()}</div><div id="results" aria-live="polite">${resultsHTML()}</div></section></main></div>`;
  return shell('<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><span aria-current="page">Solicitudes</span>', content, { list: true });
}
function detailHTML() {
  const d = cur(), r = d.row, A = allowedActions(d);
  const sla = slaOf(r);
  const content = `<header class="dhead"><button type="button" class="icon-btn" data-list aria-label="Volver a Solicitudes">${ic('back')}</button><div class="t"><div class="meta">${statusHTML(r, true)}<span class="folio">${r.folio}</span><span>${KIND[r.kind]} · ${SUB[r.subtype][0]}</span><span>Creada ${shortDate(r.createdAt)}</span><span class="mock-flag">/chatbot/solicitudes/${r.id}</span></div>
  <h1>${esc(SUB[r.subtype][0])} · ${esc(cname(d.customer))}</h1></div></header>
  <div class="scroll"><div class="dgrid"><div class="dmain">${U.conflict && A.length === 0 ? '' : ''}
  <section class="panel" aria-label="Resumen del bot"><h2>Resumen del bot</h2><p class="quote">${esc(r.summary)}</p>${r.whatsappWindowClosesAt ? `<p>${windowTag(r) || `<span class="tag">${ic('clock', 'xs')}Ventana de 24 h cierra ${whenAt(r.whatsappWindowClosesAt)}</span>`}</p>` : ''}</section>
  <div class="two">${customerCardHTML(d)}${needsHTML(d)}</div>${decisionHTML(d)}${convoHTML(d)}${otherHTML(d)}${auditHTML(d)}</div>
  <aside class="rail" aria-label="Acciones"><section class="panel" aria-label="Tiempo"><h2>Tiempo límite</h2>${sla ? `<div class="slabox">${slaHTML(r)}</div>` : '<p class="p2">La solicitud ya se cerró.</p>'}${r.overdueAt ? `<p class="help">Venció ${whenAt(r.overdueAt)}. Sigue abierta y se puede responder.</p>` : ''}</section>
  <section class="panel" aria-labelledby="h-act"><h2 id="h-act">Qué hacer</h2><div id="act">${actionHTML(d)}</div></section></aside></div></div>`;
  return shell('<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><a href="#" data-list>Solicitudes</a><span aria-hidden="true">/</span><span aria-current="page">' + r.folio + '</span>', content);
}
function resultsOnly() { setHTML($('#results'), resultsHTML()); }
window.redraw = function () {
  const keep = document.activeElement && document.activeElement.id;
  const wrap = $('#root'), sc = $('.scroll', wrap), top = sc ? sc.scrollTop : 0;
  setHTML(wrap, V.view === 'list' ? listHTML() : detailHTML());
  const s2 = $('.scroll', wrap); if (s2) s2.scrollTop = top;
  if (keep && $('#' + keep)) $('#' + keep).focus();
};
document.addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest('[data-tab]'); if (tab) { INB.tab = tab.dataset.tab; window.redraw(); return; }
  const ch = t.closest('[data-chip]'); if (ch) { INB[ch.dataset.chip] = !INB[ch.dataset.chip]; window.redraw(); return; }
  const tg = t.closest('[data-toggle]'); if (tg) { INB.open[tg.dataset.toggle] = INB.open[tg.dataset.toggle] === false; window.redraw(); return; }
  const mo = t.closest('[data-more]'); if (mo) { V.pages[mo.dataset.more] = true; toast('Se cargaron las solicitudes restantes', 'GET /chatbot-requests?customerKey=… (sin cambiar el orden del grupo).'); window.redraw(); return; }
  if (t.closest('[data-clear]')) { Object.assign(INB, { mine: false, none: false, over: false, win: false, sub: '', q: '' }); window.redraw(); return; }
  if (t.closest('[data-retry]')) { V.sim = 'ok'; $('#t-list').value = 'ok'; window.redraw(); return; }
  const op = t.closest('[data-open]'); if (op) { const r = GROUPS.flatMap(g => g.requests).concat(CLOSED.resolved.concat(CLOSED.cancelled).flatMap(g => g.requests)).find(x => x.id === op.dataset.open); const sc = SC_BY_SUB[r.subtype] || 'restock'; if (!rowById(r.id)) { toast('Detalle de ejemplo', 'Las solicitudes cerradas abren el mismo detalle de muestra.', 'info'); } U.sc = sc; U.form = null; U.f = {}; U.conflict = null; V.view = 'detail'; $('#t-view').value = 'detail'; $('#t-sc').value = sc; window.redraw(); return; }
  if (t.closest('[data-list]')) { V.view = 'list'; $('#t-view').value = 'list'; window.redraw(); }
});
document.addEventListener('keydown', e => { const tr = e.target.closest && e.target.closest('tr.rq'); if (tr && e.target === tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); tr.click(); } });
document.addEventListener('input', e => { if (e.target.id === 'q') { INB.q = e.target.value; resultsOnly(); } });
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
