/* 02 · Side index + one section card per module + HfCombobox for recipients */
function combo(st){
  const p=st.p,sel=st.data.recipientUserIds,dis=!st.canUpdate;
  if(st.users!=='ok')return recipientPicker(st);
  const known=sel.filter(id=>userById(id)).map(userById);
  const chips=known.slice(0,2).map(u=>'<span class="chip">'+esc(u.name)+'</span>').join('')+(known.length>2?'<span class="chip more" aria-label="y '+(known.length-2)+' más">+'+(known.length-2)+'</span>':'');
  const trig='<button type="button" class="combo-trigger'+(violation(st)?' invalid':'')+'" id="'+p+'combo" data-act="combo" aria-haspopup="listbox" aria-expanded="'+!!st.comboOpen+'" aria-labelledby="'+p+'rLbl '+p+'combo"'+(dis?' disabled':'')+'>'+(chips||'<span class="ph">Agregar usuarios</span>')+'<span class="sp"></span>'+ic('chevron-down')+'</button>';
  const pop=st.comboOpen?'<div class="combo-pop hf-form-overlay">'+'<div class="combo-head fig">'+recipientCount(st)+'</div>'+recipientPicker(st)+'</div>':'';
  const names=known.map(u=>u.name);
  const line=names.length?'<p class="field-help">'+(names.length===1?names[0]+' recibe':names.slice(0,-1).join(', ')+' y '+names.at(-1)+' reciben')+' los avisos.</p>':'';
  const stale=sel.filter(id=>!userById(id)).length;
  const staleNote=stale?'<div class="notice warn">'+ic('alert')+'<span class="n-text"><b>'+COPY.stale+'.</b> Uno de los seleccionados ya no está en esta cuenta.</span><button type="button" class="link-btn" data-act="rm-stale" data-id="'+sel.find(id=>!userById(id))+'">Quitar</button></div>':'';
  const err=(!st.comboOpen&&violation(st))?'<p class="field-err" id="'+p+'rErr" role="alert">'+ic('circle-alert')+COPY.zero+'.</p>':(st.fieldError?'<p class="field-err" role="alert">'+ic('circle-alert')+st.fieldError+'.</p>':'');
  return '<div class="field"><span class="field-label" id="'+p+'rLbl">Personas que reciben los correos</span><div class="combo">'+trig+pop+'</div>'+line+err+'</div>'+staleNote;
}
function page02(st){
  const p=st.p;
  const head='<header class="page-head"><h1 class="page-title" id="'+p+'title">'+COPY.title+'</h1><p class="page-sub">'+COPY.sub+'</p></header>';
  const nav=(cur)=>'<nav class="index" aria-label="Secciones de la página"><ol>'+
    '<li><a href="#'+p+'sec-estado" data-act="go" data-target="'+p+'sec-estado"'+(cur==='estado'?' aria-current="true"':'')+'>'+ic('bell')+'Estado<span class="ix-m">'+(st.data.enabled?'Activadas':'Desactivadas')+'</span></a></li>'+
    '<li><a href="#'+p+'sec-users" data-act="go" data-target="'+p+'sec-users">'+ic('users')+'Usuarios<span class="ix-m fig'+(violation(st)?' warn':'')+'">'+(violation(st)?'falta 1':knownCount(st))+'</span></a></li>'+
    '<li class="ix-sep" aria-hidden="true">Acciones</li>'+
    MODULES.map(m=>{const s=moduleState(st,m);return '<li><a href="#'+p+'sec-'+m.key+'" data-act="go" data-target="'+p+'sec-'+m.key+'">'+ic(m.icon)+m.label+'<span class="ix-m fig">'+s.on+'/'+s.total+'</span></a></li>';}).join('')+'</ol></nav>';
  if(st.view==='error')return '<div class="slot"><div class="wrap">'+head+errorState()+'</div></div>';
  if(st.view==='loading')return '<div class="slot"><div class="wrap" aria-busy="true">'+head+'<div role="status" class="sr-only">Cargando la configuración de notificaciones…</div><div class="grid"><div aria-hidden="true" class="index">'+[1,2,3,4,5,6].map(()=>'<span class="sk" style="height:14px;margin:14px 12px;width:70%"></span>').join('')+'</div><div class="cards" aria-hidden="true">'+
    ['Estado','Usuarios','Punto de venta','Promociones'].map((x,i)=>'<section class="card"><div class="card-head"><span class="sk" style="width:140px;height:16px"></span></div>'+skRows(i===3?2:1,150)+'</section>').join('')+'</div></div></div></div>';
  const off=!st.data.enabled;
  const cards=
    '<section class="card" id="'+p+'sec-estado" aria-labelledby="'+p+'h-estado"><div class="card-head"><h2 id="'+p+'h-estado" tabindex="-1">Estado</h2></div>'+masterRow(st,{icon:false})+summaryLine(st)+'</section>'+
    '<section class="card" id="'+p+'sec-users" aria-labelledby="'+p+'h-users"><div class="card-head"><h2 id="'+p+'h-users" tabindex="-1">'+COPY.recipients+'</h2><span class="card-meta">Próxima parada llega al cliente, no a esta lista</span></div><div class="card-body">'+combo(st)+'</div></section>'+
    MODULES.map(m=>{const s=moduleState(st,m);return '<section class="card" id="'+p+'sec-'+m.key+'" aria-labelledby="'+p+'h-'+m.key+'"><div class="card-head"><span class="mod-ic" aria-hidden="true">'+ic(m.icon)+'</span><h2 id="'+p+'h-'+m.key+'" tabindex="-1">'+m.label+'</h2>'+(m.actions.length>1?allButton(st,m):'<span class="card-meta fig">'+(off&&s.on?'En pausa':s.on+' de '+s.total+' activada')+'</span>')+'</div>'+
      m.actions.map(a=>actionRow(st,a)).join('')+'</section>';}).join('');
  return '<div class="slot"><div class="wrap">'+head+(off?'<div class="banner">'+ic('pause')+'<span><b>Notificaciones desactivadas.</b> Las acciones de abajo están en pausa y conservan tu selección.</span>'+(st.canUpdate?'<button type="button" class="btn" data-act="master" id="'+p+'reactivate">Activar notificaciones</button>':'')+'</div>':'')+
    '<div class="grid">'+nav('estado')+'<main class="cards" aria-labelledby="'+p+'title">'+cards+'</main></div></div></div>'+saveBar(st,{max:'1048px'})+toast(st);
}
