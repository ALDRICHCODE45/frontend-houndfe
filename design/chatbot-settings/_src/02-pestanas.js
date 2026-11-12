const TABS = [['hours', 'Horario'], ['dates', 'Fechas cerradas'], ['sla', 'Plazos'], ['extras', 'Ventana y plantilla'], ['sched', 'Agendadas']];
window.TABFOR = id => /^(dr-|sec-hours|t-)/.test(id) ? 'hours' : /^(s-|margin|sec-sla)/.test(id) ? 'sla' : /^(win|tpl)/.test(id) ? 'extras' : /^(slot|offered|maxs)/.test(id) ? 'sched' : 'hours';
function summary() {
  const d = S.draft, th = dayOf(d, 'THURSDAY'), now = 665, cur = th.ranges.find(r => hm(r.open) <= now && now < hm(r.close)), closedToday = d.closedDates.includes(TODAY);
  const nextClosed = d.closedDates.find(x => x >= TODAY), tot = weekTotal(d.openingHours);
  return `<aside class="panel b-sum" aria-label="Resumen"><h2>Resumen</h2>
<div class="fact ${cur && !closedToday ? 'ok' : ''}">${ic('clock', 'sm')}<div><b>${cur && !closedToday ? 'Abierto ahora' : 'Cerrado ahora'}</b><small>${cur && !closedToday ? `Hoy cierra a las ${cur.close}` : 'Los plazos están en pausa'} · jue 12 nov, 11:05</small></div></div>
<div class="fact">${ic('calendar', 'sm')}<div><b>${nextClosed ? dshort(nextClosed) : 'Sin fechas próximas'}</b><small>${nextClosed ? 'Próxima fecha cerrada, ' + rel(nextClosed) : 'No hay fechas cerradas por venir'}</small></div></div>
<div class="fact">${ic('timer', 'sm')}<div><b>${tot ? fmtMin(tot) : '0 h'} por semana</b><small>De atención en el horario actual</small></div></div>
<span class="mock-flag">${ic('info', 'xs')}Cálculo local, no es del contrato</span></aside>`;
}
function viewB() {
  return shell(gate(() => {
    const t = S.tab, body = t === 'hours' ? `<div class="b-two">${SEC.hours()}${summary()}</div>` : `<div class="b-one">${SEC[t]()}</div>`;
    return `<div class="page">${pageHead()}${banners()}<div class="tabs" role="tablist" aria-label="Secciones">${TABS.map(([id, n]) => `<button type="button" role="tab" id="tab-${id}" aria-selected="${t === id}" aria-controls="panel" data-act="tab" data-t="${id}">${n}${secMark(id)}</button>`).join('')}</div><div role="tabpanel" id="panel" aria-labelledby="tab-${t}">${body}</div></div>${saveBar()}`;
  }));
}
ACT.tab = b => { S.tab = b.dataset.t; render(b.id); };
const goto0 = ACT.goto;
ACT.goto = (b, e) => { e.preventDefault(); S.tab = window.TABFOR(b.dataset.id); render(); goto0(b, e); };
injectIcons(); VIEW = viewB; mountTools(); bind(); render();
