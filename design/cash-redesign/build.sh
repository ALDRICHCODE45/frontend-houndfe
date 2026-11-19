#!/bin/sh
# Assembles each self-contained artboard (the canvas serves only .html, so CSS and JS are inlined):
#   shared.css + _src/NN-name.css + <div id="root"> + _src/core.js + _src/NN-name.js
# Usage: sh build.sh
cd "$(dirname "$0")" || exit 1
for js in _src/0*.js; do
  n=$(basename "$js" .js)
  out="$n.html"
  {
    printf '<!doctype html>\n<html lang="es-MX">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>HoundFe · Caja · %s</title>\n<style>\n' "$n"
    cat shared.css "_src/$n.css"
    printf '</style>\n</head>\n<body>\n<div id="root"></div>\n<noscript><p style="padding:24px">Este tablero necesita JavaScript para mostrar las pantallas.</p></noscript>\n<script>\n(() => {\n'
    cat _src/core.js "$js"
    printf '\n})();\n</script>\n</body>\n</html>\n'
  } > "$out"
  echo "$out $(wc -c < "$out") bytes"
done
