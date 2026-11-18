setHTML($('band'),band('Artboard 02 · Índice y una tarjeta por módulo'));
setHTML($('shell'),shell('content'));
const st=createStore();
bindStore($('content'),st,page02);
wireBand(st);
document.addEventListener('click',e=>{if(st.comboOpen&&!e.target.closest('.combo')){st.comboOpen=false;st.emit();}});
const sc=$('content');
sc.addEventListener('scroll',()=>{
  const links=[...sc.querySelectorAll('.index a')];if(!links.length)return;
  let cur=links[0];
  for(const a of links){const s=$(a.dataset.target);if(s&&s.getBoundingClientRect().top-sc.getBoundingClientRect().top<140)cur=a;}
  links.forEach(a=>a.toggleAttribute('aria-current',a===cur));links.forEach(a=>{if(a===cur)a.setAttribute('aria-current','true');});
});
