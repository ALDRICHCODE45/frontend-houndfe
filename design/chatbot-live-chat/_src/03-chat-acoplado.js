/* Board 03: direction C. */
injectIcons();
S.drawer = 'open'; S.unread = 0;
const headActs = s => {
  if (s.session === 'WAITING') return `<button type="button" class="btn primary" data-claim>${ic('user', 'sm')}Atender</button>`;
  if (s.session !== 'ACTIVE') return '';
  if (mine(s)) return `${s.role === 'me' ? `<button type="button" class="btn" data-noop>${ic('swap', 'sm')}Reasignar…</button>` : ''}<button type="button" class="btn primary" data-finish-open>${ic('check-circle', 'sm')}Finalizar conversación</button>`;
  if (s.role === 'reassigner') return `<button type="button" class="btn" data-noop>${ic('swap', 'sm')}Reasignar…</button><button type="button" class="btn" data-finish-open>${ic('check-circle', 'sm')}Finalizar en su lugar…</button>`;
  return '';
};
const page = s => `<div class="two"><section class="panel" aria-labelledby="h-sum"><h2 id="h-sum">Resumen del bot</h2><p class="quote">${CF} recibió una bolsa de Croquetas Premium Adulto 15 kg rota en su pedido V-1042 y pide que se la repongan.</p></section>
<section class="panel" aria-labelledby="h-need"><h2 id="h-need">Qué necesita el cliente</h2><p class="quote">Reposición de la bolsa dañada. La necesita para el fin de semana.</p></section></div>
<section class="panel" aria-labelledby="h-ses"><h2 id="h-ses">Esta conversación</h2><dl class="kv"><dt>Sesión</dt><dd>${sessBadge(s)}</dd><dt>Atiende</dt><dd>${s.session === 'WAITING' ? 'Nadie todavía' : `${assignee(s)}${mine(s) ? ' (tú)' : ''}`}</dd><dt>Empezó</dt><dd>${s.session === 'WAITING' ? '—' : 'hoy 15:58'}</dd><dt>Ventana de 24 h</dt><dd>${winEff(s) === 'closed' ? 'cerrada' : `cierra en ${dur(closesIn(s))}`}</dd><dt>Tiempo límite</dt><dd><span class="sla ok">${ic('clock', 'xs')}<b>Quedan 3 h 40 min</b></span></dd></dl></section>
<section class="panel" aria-labelledby="h-cus"><div class="ph"><h2 id="h-cus">Cliente</h2><span class="badge success">De confianza</span></div><dl class="kv"><dt>Nombre</dt><dd>${CUST}</dd><dt>Teléfono</dt><dd>${PHONE}</dd><dt>Cliente desde</dt><dd>ene 2025</dd></dl>
<table class="plain" aria-label="Pedidos recientes"><thead><tr><th scope="col" style="padding-left:0">Pedido</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead><tbody><tr><td style="padding-left:0"><b class="fig">V-1042</b></td><td class="num">$1,840.00</td><td>Entregado hoy</td></tr><tr><td style="padding-left:0"><b class="fig">V-0988</b></td><td class="num">$965.50</td><td>Entregado</td></tr></tbody></table></section>
<section class="panel" aria-labelledby="h-oth"><h2 id="h-oth">Otras solicitudes abiertas de este cliente</h2><p class="p2">Ninguna. Esta es su única solicitud abierta.</p></section>
<section class="panel" aria-labelledby="h-aud"><h2 id="h-aud">Historial de la solicitud</h2><ol class="tl">${s.session === 'ENDING' || s.session === 'ENDED' ? `<li class="done"><b>Resuelta por ${assignee(s)}</b><small>hoy ${hm(nowM(s))}</small></li>` : ''}${s.session === 'WAITING' ? '<li class="bad"><b>Liberada: el bot no confirmó</b><small>hoy 16:00 · volvió a Nueva</small></li>' : `<li><b>Conversación ${s.session === 'STARTING' ? 'conectando…' : 'conectada'}</b><small>hoy 15:58 · el bot se calló</small></li>`}<li><b>Tomada por ${assignee(s)}</b><small>hoy 15:58</small></li><li><b>Solicitud creada por el bot</b><small>hoy 15:42 · Queja</small></li></ol></section>`;
setHTML($('#root'), shell(crumbs(), `<div id="h-head"></div><div class="cwrap"><div class="cpage"><div class="cinner" id="h-page"></div></div>
<aside class="drawer" id="h-drawer" aria-label="Conversación con ${CF}"><div id="h-drh"></div><div id="h-strip" class="dr-strip"></div><div id="h-banner"></div><div id="h-thread" class="thread scroll-t" tabindex="0" aria-label="Mensajes"></div><div id="h-comp"></div><div id="h-dlg"></div></aside>
<button type="button" class="launcher" id="h-launch" data-drawer-toggle></button></div>`));
HOSTS.head = s => `<header class="dhead"><button type="button" class="icon-btn" data-noop aria-label="Volver a Solicitudes">${ic('back')}</button><div class="t"><div class="meta">${reqBadge(s)}<span class="folio">S-000412</span><span>${SUBT[s.sub]}</span><span>Creada hoy 15:42</span></div><h1>${SUBT[s.sub]} · ${CUST}</h1></div><div class="acts">${headActs(s)}</div></header>`;
HOSTS.page = page;
HOSTS.drh = s => `<div class="dr-h"><div class="t"><h2>${CUST}</h2><p class="p2">WhatsApp ${PHONE}</p></div>${sessBadge(s)}<button type="button" class="icon-btn" data-drawer-toggle aria-label="Minimizar la conversación">${ic('down')}</button></div>`;
HOSTS.strip = s => `${winChip(s)}${staffActLine(s)}`;
HOSTS.banner = s => s.role === 'other-noconv' ? '' : bannerHTML(s, { fin: false });
HOSTS.thread = s => s.role === 'other-noconv' ? `<div class="empty" style="min-height:100%">${ic('lock')}<h2>No tienes permiso para ver esta conversación</h2><p>La atiende ${OTHER}.</p></div>` : threadHTML(s, { author: 'other' });
HOSTS.comp = s => composerHTML(s, { mobile: true });
HOSTS.launch = s => `${ic('message')}<span>${CUST} · ${s.session === 'ACTIVE' ? 'En vivo' : s.session === 'STARTING' ? 'Conectando…' : s.session === 'ENDED' || s.session === 'ENDING' ? 'Terminada' : 'Sin confirmar'}</span>${s.unread ? `<span class="n fig" aria-label="${s.unread} mensajes nuevos">${s.unread}</span>` : ''}`;
HOSTS.dlg = s => {
  if (!s.dlg) return '';
  const fin = s.dlg === 'finish';
  return `<div class="dstep" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="sh"><button type="button" class="icon-btn" data-dlg-close aria-label="Volver a la conversación">${ic('back')}</button><div><h3 id="dlg-t">${fin ? 'Finalizar conversación' : `¿Enviar plantilla a ${CF}?`}</h3><p class="p2">${fin ? finishSub(s) : `Solicitud S-000412 · ${CUST}`}</p></div></div><div class="sb">${fin ? finishBody(s) : tplBody(s)}</div><div class="sf">${fin ? finishFoot(s, 'Volver') : tplFoot(s)}</div></div>`;
};
const origPaint = paint;
function applyDrawer() { const open = S.drawer === 'open'; $('#h-drawer').hidden = !open; $('#h-launch').hidden = open; if (!open) setHTML($('#h-launch'), HOSTS.launch(S)); else S.unread = 0; }
document.addEventListener('click', e => {
  if (e.target.closest('[data-drawer-toggle]')) { S.drawer = S.drawer === 'open' ? 'min' : 'open'; applyDrawer(); if (S.drawer === 'open') { paint('thread'); S.stick = true; paint('thread'); } }
  if (e.target.closest('#t-in') && S.drawer !== 'open') { S.unread = (S.unread || 0) + 1; applyDrawer(); }
  if (e.target.closest('[data-finish-open], [data-claim]') && S.drawer !== 'open') { S.drawer = 'open'; applyDrawer(); }
});
const dt = document.createElement('span');
mountTools(`<button type="button" id="t-drawer" aria-pressed="true">${ic('panel', 'sm')}Cajón abierto</button>`);
document.addEventListener('click', e => { if (e.target.closest('#t-drawer')) { S.drawer = S.drawer === 'open' ? 'min' : 'open'; applyDrawer(); setHTML($('#t-drawer'), `${ic('panel', 'sm')}${S.drawer === 'open' ? 'Cajón abierto' : 'Cajón minimizado'}`); $('#t-drawer').setAttribute('aria-pressed', String(S.drawer === 'open')); if (S.drawer === 'open') { S.stick = true; paint('thread'); } } });
paint(); applyDrawer();
