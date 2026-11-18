/* 01 · One readable column: Estado, Usuarios, Acciones grouped by module inside one surface */
function modulesSurface(st){
  const off=!st.data.enabled;
  return (off?'<div class="notice off">'+ic('pause')+'<span class="n-text"><b>Acciones en pausa.</b> Las notificaciones están desactivadas; lo que elijas aquí se envía cuando las actives.</span>'+(st.canUpdate?'<button type="button" class="link-btn" data-act="master" id="'+st.p+'reactivate">Activar notificaciones</button>':'')+'</div>':'')+
  MODULES.map(m=>{
    return '<div class="mod" role="group" aria-labelledby="'+st.p+'m-'+m.key+'"><div class="mod-label"><span class="mod-ic" aria-hidden="true">'+ic(m.icon)+'</span><h3 class="mod-name" id="'+st.p+'m-'+m.key+'">'+m.label+'</h3>'+allButton(st,m)+'</div>'+
      '<div class="mod-rows">'+m.actions.map(a=>actionRow(st,a,{who:true})).join('')+'</div></div>';
  }).join('');
}
function page01(st){
  const head='<header class="page-head"><h1 class="page-title" id="'+st.p+'title">'+COPY.title+'</h1><p class="page-sub">'+COPY.sub+'</p></header>';
  if(st.view==='error')return '<div class="slot"><main class="page" aria-labelledby="'+st.p+'title">'+head+errorState()+'</main></div>';
  if(st.view==='loading')return '<div class="slot"><main class="page" aria-labelledby="'+st.p+'title" aria-busy="true">'+head+'<div role="status" class="sr-only">Cargando la configuración de notificaciones…</div>'+
    '<section class="group" aria-hidden="true"><span class="sk" style="width:96px;height:16px"></span><div class="surface">'+skRows(1,190)+'</div></section>'+
    '<section class="group" aria-hidden="true"><span class="sk" style="width:150px;height:16px"></span><div class="surface">'+skRows(3,140)+'</div></section>'+
    '<section class="group" aria-hidden="true"><span class="sk" style="width:160px;height:16px"></span><div class="surface">'+skRows(4,120)+'</div></section></main></div>';
  const on=st.data.enabledActions.length;
  return '<div class="slot"><main class="page" aria-labelledby="'+st.p+'title">'+head+
    '<section class="group" aria-labelledby="'+st.p+'g1"><div class="group-head"><h2 id="'+st.p+'g1">Estado</h2></div><div class="surface">'+masterRow(st,{icon:true})+summaryLine(st)+'</div></section>'+
    '<section class="group" aria-labelledby="'+st.p+'g2"><div class="group-head"><div><h2 id="'+st.p+'g2">'+COPY.recipients+'</h2><p>Reciben por correo todos los avisos activos, salvo Próxima parada, que llega al cliente.</p></div><span class="count fig">'+recipientCount(st)+'</span></div><div class="surface">'+recipientPicker(st)+'</div></section>'+
    '<section class="group" aria-labelledby="'+st.p+'g3"><div class="group-head"><div><h2 id="'+st.p+'g3">'+COPY.actions+'</h2><p>Toca una fila para encenderla o apagarla. Cada aviso se envía en cuanto ocurre.</p></div><span class="count fig">'+on+' de '+ACTIONS.length+' activadas</span></div><div class="surface">'+modulesSurface(st)+'</div></section>'+
    '</main></div>'+saveBar(st,{max:'944px'})+toast(st);
}
