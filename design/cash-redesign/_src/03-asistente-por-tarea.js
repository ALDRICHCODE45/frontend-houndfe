/* C · Asistente por tarea: slim status bar + one focused task at a time, full width, large money entry. */
function statusBar() {
  const st = STATUS[S.stage], n = nextAction();
  return `<div class="sbar" role="region" aria-label="Estado del turno">
    <span class="row" style="flex-wrap:nowrap;gap:12px"><span class="strong" style="color:var(--hf-heading);font-size:15px">Caja Principal</span>${st ? badge(st[0], st[1]) : badge('Sin turno', 't-neutral')}${drawerBadge()}</span>
    <span class="sb-sep" aria-hidden="true"></span>
    <span class="meta">${S.stage === 'sin-turno' ? 'Sin turno abierto' : `Laura Méndez · desde ${D.times.open} · fondo ${mx(D.fund)}`}</span>
    <span class="meta">${blind() && S.stage !== 'sin-turno' ? `<span class="row" style="gap:6px">${ic('eyeoff', 's14')}Totales ocultos hasta declarar</span>` : at('declarada') ? `Esperado ${mx(D.cashExp)} · diferencia <b style="color:var(--hf-warning)">${mx(D.diff)}</b>` : ''}</span>
    <span class="grow"></span>
    ${S.view !== 'inicio' && S.view !== n.view && n.kind === 'primary' ? `<span class="sb-lbl meta">Siguiente:</span>${btn(n.label, { kind: 'outline', view: n.view, cls: 'sb-btn' })}` : n.kind === 'wait' ? `<span class="row meta" style="gap:6px;flex-wrap:nowrap">${ic('clock', 's14')}${n.label}</span>` : ''}
    <button type="button" class="btn btn-ghost sb-btn" aria-haspopup="listbox">${isCajera() ? 'Tu turno' : 'Cambiar sesión'}${ic('chevd')}</button>
  </div>`;
}
const TASK_ORDER = ['apertura', 'movimientos', 'conteo', 'verificacion', 'entrega', 'recibir', 'liberar', 'cierre', 'corte'];
const STEP_OF = v => STEPS.find(s => s.id === (v === 'recibir' ? 'recepcion' : v));
const TASK_DESC = {
  apertura: 'Elige la caja, el fondo y confírmalo', movimientos: 'Entradas y salidas de efectivo con motivo', conteo: 'Congela la caja y declara cada canal a ciegas',
  verificacion: 'Otra persona recuenta el efectivo declarado', entrega: 'Reparte el efectivo entre fondo y retiro', recibir: 'Fondos o retiros que te entregaron',
  liberar: 'Deja la caja lista para la siguiente apertura', cierre: 'Un supervisor cierra y genera el folio', corte: 'Resultado del turno y PDF',
};
function availability(v) {
  const st = STEP_OF(v), s = stepState(st);
  if (v === 'recibir') return pendingForMe() ? 'now' : 'idle';
  if (v === 'movimientos') return S.stage === 'abierta' && isCajera() ? 'now' : s === 'done' ? 'done' : 'later';
  if (s === 'done') return 'done';
  if (s === 'current' || s === 'next') return (st.who === 'super') === isCajera() ? 'other' : 'now';
  if (s === 'blocked') return 'blocked';
  return 'later';
}
function home() {
  const n = nextAction();
  const list = TASK_ORDER.map(v => ({ v, a: availability(v) }));
  const row = ({ v, a }) => {
    const st = STEP_OF(v);
    const tag = { now: badge('Disponible', 't-info'), done: badge('Hecho', 't-success'), other: badge('Otra persona', 't-neutral'), blocked: badge('Bloqueado', 't-warning'), later: badge('Más adelante', 't-neutral'), idle: badge('Nada pendiente', 't-neutral') }[a];
    const why = a === 'done' || a === 'other' || a === 'blocked' ? stepMeta(st) : v === 'recibir' ? pendingLabel() : TASK_DESC[v];
    return `<li><button type="button" class="trow trow-${a}" data-view="${v}"><span class="tr-ic">${ic(st.icon, 's20')}</span><span class="grow"><span class="tr-t">${TITLES[v]}</span><span class="meta" style="display:block">${why}</span></span>${tag}${ic('chev')}</button></li>`;
  };
  const now = list.filter(x => x.a === 'now' && x.v !== n.view), rest = list.filter(x => x.a !== 'now' && x.v !== n.view);
  return `<div class="c-col">
    <h1 class="page-title">${isCajera() ? 'Hola, Laura' : 'Hola, Andrés'}</h1>
    <p class="page-sub">${D.store} · ${D.date}</p>
    <section class="hero-c ${n.kind}" aria-labelledby="c-next">
      <p class="next-k">${n.kind === 'primary' ? 'Te toca' : 'En espera'}</p>
      <h2 id="c-next" class="c-next-t">${n.label}</h2>
      <p class="c-next-d">${n.why}</p>
      <div class="row">${n.kind === 'primary' ? btn(n.label, { kind: 'primary', view: n.view, cls: 'btn-lg' }) : ''}${n.alt ? btn(n.alt.label, { kind: 'outline', view: n.alt.view, cls: 'btn-lg' }) : ''}</div>
    </section>
    ${now.length ? `<h2 class="c-h">También puedes</h2><ul class="tlist">${now.map(row).join('')}</ul>` : ''}
    <h2 class="c-h">Resto del turno</h2><ul class="tlist">${rest.map(row).join('')}</ul>
  </div>`;
}
function taskView() {
  const v = S.view, i = TASK_ORDER.indexOf(v), st = STEP_OF(v);
  return `<div class="c-col">
    <nav class="row" aria-label="Volver"><button type="button" class="btn btn-ghost" style="margin-left:-12px" data-view="inicio">${ic('back')}Tareas del turno</button></nav>
    <header class="c-task-h"><p class="meta">Paso ${i + 1} de ${TASK_ORDER.length} · ${WHO[st.who]}</p><h1 class="page-title" tabindex="-1" data-focus-title>${TITLES[v]}</h1><p class="page-sub">${TASK_DESC[v]}</p></header>
    <div class="c-panel panel-host">${PANELS[v]()}</div>
  </div>`;
}
function render() {
  document.documentElement.dataset.theme = S.theme;
  $('#root').innerHTML = `
  <div class="app c-app">
    <header class="chrome"><span class="brand"><b>HF</b>HoundFe</span><nav class="crumbs" aria-label="Ruta"><a href="#">Punto de venta</a>${ic('chev', 's14')}<a href="#" data-view="inicio" ${S.view === 'inicio' ? 'aria-current="page"' : ''}>Caja</a>${S.view !== 'inicio' ? ic('chev', 's14') + `<span aria-current="page">${TITLES[S.view]}</span>` : ''}</nav><span class="who">${D.store}<span class="avatar" aria-hidden="true">${me().ini}</span>${me().name}</span></header>
    ${statusBar()}
    <main class="c-main">${S.view === 'inicio' ? home() : taskView()}</main>
  </div>
  ${demoBar()}`;
}
boot(render);
