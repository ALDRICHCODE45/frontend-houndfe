function viewA() {
  return shell(gate(() => `<div class="page">${pageHead()}${banners()}<div class="a-grid"><nav class="a-nav" aria-label="Secciones de esta pantalla"><ul>${NAVS.map(([id, t, i]) => `<li><a href="#sec-${id}" data-act="goto" data-id="sec-${id}">${ic(i, 'sm')}${t}${secMark(id)}</a></li>`).join('')}</ul></nav><div class="a-main">${NAVS.map(([id]) => SEC[id]()).join('')}</div></div></div>${saveBar()}`));
}
injectIcons(); VIEW = viewA; mountTools(); bind(); render();
