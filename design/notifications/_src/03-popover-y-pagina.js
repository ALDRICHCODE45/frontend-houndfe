/* Direction C behaviour */
S.rich = true;
function pageHTML() {
  const u = unreadN(S.items), off = u === 0 || S.sim !== 'ok';
  return `<div class="scroll"><main class="page" aria-labelledby="ptitle"><div class="pgrid"><div class="title-row"><h1 class="page-title" id="ptitle" tabindex="-1">Notificaciones</h1>${u ? `<span class="badge info fig">${countLabel(u)} sin leer</span>` : ''}</div>
  <p class="page-sub">Solicitudes nuevas, reasignaciones y avisos de tiempo de la sucursal Centro. Cada sucursal tiene su propia lista.</p>
  <section class="surface" aria-label="Lista de notificaciones"><div class="ptool">${segHTML(S)}<span class="grow"></span><button type="button" class="btn sm" data-markall data-fk="markall" ${off ? 'disabled aria-describedby="why"' : ''}>${ic('check-all', 'sm')}Marcar todas como leídas</button>${off && S.sim === 'ok' ? '<span class="help" id="why" style="flex-basis:100%;text-align:right">No hay avisos sin leer.</span>' : ''}</div>
  ${S.markErr ? markAlert() : ''}${listBody(Object.assign({}, S, { limit: 0 }))}</section></div></main></div>`;
}
window.paint = function () {
  const v = V.view, pop = panelHTML(Object.assign({}, S, { limit: 5 }), { close: true, cls: 'pop narrow', foot: '<button type="button" class="btn sm ghost" data-page data-fk="all-page">Ver todas</button>' });
  const body = v === 'prefs' ? prefsHTML() : v === 'page' ? pageHTML() : bgInbox();
  const crumbs = v === 'prefs' ? CR_PROFILE : v === 'page' ? '<span aria-current="page">Notificaciones</span>' : CR_INBOX;
  setHTML($('#root'), shell(crumbs, body, bellHTML(S, S.open, pop), { inbox: v === 'main' }));
};
document.addEventListener('click', e => { if (e.target.closest('[data-page]')) { V.view = 'page'; S.open = false; $('#t-view').value = 'page'; repaint(); } });
mountTools(stdTools([['main', 'Bandeja con campana'], ['page', 'Página /notificaciones'], ['prefs', 'Preferencias /perfil']]));
injectIcons();
initTools(simulateNew);
bindStd();
window.paint();
