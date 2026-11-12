const uniq = (h, n) => h.replace(/\b(id|for|aria-controls)="([^"]+)"/g, `$1="f${n}-$2"`).replace(/aria-describedby="([^"]+)"/g, (m, v) => `aria-describedby="${v.split(' ').map(x => `f${n}-${x}`).join(' ')}"`).replace(/href="#(?!i-)([^"]+)"/g, `href="#f${n}-$1"`);
const mbar = () => `<header class="mbar"><button class="icon-btn" aria-label="Abrir menú">${ic('menu')}</button><span class="t">Atención del chatbot</span><button class="icon-btn" aria-label="Notificaciones, 5 sin leer">${ic('bell')}<span class="dotc">5</span></button></header>`;
const errState = () => {
  const d = S.draft; dayOf(d, 'WEDNESDAY').ranges = [{ open: '09:00', close: '15:00' }, { open: '14:00', close: '19:00' }]; dayOf(d, 'THURSDAY').ranges = [{ open: '19:00', close: '09:00' }];
  const q = d.slas.find(s => s.subtype === 'COMPLAINT'); q.claimMinutes = 60; q.resolveMinutes = 30; d.windowWarningMinutes = 1500; d.scheduling.maxScheduledPerSlot = 60; d.templateName = 'Aviso-Seguimiento';
  S.errors = validate(d); S.shown = true; S.dateIn = '2026-12-25'; S.dateErr = 'Esa fecha ya está en la lista.';
};
const dirty = () => { dayOf(S.draft, 'MONDAY').ranges = [{ open: '08:00', close: '19:00' }]; S.draft.slas.find(s => s.subtype === 'COMPLAINT').claimMinutes = 45; };
const page = (...parts) => `<div class="page">${parts.join('')}</div>`;
const FR = [
  ['Horario por día', 'Cada día apilado; «Copiar a…» en su línea', {}, () => page(banners(), SEC.hours())],
  ['Copiar a otros días', 'Chips alternables y botón explícito; barra con cambios', { copyFrom: 'MONDAY', copyTo: ['TUESDAY', 'WEDNESDAY'] }, () => { dirty(); S.copyFrom = 'MONDAY'; return page(SEC.hours()) + saveBar(); }],
  ['Fechas cerradas', 'Lista con quitar, «Pasada» y alta por fecha', {}, () => page(SEC.dates())],
  ['Plazos por tipo', 'Una tarjeta por tipo, minutos hábiles en horas', {}, () => page(SEC.sla())],
  ['Conflicto 409', 'Hoja inferior: qué cambió cada quien', { conflict: theirs() }, () => { dirty(); return page(banners(), SEC.hours()) + saveBar() + conflictModal({ frame: true }); }],
  ['Aplicar a todas · revisión', 'Prueba en seco: cambian, igual, no se pueden', { role: 'admin' }, () => page(pageHead(), SEC.hours()) + modal(...(([t, b, f]) => [t, b, f])(applyBody('review', APPLY.dry)), { frame: true })],
  ['Aplicar a todas · resultado parcial', 'Una guardada con recálculo pendiente, una falló', { role: 'admin' }, () => page(pageHead(), SEC.hours()) + modal(...applyBody('result', APPLY.real.partial), { frame: true })],
  ['Solo lectura', 'Sin controles ni barra; aviso con el permiso faltante', { role: 'reader' }, () => page(banners(), SEC.hours(), SEC.sla())],
  ['Sin configurar (versión 0)', 'Valores recomendados; «Guardar configuración»', { cfg: clone(DEFAULTS), draft: clone(DEFAULTS) }, () => page(banners(), SEC.hours()) + saveBar()],
  ['Errores de validación', 'Lista enlazada, campos marcados y barra', {}, () => { errState(); return page(banners(), SEC.hours()) + saveBar(); }],
  ['Guardado con aviso', 'recompute FAILED: guardado, plazos después', {}, () => { S.cfg.version = 4; S.draft.version = 4; S.notice = { kind: 'failed' }; S.savedAt = 1; return page(banners(), SEC.hours()) + saveBar(); }],
  ['Cargando', 'Esqueleto con el espacio de las secciones', { mode: 'loading' }, () => gate(() => '')],
  ['Error al cargar', 'No se cambió nada; reintentar', { mode: 'loaderror' }, () => gate(() => '')]
];
function build() {
  const root = $('#root'), out = FR.map(([t, sub, patch, fn], i) => {
    const keep = S; S = Object.assign(newState(), patch); S.cfg = patch.cfg || S.cfg;
    const inner = fn(); S = keep;
    return `<figure class="phone"><figcaption>${i + 1}. ${t}<small>${sub}</small></figcaption><div class="screen">${mbar()}<div class="mbody cq">${uniq(inner, i)}</div></div></figure>`;
  }).join('');
  setHTML(root, out);
  const pop = document.getElementById('f1-copyPop'); if (pop) pop.closest('.mbody').scrollTop = pop.getBoundingClientRect().top - pop.closest('.mbody').getBoundingClientRect().top - 140;
}
injectIcons(); mountTools(); build();
for (const id of ['t-role', 't-mode', 't-out', 't-apply']) $('#' + id).disabled = true;
