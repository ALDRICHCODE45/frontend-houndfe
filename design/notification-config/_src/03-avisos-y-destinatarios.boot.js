setHTML($('band'),band('Artboard 03 · Avisos y destinatarios lado a lado'));
setHTML($('shell'),shell('content'));
const st=createStore();
bindStore($('content'),st,page03);
wireBand(st);
