#!/usr/bin/env bash
# Contact sheets: one image per route, viewport and theme, with the four states side by side.
set -euo pipefail
cd "$(dirname "$0")"
for f in shots/*__data__*.png; do
  base=$(basename "$f" .png); route=${base%%__*}; rest=${base#*__data__}
  out="sheets/${route}__${rest}.png"; [ -f "$out" ] && continue
  files=()
  for s in data empty loading error; do
    p="shots/${route}__${s}__${rest}.png"; [ -f "$p" ] && files+=("$p")
  done
  vp=${rest%%__*}
  if [ "$vp" = "1440" ]; then geo='720x900>'; crop='1440x1800+0+0'; else geo='390x844>'; crop='390x1688+0+0'; fi
  tmp=$(mktemp -d)
  i=0; for p in "${files[@]}"; do convert "$p" -crop "$crop" +repage "$tmp/$i.png"; i=$((i+1)); done
  montage "$tmp"/*.png -tile "${#files[@]}x1" -geometry "$geo+8+0" -background '#888' "$out"
  rm -rf "$tmp"
done
ls sheets | wc -l
