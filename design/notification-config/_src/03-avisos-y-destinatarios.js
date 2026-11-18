/* 03 · Master in the header, action tiles on the left, sticky «Quién recibe» panel on the right */
function tile(st,a){
  const on=isOn(st,a.key),off=!st.data.enabled,dis=off||!st.canUpdate,id=st.p+'t-'+a.key;
  return '<button type="button" class="tile" role="switch" id="'+id+'" data-act="toggle" data-key="'+a.key+'" aria-checked="'+on+'"'+(dis?' aria-disabled="true"':'')+' aria-labelledby="'+id+'-t" aria-describedby="'+id+'-d'+(off?' '+id+'-r':'')+'">'+
    '<span class="t-top"><span class="t-title" id="'+id+'-t">'+esc(a.label)+'</span><span class="track" aria-hidden="true">'+ic('check')+'</span></span>'+
    '<span class="t-desc" id="'+id+'-d">'+esc(a.desc)+'</span>'+
    '<span class="t-foot"><span class="t-word">'+stateWord(st,a)+'</span>'+(a.toCustomer?'<span class="t-to">'+ic('user')+'Al cliente</span>':'<span class="t-to">'+ic('mail')+'A usuarios</span>')+'</span>'+
    (off?'<span class="t-reason" id="'+id+'-r">'+ic('pause')+'Motivo: notificaciones desactivadas</span>':'')+'</button>';
}
function page03(st){
  const p=st.p,on=st.data.enabled;
  const master='<div class="master-box">'+masterRow(st,{title:COPY.master,desc:on?'Se envían los avisos encendidos.':'No se envía ningún aviso.'})+'</div>';
  const head='<header class="head03"><div class="page-head"><h1 class="page-title" id="'+p+'title">'+COPY.title+'</h1><p class="page-sub">'+COPY.sub+'</p></div>'+(st.view==='ready'?master:'')+'</header>';
  if(st.view==='error')return '<div class="slot"><div class="wrap">'+head+errorState()+'</div></div>';
  if(st.view==='loading')return '<div class="slot"><div class="wrap" aria-busy="true">'+head+'<div role="status" class="sr-only">Cargando la configuración de notificaciones…</div><div class="cols" aria-hidden="true"><div class="tiles-area">'+
    [2,1,2].map(n=>'<div class="mgroup"><span class="sk" style="width:140px;height:16px"></span><div class="tiles">'+Array.from({length:n},()=>'<div class="tile"><span class="sk" style="width:60%;height:14px"></span><span class="sk" style="width:90%;height:11px"></span><span class="sk" style="width:70%;height:11px"></span></div>').join('')+'</div></div>').join('')+
    '</div><aside class="panel"><div class="panel-head"><span class="sk" style="width:120px;height:16px"></span></div>'+[1,2,3,4,5].map(()=>'<div class="opt"><span class="sk" style="width:28px;height:28px;border-radius:50%"></span><span class="sk" style="width:130px;height:12px"></span></div>').join('')+'</aside></div></div></div>';
  const groups='<div class="groups">'+MODULES.map(m=>'<section class="mgroup'+(m.actions.length>1?' wide':'')+'" aria-labelledby="'+p+'g-'+m.key+'"><div class="mg-head"><span class="mod-ic" aria-hidden="true">'+ic(m.icon)+'</span><h2 id="'+p+'g-'+m.key+'">'+m.label+'</h2>'+allButton(st,m)+'</div><div class="tiles">'+m.actions.map(a=>tile(st,a)).join('')+'</div></section>').join('')+'</div>';
  const toUsers=st.data.enabledActions.filter(k=>!actionByKey(k).toCustomer);
  const recap='<div class="recap"><h3>Así se reparten</h3><ul>'+(st.data.enabledActions.length?ACTIONS.filter(a=>isOn(st,a.key)).map(a=>'<li><span>'+esc(a.label)+'</span><span class="fig">'+(!on?'En pausa':a.toCustomer?'Al cliente':knownCount(st)?plural(knownCount(st),'usuario','usuarios'):'<b class="w">Sin usuarios</b>')+'</span></li>').join(''):'<li><span>Ningún aviso encendido</span></li>')+'</ul></div>';
  return '<div class="slot"><div class="wrap">'+head+'<div class="cols"><main class="tiles-area" aria-labelledby="'+p+'title"><div class="area-head"><h2 class="area-title">'+COPY.actions+'</h2><span class="count fig">'+st.data.enabledActions.length+' de '+ACTIONS.length+' encendidas</span></div>'+
    (on?'':'<div class="banner03">'+ic('pause')+'<span><b>Todo en pausa.</b> Tus avisos se conservan; vuelven al activar Notificaciones arriba.</span></div>')+groups+'</main>'+
    '<aside class="panel" aria-labelledby="'+p+'pT"><div class="panel-head"><h2 id="'+p+'pT">'+COPY.recipients+'</h2><span class="count fig">'+st.data.recipientUserIds.filter(id=>userById(id)).length+' de '+USERS.length+'</span></div><p class="panel-sub">Reciben '+(toUsers.length?plural(toUsers.length,'aviso','avisos'):'los avisos')+' por correo.</p>'+recipientPicker(st)+recap+'</aside></div></div></div>'+saveBar(st,{max:'1184px'})+toast(st);
}
