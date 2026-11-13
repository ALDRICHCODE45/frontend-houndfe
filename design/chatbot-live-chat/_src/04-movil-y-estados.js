/* Board 04: mobile 390 frames plus static edge states, built from the shared components. */
injectIcons();
const S0 = (o) => mk(o);
const scr = (inner, sheet = '', cls = '') => `<div class="screen ${cls}">${inner}${sheet}</div>`;
const fig = (cap, sub, body) => `<figure class="phone"><figcaption>${cap}<small>${sub}</small></figcaption>${body}</figure>`;
const chatBar = s => `<div class="mbar"><button type="button" class="icon-btn" aria-label="Volver al detalle">${ic('back')}</button><div class="t"><div class="meta">${reqBadge(s)}<span class="folio">S-000412</span></div><b>${CUST}</b></div><button type="button" class="icon-btn" aria-label="Más acciones de la conversación">${ic('dots')}</button></div>`;
const chatScreen = (s, sheet = '', o = {}) => scr(`${chatBar(s)}<div class="mstrip">${sessBadge(s)}${winChip(s)}</div><div class="mbanner">${bannerHTML(s, { fin: false })}</div><div class="thread scroll-t" tabindex="0" aria-label="Mensajes">${s.role === 'other-noconv' ? '' : threadHTML(s, { compact: true, author: 'other', newPill: o.pill })}</div><div class="cw">${composerHTML(s, { mobile: true, rows: 1 })}</div>${o.bar || ''}`, sheet);
const sheetHTML = (title, sub, body, foot) => `<div class="msheet"><div class="in" role="dialog" aria-modal="true" aria-label="${title}"><div class="hd"><div style="flex:1"><h2>${title}</h2><p class="p2">${sub}</p></div><button type="button" class="icon-btn" aria-label="Cerrar">${ic('x')}</button></div><div class="bd">${body}</div><div class="ft">${foot}</div></div></div>`;
const MS = mk(), ordersMini = `<table class="plain" aria-label="Pedidos recientes"><thead><tr><th scope="col" style="padding-left:0">Pedido</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead><tbody><tr><td style="padding-left:0"><b class="fig">V-1042</b></td><td class="num">$1,840.00</td><td>Entregado hoy</td></tr></tbody></table>`;

/* 1 · detail on mobile */
const detail = scr(`<div class="mbar"><button type="button" class="icon-btn" aria-label="Volver a Solicitudes">${ic('back')}</button><div class="t"><div class="meta">${reqBadge(MS)}<span class="folio">S-000412</span><span>Queja</span></div><b>Queja · ${CUST}</b></div><button type="button" class="icon-btn" aria-label="Más acciones">${ic('dots')}</button></div>
<div class="mscroll"><section class="livecard" aria-label="Conversación en vivo"><div class="row"><h2 style="font-size:16px">Conversación</h2>${sessBadge(MS)}<span class="badge info n">1 mensaje nuevo</span></div><div class="row">${winChip(MS)}</div><p class="prev"><b>${CF}:</b> Sí, por favor. La necesito para el fin de semana.<br><span class="p2">16:05</span></p></section>
<section class="panel"><h2>Resumen del bot</h2><p class="quote">${CF} recibió una bolsa de Croquetas Premium Adulto 15 kg rota en su pedido V-1042 y pide que se la repongan.</p></section>
<section class="panel"><div class="ph"><h2>Cliente</h2><span class="badge success">De confianza</span></div><dl class="kv"><dt>Nombre</dt><dd>${CUST}</dd><dt>Teléfono</dt><dd>${PHONE}</dd></dl>${ordersMini}</section>
<section class="panel"><h2>Historial de la solicitud</h2><ol class="tl"><li><b>Conversación conectada</b><small>hoy 15:58 · el bot se calló</small></li><li><b>Tomada por Laura Méndez</b><small>hoy 15:58</small></li><li><b>Solicitud creada por el bot</b><small>hoy 15:42 · Queja</small></li></ol></section></div>
<div class="sbar"><button type="button" class="btn">${ic('check-circle', 'sm')}Finalizar</button><button type="button" class="btn primary">${ic('message', 'sm')}Abrir conversación</button></div>`);
/* 2 · chat active */
const f2 = chatScreen(mk());
/* 3 · attach sheet */
const f3 = chatScreen(mk({ menu: false }), sheetHTML('Adjuntar', 'Imagen JPG, PNG o WebP, o un PDF. Hasta 10 MB.', `<button type="button" class="rrow" data-noop>${ic('image', 'sm')}<span class="tx"><b>Foto o imagen</b><small>De la galería o la cámara</small></span></button><button type="button" class="rrow" data-noop>${ic('file', 'sm')}<span class="tx"><b>Documento PDF</b><small>De tus archivos</small></span></button><p class="help">Se envía una sola cosa por mensaje; el texto que escribas va como pie.</p>`, `<button type="button" class="btn ghost" style="grid-column:1/-1">Cancelar</button>`));
/* 4 · uploading + caption */
const f4 = chatScreen(mk({ attach: { kind: 'IMAGE', name: 'foto-reposicion.jpg', size: '1.4 MB', status: 'uploading', pct: 60 }, draft: 'Así se ve la bolsa que te vamos a mandar.' }));
/* 5 · window closed */
const f5 = chatScreen(mk({ win: 'closed' }));
/* 6 · template confirm */
const f6 = chatScreen(mk({ win: 'closed' }), sheetHTML(`¿Enviar plantilla a ${CF}?`, `Solicitud S-000412 · ${CUST}`, tplBody(mk({ win: 'closed' })), `<button type="button" class="btn ghost">Cancelar</button><button type="button" class="btn primary">${ic('receipt', 'sm')}Enviar plantilla</button>`));
/* 7 · finish a complaint with the 422 mapped to the field */
const sFin = mk({ fin: { note: 'Se mandó reposición de la bolsa; Mariana confirmó por WhatsApp.', outcome: '', err: { outcome: 'Elige cómo se resolvió la queja. Es obligatorio para finalizar una queja.' }, busy: false } });
const f7 = chatScreen(mk(), sheetHTML('Finalizar conversación', finishSub(sFin), finishBody(sFin), `<button type="button" class="btn ghost">Cancelar</button><button type="button" class="btn primary">${ic('check-circle', 'sm')}Finalizar</button>`));
/* 8 · idle customer, 38 min */
const f8 = chatScreen(mk({ cust: 'idle' }));
/* 9 · read-only */
const f9 = chatScreen(mk({ role: 'other' }));
/* 10-12 · session states */
const f10 = chatScreen(mk({ session: 'STARTING', elapsed: 42 }));
const f11 = chatScreen(mk({ session: 'WAITING' }), '', { bar: '' });
const f12 = chatScreen(mk({ session: 'ENDED', outcome: 'REPLACEMENT', note: 'Se mandó reposición de la bolsa; Mariana confirmó por WhatsApp.' }));

const mob = [
  fig('1 · Detalle de la solicitud', 'Tarjeta de la conversación; Finalizar y Abrir conversación en la barra inferior', detail),
  fig('2 · Conversación en vivo', 'Compositor fijo abajo; ventana y sesión en la franja de arriba', f2),
  fig('3 · Adjuntar', 'Una imagen o PDF por mensaje, hasta 10 MB', f3),
  fig('4 · Adjunto subiendo con pie de foto', 'Enviar se habilita al terminar la subida; el texto pasa a pie de foto (1,024)', f4),
  fig('5 · Ventana de 24 h cerrada', 'Compositor bloqueado, costo a la vista, plantilla solo por botón', f5),
  fig('6 · Confirmar la plantilla', 'Hoja inferior: repite el costo y qué pasa después', f6),
  fig('7 · Finalizar una queja', 'Nota obligatoria y clasificación en filas de radio; error 422 en el campo', f7),
  fig('8 · Cliente sin escribir 38 min', '«Puedes finalizar ahora sin más pasos» (FINISH_IDLE)', f8),
  fig('9 · Solo lectura', 'La atiende otra persona: se lee, no se escribe', f9),
  fig('10 · Conectando…', 'El compositor espera la confirmación del bot', f10),
  fig('11 · Sin confirmar', 'El bot no confirmó: la solicitud volvió a Nueva', scr(`${chatBar(mk({ session: 'WAITING' }))}<div class="mstrip">${sessBadge(mk({ session: 'WAITING' }))}</div><div class="mbanner">${bannerHTML(mk({ session: 'WAITING' }), { fin: true })}</div><div class="thread scroll-t">${threadHTML(mk({ session: 'WAITING' }), { compact: true, author: 'other' })}</div><div class="cw">${composerHTML(mk({ session: 'WAITING' }), { mobile: true })}</div>`)),
  fig('12 · Conversación terminada', 'Resumen de la nota y la clasificación; sin compositor', f12)
];

/* delivery-state matrix */
const mm = (status, o = {}) => ({ id: 'x' + status, dir: 'OUT', author: 'STAFF', type: 'TEXT', text: o.text || 'Te puedo mandar una bolsa nueva hoy mismo. ¿Te late?', at: 964, day: 0, status, ...o });
const DSTATES = [
  ['En cola', 'QUEUED', 'Guardado; el bot todavía no lo toma. No hay nada que hacer.', mm('QUEUED', { age: 4 })],
  ['Pendiente de envío', 'QUEUED +30 s', 'Lo calcula el front a los 30 s sin «Enviado». Sigue en cola; no se reenvía a mano.', mm('QUEUED', { age: 48 })],
  ['Enviado', 'SENT', 'El bot lo entregó a WhatsApp (confirmación de Meta).', mm('SENT')],
  ['Entregado', 'DELIVERED', `Llegó al teléfono de ${CF}.`, mm('DELIVERED')],
  ['Leído', 'READ', `${CF} lo abrió.`, mm('READ')],
  ['No enviado, ventana cerrada', 'DEFERRED', 'WhatsApp cerró la ventana. Se reenvía solo si el cliente escribe; la ventana del chat se bloquea.', mm('DEFERRED')],
  ['No enviado', 'FAILED', 'Reintentar crea un mensaje nuevo (otro clientMessageId). Un diferido que queda al terminar la sesión también pasa a este estado.', mm('FAILED')],
  ['Entrega dudosa', 'UNKNOWN', 'Puede que ya haya llegado. Reenviarlo crea un mensaje nuevo; la plantilla no se puede reenviar.', mm('UNKNOWN')],
  ['Plantilla no entregada', 'TEMPLATE · FAILED', 'Nunca llega como «ventana cerrada». Reintentar se hace desde el recuadro de la ventana.', { id: 'xt', dir: 'OUT', author: 'STAFF', type: 'TEMPLATE', templateName: TPL.name, text: '', at: 965, day: 0, status: 'FAILED' }]
];
const dcards = DSTATES.map(([t, c, d, m]) => `<article class="ecard"><h3>${t}<code>${c}</code></h3><p>${d}</p><div class="inner"><ol class="thread-list">${bubbleHTML(m, MS, {})}</ol></div></article>`).join('');
/* window-closed composer states */
const WC = [['Disponible', 'ready', 'TEMPLATE', mk({ win: 'closed' })], ['Ya enviada, esperando', 'pending', 'WINDOW_CLOSED', mk({ win: 'closed', tpl: 'pending' })], ['Falló: se puede reintentar', 'failed', 'FAILED', mk({ win: 'closed', tpl: 'failed' })], ['Entrega dudosa: sin reintento', 'unknown', 'UNKNOWN', mk({ win: 'closed', tpl: 'unknown' })], ['Sin plantilla en Ajustes', 'none', '422 TEMPLATE_NOT_CONFIGURED', mk({ win: 'closed', tpl: 'none' })], ['Borrador conservado', 'draft', '409 WINDOW_CLOSED', mk({ win: 'closed', draft: 'Te confirmo en unos minutos si podemos llevártela hoy.' })]];
const wcards = WC.map(([t, k, c, s]) => `<article class="ecard"><h3>${t}<code>${c}</code></h3><div class="inner">${composerHTML(s)}</div></article>`).join('');
/* attachments and limits */
const longTxt = 'a'.repeat(4216);
const att = [
  ['Imagen lista', '200 / 201 · hasta 10 MB', `<div class="inner pad">${attachHTML({ kind: 'IMAGE', name: 'foto-reposicion.jpg', size: '1.4 MB', status: 'ready', pct: 100 })}</div>`],
  ['Subiendo', 'multipart · POST /media', `<div class="inner pad">${attachHTML({ kind: 'PDF', name: 'politica-de-cambios.pdf', size: '218 KB', status: 'uploading', pct: 35 })}</div>`],
  ['Muy grande', '413 MEDIA_TOO_LARGE', `<div class="inner pad">${attachHTML({ kind: 'IMAGE', name: 'foto-original.jpg', size: '14.2 MB', status: 'error', pct: 0, err: FILES.big.err })}</div>`],
  ['Tipo no permitido', '415 MEDIA_TYPE_NOT_ALLOWED', `<div class="inner pad">${attachHTML({ kind: 'VIDEO', name: 'empaque-bolsa.mp4', size: '6.2 MB', status: 'error', pct: 0, err: FILES.video.err })}</div>`],
  ['Archivo eliminado', '410 MEDIA_PURGED · 12 meses', `<div class="inner"><ol class="thread-list">${bubbleHTML({ id: 'p', dir: 'IN', author: 'CUSTOMER', type: 'IMAGE', text: 'Así llegó', media: { name: 'bolsa-rota.jpg', size: '', purged: true }, at: 942, day: 0 }, MS, {})}</ol></div>`],
  ['Más de 4,096 caracteres', 'text 1–4096', `<div class="inner">${composerHTML(mk({ draft: longTxt }), { mobile: true })}</div>`]
].map(([t, c, h]) => `<article class="ecard"><h3>${t}<code>${c}</code></h3>${h}</article>`).join('');
/* errors and conflicts */
const finErr = mk({ fin: { note: 'Se mandó reposición.', outcome: 'REPLACEMENT', err: null } });
const ecards = [
  ['La conversación cambió', '409 STALE_EPOCH', `<div class="inner pad">${al('warn', ic('refresh', 'sm'), 'La conversación cambió', 'Otra persona la tomó o la reasignó mientras escribías. Actualizamos los datos y tu borrador sigue en el cuadro de mensaje.', `<button type="button" class="btn sm">Revisar</button>`)}</div>`],
  ['Te la reasignaron', '403 NOT_ASSIGNEE', `<div class="inner">${composerHTML(mk({ role: 'other' }))}</div>`],
  ['La solicitud cambió al finalizar', '409 VERSION_CONFLICT', `<div class="inner pad">${al('danger', ic('alert', 'sm'), 'La solicitud cambió', 'Alguien la actualizó mientras escribías la nota. Cargamos la versión nueva y tu nota se conservó: revísala y vuelve a finalizar.', `<button type="button" class="btn sm">Volver a intentar</button>`)}</div>`],
  ['Todavía no está activa', '409 SESSION_NOT_ACTIVE', `<div class="inner pad">${al('info', ic('clock', 'sm'), 'La conversación todavía no está activa', 'El bot aún no confirma que se calló. Podrás escribir en cuanto lo haga.')}</div>`],
  ['Finalizar en lugar de otra persona', 'FINISH forzado', `<div class="inner pad">${finishBody(mk({ role: 'reassigner' })).replace(/<div class="field">[\s\S]*$/, '')}</div>`],
  ['Se cerró sola por inactividad', '2 h · nota automática', `<div class="inner pad">${bannerHTML(mk({ session: 'ENDED', outcome: 'none', note: 'Cierre automático: el cliente no escribió en 2 h.' }), { fin: false })}</div>`],
  ['Sin conexión en tiempo real', 'SSE caído · sondeo', `<div class="inner pad">${bannerHTML(mk({ conn: 'lost' }), { fin: false })}</div>`],
  ['Sin permiso de conversación', '403 INSUFFICIENT_PERMISSIONS', `<div class="inner"><div class="empty">${ic('lock')}<h2>No tienes permiso para ver esta conversación</h2><p>La atiende ${OTHER}. Pide el permiso «Ver conversaciones del chatbot» para leerla.</p></div></div>`],
  ['Solo ves tu sesión', 'sin read:ChatbotConversation', `<div class="inner pad">${bannerHTML(mk({ role: 'me-scoped' }), { fin: false })}</div>`]
].map(([t, c, h]) => `<article class="ecard"><h3>${t}<code>${c}</code></h3>${h}</article>`).join('');
const tools = `<div class="tools" role="group" aria-label="Opciones del artboard"><button type="button" id="t-theme"></button><span class="grow"></span><button type="button" id="t-notes" aria-pressed="false">${ic('info', 'sm')}Notas</button></div>`;
setHTML($('#root'), `<div class="board"><section class="sec" aria-labelledby="s1"><h2 id="s1">Móvil 390 · dirección A</h2><p class="p2">Doce pantallas del flujo: leer, escribir, adjuntar, ventana cerrada con plantilla, finalizar, sesión y roles. Todas usan los mismos componentes que el artboard 01.</p><div class="gallery">${mob.join('')}</div></section>
<section class="sec" aria-labelledby="s2"><h2 id="s2">Estados de entrega de un mensaje</h2><p class="p2">Icono y texto juntos. Solo los estados que piden acción llevan botón.</p><div class="cards">${dcards}</div></section>
<section class="sec" aria-labelledby="s3"><h2 id="s3">Con la ventana de 24 h cerrada</h2><p class="p2">Una sola plantilla por ventana cerrada; nunca se envía sola.</p><div class="cards">${wcards}</div></section>
<section class="sec" aria-labelledby="s4"><h2 id="s4">Adjuntos y límites</h2><p class="p2">Imagen JPG, PNG o WebP y PDF, hasta 10 MB; texto de 1 a 4,096 caracteres.</p><div class="cards">${att}</div></section>
<section class="sec" aria-labelledby="s5"><h2 id="s5">Errores, conflictos y roles</h2><p class="p2">Copy para cada respuesta del contrato. El usuario nunca ve los códigos.</p><div class="cards">${ecards}</div></section></div>
<div id="h-none"></div>`);
document.body.prepend((() => { const h = document.createElement('div'); setHTML(h, tools); return h.firstElementChild; })());
document.addEventListener('click', e => { if (e.target.closest('#t-theme')) { document.documentElement.classList.toggle('dark'); paintTheme(); } if (e.target.closest('#t-notes')) { const n = $('#notes'), b = e.target.closest('#t-notes'); n.hidden = !n.hidden; b.setAttribute('aria-pressed', String(!n.hidden)); } });
paintTheme(); measureTools(); addEventListener('resize', measureTools);
$$('.thread').forEach(t => { t.scrollTop = t.scrollHeight; });
