#!/bin/sh
# Assembles each self-contained artboard (the canvas serves only .html, so CSS, SVG and JS are inlined):
#   _src/base.css + _src/app.css + _src/NN-name.css + _src/sprite.html + _src/NN-name.body.html + _src/shared.js
# A body line that is exactly <!--@side:Clientes--> is replaced with _src/side.html (desktop sidebar).
# Usage: sh build.sh
cd "$(dirname "$0")" || exit 1
for body in _src/0*.body.html; do
  n=$(basename "$body" .body.html)
  out="$n.html"
  {
    printf '<!doctype html>\n<html lang="es-MX">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>HoundFe · Clientes · %s</title>\n<style>\n' "$n"
    cat _src/base.css _src/app.css
    [ -f "_src/$n.css" ] && cat "_src/$n.css"
    printf '</style>\n</head>\n<body>\n'
    cat _src/sprite.html
    awk '/^<!--@side-->$/ { while ((getline l < "_src/side.html") > 0) print l; close("_src/side.html"); next } { print }' "$body"
    printf '<script>\n(() => {\n'
    cat _src/shared.js
    [ -f "_src/$n.js" ] && cat "_src/$n.js"
    printf '\n})();\n</script>\n</body>\n</html>\n'
  } > "$out"
  echo "$out $(wc -c < "$out") bytes"
done
