/* 04 · Móvil 390 y estados de la dirección A (recomendada). Static boards: each frame sets S, then reuses the shared panels. */
const set = o => Object.assign(S, { role: 'cajera', stage: 'abierta', view: 'inicio', fundChoice: 'float', fundConfirmed: false, showErrors: false, lastMove: null }, o);
function mTop(title, back) {
  return `<header class="m-top">${back ? `<button type="button" class="btn btn-ghost m-ib" aria-label="Volver a Caja">${ic('back', 's20')}</button>` : `<button type="button" class="btn btn-ghost m-ib" aria-label="Abrir menú">${ic('menu', 's20')}</button>`}<span class="m-title">${title}</span><span class="avatar" aria-hidden="true">${me().ini}</span></header>`;
}
function mShift() {
  const st = STATUS[S.stage];
  return `<div class="m-shift"><p class="row">${st ? badge(st[0], st[1]) : badge('Sin turno', 't-neutral')}${drawerBadge()}</p><h2 class="h-detail">Caja Principal</h2><p class="meta">Laura Méndez · desde ${D.times.open} · fondo ${mx(D.fund)}</p></div>`;
}
function mTimeline() {
  return `<ol class="m-tl" aria-label="Pasos del turno">${STEPS.map(st => {
    const s = stepState(st);
    const dot = s === 'done' ? `<span class="tl-dot done">${ic('check', 's14')}</span>` : s === 'current' ? '<span class="tl-dot cur"></span>' : s === 'next' ? '<span class="tl-dot nxt"></span>' : s === 'blocked' ? `<span class="tl-dot blk">${ic('lock', 's14')}</span>` : '<span class="tl-dot"></span>';
    return `<li class="m-tl-i is-${s}"><a href="#" class="m-tl-a">${dot}<span class="grow"><span class="m-tl-t">${st.l}</span><span class="meta" style="display:block">${stepMeta(st)}</span></span>${s !== 'upcoming' ? ic('chev') : ''}</a></li>`;
  }).join('')}</ol>`;
}
function phone(caption, body, bar = '') {
  return `<figure class="ph-wrap"><figcaption class="ph-cap">${caption}</figcaption><div class="phone"><div class="ph-scroll">${body}</div>${bar ? `<div class="m-bar">${bar}</div>` : ''}</div></figure>`;
}
function tile(caption, body) { return `<figure class="ph-wrap"><figcaption class="ph-cap">${caption}</figcaption><div class="tile">${body}</div></figure>`; }

function phones() {
  set({});
  const n = nextAction();
  const p1 = phone('1 · Tu turno (cajera, abierta)', `${mTop('Caja')}<div class="m-pad stack">${mShift()}
    <section class="next-m"><p class="next-k">Siguiente paso</p><h3 class="h-sec">${n.label}</h3><p class="meta">${n.why}</p></section>
    <a href="#" class="card pad m-recv">${ic('inbox')}<span class="grow"><span class="strong">Por recibir</span><span class="meta" style="display:block">${pendingLabel()}</span></span>${ic('chev')}</a>
    ${mTimeline()}</div>`, `${btn('Entrada o salida', { kind: 'outline', view: 'movimientos' })}${btn('Iniciar conteo', { kind: 'primary', view: 'conteo' })}`);
  set({ stage: 'sin-turno', showErrors: true });
  const p2 = phone('2 · Abrir caja con errores (resumen + junto al campo)', `${mTop('Abrir caja', true)}<div class="m-pad panel-host">${panelApertura()}</div>`);
  set({ stage: 'congelada' });
  const p3 = phone('3 · Declarar a ciegas con denominaciones', `${mTop('Conteo y declaración', true)}<div class="m-pad panel-host">${panelConteo()}</div>`);
  set({ role: 'super', stage: 'liberada' });
  const p4 = phone('4 · Supervisor: cerrar caja', `${mTop('Cerrar caja', true)}<div class="m-pad stack">${mShift()}<div class="panel-host">${panelCierre()}</div></div>`);
  set({ role: 'super', stage: 'entregada' });
  const p5 = phone('5 · Supervisor: por recibir', `${mTop('Por recibir', true)}<div class="m-pad panel-host">${panelRecibir()}</div>`);
  set({ role: 'super', stage: 'cerrada' });
  const p6 = phone('6 · Corte de caja con PDF', `${mTop('Corte de caja', true)}<div class="m-pad panel-host">${panelCorte()}</div>`);
  return [p1, p2, p3, p4, p5, p6].join('');
}
function states() {
  set({});
  const loading = tile('Cargando', `<div role="status" class="stack"><span class="sr">Cargando tu turno…</span>
    <div class="skel" style="width:120px;height:24px"></div><div class="skel" style="width:200px;height:28px"></div><div class="skel" style="width:260px;height:16px"></div>
    <div class="skel" style="height:104px;border-radius:12px"></div>
    ${[1, 2, 3, 4].map(() => '<div class="row" style="flex-wrap:nowrap;gap:12px"><div class="skel" style="width:24px;height:24px;border-radius:9999px"></div><div class="grow stack-s"><div class="skel" style="width:70%;height:14px"></div><div class="skel" style="width:45%;height:12px"></div></div></div>').join('')}
    <p class="meta">Cargando tu turno…</p></div>`);
  const noRegs = tile('Vacío: no hay cajas', `<div class="empty">${ic('store')}<h3>Aún no hay cajas</h3><p>Crea la primera para poder abrir turnos en ${D.store}.</p>${btn('Crear caja', { kind: 'primary', icon: 'plus' })}</div><p class="meta" style="text-align:center">Sin permiso para crear: «Pide a un encargado que cree la primera caja».</p>`);
  set({ stage: 'sin-turno' });
  const noShift = tile('Vacío: sin turno', `<div class="empty">${ic('wallet')}<h3>Aún no tienes un turno abierto</h3><p>Caja Principal está disponible y tiene un fondo de ${mx(D.float.a)} de ${D.float.from} listo para recibir.</p>${btn('Abrir caja', { kind: 'primary', view: 'apertura' })}</div>`);
  const error = tile('Error', `<div class="empty error" role="alert">${ic('warn')}<h3>No se pudo cargar tu turno</h3><p>Revisa la conexión e inténtalo de nuevo. No se perdió ningún dato: los movimientos ya registrados están guardados.</p>${btn('Reintentar', { kind: 'outline', icon: 'refresh' })}</div>`);
  set({ stage: 'declarada' });
  const noPerm = tile('Sin permiso (por acción)', `<div class="stack">${forbidden('verificar', 'create:CashVerification')}<div class="empty">${ic('lock')}<h3>No tienes acceso a Caja</h3><p>Pide a un encargado el permiso «Ver sesiones de caja».</p></div></div>`);
  set({ stage: 'abierta', lastMove: 'Salida de $350.00 registrada a las 15:12 · Compra de bolsas para mostrador' });
  const blindT = tile('Ventana ciega (abierta → declarar)', `<div class="stack"><dl class="ctx-kv card pad"><div><dt>Fondo inicial</dt><dd class="money">${mx(D.fund)}</dd></div><div><dt>Efectivo esperado</dt><dd><span class="hidden-amt">${ic('eyeoff', 's14')}Oculto hasta declarar</span></dd></div><div><dt>Movimientos</dt><dd><span class="hidden-amt">Ocultos hasta declarar</span></dd></div></dl>
    <p class="notice info" role="status">${ic('check', 's14')}${S.lastMove}</p>${blindNote(' Lo que registres sí cuenta para lo esperado.')}</div>`);
  set({ stage: 'entregada' });
  const locked = tile('Bloqueado', `<div class="stack">
    <div class="callout">${ic('lock')}<div><b>La caja está congelada</b><br><span class="meta">Desde las ${D.times.count} no admite cobros en efectivo ni movimientos.</span></div></div>
    <button type="button" class="rcard" role="radio" aria-checked="false" aria-disabled="true"><span class="mark">${ic('check')}</span><span class="grow"><span class="between"><span class="rc-title">Caja Estética</span>${badge('Cajón sin liberar', 't-warning')}</span><span class="rc-desc">Turno de ayer de Sofía Torres: falta liberar el cajón</span></span></button>
    <div class="stack-s"><button type="button" class="btn btn-outline btn-block" aria-disabled="true" aria-describedby="lk-r">Liberar cajón de Caja Principal</button><p class="meta" id="lk-r">Se habilita cuando Andrés Salazar y Diego Ramírez reciban sus entregas.</p></div></div>`);
  return [loading, noRegs, noShift, error, noPerm, blindT, locked].join('');
}
function render() {
  document.documentElement.dataset.theme = S.theme;
  const ph = phones(), stt = states();
  set({});
  $('#root').innerHTML = `<main class="board">
    <header class="board-h"><h1 class="page-title">Caja · móvil 390 y estados</h1><p class="page-sub">Dirección A «Turno como línea de tiempo» (recomendada). Mismos componentes y tokens; el paso abierto ocupa la pantalla y la acción principal va en la barra inferior.</p></header>
    <section aria-labelledby="h-ph"><h2 id="h-ph" class="h-sec board-sec">Pantallas en 390 px</h2><div class="ph-grid">${ph}</div></section>
    <section aria-labelledby="h-st"><h2 id="h-st" class="h-sec board-sec">Estados</h2><div class="ph-grid">${stt}</div></section>
  </main>
  <div class="demo" role="region" aria-label="Controles de la demostración"><span class="dl">Demostración</span><div class="seg" role="radiogroup" aria-label="Tema"><button type="button" role="radio" aria-checked="${S.theme === 'light'}" data-demo="theme:light">Claro</button><button type="button" role="radio" aria-checked="${S.theme === 'dark'}" data-demo="theme:dark">Oscuro</button></div></div>`;
}
document.addEventListener('click', e => { const d = e.target.closest('[data-demo]'); if (d) { S.theme = d.dataset.demo.split(':')[1]; render(); } });
{ const q = new URLSearchParams(location.search); q.get('theme') && (S.theme = q.get('theme')); }
render();
