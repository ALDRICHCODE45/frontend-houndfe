/* ---- state shared by the interactive artboards ---- */
const S = { open: true, tab: 'all', sim: 'ok', items: SEED(), more: true, markErr: false, markFails: false, countErr: false, rich: false };
const P = { email: true, sound: true, browser: 'default', sim: 'ok', err: null, busy: null };
const V = { view: 'main' };

/* ---- one notification row: the whole row is a link to the request; reading it calls POST /notifications/:id/read ---- */
function itemHTML(n, st) {
  const t = TYPE[n.type] || { icon: 'bell', tone: 'none', label: 'Aviso' }, un = !n.readAt;
  const chip = st.rich ? `<span class="chips"><span class="badge ${t.tone === 'bad' ? 'danger' : t.tone === 'warn' ? 'warning' : t.tone === 'info' ? 'info' : ''}">${t.label}</span></span>` : '';
  return `<li class="nt${un ? ' unread' : ''}"><a class="nt-link" href="${detailUrl(n.requestId)}" data-n="${n.id}"><span class="ntile ${t.tone}" aria-hidden="true">${ic(t.icon)}</span>
  <span class="ntx"><b>${un ? '<span class="sr">Sin leer. </span>' : ''}${esc(n.title)}</b><span class="bd">${esc(n.body)}</span>${chip}</span>
  <span class="nmeta"><time datetime="${n.createdAt}" title="${whenFull(n.createdAt)}">${when(n.createdAt)}</time>${un ? '<span class="udot" aria-hidden="true"></span>' : st.rich ? `<span class="go">${ic('right', 'sm')}</span>` : ''}</span></a></li>`;
}
const skel = k => Array.from({ length: k }, () => '<div class="nsk"><span class="tile"></span><span class="ln"><span class="skel" style="width:60%"></span><span class="skel" style="width:85%"></span></span></div>').join('');
const stateBox = kind => ({
  empty: `<div class="empty">${ic('bell')}<h2>Aún no hay notificaciones</h2><p>Aquí verás las solicitudes nuevas, las que te reasignen y los avisos de tiempo.</p></div>`,
  caught: `<div class="empty">${ic('check-circle')}<h2>Estás al día</h2><p>No tienes avisos sin leer.</p><button type="button" class="btn sm" data-tab="all" data-fk="all2">Ver todas</button></div>`,
  error: `<div class="empty error" role="alert">${ic('alert')}<h2>No se pudieron cargar las notificaciones</h2><p>Tus avisos siguen ahí. Revisa tu conexión e inténtalo de nuevo.</p><button type="button" class="btn sm" data-retry data-fk="retry">${ic('refresh', 'sm')}Reintentar</button></div>`
}[kind]);
function listBody(st) {
  if (st.sim === 'loading') return `<div aria-busy="true" aria-label="Cargando notificaciones">${skel(5)}</div>`;
  if (st.sim === 'error') return stateBox('error');
  let rows = st.tab === 'unread' ? st.items.filter(n => !n.readAt) : st.items;
  const total = rows.length; if (st.limit) rows = rows.slice(0, st.limit);
  if (!rows.length) return stateBox(st.tab === 'unread' ? 'caught' : 'empty');
  const today = rows.filter(n => dayDiff(n.createdAt) === 0), before = rows.filter(n => dayDiff(n.createdAt) !== 0);
  const grp = (h, a) => a.length ? `<section aria-label="${h}"><h3 class="ngh">${h}</h3><ul>${a.map(n => itemHTML(n, st)).join('')}</ul></section>` : '';
  if (st.limit) return grp('Hoy', today) + grp('Antes', before) + (total > st.limit ? `<p class="nwhy" style="text-align:center;margin:12px 16px">Se muestran las ${st.limit} más recientes.</p>` : '');
  const more = st.more && st.tab === 'all' ? `<div class="nmore"><button type="button" class="btn sm" data-more data-fk="more">Ver anteriores</button></div>` : (st.tab === 'all' ? `<p class="nwhy" style="text-align:center;margin:12px 16px">Llegaste al final de tus notificaciones.</p>` : '');
  return grp('Hoy', today) + grp('Antes', before) + more;
}
const markAlert = () => `<div class="alert danger nalert" role="alert">${ic('alert', 'sm')}<div><strong>No se pudieron marcar como leídas</strong>Tus avisos siguen sin leer; no se perdió nada. Puedes reintentarlo.<div class="acts"><button type="button" class="btn sm" data-markall data-fk="markretry">Reintentar</button></div></div></div>`;
const staleNote = () => `<div class="alert warn nalert" role="status">${ic('bell-off', 'sm')}<div><strong>El conteo puede estar desfasado</strong>No se pudo actualizar el número de la campana; se reintenta solo.</div></div>`;
function panelHead(st, o = {}) {
  const u = unreadN(st.items);
  return `<div class="nh"><h2 id="nh" tabindex="-1">Notificaciones</h2>${st.sim === 'ok' && u ? `<span class="badge info fig">${countLabel(u)} sin leer</span>` : ''}
  <a class="icon-btn" href="/perfil" data-noop aria-label="Preferencias de notificaciones" title="Preferencias">${ic('sliders')}</a>${o.close ? `<button type="button" class="icon-btn" data-close aria-label="Cerrar notificaciones" data-fk="close">${ic(o.back ? 'back' : 'x')}</button>` : ''}</div>`;
}
function segHTML(st) {
  const u = st.sim === 'ok' ? unreadN(st.items) : 0, b = (k, l) => `<button type="button" data-tab="${k}" data-fk="tab-${k}" aria-pressed="${st.tab === k}">${l}</button>`;
  return `<div class="seg" role="group" aria-label="Mostrar">${b('all', 'Todas')}${b('unread', `Sin leer${u ? ` <span class="fig">${countLabel(u)}</span>` : ''}`)}</div>`;
}
const panelSub = st => `<div class="nsub">${segHTML(st)}</div>`;
function panelFoot(st, o = {}) {
  const u = unreadN(st.items), off = u === 0 || st.sim !== 'ok';
  return `<div class="nfoot"><button type="button" class="btn sm" data-markall data-fk="markall" ${off ? 'disabled aria-describedby="why"' : ''}>${ic('check-all', 'sm')}Marcar todas como leídas</button><span class="grow"></span>${o.foot || ''}${off && st.sim === 'ok' ? '<span class="why" id="why">No hay avisos sin leer.</span>' : ''}</div>`;
}
function panelHTML(st, o = {}) {
  return `<div class="${o.cls || 'pop'}" id="np" role="dialog" aria-modal="${o.modal ? 'true' : 'false'}" aria-labelledby="nh">${panelHead(st, o)}${panelSub(st)}<div class="nbody">${st.countErr ? staleNote() : ''}${st.markErr ? markAlert() : ''}${listBody(st)}</div>${panelFoot(st, o)}</div>`;
}
function bellHTML(st, open, panel) {
  const u = unreadN(st.items), lab = st.countErr ? `Notificaciones, ${u} sin leer (no se pudo actualizar)` : `Notificaciones${u ? `, ${u} sin leer` : ', sin avisos nuevos'}`;
  return `<div class="bellwrap"><button type="button" class="icon-btn" id="bell" data-fk="bell" aria-haspopup="dialog" aria-expanded="${open}" aria-controls="np" aria-label="${lab}">${ic(st.countErr ? 'bell-off' : 'bell')}${u ? `<span class="dotc fig${st.countErr ? ' stale' : ''}" aria-hidden="true">${countLabel(u)}</span>` : ''}</button>${open ? panel : ''}</div>`;
}

/* ---- app shell: sidebar and topbar as in src/app/layouts/DashboardLayout.vue (search, bell where the comment says to restore it, color mode, user menu) ---- */
function shell(crumbs, content, bell, opts = {}) {
  const nav = (i, l) => `<li><a href="#" data-noop>${ic(i, 'sm')}${l}</a></li>`;
  return `<div class="app"><aside class="side" aria-label="Menú principal"><div class="brand"><span class="brand-mark" aria-hidden="true">${ic('paw', 'sm')}</span>HoundFe</div>
  <div class="tenant"><span class="tenant-tile" aria-hidden="true">C</span><span><strong>Sucursal Centro</strong><small>Guadalajara</small></span></div>
  <nav class="nav" aria-label="Módulos"><ul>${nav('home', 'Resumen')}</ul><p class="nav-group">POS</p><ul>${nav('cart', 'Ventas')}${nav('package', 'Productos')}${nav('users', 'Clientes')}${nav('truck', 'Rutas de entrega')}</ul>
  <p class="nav-group">Chatbot</p><ul><li><a href="#" data-noop class="sub"${opts.inbox ? ' aria-current="page"' : ''}>${ic('inbox', 'sm')}Solicitudes<span class="count fig" aria-label="7 nuevas">7</span></a></li></ul></nav>
  <div class="side-foot"><span class="avatar" aria-hidden="true">LM</span><span>Laura Méndez<small>Gerente</small></span></div></aside>
  <div class="col"><header class="topbar"><nav class="crumbs" aria-label="Ruta">${crumbs}</nav><span class="spacer"></span>
  <button type="button" class="icon-btn" aria-label="Buscar" data-noop>${ic('search')}</button>${bell}<button type="button" class="icon-btn" aria-label="Cambiar tema" data-noop>${ic('moon')}</button>
  <button type="button" class="icon-btn" aria-label="Abrir menú de usuario" data-noop><span class="avatar sm" aria-hidden="true">LM</span></button></header>${content}</div></div>`;
}
const CR_INBOX = '<a href="#" data-noop>Chatbot</a><span aria-hidden="true">/</span><span aria-current="page">Solicitudes</span>';
const CR_PROFILE = '<span aria-current="page">Mi perfil</span>';
function bgInbox() {
  const row = (s, f, st, tm) => `<tr><td><div class="name">${s}</div><div class="p2">${f}</div></td><td>${st}</td><td class="fig">${tm}</td></tr>`;
  return `<div class="scroll bg-inbox"><main class="page"><div class="title-row"><h1 class="page-title">Solicitudes</h1><span class="badge warning dot fig">11 abiertas</span></div><p class="page-sub">Las solicitudes del mismo cliente van juntas; las más urgentes primero.</p>
  <section class="surface" aria-label="Solicitudes por cliente"><table><colgroup><col><col style="width:200px"><col style="width:120px"></colgroup><thead><tr><th scope="col">Solicitud</th><th scope="col">Estado</th><th scope="col">Antigüedad</th></tr></thead>
  <tbody><tr class="ghead"><td colspan="3"><div class="name">Mariana Robles <span class="p2">· 3 abiertas</span></div></td></tr>
  ${row('Quiere saber si llega croquetas a Zapopan', 'S-000118 · Zona de entrega', '<span class="badge danger dot">Vencida</span>', '3 h 12 min')}
  ${row('Transferencia de $1,240.00 por confirmar', 'S-000121 · Comprobante', '<span class="badge warning dot">En atención · por Luis</span>', '2 h 5 min')}
  <tr class="ghead"><td colspan="3"><div class="name">Jorge Aguirre <span class="p2">· 1 abierta</span></div></td></tr>
  ${row('¿Tienen alimento sin grano para gato?', 'S-000123 · Pregunta del bot', '<span class="badge info dot">Nueva</span>', '1 h 2 min')}</tbody></table></section></main></div>`;
}

/* ---- /perfil: preferences (GET/PATCH /me/notification-preferences → { emailEnabled, soundEnabled }) ---- */
const swRow = (key, title, desc, on) => {
  const busy = P.busy === key, err = P.err === key;
  return `<button type="button" class="sw-row${err ? ' is-error' : ''}" role="switch" aria-checked="${on}" data-pref="${key}" data-fk="pref-${key}" ${busy ? 'aria-busy="true"' : ''} ${err ? `aria-describedby="e-${key}"` : ''}>
  <span class="sw-text"><b>${title}</b><small>${desc}</small></span><span class="sw-state">${busy ? 'Guardando…' : on ? 'Activado' : 'Desactivado'}</span><span class="track" aria-hidden="true"></span></button>${err ? `<div class="sw-err" id="e-${key}" role="alert">${ic('alert', 'sm')}No se guardó. Tu preferencia sigue en «${on ? 'Activado' : 'Desactivado'}». <button type="button" class="btn sm" data-pref="${key}" data-fk="pref-retry">Reintentar</button></div>` : ''}`;
};
const BR = {
  default: ['Sin decidir', 'El navegador te pedirá permiso. Solo se usa con la pestaña oculta.', `<button type="button" class="btn sm" data-br="granted" data-fk="br">Permitir avisos</button>`],
  granted: ['Permitido', 'Verás una notificación del sistema cuando llegue un aviso con la pestaña oculta.', `<button type="button" class="btn sm" data-os data-fk="br">Enviar aviso de prueba</button>`],
  denied: ['Bloqueado', 'Este navegador bloqueó los avisos. Se desbloquea desde el candado de la barra de direcciones; la campana sigue avisando.', `<button type="button" class="btn sm" data-br="default" data-fk="br">Ver cómo desbloquear</button>`]
};
function prefsHTML() {
  let sw;
  if (P.sim === 'loading') sw = `<div class="sw-list" aria-busy="true" aria-label="Cargando preferencias">${[1, 2].map(() => '<div class="sw-extra"><span class="ln" style="flex:1;display:grid;gap:8px"><span class="skel" style="width:40%"></span><span class="skel" style="width:75%"></span></span><span class="skel" style="width:44px;height:26px;border-radius:999px"></span></div>').join('')}</div>`;
  else if (P.sim === 'loaderror') sw = `<div class="empty error" role="alert" style="margin:0">${ic('alert')}<h2>No se pudieron cargar tus preferencias</h2><p>No se cambió nada. Inténtalo de nuevo.</p><button type="button" class="btn sm" data-retry data-fk="retry">${ic('refresh', 'sm')}Reintentar</button></div>`;
  else {
    const b = BR[P.browser];
    sw = `<div class="sw-list" role="group" aria-label="Canales de aviso">
    <div class="sw-row" role="switch" aria-checked="true" aria-disabled="true" aria-describedby="in-app-note" tabindex="0"><span class="sw-text"><b>Avisos en el sistema</b><small id="in-app-note">La campana siempre te avisa; no se puede apagar.</small></span><span class="sw-state">Siempre</span><span class="track" aria-hidden="true"></span></div>
    ${swRow('emailEnabled', 'Correo electrónico', 'Un correo por solicitud nueva (juntas en un solo correo cada 2 min), reasignaciones y avisos de tiempo. Sin nombre ni teléfono del cliente.', P.email)}
    ${swRow('soundEnabled', 'Sonido', 'Suena cuando llega un aviso y la pestaña está oculta. Es el valor del servidor y vale en todos tus dispositivos.', P.sound)}
    <div class="sw-extra"><span class="sw-text" style="flex:1;min-width:200px"><b>Avisos del navegador <span class="mock-flag">no está en el contrato</span></b><small>${b[1]}</small></span><span class="badge ${P.browser === 'granted' ? 'success' : P.browser === 'denied' ? 'danger' : ''} dot">${b[0]}</span>${b[2]}</div></div>`;
  }
  const yes = t => `<span class="v-yes">${t}</span>`, no = '<span class="v-no">No</span>';
  return `<div class="scroll"><main class="page" aria-labelledby="ptitle"><div class="prefs"><div><h1 class="page-title" id="ptitle" tabindex="-1">Mi perfil</h1><p class="page-sub">Tus datos y cómo quieres que te avisemos.</p></div>
  <section class="panel" aria-labelledby="h-acc"><div class="sec-h"><h2 id="h-acc">Cuenta <span class="mock-flag">ejemplo</span></h2></div><dl class="kv"><dt>Nombre</dt><dd>Laura Méndez</dd><dt>Correo</dt><dd>laura.mendez@ejemplo.mx</dd><dt>Rol</dt><dd>Gerente · Sucursal Centro</dd></dl></section>
  <section aria-labelledby="h-not"><div class="sec-h"><h2 id="h-not">Notificaciones</h2><p>Tus preferencias son de tu persona: valen en todas las sucursales y dispositivos, y cada cambio se guarda al instante.</p></div>${sw}</section>
  <section aria-labelledby="h-mx"><div class="sec-h"><h2 id="h-mx">Qué te avisamos</h2><p>Fuera del horario de la sucursal, los avisos de tiempo se guardan y llegan en la próxima apertura.</p></div>
  <div class="surface"><table class="mtx"><thead><tr><th scope="col">Aviso</th><th scope="col">Campana</th><th scope="col">Correo</th></tr></thead><tbody>
  <tr><th scope="row">Nueva solicitud</th><td>${yes('Sí')}</td><td>${yes('Sí · junto')}</td></tr>
  <tr><th scope="row">Te reasignaron una solicitud</th><td>${yes('Sí')}</td><td>${yes('Sí')}</td></tr>
  <tr><th scope="row">Sin tomar · por vencer · vencida</th><td>${yes('Sí')}</td><td>${yes('Sí')}</td></tr>
  <tr><th scope="row">Se cerró sin tu acción</th><td>${yes('Sí')}</td><td>${no}</td></tr></tbody></table></div></section></div></main></div>`;
}

/* ---- artboard tools, toast, browser notification mock ---- */
function toolsHTML(extra = '') {
  return `<div class="tools" role="group" aria-label="Opciones del artboard"><button type="button" id="t-theme"></button>${extra}<span class="grow"></span><button type="button" id="t-new">${ic('bell', 'sm')}Simular aviso nuevo</button><button type="button" id="t-notes" aria-pressed="false">${ic('info', 'sm')}Notas</button></div>`;
}
function mountTools(extra) { const h = document.createElement('div'); setHTML(h, toolsHTML(extra)); document.body.prepend(h.firstElementChild); }
function measureTools() { document.documentElement.style.setProperty('--tools-h', $('.tools').offsetHeight + 'px'); }
function initTools(onNew) {
  measureTools(); addEventListener('resize', measureTools);
  const paint = () => { const d = document.documentElement.classList.contains('dark'); setHTML($('#t-theme'), `${ic(d ? 'moon' : 'sun', 'sm')}${d ? 'Oscuro' : 'Claro'}`); };
  $('#t-theme').addEventListener('click', () => { document.documentElement.classList.toggle('dark'); paint(); });
  $('#t-notes').addEventListener('click', e => { const s = $('#notes'); s.hidden = !s.hidden; e.currentTarget.setAttribute('aria-pressed', String(!s.hidden)); });
  $('#t-new').addEventListener('click', onNew);
  paint();
}
function toast(title, desc, icon = 'check-circle') {
  const t = document.createElement('div'); t.className = 'toast';
  setHTML(t, `<span class="tile">${ic(icon)}</span><div><strong>${esc(title)}</strong>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`);
  let host = $('#toasts'); if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
  host.appendChild(t); setTimeout(() => t.remove(), 4500);
}
function osNote(n, sound) {
  $$('.os-note').forEach(x => x.remove());
  const o = document.createElement('div'); o.className = 'os-note'; o.setAttribute('role', 'status');
  setHTML(o, `<span class="tile">${ic('paw')}</span><div><strong>${esc(n.title)}</strong>${esc(n.body)}<small>${ic(sound ? 'volume' : 'bell-off', 'xs')}${sound ? 'Con sonido (soundEnabled)' : 'Sin sonido'} · Notificación del navegador, solo con la pestaña oculta</small></div>`);
  document.body.appendChild(o); setTimeout(() => o.remove(), 6000);
}

/* ---- interaction shared by the interactive artboards; each artboard defines window.paint ---- */
let _focus = null;
function repaint() { _focus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk : null; window.paint(); if (_focus) { const el = $(`[data-fk="${_focus}"]`); if (el) el.focus(); } }
function scenario(v) {
  Object.assign(S, { sim: 'ok', markErr: false, markFails: false, countErr: false, items: SEED(), more: true, tab: 'all' });
  if (v === 'loading' || v === 'error') S.sim = v;
  if (v === 'empty') { S.items = []; S.more = false; }
  if (v === 'caught') { S.items.forEach(n => { n.readAt = at(0); }); S.tab = 'unread'; }
  if (v === 'markerr') S.markFails = true;
  if (v === 'counterr') S.countErr = true;
  repaint();
}
function markAll() {
  if (S.markFails) { S.markErr = true; return repaint(); }
  const k = unreadN(S.items); S.items.forEach(n => { if (!n.readAt) n.readAt = at(0); }); S.markErr = false;
  toast('Todo leído', `POST /notifications/read-all → { "updated": ${k} }`); repaint();
}
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-noop]')) e.preventDefault();
  if (t.closest('.phone')) { if (t.closest('a')) e.preventDefault(); return; } // static mobile frames
  const n = t.closest('[data-n]');
  if (n) { e.preventDefault(); const it = S.items.find(x => x.id === n.dataset.n); if (it && !it.readAt) it.readAt = at(0); toast('Abriendo la solicitud', `POST /notifications/:id/read y luego ${detailUrl(it ? it.requestId : ':id')}`, 'inbox'); S.open = false; V.view = V.view === 'page' ? 'page' : 'main'; return repaint(); }
  const tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; return repaint(); }
  if (t.closest('[data-markall]')) return markAll();
  if (t.closest('[data-more]')) { S.items = S.items.concat(OLDER()); S.more = false; return repaint(); }
  if (t.closest('[data-retry]')) { S.sim = 'ok'; P.sim = 'ok'; if ($('#t-state')) $('#t-state').value = 'ok'; if ($('#t-prefs')) $('#t-prefs').value = 'ok'; return repaint(); }
  if (t.closest('[data-close]')) { S.open = false; repaint(); const b = $('#bell'); if (b) b.focus(); return; }
  if (t.closest('#bell')) { S.open = !S.open; repaint(); if (S.open && $('#nh')) $('#nh').focus(); return; }
  const br = t.closest('[data-br]'); if (br) { P.browser = br.dataset.br; return repaint(); }
  if (t.closest('[data-os]')) { osNote({ title: 'Nueva solicitud', body: 'Queja · S-000124' }, P.sound); return; }
  const pf = t.closest('[data-pref]'); if (pf) {
    const k = pf.dataset.pref; if (P.busy) return;
    if (P.sim === 'saveerror') { P.err = k; return repaint(); }
    P.err = null; P.busy = k; P[k === 'emailEnabled' ? 'email' : 'sound'] = !P[k === 'emailEnabled' ? 'email' : 'sound']; repaint();
    setTimeout(() => { const v = P[k === 'emailEnabled' ? 'email' : 'sound']; P.busy = null; toast('Preferencia guardada', `PATCH /me/notification-preferences { "${k}": ${v} }`); repaint(); }, 500);
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.open && $('#np') && window.escCloses !== false) { S.open = false; repaint(); const b = $('#bell'); if (b) b.focus(); } });
function simulateNew() {
  const f = FRESH(); f.id = NID(40 + S.items.length); f.createdAt = at(0); S.items.unshift(f); S.tab = 'all'; S.sim = 'ok';
  const hidden = true; // the artboard pretends the tab is hidden: browser notification (+ sound only if soundEnabled)
  repaint(); osNote(f, P.sound); toast('Aviso nuevo en la campana', `${f.title} · ${f.body}`, 'bell'); return hidden;
}

/* ---- standard tool selects: view, notification state, preferences state ---- */
const stdTools = views => `<label>Vista <select id="t-view">${views.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
<label>Notificaciones <select id="t-state"><option value="ok">Con datos</option><option value="loading">Cargando</option><option value="empty">Vacío</option><option value="caught">Todo leído (Sin leer)</option><option value="error">Error al cargar</option><option value="markerr">Error al marcar todas</option><option value="counterr">Falló el conteo</option></select></label>
<label>Preferencias <select id="t-prefs"><option value="ok">Con datos</option><option value="loading">Cargando</option><option value="loaderror">Error al cargar</option><option value="saveerror">Error al guardar</option></select></label>
<label>Navegador <select id="t-br"><option value="default">Sin decidir</option><option value="granted">Permitido</option><option value="denied">Bloqueado</option></select></label>`;
function bindStd() {
  $('#t-view').addEventListener('change', e => { V.view = e.target.value; if (V.view !== 'main') S.open = false; else S.open = true; repaint(); });
  $('#t-state').addEventListener('change', e => scenario(e.target.value));
  $('#t-prefs').addEventListener('change', e => { P.sim = e.target.value; P.err = null; repaint(); });
  $('#t-br').addEventListener('change', e => { P.browser = e.target.value; repaint(); });
}
