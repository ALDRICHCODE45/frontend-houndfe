/* B · Tablero de caja: header with the shift and one primary action, task cards, tasks open in a side panel. */
const CARD_STATE = {
  done: ['Hecho', 't-success'], current: ['Ahora', 't-info'], next: ['Siguiente', 't-info'], blocked: ['Bloqueado', 't-warning'], upcoming: ['Después', 't-neutral'],
};
function cardState(st) {
  const s = stepState(st);
  if ((s === 'current' || s === 'next') && st.who !== 'todos' && ((st.who === 'super') === isCajera())) return ['Otra persona', 't-neutral'];
  return CARD_STATE[s];
}
function cards() {
  const order = ['apertura', 'movimientos', 'conteo', 'verificacion', 'entrega', 'recepcion', 'liberar', 'cierre', 'corte'];
  return order.map(id => {
    const st = STEPS.find(x => x.id === id), [w, tone] = cardState(st), s = stepState(st);
    const view = id === 'recepcion' ? 'recibir' : id;
    const title = id === 'recepcion' ? 'Por recibir' : TITLES[view];
    const desc = id === 'recepcion' ? pendingLabel() : stepMeta(st);
    const isNext = nextAction().view === view && nextAction().kind === 'primary';
    return `<article class="tcard${isNext ? ' is-next' : ''}${s === 'upcoming' ? ' is-later' : ''}">
      <div class="between"><span class="row" style="flex-wrap:nowrap;gap:10px"><span class="tc-ic">${ic(st.icon)}</span><h3 class="tc-t">${title}</h3></span>${badge(w, tone)}</div>
      <p class="meta tc-d">${desc}</p>
      <button type="button" class="btn ${isNext ? 'btn-outline' : 'btn-ghost'} tc-b" data-view="${view}">${s === 'done' ? 'Ver detalle' : isNext ? 'Ir a ' + title.toLowerCase() : 'Abrir'}${ic('chev')}</button>
    </article>`;
  }).join('');
}
function hero() {
  const n = nextAction(), st = STATUS[S.stage], b = blind();
  return `<section class="hero card" aria-labelledby="hero-h">
    <div class="hero-main">
      <p class="meta row">${st ? badge(st[0], st[1]) : badge('Sin turno', 't-neutral')}${drawerBadge()}<span>${S.stage === 'sin-turno' ? 'Sin turno abierto' : `Laura Méndez · desde ${D.times.open}`}</span></p>
      <h2 id="hero-h" class="h-detail">${n.kind === 'primary' ? n.label : n.label}</h2>
      <p class="meta" style="max-width:60ch">${n.why}</p>
      <div class="row" style="margin-top:8px">${n.kind === 'primary' ? btn(n.label, { kind: 'primary', view: n.view }) : `<span class="badge t-neutral noicon">${ic('clock', 's14')} En espera de otra persona</span>`}${n.alt ? btn(n.alt.label, { kind: 'outline', view: n.alt.view }) : ''}</div>
    </div>
    <dl class="hero-facts">
      <div><dt>Fondo inicial</dt><dd class="money">${S.stage === 'sin-turno' ? '—' : mx(D.fund)}</dd></div>
      <div><dt>Efectivo esperado</dt><dd>${S.stage === 'sin-turno' ? '—' : b ? `<span class="hidden-amt">${ic('eyeoff', 's14')}Oculto hasta declarar</span>` : `<span class="money">${mx(D.cashExp)}</span>`}</dd></div>
      <div><dt>Diferencia</dt><dd>${at('declarada') && !b ? `<span class="strong" style="color:var(--hf-warning)">${mx(D.diff)}</span>` : '<span class="meta">—</span>'}</dd></div>
    </dl>
  </section>`;
}
function side() {
  const recv = `<section class="card pad stack-m" aria-labelledby="pr-h"><div class="between"><h2 id="pr-h" class="h-sec">Por recibir</h2>${pendingForMe() ? '<span class="count">1</span>' : ''}</div>
    ${pendingForMe() ? `<div class="pr-item"><div><span class="strong">Retiro · ${mx(7242.5)}</span><span class="meta" style="display:block">De Laura Méndez · Caja Principal · 16:40</span></div>${btn('Recibir', { kind: 'outline', view: 'recibir' })}</div>` : '<p class="meta">Nadie te ha entregado efectivo. Los fondos y retiros que te entreguen aparecen aquí.</p>'}</section>`;
  if (isCajera()) return `${recv}
    <section class="card pad stack-m" aria-labelledby="how-h"><h2 id="how-h" class="h-sec">Cómo avanza tu turno</h2>
      <ol class="how">${['Abres con el fondo confirmado', 'Vendes y registras entradas o salidas', 'Inicias el conteo y declaras a ciegas', 'Un supervisor verifica', 'Entregas el efectivo y lo reciben', 'Liberas el cajón', 'Un supervisor cierra y genera el corte'].map((t, i) => `<li><span class="how-n">${i + 1}</span>${t}</li>`).join('')}</ol>
      <p class="meta">Puedes abrir cualquier tarjeta en cualquier momento; cada una dice si ya se puede hacer.</p></section>`;
  return `<section class="card stack-s" aria-labelledby="ss-h" style="padding:16px 0 8px"><h2 id="ss-h" class="h-sec" style="padding:0 16px">Sucursal · 3 sesiones</h2>
    <table class="ptable"><caption class="sr">Sesiones de la sucursal</caption><thead><tr><th>Caja</th><th>Pendiente</th></tr></thead><tbody>
    ${D.sessions.map((s, i) => `<tr class="${i === 0 ? 'sel' : ''}"><td><span class="strong" style="color:var(--hf-heading)">${s.reg}</span><span class="meta" style="display:block">${s.who}</span></td><td>${s.mine ? (nextAction().kind === 'primary' ? badge(nextAction().label.replace(/ de \$.*/, ''), 't-info') : badge(STAGE_LABEL[S.stage], 't-neutral')) : badge(s.next, s.tone)}</td></tr>`).join('')}
    </tbody></table></section>${recv}`;
}
function sheet() {
  if (S.view === 'inicio') return '';
  return `<div class="scrim" data-view="inicio" aria-hidden="true"></div>
  <aside class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">
    <header class="sheet-head"><div><p class="meta">Caja Principal · Laura Méndez</p><h2 id="sheet-h" class="h-detail" tabindex="-1" data-focus-title>${TITLES[S.view]}</h2></div>${`<button type="button" class="btn btn-ghost" data-view="inicio" aria-label="Cerrar panel">${ic('x', 's20')}</button>`}</header>
    <div class="sheet-body panel-host">${PANELS[S.view]()}</div>
  </aside>`;
}
function render() {
  document.documentElement.dataset.theme = S.theme;
  $('#root').innerHTML = `
  <div class="app">
    <header class="chrome"><span class="brand"><b>HF</b>HoundFe</span><nav class="crumbs" aria-label="Ruta"><a href="#">Punto de venta</a>${ic('chev', 's14')}<span aria-current="page">Caja</span></nav><span class="who">${D.store}<span class="avatar" aria-hidden="true">${me().ini}</span>${me().name}</span></header>
    <main class="b-main">
      <header class="b-head">
        <div><h1 class="page-title">Caja</h1><p class="page-sub">${D.store} · ${D.date}</p></div>
        <div class="field" style="min-width:300px"><label for="b-shift" class="small meta">${isCajera() ? 'Tu turno' : 'Sesión'}</label><button id="b-shift" type="button" class="input" aria-haspopup="listbox" style="display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left"><span><span class="strong" style="color:var(--hf-heading)">Caja Principal</span> <span class="meta">· Laura Méndez</span></span>${ic('chevd')}</button></div>
      </header>
      <div class="b-grid">
        <div class="stack">${hero()}<div class="tgrid" role="list" aria-label="Tareas de la caja">${cards()}</div></div>
        <div class="stack">${side()}</div>
      </div>
    </main>
  </div>
  ${sheet()}
  ${demoBar()}`;
}
boot(render);
