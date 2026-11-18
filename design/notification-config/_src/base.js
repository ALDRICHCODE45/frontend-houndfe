/* ---------- icons (Lucide paths, inline) ---------- */
const P=d=>d.split('|').map(x=>x.startsWith('<')?x:'<path d="'+x+'"/>').join('');
const ICONS={
  paw:P('<circle cx="11" cy="4" r="2"/>|<circle cx="18" cy="8" r="2"/>|<circle cx="20" cy="16" r="2"/>|M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z'),
  cart:P('<circle cx="8" cy="21" r="1"/>|<circle cx="19" cy="21" r="1"/>|M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'),
  receipt:P('M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z|M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8|M12 17.5v-11'),
  package:P('M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z|M12 22V12|m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7|m7.5 4.27 9 5.15'),
  users:P('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|<circle cx="9" cy="7" r="4"/>|M22 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75'),
  chat:P('M7.9 20A9 9 0 1 0 4 16.1L2 22Z'),
  truck:P('M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2|M15 18H9|M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14|<circle cx="17" cy="18" r="2"/>|<circle cx="7" cy="18" r="2"/>'),
  shield:P('M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'),
  settings:P('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z|<circle cx="12" cy="12" r="3"/>'),
  store:P('m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7|M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8|M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4|M2 7h20'),
  bell:P('M10.268 21a2 2 0 0 0 3.464 0|M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326'),
  mail:P('<rect width="20" height="16" x="2" y="4" rx="2"/>|m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'),
  search:P('<circle cx="11" cy="11" r="8"/>|m21 21-4.3-4.3'),
  check:P('M20 6 9 17l-5-5'),
  minus:P('M5 12h14'),
  'circle-check':P('<circle cx="12" cy="12" r="10"/>|m9 12 2 2 4-4'),
  alert:P('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3|M12 9v4|M12 17h.01'),
  'circle-alert':P('<circle cx="12" cy="12" r="10"/>|M12 8v4|M12 16h.01'),
  info:P('<circle cx="12" cy="12" r="10"/>|M12 16v-4|M12 8h.01'),
  pause:P('<rect x="14" y="4" width="4" height="16" rx="1"/>|<rect x="6" y="4" width="4" height="16" rx="1"/>'),
  undo:P('M9 14 4 9l5-5|M4 9h10.5a5.5 5.5 0 0 1 0 11H11'),
  loader:P('M21 12a9 9 0 1 1-6.219-8.56'),
  refresh:P('M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8|M21 3v5h-5'),
  x:P('M18 6 6 18|m6 6 12 12'),
  tag:P('M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z|<circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  briefcase:P('M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16|<rect width="20" height="14" x="2" y="6" rx="2"/>'),
  user:P('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2|<circle cx="12" cy="7" r="4"/>'),
  lock:P('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>|M7 11V7a5 5 0 0 1 10 0v4'),
  'chevron-down':P('m6 9 6 6 6-6'),
  notes:P('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z|M14 2v4a2 2 0 0 0 2 2h4|M10 9H8|M16 13H8|M16 17H8'),
  menu:P('M4 12h16|M4 18h16|M4 6h16'),
  sun:P('<circle cx="12" cy="12" r="4"/>|M12 2v2|M12 20v2|m4.93 4.93 1.41 1.41|m17.66 17.66 1.41 1.41|M2 12h2|M20 12h2|m6.34 17.66-1.41 1.41|m19.07 4.93-1.41 1.41'),
  moon:P('M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z')
};
function setHTML(el,html){const r=document.createRange();r.selectNodeContents(el);el.replaceChildren(r.createContextualFragment(html));}
const ic=(n,cls)=>'<svg class="i'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(ICONS[n]||'')+'</svg>';
function hydrate(root){root.querySelectorAll('svg[data-i]').forEach(s=>{s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');s.setAttribute('focusable','false');setHTML(s,ICONS[s.dataset.i]||'');s.removeAttribute('data-i');});}
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clone=o=>structuredClone(o);
const plural=(n,one,many)=>n+' '+(n===1?one:many);
const initials=n=>n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- real content: ACTION_REGISTRY and copy.ts ---------- */
const COPY={
  title:'Configuración de notificaciones',
  sub:'Elige qué avisos se envían por correo y a quién. Nada cambia hasta que guardas.',
  master:'Notificaciones',
  recipients:'Usuarios a notificar',
  actions:'Acciones a notificar',
  loadError:'No se pudo cargar la configuración de notificaciones',
  success:'Configuración de notificaciones guardada',
  search:'Buscar usuarios…',
  usersLoadError:'No se pudieron cargar los usuarios',
  zero:'Selecciona al menos un usuario a notificar',
  noPerm:'No tienes permisos para guardar cambios',
  invalid:'Uno de los usuarios seleccionados no pertenece a esta cuenta',
  stale:'Usuario no disponible'
};
const MODULES=[
  {key:'pos',label:'Punto de venta',icon:'cart',actions:[
    {key:'LOW_STOCK',label:'Bajo inventario',desc:'Envía un correo cuando un producto cae por debajo de su inventario mínimo.'}]},
  {key:'hr',label:'Recursos humanos',icon:'briefcase',actions:[
    {key:'TIME_OFF_REQUESTED',label:'Solicitud de validación',desc:'Envía un correo cuando alguien del equipo pide días libres y espera que los apruebes.',proposed:true}]},
  {key:'delivery',label:'Entregas',icon:'truck',actions:[
    {key:'DELIVERY_NEXT_STOP',label:'Próxima parada',desc:'Avisa al siguiente cliente que su paquete está por llegar.',toCustomer:true}]},
  {key:'promotions',label:'Promociones',icon:'tag',actions:[
    {key:'PROMOTION_EXPIRING',label:'Vencimiento próximo',desc:'Envía un correo cuando una promoción activa vence en los próximos 7 días. La entrega es asíncrona y puede demorar.'},
    {key:'PROMOTION_NEAR_CAPACITY',label:'Cerca del límite',desc:'Envía un correo cuando el consumo de una promoción con cupo finito pasa desde menos del 80% hasta alcanzar o superar ese umbral. Las promociones sin límite no generan esta alerta. La entrega es asíncrona y puede demorar.'}]}
];
const ACTIONS=MODULES.flatMap(m=>m.actions.map(a=>({...a,module:m})));
const actionByKey=k=>ACTIONS.find(a=>a.key===k);
const USERS=[
  {id:'u1',name:'Mariana Ruiz'},{id:'u2',name:'Luis Hernández'},{id:'u3',name:'Sofía Castillo'},
  {id:'u4',name:'Jorge Méndez'},{id:'u5',name:'Ana Lucía Torres'},{id:'u6',name:'Ricardo Peña'},
  {id:'u7',name:'Daniela Ortiz'},{id:'u8',name:'Fernando Gil'},{id:'u9',name:'Paola Vázquez'}
];
const userById=id=>USERS.find(u=>u.id===id);
const INITIAL={enabled:true,recipientUserIds:['u1','u2','u4'],enabledActions:['LOW_STOCK','DELIVERY_NEXT_STOP','PROMOTION_EXPIRING']};

/* ---------- store: form state mirrors NotificationConfigForm ---------- */
let storeSeq=0;
function createStore(opts={}){
  const p='s'+(++storeSeq)+'-';
  const st={p,data:clone(opts.data||INITIAL),saved:null,view:opts.view||'ready',users:opts.users||'ok',canUpdate:opts.canUpdate!==false,
    saving:!!opts.saving,saveError:opts.saveError||null,fieldError:opts.fieldError||null,outcome:'ok',savedAt:Date.now()-12*60000,q:'',subs:[],toast:false};
  st.saved=clone(opts.saved||st.data);
  if(opts.mutate)opts.mutate(st.data);
  st.on=fn=>st.subs.push(fn);
  st.emit=()=>st.subs.forEach(fn=>fn());
  st.set=fn=>{if(st.saving||!st.canUpdate)return;fn(st.data);st.saveError=null;st.emit();};
  return st;
}
const setEq=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
function dirtyCount(st){
  const d=st.data,s=st.saved;let n=d.enabled!==s.enabled?1:0;
  n+=d.recipientUserIds.filter(x=>!s.recipientUserIds.includes(x)).length+s.recipientUserIds.filter(x=>!d.recipientUserIds.includes(x)).length;
  n+=d.enabledActions.filter(x=>!s.enabledActions.includes(x)).length+s.enabledActions.filter(x=>!d.enabledActions.includes(x)).length;
  return n;
}
const knownCount=st=>st.data.recipientUserIds.filter(id=>userById(id)).length;
const violation=st=>st.data.enabledActions.some(k=>!actionByKey(k).toCustomer)&&st.data.recipientUserIds.length===0;
const canSave=st=>dirtyCount(st)>0&&!st.saving&&!violation(st)&&st.canUpdate;
const isOn=(st,k)=>st.data.enabledActions.includes(k);
function toggleAction(st,k){st.set(d=>{d.enabledActions=d.enabledActions.includes(k)?d.enabledActions.filter(x=>x!==k):[...d.enabledActions,k];});}
function toggleRecipient(st,id){st.set(d=>{d.recipientUserIds=d.recipientUserIds.includes(id)?d.recipientUserIds.filter(x=>x!==id):[...d.recipientUserIds,id];});st.fieldError=null;}
function moduleState(st,m){const on=m.actions.filter(a=>isOn(st,a.key)).length;return {on,total:m.actions.length,pressed:on===0?'false':on===m.actions.length?'true':'mixed'};}
function toggleModule(st,m){const all=moduleState(st,m).pressed==='true';st.set(d=>{const keys=m.actions.map(a=>a.key);d.enabledActions=d.enabledActions.filter(k=>!keys.includes(k));if(!all)d.enabledActions.push(...keys);});}
function announce(t){const a=$('announce');if(!a)return;a.textContent='';setTimeout(()=>{a.textContent=t;},30);}
function doSave(st){
  if(!canSave(st))return;
  st.saving=true;st.saveError=null;st.emit();
  setTimeout(()=>{
    st.saving=false;
    if(st.outcome==='net'){st.saveError='No se guardó: no hubo respuesta del servidor. Tus cambios siguen aquí; puedes reintentar.';announce(st.saveError);}
    else if(st.outcome==='invalid'){st.fieldError=COPY.invalid;st.saveError='No se guardó: revisa Usuarios a notificar.';announce(st.saveError);}
    else{st.data.recipientUserIds=st.data.recipientUserIds.slice();st.saved=clone(st.data);st.savedAt=Date.now();st.toast=true;announce(COPY.success);setTimeout(()=>{st.toast=false;st.emit();},2600);}
    st.emit();
  },1100);
}
function doDiscard(st){st.data=clone(st.saved);st.saveError=null;st.fieldError=null;announce('Cambios descartados.');st.emit();}

/* ---------- derived copy ---------- */
function stateWord(st,a){
  const on=isOn(st,a.key);
  if(!st.data.enabled)return on?'En pausa':'Desactivado';
  return on?'Activado':'Desactivado';
}
function summary(st){
  const d=st.data,n=d.enabledActions.length,toUsers=d.enabledActions.filter(k=>!actionByKey(k).toCustomer).length,m=d.recipientUserIds.filter(id=>userById(id)).length;
  if(!d.enabled)return {tone:'off',icon:'pause',html:'<b>No se envía ningún aviso.</b> Tu selección de '+plural(n,'aviso','avisos')+' se conserva para cuando las vuelvas a activar.'};
  if(n===0)return {tone:'warn',icon:'alert',html:'<b>Activadas, pero sin avisos elegidos.</b> Enciende al menos una acción para que llegue algún correo.'};
  if(toUsers>0&&m===0)return {tone:'warn',icon:'alert',html:'<b>Falta a quién enviar.</b> '+plural(toUsers,'aviso necesita','avisos necesitan')+' al menos un usuario.'};
  const cust=d.enabledActions.includes('DELIVERY_NEXT_STOP');
  return {tone:'ok',icon:'circle-check',html:'<b>Se envían '+plural(n,'aviso','avisos')+' por correo</b>'+(toUsers?' a '+plural(m,'usuario','usuarios'):'')+(cust?' · Próxima parada va al cliente':'')+'.'};
}
function relTime(t){const m=Math.round((Date.now()-t)/60000);return m<1?'justo ahora':m<60?'hace '+m+' min':'hace '+Math.round(m/60)+' h';}

/* ---------- shared pieces (HTML) ---------- */
function masterRow(st,o={}){
  const on=st.data.enabled,dis=!st.canUpdate;
  return '<button type="button" class="srow master'+(o.cls?' '+o.cls:'')+'" role="switch" id="'+st.p+'master" data-act="master" aria-checked="'+on+'"'+(dis?' aria-disabled="true"':'')+' aria-labelledby="'+st.p+'mT" aria-describedby="'+st.p+'mD">'+
    (o.icon?'<span class="m-ic" aria-hidden="true">'+ic('bell')+'</span>':'')+
    '<span class="s-text"><span class="s-title" id="'+st.p+'mT">'+(o.title||'Notificaciones por correo')+'</span>'+
    '<span class="s-desc" id="'+st.p+'mD">'+(o.desc||'Interruptor general. Apagado, no se envía ningún aviso y tu selección se conserva.')+'</span></span>'+
    '<span class="s-word" aria-hidden="true">'+(on?'Activadas':'Desactivadas')+'</span><span class="track" aria-hidden="true">'+ic('check')+'</span></button>';
}
function summaryLine(st){const s=summary(st);return '<div class="notice '+s.tone+'" aria-live="polite">'+ic(s.icon)+'<span class="n-text">'+(dirtyCount(st)?'<span class="pending">Al guardar: </span>':'')+s.html+'</span></div>';}
function actionRow(st,a,o={}){
  const on=isOn(st,a.key),masterOff=!st.data.enabled,dis=masterOff||!st.canUpdate;
  const id=st.p+'a-'+a.key, tId=id+'-t', dId=id+'-d', rId=id+'-r';
  const reason=masterOff?'<span class="s-reason" id="'+rId+'">'+ic('pause')+'<span>'+(on?'En pausa: las notificaciones están desactivadas.':'No disponible mientras las notificaciones están desactivadas.')+'</span></span>':'';
  const tag=a.toCustomer?'<span class="badge b-neutral b-plain">'+ic('user')+'Va al cliente</span>':(o.who&&on&&!masterOff?'<span class="badge b-neutral b-plain">'+ic('mail')+(knownCount(st)?'A '+plural(knownCount(st),'usuario','usuarios'):'Sin usuarios')+'</span>':'');
  return '<button type="button" class="srow'+(o.cls?' '+o.cls:'')+'" role="switch" id="'+id+'" data-act="toggle" data-key="'+a.key+'" aria-checked="'+on+'"'+(dis?' aria-disabled="true"':'')+' aria-labelledby="'+tId+'" aria-describedby="'+dId+(reason?' '+rId:'')+'">'+
    (o.lead||'')+
    '<span class="s-text"><span class="s-title"><span id="'+tId+'">'+esc(a.label)+'</span>'+tag+'</span>'+
    '<span class="s-desc" id="'+dId+'">'+esc(a.desc)+'</span>'+reason+'</span>'+
    '<span class="s-word" aria-hidden="true">'+stateWord(st,a)+'</span><span class="track" aria-hidden="true">'+ic('check')+'</span></button>';
}
function allButton(st,m){
  if(m.actions.length<2)return '';
  const s=moduleState(st,m),dis=!st.data.enabled||!st.canUpdate;
  return '<button type="button" class="all" id="'+st.p+'all-'+m.key+'" data-act="all" data-mod="'+m.key+'" aria-pressed="'+s.pressed+'"'+(dis?' aria-disabled="true"':'')+' aria-label="Todas las acciones de '+m.label+', '+s.on+' de '+s.total+' activadas">'+
    '<span class="mark" aria-hidden="true">'+ic(s.pressed==='mixed'?'minus':'check')+'</span>'+(s.pressed==='true'?'Desactivar todas':'Activar todas')+' <span class="fig">'+s.on+' de '+s.total+'</span></button>';
}
function recipientPicker(st,o={}){
  const p=st.p;
  if(st.users==='loading')return '<div role="status" aria-busy="true" class="pick"><span class="sr-only">Cargando usuarios…</span>'+[1,2,3,4].map(()=>'<div class="opt" aria-hidden="true"><span class="sk" style="width:32px;height:32px;border-radius:50%"></span><span class="sk" style="width:'+(120+Math.round(Math.random()*80))+'px;height:12px"></span></div>').join('')+'</div>';
  if(st.users==='error')return '<div class="notice err" role="alert">'+ic('circle-alert')+'<span class="n-text"><b>'+COPY.usersLoadError+'.</b> Tu selección guardada no cambia.</span><button type="button" class="link-btn" data-act="retry-users">'+ic('refresh')+'Reintentar</button></div>';
  const sel=st.data.recipientUserIds, q=norm(st.q.trim());
  const list=USERS.filter(u=>!q||norm(u.name).includes(q));
  const dis=!st.canUpdate;
  const stale=sel.filter(id=>!userById(id));
  const search=o.search===false?'':'<div class="pick-search"><label class="sr-only" for="'+p+'q">Buscar usuarios</label>'+ic('search')+'<input id="'+p+'q" type="search" data-act="q" placeholder="'+COPY.search+'" value="'+esc(st.q)+'" autocomplete="off"'+(dis?' disabled':'')+'></div>';
  const rows=list.length?list.map((u,i)=>{const on=sel.includes(u.id);return '<div class="opt" role="option" id="'+p+'u-'+u.id+'" data-act="opt" data-id="'+u.id+'" aria-selected="'+on+'"'+(dis?' aria-disabled="true"':'')+' tabindex="'+(i===0?0:-1)+'"><span class="who" aria-hidden="true">'+initials(u.name)+'</span><span class="o-name">'+esc(u.name)+'</span><span class="o-word" aria-hidden="true">Recibe</span><span class="mark" aria-hidden="true">'+ic('check')+'</span></div>';}).join(''):'<p class="pick-empty">Ningún usuario para «'+esc(st.q)+'». <button type="button" class="link-btn" data-act="clear-q">Limpiar búsqueda</button></p>';
  const staleRows=stale.map(id=>'<div class="stale"><span class="who" aria-hidden="true">'+ic('user')+'</span><span class="o-name">'+COPY.stale+'<small>Ya no está en esta cuenta. No recibirá correos; quítalo para limpiar la lista.</small></span><button type="button" class="btn btn-ghost" data-act="rm-stale" data-id="'+id+'"'+(dis?' disabled':'')+'>'+ic('x')+'Quitar</button></div>').join('');
  const notes=[];
  if(st.fieldError)notes.push('<div class="notice err" id="'+p+'rErr" role="alert">'+ic('circle-alert')+'<span class="n-text"><b>'+st.fieldError+'.</b> Quita al usuario marcado o elige otro y vuelve a guardar.</span></div>');
  if(violation(st))notes.push('<div class="notice warn" id="'+p+'rErr" role="alert">'+ic('alert')+'<span class="n-text"><b>'+COPY.zero+'.</b> '+zeroWhy(st)+'</span></div>');
  return search+'<div class="pick" role="listbox" aria-multiselectable="true" aria-label="'+COPY.recipients+'" id="'+p+'list"'+(notes.length?' aria-describedby="'+p+'rErr"':'')+'>'+rows+'</div>'+staleRows+notes.join('');
}
function zeroWhy(st){const ks=st.data.enabledActions.filter(k=>!actionByKey(k).toCustomer).map(k=>actionByKey(k).label);return (ks.length===1?ks[0]+' necesita':ks.slice(0,-1).join(', ')+' y '+ks.at(-1)+' necesitan')+' a quién enviarse.';}
function recipientCount(st){return plural(st.data.recipientUserIds.filter(id=>userById(id)).length,'seleccionado','seleccionados')+' de '+USERS.length;}

function saveBar(st,o={}){
  const n=dirtyCount(st),bad=violation(st);let state;
  if(!st.canUpdate)state='<span class="st clean">'+ic('lock')+COPY.noPerm+'</span>';
  else if(st.saving)state='<span class="st saving">'+ic('loader','spin')+'Guardando…</span>';
  else if(st.saveError)state='<span class="st err">'+ic('circle-alert')+'<span>'+st.saveError+'</span></span>';
  else if(n)state='<span class="st dirty">'+plural(n,'cambio sin guardar','cambios sin guardar')+(bad?' · <span class="why">falta elegir usuarios</span>':'')+'</span>';
  else state='<span class="st clean">'+ic('check')+'Guardado '+relTime(st.savedAt)+'</span>';
  const btns=st.canUpdate?'<div class="btns'+(n&&!st.saving?'':' solo')+'">'+(n&&!st.saving?'<button type="button" class="btn btn-ghost" data-act="discard">'+ic('undo')+'Descartar</button>':'')+
    '<button type="button" class="btn btn-primary" data-act="save"'+(canSave(st)||st.saving?'':' disabled')+(st.saving?' aria-busy="true"':'')+'>'+(st.saving?ic('loader','spin')+'Guardando…':'Guardar cambios')+'</button></div>':'';
  return '<div class="savebar" role="region" aria-label="Guardar cambios"><div class="savebar-in" style="max-width:'+(o.max||'none')+'"><div class="save-state" aria-live="polite">'+state+'</div>'+btns+'</div></div>';
}
function errorState(){return '<div class="empty err" role="alert">'+ic('alert')+'<h2>'+COPY.loadError+'</h2><p>No se cambió nada. Revisa tu conexión y vuelve a intentarlo.</p><button type="button" class="btn" data-act="retry">'+ic('refresh')+'Reintentar</button></div>';}
function toast(st){return st.toast?'<div class="toast" role="status"><span class="t-ic">'+ic('circle-check')+'</span><div><b>'+COPY.success+'</b><span>Los próximos avisos ya usan estos ajustes.</span></div></div>':'';}
const skRows=(n,w)=>Array.from({length:n},(_,i)=>'<div class="sk-row"><span style="flex:1;display:grid;gap:8px"><span class="sk" style="width:'+(w||160)+'px;height:13px"></span><span class="sk" style="width:'+(60+((i*17)%30))+'%;height:11px"></span></span><span class="sk" style="width:44px;height:24px;border-radius:999px"></span></div>').join('');

/* ---------- binding ---------- */
function bindStore(root,st,render){
  const paint=()=>{
    const a=document.activeElement, fid=a&&root.contains(a)?a.id:null, sel=a&&a.selectionStart;
    setHTML(root,render(st));
    if(fid&&$(fid)){$(fid).focus({preventScroll:true});if(sel!=null&&$(fid).setSelectionRange)$(fid).setSelectionRange(sel,sel);}
  };
  st.on(paint);paint();
  root.addEventListener('click',e=>{
    const t=e.target.closest('[data-act]');if(!t||!root.contains(t))return;
    if(t.getAttribute('aria-disabled')==='true'){announce(!st.canUpdate?COPY.noPerm:'Activa las notificaciones para cambiar esta acción.');return;}
    const act=t.dataset.act;
    if(act==='master'){st.set(d=>{d.enabled=!d.enabled;});announce(st.data.enabled?'Notificaciones activadas.':'Notificaciones desactivadas. Las acciones quedan en pausa.');}
    else if(act==='toggle')toggleAction(st,t.dataset.key);
    else if(act==='all')toggleModule(st,MODULES.find(m=>m.key===t.dataset.mod));
    else if(act==='opt')toggleRecipient(st,t.dataset.id);
    else if(act==='rm-stale'){st.set(d=>{d.recipientUserIds=d.recipientUserIds.filter(x=>x!==t.dataset.id);});announce('Usuario no disponible quitado.');}
    else if(act==='clear-q'){st.q='';st.emit();$(st.p+'q')?.focus();}
    else if(act==='save')doSave(st);
    else if(act==='discard')doDiscard(st);
    else if(act==='retry'){st.view='loading';st.emit();setTimeout(()=>{st.view='ready';st.emit();},900);}
    else if(act==='retry-users'){st.users='loading';st.emit();setTimeout(()=>{st.users='ok';st.emit();},900);}
    else if(act==='go'){e.preventDefault();const el=$(t.dataset.target);if(el){el.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});el.querySelector('h2')?.focus({preventScroll:true});}}
    else if(act==='combo'){st.comboOpen=!st.comboOpen;st.emit();}
  });
  root.addEventListener('input',e=>{if(e.target.dataset.act==='q'){st.q=e.target.value;st.emit();}});
  root.addEventListener('keydown',e=>{
    const o=e.target.closest('[role="option"]');if(!o)return;
    const opts=[...o.parentElement.querySelectorAll('[role="option"]')],i=opts.indexOf(o);let j=-1;
    if(e.key==='ArrowDown')j=Math.min(i+1,opts.length-1);else if(e.key==='ArrowUp')j=Math.max(i-1,0);
    else if(e.key==='Home')j=0;else if(e.key==='End')j=opts.length-1;
    else if(e.key===' '||e.key==='Enter'){e.preventDefault();if(o.getAttribute('aria-disabled')!=='true'){toggleRecipient(st,o.dataset.id);}return;}
    else if(e.key==='Escape'&&st.comboOpen){st.comboOpen=false;st.emit();$(st.p+'combo')?.focus();return;}
    if(j<0)return;e.preventDefault();opts.forEach(x=>x.tabIndex=-1);opts[j].tabIndex=0;opts[j].focus();
  });
}

/* ---------- desktop shell ---------- */
function shell(contentId){
  return '<div class="app"><aside class="side" aria-label="Navegación principal"><div class="logo"><span class="logo-mark" aria-hidden="true">'+ic('paw')+'</span>HoundFe</div>'+
  '<nav aria-label="Secciones">'+
  '<div class="nav-group"><h2>POS</h2><ul><li><a href="#">'+ic('cart')+'Punto de venta</a></li><li><a href="#">'+ic('receipt')+'Ventas</a></li><li><a href="#">'+ic('package')+'Productos</a></li><li><a href="#">'+ic('users')+'Clientes</a></li></ul></div>'+
  '<div class="nav-group"><h2>Chatbot</h2><ul><li><a href="#">'+ic('chat')+'Conversaciones</a></li></ul></div>'+
  '<div class="nav-group"><h2>Admin</h2><ul><li><a href="#">'+ic('shield')+'Usuarios y roles</a></li></ul></div>'+
  '<div class="nav-group"><h2>Sistema</h2><ul><li><a href="#">'+ic('settings')+'Configuración</a></li><li><a href="#">'+ic('store')+'Catálogo online</a></li><li><a href="#" aria-current="page">'+ic('bell')+'Notificaciones</a></li></ul></div>'+
  '</nav></aside><div class="main"><header class="top"><nav class="crumbs" aria-label="Ruta"><ol><li><a href="#">Sistema</a></li><li aria-hidden="true">›</li><li><a href="#">Configuración</a></li><li aria-hidden="true">›</li><li><span aria-current="page">Notificaciones</span></li></ol></nav><span class="sp"></span>'+
  '<button class="icon-btn" type="button" data-theme aria-label="Cambiar tema">'+ic('moon')+'</button><button class="avatar" type="button" aria-label="Cuenta de Mariana Ruiz">MR</button></header>'+
  '<div class="scroll" id="'+contentId+'"></div></div></div>';
}
function band(title,o={}){
  return '<div class="ab" role="region" aria-label="Controles del artboard"><strong>'+title+'</strong><span>Sistema › Configuración › Notificaciones</span><span class="sp"></span>'+
  (o.states===false?'':'<label>Estado <select id="abState"><option value="ready">Normal</option><option value="loading">Cargando</option><option value="error">Error al cargar</option><option value="off">Notificaciones desactivadas</option><option value="zero">Sin usuarios a notificar</option><option value="stale">Con usuario no disponible</option><option value="users-error">No cargan los usuarios</option><option value="noperm">Sin permiso para guardar</option></select></label>'+
  '<label>Al guardar <select id="abOutcome"><option value="ok">Se guarda</option><option value="net">Falla la red</option><option value="invalid">Usuario de otra cuenta</option></select></label>')+
  '<button type="button" id="abNotes" aria-pressed="false">'+ic('notes')+'Notas</button><button type="button" id="abTheme" aria-pressed="false">'+ic('moon')+'Tema oscuro</button></div>';
}
function setTheme(dark){
  document.documentElement.classList.toggle('dark',dark);
  const b=$('abTheme');if(b){b.setAttribute('aria-pressed',String(dark));setHTML(b,ic(dark?'sun':'moon')+(dark?'Tema claro':'Tema oscuro'));}
  document.querySelectorAll('[data-theme]').forEach(x=>{setHTML(x,ic(dark?'sun':'moon'));x.setAttribute('aria-label',dark?'Cambiar a tema claro':'Cambiar a tema oscuro');});
}
function wireBand(st){
  const toggle=()=>setTheme(!document.documentElement.classList.contains('dark'));
  $('abTheme').addEventListener('click',toggle);
  document.addEventListener('click',e=>{if(e.target.closest('[data-theme]'))toggle();});
  $('abNotes').addEventListener('click',()=>{const n=$('notes');n.hidden=!n.hidden;$('abNotes').setAttribute('aria-pressed',String(!n.hidden));});
  if(!st||!$('abState'))return;
  $('abOutcome').addEventListener('change',e=>{st.outcome=e.target.value;});
  $('abState').addEventListener('change',e=>{
    const v=e.target.value;
    Object.assign(st,{view:'ready',users:'ok',canUpdate:true,saving:false,saveError:null,fieldError:null,q:'',comboOpen:false});
    st.data=clone(INITIAL);
    if(v==='loading'||v==='error')st.view=v;
    if(v==='off')st.data.enabled=false;
    if(v==='zero')st.data.recipientUserIds=[];
    if(v==='stale')st.data.recipientUserIds.push('u-baja');
    if(v==='users-error')st.users='error';
    if(v==='noperm')st.canUpdate=false;
    st.saved=clone(st.data);
    if(v==='zero'){st.saved.recipientUserIds=['u1'];}
    st.emit();
  });
}
