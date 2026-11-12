/* tools: artboard controls (outside the mock): permission, screen state, save outcome, apply outcome, notes, theme. */
function mountTools() {
  const sel = (id, label, opts) => `<label>${label}<select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
  setHTML($('#tools'), `<strong style="font-size:12px;padding:0 8px">Atención del chatbot</strong>
${sel('t-role', 'Permiso', [['manager', 'Gerente: ver y cambiar'], ['admin', 'Gerente + todas las sucursales'], ['reader', 'Solo ver']])}
${sel('t-mode', 'Estado', [['normal', 'Configurada (versión 3)'], ['defaults', 'Sin configurar (versión 0)'], ['errors', 'Con errores de validación'], ['conflict', 'Conflicto 409 al guardar'], ['failed', 'Guardado con aviso (recompute FAILED)'], ['loading', 'Cargando'], ['loaderror', 'Error al cargar'], ['forbidden', 'Sin permiso para ver']])}
${sel('t-out', 'Al guardar', [['ok', 'Guarda bien'], ['conflict', 'Otra persona guardó antes (409)'], ['failed', 'Plazos pendientes (FAILED)'], ['partial', 'Plazos parciales (PARTIAL)'], ['error', 'Error del servidor'], ['forbidden', 'Sin permiso (403)']])}
${sel('t-apply', 'Al aplicar a todas', [['ok', 'Todo bien'], ['partial', 'Resultado parcial'], ['none', 'Nada que cambiar'], ['conflict', 'Conflicto sin permiso de lectura']])}
<span class="grow"></span><button type="button" id="t-notes" aria-pressed="false">${ic('info', 'sm')}Notas</button><button type="button" id="t-theme" aria-pressed="false">${ic('moon', 'sm')}Oscuro</button>`);
  const h = () => document.documentElement.style.setProperty('--tools-h', $('#tools').offsetHeight + 'px'); h(); addEventListener('resize', h);
  $('#t-role').addEventListener('change', e => { S.role = e.target.value; S.copyFrom = null; S.dialog = null; render(); });
  $('#t-mode').addEventListener('change', e => setMode(e.target.value));
  $('#t-out').addEventListener('change', e => { S.outcome = e.target.value; });
  $('#t-apply').addEventListener('change', e => { S.applyOut = e.target.value; });
  $('#t-notes').addEventListener('click', e => { const n = $('#notes'); n.hidden = !n.hidden; e.currentTarget.setAttribute('aria-pressed', String(!n.hidden)); });
  $('#t-theme').addEventListener('click', e => { const d = document.documentElement.classList.toggle('dark'); e.currentTarget.setAttribute('aria-pressed', String(d)); });
}
const NAVS = [['hours', 'Horario de atención', 'clock'], ['dates', 'Fechas cerradas', 'calendar'], ['sla', 'Plazos por tipo', 'timer'], ['extras', 'Ventana y plantilla', 'send'], ['sched', 'Conversaciones agendadas', 'calendar']];
const SEC = {
  hours: () => secCard('hours', 'Horario de atención', 'Cuándo corren los plazos del chatbot. Fuera de este horario se pausan.', hoursBody()),
  dates: () => secCard('dates', 'Fechas cerradas', 'Días sin atención aunque el horario diga lo contrario.', datesBody()),
  sla: () => secCard('sla', 'Plazos por tipo de solicitud', 'Cuánto tiempo hay para atender y para resolver cada tipo.', slaBody()),
  extras: () => secCard('extras', 'Ventana de WhatsApp y plantilla', 'Para cuando pasaron más de 24 h desde el último mensaje del cliente.', extrasBody()),
  sched: () => secCard('sched', 'Conversaciones agendadas', 'Horarios que el cliente puede elegir para ser atendido.', schedBody(), { tag: pending() })
};
const secMark = id => { const n = S.shown ? errCount(id) : 0, d = dirtyItems().filter(i => i.sec === id).length; return n ? `<span class="nb bad" aria-label="${plural(n, 'campo por corregir', 'campos por corregir')}">${n}</span>` : d ? `<span class="nb" aria-label="Modificado"></span>` : ''; };
