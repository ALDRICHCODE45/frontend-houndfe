/* Board 01: direction A. */
injectIcons();
const OTHERS = () => `<div class="two"><section class="panel" aria-labelledby="h-sum"><h2 id="h-sum">Resumen del bot</h2><p class="quote">${CF} recibió una bolsa de Croquetas Premium Adulto 15 kg rota en su pedido V-1042 y pide que se la repongan.</p></section>
<section class="panel" aria-labelledby="h-need"><h2 id="h-need">Qué necesita el cliente</h2><p class="quote">Reposición de la bolsa dañada. La necesita para el fin de semana.</p></section></div>`;
const auditHTML = s => {
  const live = s.session !== 'WAITING';
  const rows = [];
  if (s.session === 'ENDING' || s.session === 'ENDED') rows.push(`<li class="done"><b>Resuelta por ${assignee(s)}</b><small>hoy ${hm(nowM(s))} · clasificación: ${s.sub === 'COMPLAINT' ? (OUTCOMES.find(o => o[0] === s.outcome) || ['', 'Reemplazo'])[1] : 'no aplica'}</small></li>`);
  if (live) rows.push(`<li><b>Conversación ${s.session === 'STARTING' ? 'conectando…' : 'conectada'}</b><small>hoy 15:58 · el bot se calló</small></li>`);
  rows.push(s.session === 'WAITING' ? `<li class="bad"><b>Liberada: el bot no confirmó</b><small>hoy 16:00 · volvió a Nueva</small></li>` : '', `<li><b>Tomada por ${assignee(s)}</b><small>hoy 15:58</small></li>`, `<li><b>Solicitud creada por el bot</b><small>hoy 15:42 · Queja</small></li>`);
  return `<section class="panel" aria-labelledby="h-aud"><h2 id="h-aud">Historial de la solicitud</h2><ol class="tl">${rows.join('')}</ol></section>`;
};
const railHTML = s => `<section class="panel" aria-labelledby="h-act"><h2 id="h-act">Qué hacer</h2><div style="display:grid;gap:8px">${actionsHTML(s)}</div></section>
<section class="panel" aria-labelledby="h-ses"><h2 id="h-ses">Esta conversación</h2><dl class="kv railkv"><dt>Sesión</dt><dd>${sessBadge(s)}</dd><dt>Atiende</dt><dd>${s.session === 'WAITING' ? 'Nadie todavía' : `${assignee(s)}${mine(s) ? ' (tú)' : ''}`}</dd><dt>Empezó</dt><dd>${s.session === 'WAITING' ? '—' : 'hoy 15:58'}</dd><dt>Cliente</dt><dd>${s.session === 'ACTIVE' ? (idle(s) ? `sin escribir desde hace ${dur(silentMin(s))}` : `escribió hace ${silentMin(s)} min`) : '—'}</dd><dt>Ventana</dt><dd>${winEff(s) === 'closed' ? 'cerrada' : `cierra en ${dur(closesIn(s))}`}</dd></dl>
<p class="help">${ic('info', 'xs')} Si ${CF} no escribe en 2 h, la conversación se finaliza sola.</p></section>
<section class="panel" aria-labelledby="h-cus"><div class="ph"><h2 id="h-cus">Cliente</h2><span class="badge success">De confianza</span></div><div style="display:flex;gap:12px;align-items:center"><span class="avatar" aria-hidden="true">MO</span><div style="min-width:0"><div class="name ell">${CUST}</div><div class="p2">${PHONE}</div></div></div>
<table class="plain" aria-label="Pedidos recientes"><thead><tr><th scope="col" style="padding-left:0">Pedido</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead><tbody><tr><td style="padding-left:0"><b class="fig">V-1042</b></td><td class="num">$1,840.00</td><td>Entregado</td></tr><tr><td style="padding-left:0"><b class="fig">V-0988</b></td><td class="num">$965.50</td><td>Entregado</td></tr></tbody></table></section>`;

setHTML($('#root'), shell(crumbs(), `<div id="h-head"></div><div class="scroll"><div class="dgrid"><div class="dmain">
<section class="panel chatp" aria-labelledby="h-conv-t"><div id="h-chathead"></div><div id="h-banner"></div><div id="h-thread" class="thread scroll-t" tabindex="0" aria-label="Conversación"></div><div id="h-comp"></div></section>
${OTHERS()}<div id="h-audit"></div></div><aside class="rail" aria-label="Acciones y datos" id="h-rail"></aside></div></div><div id="h-dlg"></div>`));
HOSTS.head = s => `<header class="dhead"><button type="button" class="icon-btn" data-noop aria-label="Volver a Solicitudes">${ic('back')}</button><div class="t"><div class="meta">${reqBadge(s)}<span class="folio">S-000412</span><span>Queja</span><span>Creada hoy 15:42</span></div><h1>${SUBT[s.sub]} · ${CUST}</h1></div></header>`;
HOSTS.chathead = s => `<div class="chat-h"><div><h2 id="h-conv-t">Conversación</h2><p class="p2">${CUST} · WhatsApp ${PHONE}</p></div><div class="chat-h-r">${sessBadge(s)}${winChip(s)}${staffActLine(s)}</div></div>`;
HOSTS.banner = s => s.role === 'other-noconv' ? '' : bannerHTML(s, { fin: false });
HOSTS.thread = s => s.role === 'other-noconv' ? `<div class="empty forbid">${ic('lock')}<h2>No tienes permiso para ver esta conversación</h2><p>La atiende ${OTHER}. Pide el permiso «Ver conversaciones del chatbot» para leerla.</p></div>` : threadHTML(s);
HOSTS.comp = s => composerHTML(s);
HOSTS.rail = railHTML;
HOSTS.audit = auditHTML;
HOSTS.dlg = s => {
  if (!s.dlg) return '';
  const fin = s.dlg === 'finish';
  return `<div class="sheet-scrim" data-dlg-close></div><aside class="sheet" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="sheet-head"><div class="t"><div class="meta">${fin ? finishSub(s) : `Solicitud S-000412 · ${CUST}`}</div><h2 id="dlg-t">${fin ? 'Finalizar conversación' : `¿Enviar plantilla a ${CF}?`}</h2></div><button type="button" class="icon-btn" data-dlg-close aria-label="Cerrar">${ic('x')}</button></div>
  <div class="sheet-body">${fin ? finishBody(s) : tplBody(s)}</div><div class="sheet-foot">${fin ? finishFoot(s) : tplFoot(s)}</div></aside>`;
};
mountTools('');
paint();
