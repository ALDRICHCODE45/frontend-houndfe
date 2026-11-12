const pc = m => (m / 1440 * 100).toFixed(2) + '%';
function statusBand() {
  const d = S.draft, th = dayOf(d, 'THURSDAY'), cur = th.ranges.find(r => hm(r.open) <= 665 && 665 < hm(r.close)), closed = d.closedDates.includes(TODAY), nc = d.closedDates.find(x => x >= TODAY), open = cur && !closed;
  return `<div class="status" aria-label="Estado ahora"><div class="${open ? 'ok' : ''}">${ic('clock', 'sm')}<div><b>${open ? 'Abierto ahora' : 'Cerrado ahora'}</b><small>${open ? `Cierra hoy a las ${cur.close}` : 'Los plazos están en pausa'} · jue 12 nov, 11:05</small></div></div><div>${ic('calendar', 'sm')}<div><b>${nc ? dshort(nc) : 'Sin fechas próximas'}</b><small>${nc ? 'Próxima fecha cerrada, ' + rel(nc) : 'No hay fechas cerradas por venir'}</small></div></div><div>${ic('timer', 'sm')}<div><b>${fmtMin(weekTotal(d.openingHours)) === 'Sin plazo' ? '0 h' : fmtMin(weekTotal(d.openingHours))} por semana</b><small>De atención en el horario actual</small></div></div></div>`;
}
function timeline() {
  const oh = S.draft.openingHours;
  const rows = oh.days.map(d => {
    const [long, sh] = DAY_L[d.day], open = d.ranges.length > 0, err = !!S.errors['h:' + d.day], sel = S.day === d.day;
    const bars = d.ranges.map(r => { const o = hm(r.open), c = hm(r.close); return o != null && c != null && c > o ? `<span class="bar ${err ? 'bad' : ''}" style="left:${pc(o)};width:${pc(c - o)}">${c - o >= 240 ? `${r.open}–${r.close}` : ''}</span>` : ''; }).join('');
    return `<button type="button" class="tl-row ${open ? '' : 'closed'}" aria-pressed="${sel}" data-act="pickDay" data-day="${d.day}" aria-label="${long}: ${open ? rangesText(d.ranges) : 'cerrado'}. Editar"><span class="nm">${long}</span><span class="track-b">${bars}</span><span class="tt fig">${open ? fmtMin(dayTotal(d.ranges)) : ''}</span></button>`;
  }).join('');
  const hrs = [0, 6, 12, 18, 24];
  return `<div class="tl-wrap"><div class="tl-axis" aria-hidden="true"><span></span><div class="scale">${hrs.map(h => `<span style="left:${h / 24 * 100}%${h === 24 ? ';transform:translateX(-100%)' : h === 0 ? ';transform:none' : ''}">${h}:00</span>`).join('')}</div><span></span></div><div class="tl-rows">${rows}<div class="nowline" style="left:calc(72px + 12px + 8px + (100% - 72px - 64px - 24px - 16px) * ${(665 / 1440).toFixed(4)} + 0px)" aria-hidden="true"><span>ahora</span></div></div></div>`;
}
function hoursC() {
  const d = dayOf(S.draft, S.day), err = S.errors['h:week'];
  const ed = can().edit;
  return `<div class="c-top"><section class="panel sec" id="sec-hours" aria-labelledby="h-hours"><div class="ph sec-h"><div class="phl"><h2 id="h-hours">Horario de atención</h2><p class="p2">Toca un día para editarlo. Fuera de estas franjas los plazos se pausan.</p></div><div class="phr">${secBadges('hours')}</div></div>${pickupNote()}<div class="hrow-top">${tzField()}${ed ? pickupCopy() : ''}</div>${err ? `<div class="alert danger" role="alert">${ic('alert', 'sm')}<div><strong>${esc(err)}</strong></div></div>` : ''}${timeline()}</section>
<aside class="panel c-side" aria-label="Editar ${DAY_L[S.day][0].toLowerCase()}"><div class="ph"><h2>${DAY_L[S.day][0]}</h2><span class="p2">Editando</span></div><ul class="days">${dayRow(d)}</ul></aside></div>`;
}
function simCard() {
  const arr = S.sim, rows = S.draft.slas.map(s => { const n = SUBS[s.subtype][0]; if (s.subtype === 'TRANSFER_RECEIPT') return `<tr><td>${n}</td><td colspan="2">Al cierre del día de llegada (con margen de ${fmtMin(S.draft.receiptCloseMarginMinutes)})</td></tr>`; return `<tr><td>${n}</td><td class="fig">${s.claimMinutes == null ? 'Sin plazo' : fmtDue(dueAt(S.draft, arr, s.claimMinutes))}</td><td class="fig">${s.subtype === 'TALK_TO_HUMAN' ? 'En vivo' : s.resolveMinutes == null ? 'Sin plazo' : fmtDue(dueAt(S.draft, arr, s.resolveMinutes))}</td></tr>`; }).join('');
  return `<div class="sim"><div class="sim-top"><div class="field"><label class="lbl" for="sim">Si una solicitud llega…</label><input type="datetime-local" class="ctl" id="sim" value="${arr}"></div><span class="mock-flag">${ic('info', 'xs')}Cálculo local, no es del contrato</span></div><table class="simt"><thead><tr><th>Tipo</th><th>Atender antes de</th><th>Resolver antes de</th></tr></thead><tbody>${rows}</tbody></table><p class="p2">Cuenta solo el horario abierto y salta fechas cerradas, como lo hace el servidor. El cálculo real es el del servidor.</p></div>`;
}
function viewC() {
  return shell(gate(() => `<div class="page">${pageHead()}${banners()}${statusBand()}<div class="c-main">${hoursC()}${SEC.dates()}${secCard('sla', 'Plazos por tipo de solicitud', 'Cuánto tiempo hay para atender y para resolver cada tipo.', slaBody() + simCard())}${SEC.extras()}${SEC.sched()}</div></div>${saveBar()}`));
}
ACT.pickDay = b => { S.day = b.dataset.day; S.copyFrom = null; render(); };
document.addEventListener('change', e => { if (e.target.id === 'sim') { S.sim = e.target.value; render('sim'); } });
injectIcons(); VIEW = viewC; mountTools(); bind(); render();
