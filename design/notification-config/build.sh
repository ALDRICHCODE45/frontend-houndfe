#!/bin/sh
# Assembles each self-contained artboard (the canvas serves only .html, so CSS and JS are inlined):
#   _src/base.css + extra css + _src/NN.css, body, then _src/base.js + render modules + boot.
# Usage: sh build.sh
cd "$(dirname "$0")" || exit 1
build(){ # $1 out name, $2 title, $3 css list, $4 js list, $5 body
  {
    printf '<!doctype html>\n<html lang="es-MX">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>HoundFe · Notificaciones · %s</title>\n<style>\n' "$2"
    for f in $3; do cat "_src/$f"; done
    printf '</style>\n</head>\n<body>\n'
    cat "_src/$5"
    printf '<script>\n(() => {\n'
    for f in $4; do cat "_src/$f"; printf '\n'; done
    printf '})();\n</script>\n</body>\n</html>\n'
  } > "$1.html"
  echo "$1.html $(wc -c < "$1.html") bytes"
}
A=01-filas-en-una-columna; B=02-indice-y-modulos; C=03-avisos-y-destinatarios; M=04-movil-y-estados
build $A "A · Filas en una columna" "base.css $A.css" "base.js $A.js $A.boot.js" "$A.body.html"
[ -f _src/$B.js ] && build $B "B · Índice y módulos" "base.css $B.css" "base.js $B.js $B.boot.js" "$B.body.html"
[ -f _src/$C.js ] && build $C "C · Avisos y destinatarios" "base.css $C.css" "base.js $C.js $C.boot.js" "$C.body.html"
[ -f _src/$M.js ] && build $M "Móvil y estados (A)" "base.css $A.css $M.css" "base.js $A.js $M.js" "$M.body.html"
exit 0
