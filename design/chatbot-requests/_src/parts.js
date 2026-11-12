/* Shared inbox pieces: SLA, status, filters, shell, artboard tools. */
const HRS = { closed: false };
const FULLPHONE = m => `+52 ${String(m || '').replace('****', '1234')}`;
const cname = c => (c && c.displayName) || 'Cliente sin vincular';
const phoneOf = c => !c || !c.phone ? 'Sin teléfono' : (can('phone') ? FULLPHONE(c.phone) : c.phone);
const initials = n => String(n || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
const subHTML = (r, big) => `<span class="tag">${ic(SUB[r.subtype][1], 'xs')}${SUB[r.subtype][0]}</span>`;

function slaOf(r) {
  if (r.status === 'RESOLVED' || r.status === 'CANCELLED') return null;
  if (r.scheduledFor) return { t: 'sched', i: 'calendar', a: `Agendada · ${DOW[loc(r.scheduledFor).getUTCDay()]} ${hhmm(r.scheduledFor)}`, b: r.requiresTemplateAtStart ? 'Fuera de la ventana de 24 h: se usa plantilla' : 'Dentro de la ventana gratis' };
  const paused = HRS.closed || r.slaPaused;
  if (r.overdueAt) return { t: 'bad', i: 'alert', a: `Vencida hace ${dur((NOW - new Date(r.overdueAt)) / 60000)}`, b: paused ? `En pausa · se reanuda ${whenAt(RESUME)}` : 'Sigue abierta' };
  if (paused) return { t: 'pause', i: 'pause', a: 'En pausa', b: `se reanuda ${whenAt(RESUME)}` };
  const dl = r.status === 'NEW' ? (r.claimDeadlineAt || r.resolveDeadlineAt) : r.resolveDeadlineAt;
  if (!dl) return { t: 'none', i: 'clock', a: 'Sin límite', b: null };
  const left = (new Date(dl) - NOW) / 60000, ratio = left / ((new Date(dl) - new Date(r.createdAt)) / 60000);
  const t = ratio > 0.5 ? 'ok' : ratio > 0.1 ? 'warn' : 'bad';
  return { t, i: t === 'bad' ? 'alert' : 'clock', a: `Quedan ${dur(left)}`, b: r.status === 'NEW' ? 'para tomarla' : 'para resolverla' };
}
const slaHTML = (r, compact) => { const s = slaOf(r); return s ? `<div class="sla ${s.t}">${ic(s.i, 'sm')}<span><b>${s.a}</b>${s.b && !compact ? `<small>${s.b}</small>` : ''}</span></div>` : '<span class="p2">—</span>'; };
const TONE_RANK = { bad: 0, warn: 1, ok: 2, sched: 3, pause: 4, none: 5 };
const groupTone = g => g.requests.map(slaOf).filter(Boolean).sort((a, b) => TONE_RANK[a.t] - TONE_RANK[b.t])[0]?.t || 'none';

function statusHTML(r, withWho) {
  const by = r.assignee ? who(r.assignee) : null;
  if (r.status === 'RESOLVED') return '<span class="badge success dot">Resuelta</span>';
  if (r.status === 'CANCELLED') return '<span class="badge dot">Cancelada</span>';
  if (r.displayStatus === 'EXPIRED') return `<span class="badge danger urgent">${ic('alert', 'xs')}<span class="t">Vencida${withWho && by ? ` · por ${by}` : ''}</span></span>`;
  if (r.status === 'NEW') return '<span class="badge warning dot">Nueva</span>';
  return `<span class="badge info dot"><span class="t">En atención${withWho && by ? ` · por ${by}` : ''}</span></span>`;
}
const windowTag = r => { if (!r.whatsappWindowClosesAt || r.status === 'RESOLVED' || r.status === 'CANCELLED') return ''; const m = (new Date(r.whatsappWindowClosesAt) - NOW) / 60000; return m <= 120 ? `<span class="tag warn">${ic('clock', 'xs')}Ventana de 24 h cierra en ${dur(m)}</span>` : ''; };

/* ---- inbox state and query (mirrors GET /chatbot-requests/groups filters) ---- */
const INB = { tab: 'open', mine: false, none: false, over: false, win: false, sub: '', q: '', open: {}, view: 'ok' };
function queryGroups() {
  let gs = INB.tab === 'open' ? GROUPS : INB.tab === 'resolved' ? CLOSED.resolved : INB.tab === 'cancelled' ? CLOSED.cancelled : GROUPS.filter(g => g.requests.some(r => r.scheduledFor));
  const q = INB.q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), digits = q.replace(/\D/g, '');
  const keep = r => {
    const g = gs.find(x => x.requests.includes(r));
    if (INB.tab === 'scheduled' && !r.scheduledFor) return false;
    if (INB.mine && !(r.assignee && r.assignee.id === ME.id)) return false;
    if (INB.none && r.assignee) return false;
    if (INB.over && !r.overdueAt) return false;
    if (INB.win && !(r.whatsappWindowClosesAt && (new Date(r.whatsappWindowClosesAt) - NOW) / 60000 <= 120)) return false;
    if (INB.sub && r.subtype !== INB.sub) return false;
    if (q) {
      const nm = cname(g.customer).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const folio = r.folio.toLowerCase() === q.replace(/^s-?0*/, 's-').replace(/s-(\d+)/, (_, n) => 's-' + String(n).padStart(6, '0'));
      const ph = can('phone') && digits.length >= 3 && FULLPHONE(g.customer.phone).replace(/\D/g, '').includes(digits);
      if (!(folio || ph || q.split(/\s+/).every(w => nm.includes(w)))) return false;
    }
    return true;
  };
  return gs.map(g => ({ ...g, requests: g.requests.filter(keep) })).filter(g => g.requests.length);
}
const anyFilter = () => INB.mine || INB.none || INB.over || INB.win || INB.sub || INB.q.trim();

function filterBarHTML() {
  const chip = (k, label, n) => `<button type="button" class="chip" data-chip="${k}" aria-pressed="${INB[k]}">${label}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`;
  const tab = (k, label, n) => `<button type="button" data-tab="${k}" aria-pressed="${INB.tab === k}">${label}${n != null ? ` <span class="fig">${n}</span>` : ''}</button>`;
  return `<div class="seg" role="group" aria-label="Estado de las solicitudes">${tab('open', 'Abiertas', COUNTS.new + COUNTS.inProgress)}${tab('scheduled', 'Agendadas', COUNTS.scheduled)}${tab('resolved', 'Resueltas · 7 días')}${tab('cancelled', 'Canceladas · 7 días')}</div>
  <a href="#" class="btn ghost" data-noop>${ic('history', 'sm')}Historial</a>`;
}
function filterRowHTML() {
  const types = Object.entries(SUB).filter(([k]) => k !== 'DISCOUNT');
  return `<div class="search" style="width:300px"><label class="sr" for="q">Buscar</label>${ic('search', 'sm')}<input class="ctl" id="q" type="search" value="${esc(INB.q)}" placeholder="${can('phone') ? 'Folio, cliente o teléfono' : 'Folio o nombre del cliente'}" autocomplete="off"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap" role="group" aria-label="Filtros">${[['mine', 'Mías', COUNTS.mine], ['none', 'Sin responsable', null], ['over', 'Vencidas', COUNTS.overdue], ['win', 'Ventana por cerrar', COUNTS.windowClosingSoon]].map(([k, l, n]) => `<button type="button" class="chip" data-chip="${k}" aria-pressed="${INB[k]}">${l}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>
  <label class="sr" for="subf">Tipo</label><select class="ctl" id="subf" style="width:190px"><option value="">Tipo · Todos</option>${types.map(([k, v]) => `<option value="${k}" ${INB.sub === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>`;
}
const countLine = () => `${COUNTS.new} nuevas · ${COUNTS.inProgress} en atención · ${COUNTS.overdue} vencidas`;
const legendHTML = () => `<div class="legend" aria-label="Semáforo de tiempo"><span class="sla ok">${ic('clock', 'xs')}<b>Más de la mitad del tiempo</b></span><span class="sla warn">${ic('clock', 'xs')}<b>Menos de la mitad</b></span><span class="sla bad">${ic('alert', 'xs')}<b>Cerca de vencer o vencida</b></span><span class="sla pause">${ic('pause', 'xs')}<b>En pausa · se reanuda mañana 9:00</b></span><span class="sla sched">${ic('calendar', 'xs')}<b>Agendada · mar 10:30</b></span></div>`;
const hoursBanner = () => HRS.closed ? `<div class="alert info" role="status">${ic('moon', 'sm')}<div><strong>Fuera de horario de atención</strong>Los tiempos límite están en pausa y se reanudan ${whenAt(RESUME)}. Las solicitudes ya vencidas siguen marcadas como vencidas.</div></div>` : '';
function stateHTML(kind) {
  const m = {
    empty: ['inbox', 'No hay solicitudes abiertas', 'Cuando el chatbot necesite a una persona, la solicitud aparece aquí.', ''],
    nomatch: ['search-x', `Sin resultados para «${esc(INB.q.trim() || 'estos filtros')}»`, 'Cambia o quita los filtros para ver más solicitudes.', '<button type="button" class="btn" data-clear>Quitar filtros</button>'],
    error: ['alert', 'No pudimos cargar las solicitudes', 'Tus cambios no se perdieron: aquí solo se lee. Revisa tu conexión e inténtalo de nuevo.', '<button type="button" class="btn" data-retry>Reintentar</button>'],
    forbidden: ['lock', 'No tienes permiso para ver las solicitudes del chatbot', 'Pide a un administrador el permiso «Ver solicitudes del chatbot» (read:ChatbotRequest).', '']
  }[kind];
  return `<div class="empty ${kind === 'error' ? 'error' : ''}" ${kind === 'error' ? 'role="alert"' : ''}>${ic(m[0])}<h2>${m[1]}</h2><p>${m[2]}</p>${m[3]}</div>`;
}
const skelRows = n => Array.from({ length: n }, () => `<div style="padding:16px;border-bottom:1px solid var(--hf-border);display:grid;gap:8px"><span class="skel" style="width:35%"></span><span class="skel" style="width:70%"></span></div>`).join('') + '<p class="sr">Cargando solicitudes</p>';

/* ---- shell ---- */
function shell(crumbs, content, opts = {}) {
  const nav = (i, l, cur) => `<li><a href="#" data-noop ${cur ? 'aria-current="page" class="sub"' : ''}>${i ? ic(i, 'sm') : ''}${l}${cur ? `<span class="count fig" aria-label="${COUNTS.new} nuevas">${COUNTS.new}</span>` : ''}</a></li>`;
  return `<div class="app"><aside class="side" aria-label="Menú principal"><div class="brand"><span class="brand-mark" aria-hidden="true">${ic('paw', 'sm')}</span>HoundFe</div>
  <div class="tenant"><span class="tenant-tile" aria-hidden="true">C</span><span><strong>Sucursal Centro</strong><small>Guadalajara</small></span></div>
  <nav class="nav" aria-label="Módulos"><ul>${nav('home', 'Resumen')}</ul><p class="nav-group">POS</p><ul>${nav('cart', 'Ventas')}${nav('package', 'Productos')}${nav('users', 'Clientes')}${nav('truck', 'Rutas de entrega')}</ul>
  <p class="nav-group">Chatbot</p><ul><li><a href="#" data-noop ${opts.list ? 'aria-current="page"' : ''} class="sub">${ic('inbox', 'sm')}Solicitudes<span class="count fig" aria-label="${COUNTS.new} nuevas">${COUNTS.new}</span></a></li></ul>
  <p class="nav-group">Más módulos</p><ul><li><a href="#" data-noop>Compras${ic('right', 'xs chev')}</a></li><li><a href="#" data-noop>Admin${ic('right', 'xs chev')}</a></li></ul></nav>
  <div class="side-foot"><span class="avatar" aria-hidden="true">LM</span><span>Laura Méndez<small>${PERM.mode === 'mgr' ? 'Gerente' : 'Cajero'}</small></span></div></aside>
  <div class="col"><header class="topbar"><nav class="crumbs" aria-label="Ruta">${crumbs}</nav><span class="spacer"></span><button type="button" class="icon-btn" aria-label="Notificaciones, 3 sin leer">${ic('bell')}<span class="dotc fig" aria-hidden="true">3</span></button></header>${content}</div></div>`;
}

/* ---- artboard tools ---- */
function toolsHTML(extra = '') {
  return `<div class="tools" role="group" aria-label="Opciones del artboard"><button type="button" id="t-theme"></button>
  <label>Rol <select id="t-perm"><option value="mgr">Gerente</option><option value="cashier">Cajero (sin teléfono ni resolver)</option></select></label>
  <label>Horario <select id="t-hours"><option value="open">En horario</option><option value="closed">Fuera de horario</option></select></label>${extra}<span class="grow"></span><button type="button" id="t-notes" aria-pressed="false">${ic('info', 'sm')}Notas</button></div>`;
}
function mountTools(extra) { const h = document.createElement('div'); setHTML(h, toolsHTML(extra)); document.body.prepend(h.firstElementChild); }
function measureTools() { document.documentElement.style.setProperty('--tools-h', $('.tools').offsetHeight + 'px'); }
function initTools(rerender) {
  measureTools(); addEventListener('resize', measureTools);
  const paint = () => { const d = document.documentElement.classList.contains('dark'); setHTML($('#t-theme'), `${ic(d ? 'moon' : 'sun', 'sm')}${d ? 'Oscuro' : 'Claro'}`); };
  $('#t-theme').addEventListener('click', () => { document.documentElement.classList.toggle('dark'); paint(); });
  $('#t-perm').value = PERM.mode; $('#t-hours').value = HRS.closed ? 'closed' : 'open';
  $('#t-perm').addEventListener('change', e => { PERM.mode = e.target.value; rerender(); });
  $('#t-hours').addEventListener('change', e => { HRS.closed = e.target.value === 'closed'; rerender(); });
  $('#t-notes').addEventListener('click', e => { const s = $('#notes'); s.hidden = !s.hidden; e.currentTarget.setAttribute('aria-pressed', String(!s.hidden)); });
  paint();
}
function toast(title, desc, icon = 'check-circle') {
  const t = document.createElement('div'); t.className = 'toast';
  setHTML(t, `<span class="tile">${ic(icon)}</span><div><strong>${esc(title)}</strong>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`);
  let host = $('#toasts'); if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
  host.appendChild(t); setTimeout(() => t.remove(), 4500);
}
document.addEventListener('click', e => { if (e.target.closest('[data-noop]')) e.preventDefault(); });
