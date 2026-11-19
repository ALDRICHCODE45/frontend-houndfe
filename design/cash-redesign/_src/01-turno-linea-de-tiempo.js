/* A · Turno como línea de tiempo (recomendada): session list · timeline with inline task · context column. */
function stepDot(s) {
  if (s === 'done') return `<span class="tl-dot done">${ic('check', 's14')}</span>`;
  if (s === 'current') return `<span class="tl-dot cur"></span>`;
  if (s === 'next') return `<span class="tl-dot nxt"></span>`;
  if (s === 'blocked') return `<span class="tl-dot blk">${ic('lock', 's14')}</span>`;
  return `<span class="tl-dot"></span>`;
}
const STATE_WORD = { done: 'Hecho', current: 'En curso', next: 'Siguiente', blocked: 'Bloqueado', upcoming: 'Después' };
function sessionList() {
  if (isCajera()) {
    const st = STATUS[S.stage];
    return `<h2 class="side-h">Tu turno</h2>
      ${S.stage === 'sin-turno' ? `<a href="#" class="sess" aria-current="true" data-view="apertura"><span class="strong">Sin turno abierto</span><span class="meta">Abre uno para empezar a vender</span></a>` : `<a href="#" class="sess" aria-current="true" data-view="inicio"><span class="between"><span class="strong">Caja Principal</span>${badge(st[0], st[1])}</span><span class="meta">Laura Méndez · desde ${D.times.open}</span></a>`}
      <p class="meta side-note">Se elige solo: tu última sesión con el cajón sin liberar.</p>`;
  }
  const rows = D.sessions.map((s, i) => {
    const st = s.mine ? STATUS[S.stage] : [s.st, s.tone];
    const next = s.mine ? (nextAction().kind === 'primary' ? nextAction().label : STAGE_LABEL[S.stage]) : s.next;
    return `<a href="#" class="sess" ${i === 0 ? 'aria-current="true"' : ''} data-view="inicio"><span class="between"><span class="strong">${s.reg}</span>${st ? badge(st[0], st[1]) : badge('Sin turno', 't-neutral')}</span><span class="meta">${s.who} · ${s.since}</span><span class="sess-next">${next}</span></a>`;
  }).join('');
  return `<h2 class="side-h">Sesiones de la sucursal · 3</h2>${rows}`;
}
function nextBar() {
  const n = nextAction();
  if (S.view !== 'inicio' && S.view === n.view) return '';
  return `<section class="next ${n.kind}" aria-labelledby="next-h">
    <div class="grow"><p class="next-k">${n.kind === 'primary' ? 'Siguiente paso' : 'En espera'}</p><h2 id="next-h" class="next-t">${n.label}</h2><p class="meta">${n.why}</p></div>
    <div class="row" style="flex-wrap:nowrap">${n.alt ? btn(n.alt.label, { kind: 'outline', view: n.alt.view }) : ''}${n.kind === 'primary' ? btn(n.label, { kind: S.view === 'inicio' ? 'primary' : 'outline', view: n.view }) : ''}</div>
  </section>`;
}
function timeline() {
  const items = STEPS.map(st => {
    const s = stepState(st), open = S.view === st.id;
    const reach = s !== 'upcoming';
    const view = st.id === 'recepcion' ? 'recibir' : st.id;
    return `<li class="tl-item is-${s}${open ? ' is-open' : ''}">
      ${stepDot(s)}
      <div class="tl-body">
        <div class="tl-head">
          <div class="grow"><h3 class="tl-t">${st.l}</h3><p class="meta">${stepMeta(st)}</p></div>
          <span class="tl-who">${WHO[st.who]}</span>
          ${open ? btn('Ocultar', { kind: 'ghost', view: 'inicio' }) : reach ? `<button type="button" class="btn btn-ghost" data-view="${view}" aria-label="${s === 'done' ? 'Ver' : 'Abrir'}: ${st.l}">${s === 'done' ? 'Ver' : 'Abrir'}${ic('chev')}</button>` : ''}
        </div>
        ${open ? `<div class="tl-panel panel-host"><h3 class="sr" tabindex="-1" data-focus-title>${TITLES[view]}</h3>${PANELS[view]()}</div>` : ''}
      </div>
      <span class="sr">Estado: ${STATE_WORD[s]}</span>
    </li>`;
  }).join('');
  return `<ol class="tl" aria-label="Pasos del turno de Caja Principal">${items}</ol>`;
}
function context() {
  const b = blind();
  const rows = S.stage === 'sin-turno' ? '<p class="meta">Abre tu turno para ver su resumen.</p>' : `
    <dl class="ctx-kv">
      <div><dt>Responsable</dt><dd>Laura Méndez</dd></div>
      <div><dt>Abierta</dt><dd>${D.date.split(' ').slice(1).join(' ')}, ${D.times.open}</dd></div>
      <div><dt>Fondo inicial</dt><dd class="money">${mx(D.fund)}</dd></div>
      <div><dt>Efectivo esperado</dt><dd>${b ? `<span class="hidden-amt">${ic('eyeoff', 's14')}Oculto hasta declarar</span>` : `<span class="money">${mx(D.cashExp)}</span>`}</dd></div>
      ${at('declarada') ? `<div><dt>Declarado</dt><dd class="money">${mx(D.cashDecl)}</dd></div><div><dt>Diferencia</dt><dd class="strong" style="color:var(--hf-warning)">${mx(D.diff)} faltante</dd></div>` : ''}
      <div><dt>Cajón</dt><dd>${at('liberada') ? 'Liberado ' + D.times.released : 'Sin liberar'}</dd></div>
    </dl>`;
  const p = pendingForMe();
  return `
    <section class="card pad stack-m" aria-labelledby="ctx-h"><h2 id="ctx-h" class="h-sec">Resumen</h2>${rows}</section>
    <a href="#" class="card pad recv" data-view="recibir" aria-label="Por recibir: ${p ? '1 entrega' : 'ninguna'}">
      <span class="row" style="flex-wrap:nowrap">${ic('inbox')}<span class="grow"><span class="strong">Por recibir</span><span class="meta" style="display:block">${pendingLabel()}</span></span>${p ? '<span class="count">1</span>' : ''}${ic('chev')}</span>
    </a>
    ${S.stage === 'abierta' && isCajera() ? `<section class="card pad stack-s"><h2 class="h-sec">Atajos</h2>${btn('Registrar entrada o salida', { kind: 'outline', view: 'movimientos', cls: 'btn-block' })}<p class="meta">Disponible mientras la caja esté abierta.</p></section>` : ''}
    <p class="meta perm">${ic('lock', 's14')}${isCajera() ? 'Verificar y cerrar los hace un supervisor.' : 'Tienes permisos de verificación, cierre y auditoría.'}</p>`;
}
function render() {
  document.documentElement.dataset.theme = S.theme;
  const st = STATUS[S.stage];
  $('#root').innerHTML = `
  <div class="app">
    <header class="chrome"><span class="brand"><b>HF</b>HoundFe</span><nav class="crumbs" aria-label="Ruta"><a href="#">Punto de venta</a>${ic('chev', 's14')}<span aria-current="page">Caja</span></nav><span class="who">${D.store}<span class="avatar" aria-hidden="true">${me().ini}</span>${me().name}</span></header>
    <div class="a-grid">
      <aside class="a-side" aria-label="Sesiones">
        <h1 class="page-title">Caja</h1>
        ${sessionList()}
      </aside>
      <main class="a-main" aria-labelledby="shift-h">
        <header class="a-head">
          <p class="meta row">${st ? badge(st[0], st[1]) : badge('Sin turno', 't-neutral')}${drawerBadge()}<span>${S.stage === 'sin-turno' ? 'Aún no hay turno abierto' : `Laura Méndez · abierta ${D.times.open}`}</span></p>
          <h2 id="shift-h" class="h-detail">${S.stage === 'sin-turno' ? 'Abre tu turno' : 'Caja Principal'}</h2>
        </header>
        ${nextBar()}
        ${timeline()}
      </main>
      <aside class="a-ctx" aria-label="Resumen del turno">${context()}</aside>
    </div>
  </div>
  ${demoBar()}`;
}
boot(render);
