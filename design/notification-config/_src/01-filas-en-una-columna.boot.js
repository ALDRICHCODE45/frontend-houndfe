setHTML($('band'),band('Artboard 01 · Filas en una columna (recomendada)'));
setHTML($('shell'),shell('content'));
const st=createStore();
bindStore($('content'),st,page01);
wireBand(st);
