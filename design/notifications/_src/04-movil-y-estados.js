/* 04: static mobile frames built from the same builders (data.js, parts.js) */
window.paint = () => {};
const mk = o => Object.assign({ tab: 'all', sim: 'ok', items: SEED(), more: true, markErr: false, rich: false, countErr: false }, o);
const uniq = (h, n) => h.replace(/\b(id|aria-describedby|aria-labelledby|aria-controls)="([^"]+)"/g, (m, a, v) => `${a}="f${n}-${v}"`);
const withP = (o, fn) => { const keep = Object.assign({}, P); Object.assign(P, o); try { return fn(); } finally { Object.assign(P, keep); } };
const mtop = (title, st, open) => `<div class="mbar"><button type="button" class="icon-btn" aria-label="Abrir menú">${ic('menu')}</button><span class="t">${title}</span><button type="button" class="icon-btn" aria-label="Buscar">${ic('search')}</button>${bellHTML(st, open, '')}<button type="button" class="icon-btn" aria-label="Abrir menú de usuario"><span class="avatar sm" aria-hidden="true">LM</span></button></div>`;
const bgCards = () => `<div class="mbody"><div class="title-row"><h1 class="page-title" style="font-size:1.75rem">Solicitudes</h1><span class="badge warning dot fig">11 abiertas</span></div>
  <article class="mc"><a href="#" class="name">Quiere saber si llega croquetas a Zapopan</a><div class="p2">S-000118 · Zona de entrega</div><span class="badge danger dot" style="width:max-content">Vencida</span></article>
  <article class="mc"><a href="#" class="name">Transferencia de $1,240.00 por confirmar</a><div class="p2">S-000121 · Comprobante</div><span class="badge warning dot" style="width:max-content">En atención · por Luis</span></article></div>`;
function full(st) { // full-screen panel
  const head = `<div class="nh"><button type="button" class="icon-btn" aria-label="Cerrar notificaciones">${ic('back')}</button><h2 id="nh">Notificaciones</h2>${st.sim === 'ok' && unreadN(st.items) ? `<span class="badge info fig">${countLabel(unreadN(st.items))} sin leer</span>` : ''}<a class="icon-btn" href="/perfil" aria-label="Preferencias de notificaciones">${ic('sliders')}</a></div>`;
  return `<div class="sheetfull" role="dialog" aria-modal="true" aria-labelledby="nh">${head}${panelSub(st)}<div class="nbody">${st.markErr ? markAlert() : ''}${listBody(st)}</div>${panelFoot(st)}</div>`;
}
const frame = (n, title, note, inner) => `<figure class="phone"><figcaption>${title}<small>${note}</small></figcaption><div class="screen">${uniq(inner, n)}</div></figure>`;
const caught = mk({ tab: 'unread' }); caught.items.forEach(n => { n.readAt = at(0); });
const prefsF = (o, n, title, note) => frame(n, title, note, `<div class="mbar"><button type="button" class="icon-btn" aria-label="Abrir menú">${ic('menu')}</button><span class="t">Mi perfil</span>${bellHTML(mk({}), false, '')}</div>${withP(o, prefsHTML)}`);
const FR = [
  frame(1, '1 · Campana con avisos', 'GET /notifications/unread-count → { count: 4 }', mtop('Solicitudes', mk({}), false) + bgCards()),
  frame(2, '2 · Panel abierto', 'Hoy / Antes, sin leer con punto y negrita, toque abre la solicitud', mtop('Solicitudes', mk({}), true) + full(mk({}))),
  frame(3, '3 · Vacío', 'Sin notificaciones todavía: qué aparecerá aquí', mtop('Solicitudes', mk({ items: [] }), true) + full(mk({ items: [], more: false }))),
  frame(4, '4 · «Estás al día»', 'Filtro Sin leer sin resultados; salida a «Ver todas»', mtop('Solicitudes', caught, true) + full(caught)),
  frame(5, '5 · Cargando', 'Esqueleto con el tamaño de las filas; las acciones esperan', mtop('Solicitudes', mk({ sim: 'loading' }), true) + full(mk({ sim: 'loading' }))),
  frame(6, '6 · Error al cargar', 'role="alert", reintento seguro (solo lectura)', mtop('Solicitudes', mk({ sim: 'error' }), true) + full(mk({ sim: 'error' }))),
  frame(7, '7 · Error al marcar todas', 'No se marcó nada; los avisos siguen sin leer', mtop('Solicitudes', mk({ markErr: true }), true) + full(mk({ markErr: true, more: false }))),
  prefsF({ sim: 'ok', email: true, sound: true, browser: 'default', err: null, busy: null }, 8, '8 · /perfil', 'GET /me/notification-preferences → { emailEnabled, soundEnabled }'),
  prefsF({ sim: 'saveerror', email: true, sound: true, browser: 'denied', err: 'soundEnabled', busy: null }, 9, '9 · Error al guardar y navegador bloqueado', 'PATCH falló: conserva el valor y ofrece Reintentar')
];
injectIcons();
setHTML($('#root'), FR.join(''));
mountTools('');
initTools(() => toast('Solo en las direcciones 01 a 03', 'Esta pantalla es estática.', 'info'));
$('#t-new').hidden = true;
