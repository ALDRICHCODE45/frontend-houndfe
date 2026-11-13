#!/bin/sh
# Assembles each self-contained artboard (the canvas serves only .html, so CSS and JS are inlined):
#   shared.css + _src/live.css + _src/NN-name.css + _src/NN-name.body.html + _src/core.js + _src/parts.js + _src/NN-name.js
# Usage: sh build.sh            (all artboards)
cd "$(dirname "$0")" || exit 1
for css in _src/0*.css; do
  n=$(basename "$css" .css)
  out="$n.html"
  {
    printf '<!doctype html>\n<html lang="es-MX">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>HoundFe · Chatbot → Conversación en vivo · %s</title>\n<style>\n' "$n"
    cat shared.css _src/live.css "$css"
    printf '</style>\n</head>\n<body>\n'
    cat "_src/$n.body.html"
    printf '<script>\n(() => {\n'
    cat _src/core.js _src/parts.js "_src/$n.js"
    printf '\n})();\n</script>\n</body>\n</html>\n'
  } > "$out"
  echo "$out $(wc -c < "$out") bytes"
done
