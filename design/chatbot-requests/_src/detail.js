/* Detail data and building blocks (GET /chatbot-requests/:id shape, handoff 14 §8) plus the action panel driven by allowedActions. */
const rowById = id => GROUPS.flatMap(g => g.requests).find(r => r.id === id);
const ev = (type, minAgo, actor, from, to, data) => ({ id: `${type}-${minAgo}`, type, createdAt: at(-minAgo), actor: actor ? { kind: 'USER', ...actor } : { kind: 'SYSTEM', id: null, displayName: null }, fromStatus: from || null, toStatus: to || null, data: data || {} });
const ordersJuan = [{ folio: 'V-1042', createdAt: at(-2 * 1440), totalCents: 184000, status: 'CONFIRMED', paymentStatus: 'PENDING' }, { folio: 'V-0988', createdAt: at(-12 * 1440), totalCents: 96550, status: 'CONFIRMED', paymentStatus: 'PAID' }, { folio: 'V-0931', createdAt: at(-30 * 1440), totalCents: 12300, status: 'CANCELED', paymentStatus: 'REFUNDED' }];
const DET = {
  restock: { row: rowById('rq-123'), needs: 'El cliente quiere saber cuándo habrá Croquetas Premium Adulto 15 kg. Necesita 6 piezas para el viernes.', context: { carrito: '6 × Croquetas Premium Adulto 15 kg', 'lista de precios': 'Mayoreo', 'último mensaje': 'hace 2 h 10 min' },
    customer: { ...C.juan, customerSince: '2025-03-02T10:00:00.000Z', priceList: { name: 'Mayoreo' }, ambiguous: false, candidates: [], recentOrders: ordersJuan },
    decision: { subtype: 'RESTOCK', snapshot: { branchName: 'Sucursal Centro', productName: 'Croquetas Premium Adulto 15 kg', sku: 'CRQ-PA-15', requestedQuantity: 6, observedStockAtRequest: 0, stockObservedAt: at(-1500) } },
    other: ['rq-131', 'rq-134'], audit: [ev('OVERDUE', 125, null, null, null), ev('CLAIMED', 400, ME, 'NEW', 'IN_PROGRESS'), ev('CREATED', 1500, null, null, 'NEW')] },
  unknown: { row: rowById('rq-138'), needs: 'Pregunta si pueden facturar con RFC de persona moral. El bot no tiene la política de facturación.', context: { carrito: 'vacío', 'último mensaje': 'hace 20 min' },
    customer: { id: null, displayName: null, phone: '55 **** 0142', customerSince: null, priceList: null, ambiguous: true, recentOrders: [],
      candidates: [{ id: 'c-a', displayName: 'Estética Canina Doña Lupe', phone: '55 **** 0142', isTrusted: true, customerSince: '2024-06-18T00:00:00.000Z', lastOrderAt: at(-6 * 1440) }, { id: 'c-b', displayName: 'Guadalupe Camarena', phone: '55 **** 0142', isTrusted: false, customerSince: '2026-02-03T00:00:00.000Z', lastOrderAt: null }] },
    decision: null, other: ['rq-141'], merge: ['rq-141'], audit: [ev('CREATED', 20, null, null, 'NEW')] },
  zone: { row: rowById('rq-127'), needs: 'Quiere saber si hay envío a la colonia Lafayette y cuánto cuesta. Aprobar la zona resuelve las solicitudes de todos los clientes de ese código postal.', context: { carrito: '2 × Arena Sanitaria 10 kg', 'código postal': '44150' },
    customer: { ...C.roberto, customerSince: '2026-08-14T10:00:00.000Z', priceList: null, ambiguous: false, candidates: [], recentOrders: [{ folio: 'V-1011', createdAt: at(-9 * 1440), totalCents: 54900, status: 'CONFIRMED', paymentStatus: 'PAID' }] },
    decision: { subtype: 'DELIVERY_ZONE', zipCode: '44150', state: 'Jalisco', municipality: 'Guadalajara', neighborhood: 'Lafayette', requesterCount: 5 }, zoneImpact: { requests: 4, customers: 3, setVersion: 7 },
    other: [], audit: [ev('CLAIMED', 55, ME, 'NEW', 'IN_PROGRESS'), ev('CREATED', 260, null, null, 'NEW')] },
  receipt: { row: rowById('rq-134'), needs: 'Mandó el comprobante de una transferencia por $1,840.00 para la venta V-1042 y pide confirmación.', context: { venta: 'V-1042', 'pagado hasta hoy': '$0.00' },
    customer: { ...C.juan, customerSince: '2025-03-02T10:00:00.000Z', priceList: { name: 'Mayoreo' }, ambiguous: false, candidates: [], recentOrders: ordersJuan },
    decision: { subtype: 'TRANSFER_RECEIPT', saleFolio: 'V-1042', declaredAmountCents: 184000, declaredDate: '2026-11-11', declaredReference: 'SPEI 4471290', saleTotalCents: 184000, salePaidCents: 0, saleDebtCents: 184000, mismatch: false, file: 'comprobante-spei.jpg · 214 KB' },
    other: ['rq-123', 'rq-131'], audit: [ev('CREATED', 40, null, null, 'NEW')] },
  expiration: { row: rowById('rq-103'), needs: 'La clínica pregunta por la fecha de caducidad del lote de Antiparasitario en pipeta talla L.', context: { lote: 'AP-L-2209' },
    customer: { ...C.patitas, customerSince: '2024-01-10T10:00:00.000Z', priceList: { name: 'Mayoreo' }, ambiguous: false, candidates: [], recentOrders: [{ folio: 'V-1030', createdAt: at(-5 * 1440), totalCents: 482000, status: 'CONFIRMED', paymentStatus: 'PAID' }] },
    decision: { subtype: 'EXPIRATION', snapshot: { branchName: 'Sucursal Centro', productName: 'Antiparasitario en pipeta', variantName: 'Talla L', unit: 'pieza' } },
    other: ['rq-102', 'rq-104'], audit: [ev('CREATED', 90, null, null, 'NEW')] }
};
Object.values(DET).forEach(d => { d.merge = d.merge || []; d.base = structuredClone(d.row); });
const U = { form: null, sc: 'restock', conflict: null, sim: '', f: {}, err: {} };
const cur = () => DET[U.sc];

/* ---- allowedActions, computed with the rules of handoff 14 §8 ---- */
function allowedActions(d) {
  const r = d.row, open = r.status === 'NEW' || r.status === 'IN_PROGRESS', other = r.assignee && r.assignee.id !== ME.id, mine = r.assignee && r.assignee.id === ME.id;
  const assign = can('assign'), res = can('resolve'), a = [];
  if (r.status === 'NEW') a.push('CLAIM');
  if (r.status === 'IN_PROGRESS' && (mine || assign)) a.push('RELEASE');
  if (assign && r.status === 'IN_PROGRESS') a.push('REASSIGN');
  if (res && r.kind === 'DECISION' && open && !other) a.push('RESOLVE');
  if (open && ['UNKNOWN_QUESTION', 'TALK_TO_HUMAN', 'COMPLAINT'].includes(r.subtype) && d.merge.length && (!other || assign)) a.push('MERGE');
  if (open && !d.customer.id && d.customer.candidates.length) a.push('LINK_CUSTOMER');
  if (open && r.kind !== 'DECISION' && (!other || assign)) a.push('CANCEL');
  return a;
}
const AUDIT_LABEL = { CREATED: 'Solicitud creada', CLAIMED: 'Tomada', RELEASED: 'Liberada', REASSIGNED: 'Reasignada', RESOLVED: 'Resuelta', CANCELLED: 'Cancelada', MERGED: 'Unida con otra solicitud', CUSTOMER_LINKED: 'Cliente vinculado', OVERDUE: 'Venció el tiempo límite' };

/* ---- blocks ---- */
function customerCardHTML(d) {
  const c = d.customer, linked = !!c.id;
  return `<section class="panel" aria-labelledby="h-cust"><div class="ph"><h2 id="h-cust">Cliente</h2>${c.isTrusted ? '<span class="badge success">De confianza</span>' : ''}</div>
  <div style="display:flex;gap:12px;align-items:center"><span class="avatar" aria-hidden="true">${linked ? initials(c.displayName) : '?'}</span><div style="min-width:0"><div class="name ell">${esc(cname(c))}</div><div class="p2 fig">${ic('phone', 'xs')} ${esc(phoneOf(c))}</div></div></div>
  ${can('phone') ? '' : `<p class="help">${ic('lock', 'xs')} El teléfono completo requiere el permiso «Ver teléfono completo». Sin él no hay botones de llamar ni copiar.</p>`}
  ${linked ? `<dl class="kv"><dt>Cliente desde</dt><dd>${shortDate(c.customerSince).split(',')[0]} ${loc(c.customerSince).getUTCFullYear()}</dd><dt>Lista de precios</dt><dd>${c.priceList ? esc(c.priceList.name) : '—'}</dd></dl>
  ${c.recentOrders.length ? `<table class="plain" aria-label="Pedidos recientes"><thead><tr><th scope="col" style="padding-left:0">Pedido</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead><tbody>${c.recentOrders.map(o => `<tr><td style="padding-left:0"><b class="fig">${o.folio}</b><div class="p2">${shortDate(o.createdAt).split(',')[0]}</div></td><td class="num">${money(o.totalCents)}</td><td>${o.status === 'CANCELED' ? 'Cancelado' : o.paymentStatus === 'PAID' ? 'Pagado' : o.paymentStatus === 'REFUNDED' ? 'Reembolsado' : 'Pago pendiente'}</td></tr>`).join('')}</tbody></table>` : ''}`
  : `<div class="alert warn" role="note">${ic('user', 'sm')}<div><strong>Sin cliente vinculado</strong>${c.ambiguous ? `Hay ${c.candidates.length} clientes con este teléfono y el bot no pudo elegir. Una persona debe vincular el correcto.` : 'La identidad es solo el teléfono.'}</div></div>`}</section>`;
}
function needsHTML(d) {
  return `<section class="panel" aria-labelledby="h-need"><h2 id="h-need">Qué necesita el cliente</h2><p class="quote">${esc(d.needs)}</p>
  <div><div class="ph"><h3 style="font-size:13px">Contexto del momento</h3><span class="mock-flag">${ic('info', 'xs')}Estructura por confirmar</span></div>
  <dl class="kv" style="margin-top:8px">${Object.entries(d.context).map(([k, v]) => `<dt>${esc(k.charAt(0).toUpperCase() + k.slice(1))}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div></section>`;
}
function decisionHTML(d) {
  const x = d.decision; if (!x) return '';
  const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
  let body = '';
  if (x.subtype === 'RESTOCK') body = kv([['Producto', `<b>${esc(x.snapshot.productName)}</b> · ${x.snapshot.sku}`], ['Sucursal', x.snapshot.branchName], ['Cantidad pedida', `<span class="fig">${x.snapshot.requestedQuantity}</span> piezas`], ['Existencias al pedir', `<span class="fig">${x.snapshot.observedStockAtRequest}</span> · visto ${whenAt(x.snapshot.stockObservedAt)}`]]);
  if (x.subtype === 'EXPIRATION') body = kv([['Producto', `<b>${esc(x.snapshot.productName)}</b>`], ['Variante', x.snapshot.variantName], ['Sucursal', x.snapshot.branchName]]);
  if (x.subtype === 'DELIVERY_ZONE') body = kv([['Código postal', `<b class="fig">${x.zipCode}</b>`], ['Colonia', `${x.neighborhood}, ${x.municipality}, ${x.state}`], ['Clientes que preguntaron', `<span class="fig">${x.requesterCount}</span> (incluye resueltas y canceladas)`]]);
  if (x.subtype === 'TRANSFER_RECEIPT') body = kv([['Venta', `<b class="fig">${x.saleFolio}</b> · total ${money(x.saleTotalCents)}`], ['Pagado / debe', `${money(x.salePaidCents)} / <b>${money(x.saleDebtCents)}</b>`], ['Declarado por el cliente', `${money(x.declaredAmountCents)} · ${x.declaredDate} · ref. ${x.declaredReference}`], ['Coincidencia', x.mismatch ? '<span class="tag warn">El monto no coincide</span>' : 'Monto y fecha coinciden']]) + `<div class="hint-box" style="display:flex;gap:8px;align-items:center">${ic('image', 'sm')}${x.file}<span class="mock-flag">Vista previa: URL del recibo existente</span></div>`;
  return `<section class="panel" aria-labelledby="h-dec"><h2 id="h-dec">${SUB[x.subtype][0]}: datos de la solicitud</h2>${body}</section>`;
}
function convoHTML(d) {
  if (!can('convo')) return `<section class="panel" aria-labelledby="h-conv"><h2 id="h-conv">Conversación</h2><div class="empty" style="min-height:0;padding:16px">${ic('lock')}<h2>No tienes permiso para ver la conversación</h2><p>Hace falta «Ver conversaciones del chatbot» (read:ChatbotConversation). El resumen y lo que necesita el cliente sí están visibles.</p></div></section>`;
  const r = d.row;
  return `<section class="panel" aria-labelledby="h-conv"><div class="ph"><h2 id="h-conv">Conversación</h2><span class="mock-flag">${ic('info', 'xs')}Mensajes: unidad 9, forma por confirmar</span></div>
  <p class="p2">${r.assignee ? `La atiende ${esc(who(r.assignee) === 'ti' ? 'ti' : r.assignee.displayName)}. El bot sigue contestando otras cosas.` : 'Esperando a una persona. El bot sigue ayudando con otras cosas.'}</p>
  <div class="bubble-list" role="log" aria-label="Mensajes"><div class="bubble them">Hola, ¿tienen ${esc(d.needs.includes('Croquetas') ? 'las Croquetas Premium de 15 kg' : 'factura para persona moral')}?<small>Cliente · hace 2 h 10 min</small></div>
  <div class="bubble bot">Déjeme preguntarle al equipo y le aviso por aquí en cuanto me respondan.<small>Bot · hace 2 h 9 min</small></div>
  <div class="bubble them"><span class="p2">${ic('image', 'xs')} foto-anaquel.jpg</span><small>Cliente · hace 2 h 4 min</small></div></div>
  <p class="help">Responder y escribir desde aquí llegan en la etapa de conversación en vivo (S6); hoy solo se lee.</p></section>`;
}
function otherHTML(d) {
  const list = d.other.map(rowById).filter(Boolean);
  return `<section class="panel" aria-labelledby="h-oth"><div class="ph"><h2 id="h-oth">Otras solicitudes abiertas de este cliente</h2><span class="p2 fig">${list.length}</span></div>
  ${list.length ? `<ul style="display:grid;gap:8px">${list.map(r => `<li><a href="#" data-noop class="rrow" style="text-decoration:none;color:inherit"><span class="tx"><span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${subHTML(r)}<span class="folio">${r.folio}</span>${statusHTML(r, true)}</span><span class="ell">${esc(r.summary)}</span></span>${slaHTML(r, true)}${ic('right', 'sm')}</a></li>`).join('')}</ul>` : '<p class="p2">No tiene otras solicitudes abiertas.</p>'}</section>`;
}
function auditHTML(d) {
  const L = d.audit.slice();
  return `<section class="panel" aria-labelledby="h-aud"><div class="ph"><h2 id="h-aud">Historial de la solicitud</h2><span class="mock-flag">${ic('info', 'xs')}Tipos de evento por confirmar</span></div>
  <ol class="tl">${L.map((e, i) => `<li class="${i === 0 && d.row.status === 'RESOLVED' ? 'done' : e.type === 'OVERDUE' ? 'bad' : ''}"><b>${AUDIT_LABEL[e.type] || e.type}${e.type === 'CLAIMED' || e.type === 'REASSIGNED' ? ` por ${esc(e.actor.id === ME.id ? 'ti' : e.actor.displayName)}` : ''}</b><small>${e.actor.kind === 'SYSTEM' ? 'Sistema' : esc(e.actor.displayName)} · ${whenAt(e.createdAt)}${e.data && e.data.customerNote ? ` · mensaje al cliente: «${esc(e.data.customerNote)}»` : ''}</small></li>`).join('')}</ol>
  <button type="button" class="btn ghost sm" data-noop style="justify-self:start">Ver más eventos</button></section>`;
}

/* ---- action panel ---- */
const radios = (key, items, val) => `<div class="rgroup" role="radiogroup" aria-label="${key}">${items.map(([v, t, s]) => `<button type="button" role="radio" class="rrow" aria-checked="${val === v}" data-radio="${key}" data-val="${v}"><span class="mark">${ic('check')}</span><span class="tx"><b>${t}</b>${s ? `<small>${s}</small>` : ''}</span></button>`).join('')}</div>`;
const fieldErr = k => U.err[k] ? `<p class="err">${ic('alert', 'xs')}<span>${U.err[k]}</span></p>` : '';
const taField = (id, label, key, max, opt, help) => `<div class="field"><label class="lbl" for="${id}">${label}${opt ? ' (opcional)' : ''}</label><textarea class="ctl" id="${id}" data-field="${key}" maxlength="${max}" aria-invalid="${!!U.err[key]}">${esc(U.f[key] || '')}</textarea><div style="display:flex;justify-content:space-between;gap:8px"><span class="help">${help || ''}</span><span class="counter fig" data-count="${id}">${(U.f[key] || '').length}/${max}</span></div>${fieldErr(key)}</div>`;
const numField = (id, label, key, help, pre) => `<div class="field"><label class="lbl" for="${id}">${label}</label><input class="ctl fig" id="${id}" inputmode="decimal" data-field="${key}" value="${esc(U.f[key] ?? '')}" aria-invalid="${!!U.err[key]}">${help ? `<span class="help">${help}</span>` : ''}${fieldErr(key)}</div>`;

function resolveFormHTML(d) {
  const s = d.row.subtype, f = U.f, o = f.opt || (s === 'DELIVERY_ZONE' ? 'APPROVE' : s === 'TRANSFER_RECEIPT' ? 'CONFIRM' : 'GIVE');
  if (s === 'RESTOCK') return `<p class="lbl">¿Qué le respondemos al cliente?</p>${radios('opt', [['GIVE', 'Dar un estimado de reposición', 'El bot le avisa cuántos días tardará.'], ['NONE', 'Todavía no hay estimado', 'El bot le avisa que no hay fecha.']], o)}${o === 'GIVE' ? numField('f-days', 'Días para reponer', 'days', 'Entre 1 y 365 días.') : ''}`;
  if (s === 'EXPIRATION') return `<p class="lbl">¿Qué le respondemos al cliente?</p>${radios('opt', [['GIVE', 'Indicar la caducidad', 'Escribe la fecha o el texto que verá el cliente.'], ['NONE', 'No tengo la fecha', 'El bot le avisa que no está disponible.']], o)}${o === 'GIVE' ? taField('f-exp', 'Caducidad', 'exp', 500, false, 'Ej. marzo de 2027.') : ''}`;
  if (s === 'DELIVERY_ZONE') {
    const z = d.zoneImpact, zt = f.zt || 'FREE';
    return `${radios('opt', [['APPROVE', 'Aprobar la zona', 'Define el tipo de envío.'], ['REJECT', 'Rechazar la zona', 'No hay entrega en este código postal.']], o)}
    ${o === 'APPROVE' ? `${radios('zt', [['FREE', 'Envío gratis', ''], ['SURCHARGE', 'Con cargo adicional', ''], ['CARRIER_ONLY', 'Solo paquetería', '']], zt)}${zt === 'SURCHARGE' ? numField('f-sur', 'Cargo de envío (MXN)', 'sur', '') : ''}${zt !== 'CARRIER_ONLY' ? numField('f-eta', 'Días de entrega', 'eta', '') : ''}` : ''}
    <div class="alert warn" role="note">${ic('users', 'sm')}<div><strong>Esto resolverá ${z.requests} solicitudes de ${z.customers} clientes</strong>La decisión aplica a todos los clientes que preguntaron por el código postal ${d.decision.zipCode}.</div></div>`;
  }
  return `${radios('opt', [['CONFIRM', 'Confirmar comprobante', 'Registra el pago de la transferencia en la venta.'], ['REJECT', 'Rechazar comprobante', 'El cliente recibe el motivo.']], o)}
  ${o === 'CONFIRM' ? numField('f-amt', 'Monto recibido (MXN)', 'amt', `El cliente declaró ${money(d.decision.declaredAmountCents)}. Debe ser mayor que $0.00.`) : `${taField('f-rs', 'Motivo interno', 'rs', 1000, false, 'Solo lo ve el personal.')}${taField('f-cr', 'Mensaje para el cliente', 'cr', 300, false, 'Obligatorio: el bot se lo envía tal cual.')}`}`;
}
function formHTML(d) {
  const f = U.f, F = U.form;
  const head = (t, s) => `<div style="display:flex;gap:8px;align-items:center"><button type="button" class="icon-btn" style="width:36px;height:36px" data-back aria-label="Volver a las acciones">${ic('back', 'sm')}</button><div><h3 style="font-size:15px">${t}</h3>${s ? `<p class="p2">${s}</p>` : ''}</div></div>`;
  const foot = (label, cls) => `<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn ghost" data-back>Volver</button><button type="button" class="btn ${cls || 'primary'}" data-submit="${F}">${label}</button></div>`;
  if (F === 'resolve') return `${head('Resolver · ' + SUB[d.row.subtype][0], d.row.status === 'NEW' ? 'Al resolver también la tomas.' : '')}${resolveFormHTML(d)}${foot('Resolver')}`;
  if (F === 'cancel') {
    const rs = f.crs || 'NOT_ACTIONABLE';
    return `${head('Cancelar solicitud', 'La solicitud sale de la bandeja y queda en Canceladas.')}${radios('crs', [['DUPLICATE', 'Duplicada', ''], ['NOT_ACTIONABLE', 'No se puede atender', ''], ['CUSTOMER_UNREACHABLE', 'El cliente no responde', ''], ['OTHER', 'Otro motivo', 'Pide una nota interna.']], rs)}
    ${taField('f-note', 'Nota interna', 'note', 500, rs !== 'OTHER', 'Solo la ve el personal.')}
    ${rs === 'DUPLICATE' ? `<p class="hint-box">Con «Duplicada» no se envía mensaje al cliente.</p>` : taField('f-cn', 'Mensaje para el cliente', 'cn', 500, true, 'Si lo dejas vacío, el bot manda su aviso genérico.')}
    ${foot('Cancelar solicitud', 'danger')}`;
  }
  if (F === 'reassign') return `${head('Reasignar', 'Elige a quién se la pasas. Sigue En atención.')}${radios('to', PEOPLE.filter(p => !d.row.assignee || p.id !== d.row.assignee.id).map(p => [p.id, p.displayName, '']), f.to)}${fieldErr('to')}${taField('f-note', 'Nota', 'note', 500, true, 'Queda en el historial.')}<span class="mock-flag">Lista: GET /assignable-users</span>${foot('Reasignar')}`;
  if (F === 'merge') return `${head('Unir con otra solicitud', `Esta solicitud (${d.row.folio}) desaparece y sigue la que elijas. El bot lo sabe.`)}${radios('mt', d.merge.map(rowById).map(r => [r.id, `${r.folio} · ${esc(r.summary)}`, `${esc(who(r.assignee) || 'Sin responsable')} · misma conversación`]), f.mt)}${fieldErr('mt')}${d.row.assignee && d.row.assignee.id !== ME.id ? `<p class="hint-box">Si la tiene otra persona, recibe un aviso de que la uniste.</p>` : ''}${foot('Unir solicitudes')}`;
  if (F === 'link') return `${head('Vincular cliente', 'Elige el cliente que tiene este teléfono.')}${radios('lk', d.customer.candidates.map(c => [c.id, esc(c.displayName), `${phoneOf(c)} · ${c.isTrusted ? 'De confianza · ' : ''}${c.lastOrderAt ? 'último pedido ' + shortDate(c.lastOrderAt).split(',')[0] : 'sin pedidos'}`]), f.lk)}${fieldErr('lk')}<p class="hint-box">También se vincularán las otras solicitudes con este mismo teléfono que no tienen cliente.</p>${foot('Vincular cliente')}`;
  return '';
}
const PRIMARY = { CLAIM: ['Atender', 'user-check'], RESOLVE: ['Resolver…', 'check-circle'] };
const SECOND = { RELEASE: ['Liberar', 'undo', 'release'], REASSIGN: ['Reasignar…', 'swap', 'reassign'], MERGE: ['Unir con otra…', 'merge', 'merge'], LINK_CUSTOMER: ['Vincular cliente…', 'link', 'link'], CANCEL: ['Cancelar solicitud…', 'ban', 'cancel'] };
function conflictHTML() {
  const c = U.conflict; if (!c) return '';
  const M = {
    REQUEST_CLAIMED_BY_OTHER: ['409', 'Luis Ortega ya tomó esta solicitud', 'La atendió mientras la mirabas. No se aplicó tu acción ni se guardó nada.', ['Actualizar', 'Ver en solo lectura']],
    VERSION_CONFLICT: ['409', 'La solicitud cambió mientras la mirabas', 'Pasó de la versión 4 a la 5 (por ejemplo, alguien la reasignó). No se aplicó tu acción; revisa y vuelve a intentarlo.', ['Actualizar']],
    REQUEST_CLOSED: ['409', 'Esta solicitud ya se cerró', 'Otra persona la resolvió o el cliente la canceló. Ya no admite acciones.', ['Actualizar']],
    ZONE_SET_CHANGED: ['409', 'Cambiaron los clientes de este código postal', 'Ahora resolverías 5 solicitudes de 4 clientes (antes 4 de 3). Revisa y confirma con los datos nuevos.', ['Confirmar con los datos nuevos']],
    NOT_ASSIGNEE: ['403', 'Solo quien la atiende puede hacerlo', 'Para liberar o cancelar la de otra persona hace falta el permiso de reasignar.', ['Entendido']]
  }[c];
  return `<div class="alert danger" role="alert">${ic('alert', 'sm')}<div><strong>${M[1]}</strong>${M[2]}<div class="acts">${M[3].map((a, i) => `<button type="button" class="btn sm ${i ? 'ghost' : ''}" data-clear-conflict>${a}</button>`).join('')}</div><small class="muted" style="display:block;margin-top:6px">Detalle técnico: ${M[0]} ${c}</small></div></div>`;
}
function actionHTML(d) {
  const A = allowedActions(d), r = d.row, closed = r.status === 'RESOLVED' || r.status === 'CANCELLED';
  let body;
  if (U.form && A.length) body = formHTML(d);
  else if (closed) body = `<div class="alert ${r.status === 'RESOLVED' ? 'success' : 'info'}">${ic(r.status === 'RESOLVED' ? 'check-circle' : 'ban', 'sm')}<div><strong>${r.status === 'RESOLVED' ? 'Solicitud resuelta' : 'Solicitud cancelada'}</strong>Ya no admite acciones. El historial muestra qué pasó.</div></div>`;
  else if (!A.length) body = `<div class="alert info" role="note">${ic('lock', 'sm')}<div><strong>${r.assignee && r.assignee.id !== ME.id ? `La está atendiendo ${esc(r.assignee.displayName)}` : 'Solo puedes verla'}</strong>${r.assignee ? 'Puedes leerla, pero no cambiarla.' : 'Tu rol no tiene acciones disponibles sobre esta solicitud.'}</div></div>`;
  else {
    const prim = A.includes('CLAIM') ? 'CLAIM' : A.includes('RESOLVE') ? 'RESOLVE' : null;
    body = `<div style="display:grid;gap:8px">${prim ? `<button type="button" class="btn primary block" data-act="${prim}">${ic(PRIMARY[prim][1], 'sm')}${PRIMARY[prim][0]}</button>` : ''}
    ${A.includes('CLAIM') && A.includes('RESOLVE') ? `<button type="button" class="btn block" data-act="RESOLVE">${ic('check-circle', 'sm')}Resolver sin tomarla…</button>` : ''}
    ${A.filter(a => SECOND[a]).map(a => `<button type="button" class="btn block ${a === 'CANCEL' ? 'danger' : ''}" data-act="${a}">${ic(SECOND[a][1], 'sm')}${SECOND[a][0]}</button>`).join('')}</div>
    ${r.kind === 'DECISION' && !A.includes('RESOLVE') && !(r.assignee && r.assignee.id !== ME.id) ? `<p class="help">${ic('lock', 'xs')} Resolver no está disponible para tu rol. Una decisión se cierra con su acción, no se cancela.</p>` : ''}
    ${r.kind === 'CLARIFICATION' ? `<p class="help">${ic('info', 'xs')} Responder la aclaración llega en la etapa S6; no hay botón todavía.</p>` : ''}`;
  }
  return `<div id="act-inner" style="display:grid;gap:12px">${conflictHTML()}${body}<p class="help fig">Versión ${r.version} · ${A.length ? 'acciones según tu rol' : 'sin acciones'}</p></div>`;
}

/* ---- behaviour (delegated; the artboard sets window.redraw) ---- */
function simulate(kind) { U.sim = kind; U.conflict = kind || null; window.redraw(); }
function validateForm(d) {
  const f = U.f, e = {}, F = U.form, s = d.row.subtype, o = f.opt;
  if (F === 'resolve') {
    if (s === 'RESTOCK' && (o || 'GIVE') === 'GIVE' && !(+f.days >= 1 && +f.days <= 365)) e.days = 'Escribe un número de días entre 1 y 365.';
    if (s === 'EXPIRATION' && (o || 'GIVE') === 'GIVE' && !(f.exp || '').trim()) e.exp = 'Escribe la caducidad que verá el cliente.';
    if (s === 'TRANSFER_RECEIPT' && (o || 'CONFIRM') === 'CONFIRM' && !(parseFloat(f.amt) > 0)) e.amt = 'El monto debe ser mayor que $0.00.';
    if (s === 'TRANSFER_RECEIPT' && o === 'REJECT') { if (!(f.rs || '').trim()) e.rs = 'Escribe el motivo interno.'; if (!(f.cr || '').trim()) e.cr = 'El mensaje para el cliente es obligatorio.'; }
  }
  if (F === 'cancel' && f.crs === 'OTHER' && !(f.note || '').trim()) e.note = 'Con «Otro motivo» la nota interna es obligatoria.';
  if (F === 'reassign' && !f.to) e.to = 'Elige a quién se la pasas.';
  if (F === 'merge' && !f.mt) e.mt = 'Elige la solicitud que se queda.';
  if (F === 'link' && !f.lk) e.lk = 'Elige un cliente.';
  return e;
}
function commit(d, F) {
  const r = d.row, add = (t, data) => { d.audit.unshift(ev(t, 0, ME, null, null, data)); r.version++; };
  if (F === 'CLAIM') { r.status = 'IN_PROGRESS'; r.assignee = ME; add('CLAIMED'); toast('Solicitud tomada', `${r.folio} ahora está a tu nombre.`); }
  else if (F === 'release') { r.status = 'NEW'; r.assignee = null; add('RELEASED'); toast('Solicitud liberada', `${r.folio} volvió a Nueva.`); }
  else if (F === 'resolve') { r.status = 'RESOLVED'; r.assignee = r.assignee || ME; add('RESOLVED'); toast('Solicitud resuelta', d.zoneImpact && r.subtype === 'DELIVERY_ZONE' && U.f.opt !== 'REJECT' ? `También se resolvieron ${d.zoneImpact.requests - 1} del mismo código postal.` : `${r.folio} salió de la bandeja.`); }
  else if (F === 'cancel') { r.status = 'CANCELLED'; add('CANCELLED', U.f.cn ? { customerNote: U.f.cn } : {}); toast('Solicitud cancelada', U.f.cn ? 'El bot enviará tu mensaje al cliente.' : 'El bot enviará su aviso genérico.'); }
  else if (F === 'reassign') { r.assignee = PEOPLE.find(p => p.id === U.f.to); add('REASSIGNED'); toast('Solicitud reasignada', `Ahora la atiende ${r.assignee.displayName}.`); }
  else if (F === 'merge') { r.status = 'CANCELLED'; add('MERGED'); toast('Solicitudes unidas', `${r.folio} se unió con ${rowById(U.f.mt).folio}.`); }
  else if (F === 'link') { const c = d.customer.candidates.find(x => x.id === U.f.lk); d.customer = { ...d.customer, ...c, ambiguous: false, candidates: [], recentOrders: [], priceList: null }; add('CUSTOMER_LINKED'); toast('Cliente vinculado', `${c.displayName} quedó en esta y otras solicitudes del teléfono.`); }
  U.form = null; U.f = {}; U.err = {};
}
document.addEventListener('click', e => {
  const d = cur(), t = e.target;
  const b = t.closest('[data-act]');
  if (b) { const a = b.dataset.act; if (U.sim && a === 'CLAIM') { U.conflict = U.sim; } else if (a === 'CLAIM') commit(d, 'CLAIM'); else if (a === 'RELEASE') commit(d, 'release'); else { U.form = a === 'RESOLVE' ? 'resolve' : SECOND[a][2]; U.f = {}; U.err = {}; } window.redraw(); return; }
  const rd = t.closest('[data-radio]'); if (rd) { U.f[rd.dataset.radio] = rd.dataset.val; U.err = {}; window.redraw(); return; }
  if (t.closest('[data-back]')) { U.form = null; U.err = {}; window.redraw(); return; }
  if (t.closest('[data-clear-conflict]')) { U.conflict = null; U.sim = ''; const s = $('#t-sim'); if (s) s.value = ''; window.redraw(); return; }
  const sb = t.closest('[data-submit]');
  if (sb) { U.err = validateForm(d); if (!Object.keys(U.err).length) { if (U.sim) { U.conflict = U.sim; } else commit(d, sb.dataset.submit); } window.redraw(); }
});
document.addEventListener('input', e => {
  const f = e.target.closest('[data-field]'); if (!f) return;
  U.f[f.dataset.field] = f.value; const c = $(`[data-count="${f.id}"]`); if (c) c.textContent = `${f.value.length}/${f.maxLength}`;
});
const simToolHTML = () => `<label>Respuesta <select id="t-sim"><option value="">Correcta</option><option value="REQUEST_CLAIMED_BY_OTHER">409 La tomó otra persona</option><option value="VERSION_CONFLICT">409 Cambió la versión</option><option value="REQUEST_CLOSED">409 Ya se cerró</option><option value="ZONE_SET_CHANGED">409 Cambió la zona</option><option value="NOT_ASSIGNEE">403 No es quien la atiende</option></select></label>`;
const scToolHTML = () => `<label>Solicitud <select id="t-sc"><option value="restock">Reposición (en atención, vencida)</option><option value="unknown">Pregunta sin cliente vinculado</option><option value="zone">Zona de entrega</option><option value="receipt">Comprobante</option><option value="expiration">Caducidad</option></select></label>`;
function initDetailTools() {
  $('#t-sim').addEventListener('change', e => simulate(e.target.value));
  $('#t-sc').value = U.sc; $('#t-sc').addEventListener('change', e => { U.sc = e.target.value; U.form = null; U.f = {}; U.err = {}; U.conflict = null; window.redraw(); });
}
function resetDetail() { Object.values(DET).forEach(d => { Object.assign(d.row, structuredClone(d.base)); }); }
