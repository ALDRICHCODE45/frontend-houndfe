/* Board 02: direction B. */
injectIcons();
S.tab = 'ctx';
const ordersTab = () => `<div class="ctxsec"><h3>Pedidos recientes de ${CF}</h3><table class="plain" aria-label="Pedidos recientes"><thead><tr><th scope="col" style="padding-left:0">Pedido</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead><tbody><tr><td style="padding-left:0"><b class="fig">V-1042</b></td><td class="num">$1,840.00</td><td>Entregado hoy</td></tr><tr><td style="padding-left:0"><b class="fig">V-0988</b></td><td class="num">$965.50</td><td>Entregado</td></tr><tr><td style="padding-left:0"><b class="fig">V-0931</b></td><td class="num">$420.00</td><td>Entregado</td></tr></tbody></table></div>
<div class="ctxsec"><h3>Productos del pedido V-1042</h3><table class="plain" aria-label="Productos del pedido"><thead><tr><th scope="col" style="padding-left:0">Producto</th><th scope="col" class="num">Cant.</th></tr></thead><tbody><tr><td style="padding-left:0">Croquetas Premium Adulto 15 kg</td><td class="num">2</td></tr><tr><td style="padding-left:0">Arena Sanitaria 10 kg</td><td class="num">1</td></tr></tbody></table></div>`;
const histTab = s => `<div class="ctxsec"><h3>Historial de la solicitud</h3><ol class="tl">${s.session === 'ENDING' || s.session === 'ENDED' ? `<li class="done"><b>Resuelta por ${assignee(s)}</b><small>hoy ${hm(nowM(s))}</small></li>` : ''}${s.session !== 'WAITING' ? `<li><b>Conversación ${s.session === 'STARTING' ? 'conectando…' : 'conectada'}</b><small>hoy 15:58 · el bot se calló</small></li>` : '<li class="bad"><b>Liberada: el bot no confirmó</b><small>hoy 16:00 · volvió a Nueva</small></li>'}<li><b>Tomada por ${assignee(s)}</b><small>hoy 15:58</small></li><li><b>Solicitud creada por el bot</b><small>hoy 15:42 · Queja</small></li></ol></div>
<div class="ctxsec"><h3>Otras solicitudes abiertas de ${CF}</h3><p class="p2">Ninguna. Esta es su única solicitud abierta.</p></div>`;
const ctxTab = s => `<div class="ctxsec"><h3>Resumen del bot</h3><p class="quote">${CF} recibió una bolsa de Croquetas Premium Adulto 15 kg rota en su pedido V-1042 y pide que se la repongan.</p></div>
<div class="ctxsec"><h3>Qué necesita el cliente</h3><p class="quote">Reposición de la bolsa dañada. La necesita para el fin de semana.</p></div>
<div class="ctxsec"><div class="ph"><h3>Cliente</h3><span class="badge success">De confianza</span></div><dl class="kv" style="margin-top:6px"><dt>Nombre</dt><dd>${CUST}</dd><dt>Teléfono</dt><dd>${PHONE}</dd><dt>Cliente desde</dt><dd>ene 2025</dd><dt>Lista de precios</dt><dd>Público general</dd></dl><p class="help" style="margin-top:6px">${ic('lock', 'xs')} El teléfono completo requiere el permiso «Ver teléfono completo».</p></div>
<div class="ctxsec"><h3>Tiempo límite</h3><div class="sla ok">${ic('clock', 'sm')}<span><b>Quedan 3 h 40 min</b><small>para resolverla</small></span></div></div>`;
const headActs = s => {
  if (s.session === 'WAITING') return `<button type="button" class="btn primary" data-claim>${ic('user', 'sm')}Atender</button>`;
  if (s.session !== 'ACTIVE') return '';
  if (mine(s)) return `${s.role === 'me' ? `<button type="button" class="btn" data-noop>${ic('swap', 'sm')}Reasignar…</button>` : ''}<button type="button" class="btn primary" data-finish-open>${ic('check-circle', 'sm')}Finalizar conversación</button>`;
  if (s.role === 'reassigner') return `<button type="button" class="btn" data-noop>${ic('swap', 'sm')}Reasignar…</button><button type="button" class="btn" data-finish-open>${ic('check-circle', 'sm')}Finalizar en su lugar…</button>`;
  return '';
};
setHTML($('#root'), shell(crumbs(), `<div id="h-head"></div><div class="ws"><section class="pane-chat" aria-label="Conversación con ${CF}"><div id="h-strip"></div><div id="h-banner"></div><div id="h-thread" class="thread scroll-t" tabindex="0" aria-label="Mensajes"></div><div id="h-comp"></div></section>
<aside class="pane-ctx" aria-label="Contexto de la solicitud"><div class="ctx-tabs"><div class="seg" role="group" aria-label="Contexto" id="h-tabs"></div></div><div id="h-ctx"></div></aside></div><div id="h-dlg"></div>`));
HOSTS.head = s => `<header class="bhead"><button type="button" class="icon-btn" data-noop aria-label="Volver a Solicitudes">${ic('back')}</button><div class="who"><span class="avatar" aria-hidden="true">MO</span><div style="min-width:0"><h1>${CUST}</h1><div class="meta">${reqBadge(s)}<span class="folio">S-000412</span><span>${SUBT[s.sub]}</span><span>WhatsApp ${PHONE}</span></div></div></div><div class="acts">${headActs(s)}</div></header>`;
HOSTS.strip = s => `<div class="strip">${sessBadge(s)}${winChip(s)}${staffActLine(s)}</div>`;
HOSTS.banner = s => s.role === 'other-noconv' ? '' : bannerHTML(s, { fin: false });
HOSTS.thread = s => s.role === 'other-noconv' ? `<div class="empty" style="min-height:100%">${ic('lock')}<h2>No tienes permiso para ver esta conversación</h2><p>La atiende ${OTHER}. Pide el permiso «Ver conversaciones del chatbot» para leerla.</p></div>` : threadHTML(s, { compact: true, author: 'other' });
HOSTS.comp = s => composerHTML(s);
HOSTS.tabs = s => [['ctx', 'Contexto'], ['ord', 'Pedidos'], ['his', 'Historial']].map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${s.tab === k}">${l}</button>`).join('');
HOSTS.ctx = s => s.tab === 'ord' ? ordersTab() : s.tab === 'his' ? histTab(s) : ctxTab(s);
HOSTS.dlg = s => {
  if (!s.dlg) return '';
  if (s.dlg === 'tpl') return `<div class="modal-scrim"><div class="modal sm" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="modal-h"><div class="t"><div class="meta">Solicitud S-000412 · ${CUST}</div><h2 id="dlg-t">¿Enviar plantilla a ${CF}?</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">${ic('x')}</button></div><div class="modal-b">${tplBody(s)}</div><div class="modal-f">${tplFoot(s)}</div></div></div>`;
  const body = finishBody(s);
  return `<div class="modal-scrim"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="modal-h"><div class="t"><div class="meta">${finishSub(s)}</div><h2 id="dlg-t">Finalizar conversación</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">${ic('x')}</button></div><div class="modal-b ${s.sub === 'COMPLAINT' ? 'cols' : ''}">${s.sub === 'COMPLAINT' ? finishCols(s) : `<div class="dlg-body">${body}</div>`}</div><div class="modal-f">${finishFoot(s)}</div></div></div>`;
};
/* two columns: note (and the warning) left, outcome right: split the shared form body */
function finishCols(s) {
  const tmp = document.createElement('div'); setHTML(tmp, finishBody(s));
  const fs = tmp.querySelector('fieldset'); const right = fs ? fs.outerHTML : ''; if (fs) fs.remove();
  return `<div class="colL">${tmp.innerHTML}</div><div class="colR">${right}</div>`;
}
document.addEventListener('click', e => { const tb = e.target.closest('[data-tab]'); if (tb) { S.tab = tb.dataset.tab; paint('tabs', 'ctx'); } });
mountTools('');
paint();
