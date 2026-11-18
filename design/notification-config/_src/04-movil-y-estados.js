setHTML($('band'),band('Artboard 04 · Móvil 390 y estados (dirección A)',{states:false}));
wireBand(null);
const PHONES=[
  {t:'Con cambios sin guardar',d:'Encendiste «Cerca del límite» y sumaste a Sofía: 2 cambios. Descartar aparece solo con cambios.',o:{mutate:d=>{d.enabledActions.push('PROMOTION_NEAR_CAPACITY');d.recipientUserIds.push('u3');}},scroll:980},
  {t:'Cargando',d:'Esqueleto con la forma real de la página; los controles no se pueden usar todavía.',o:{view:'loading'}},
  {t:'Error al cargar',d:'Qué falló, que no se cambió nada y una sola salida: Reintentar.',o:{view:'error'}},
  {t:'Notificaciones desactivadas',d:'Cada acción dice por qué no se puede cambiar; la selección se conserva.',o:{data:{...INITIAL,enabled:false}},scroll:1060},
  {t:'Guardando',d:'Ambas acciones bloqueadas mientras se guarda; el estado lo anuncia.',o:{saving:true,mutate:d=>{d.enabledActions.push('TIME_OFF_REQUESTED');}},scroll:980},
  {t:'Falta elegir usuarios',d:'Hay avisos para usuarios y nadie en la lista: aviso bajo la lista y Guardar deshabilitado.',o:{mutate:d=>{d.recipientUserIds=[];}},scroll:640},
  {t:'Error al guardar',d:'No hubo respuesta del servidor: los cambios siguen ahí y Guardar reintenta.',o:{saveError:'No se guardó: no hubo respuesta del servidor. Tus cambios siguen aquí; puedes reintentar.',mutate:d=>{d.enabledActions=d.enabledActions.filter(k=>k!=='LOW_STOCK');}},scroll:980},
  {t:'Usuario no disponible',d:'Un seleccionado ya no está en la cuenta: se marca, no se quita solo.',o:{data:{...INITIAL,recipientUserIds:['u1','u2','u4','u-baja']}},scroll:700},
  {t:'Sin permiso para guardar',d:'Todo se ve pero no se cambia; la barra explica por qué.',o:{canUpdate:false},scroll:0}
];
const host=$('phones');
setHTML(host,PHONES.map((p,i)=>'<section aria-labelledby="ph'+i+'"><div class="ph-cap"><h2 id="ph'+i+'">'+p.t+'</h2><p>'+p.d+'</p></div><div class="device" role="region" aria-label="Teléfono: '+p.t+'"><div class="mbar"><button class="icon-btn" type="button" aria-label="Abrir menú">'+ic('menu')+'</button><span class="logo"><span class="logo-mark" aria-hidden="true">'+ic('paw')+'</span>HoundFe</span><button class="avatar" type="button" aria-label="Cuenta de Mariana Ruiz">MR</button></div><div class="mscroll" id="m'+i+'"></div></div></section>').join(''));
PHONES.forEach((p,i)=>{const st=createStore(p.o);bindStore($('m'+i),st,page01);if(p.scroll)$('m'+i).scrollTop=p.scroll;});
