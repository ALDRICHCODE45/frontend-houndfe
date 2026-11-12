/* Direction B behaviour */
S.rich = true;
window.paint = function () {
  const main = V.view === 'main';
  const panel = S.open ? `<div class="sheet-scrim" data-close></div>${panelHTML(S, { cls: 'sheet', close: true, modal: true, foot: '<a class="btn sm ghost" href="/perfil" data-noop>Preferencias</a>' })}` : '';
  setHTML($('#root'), shell(main ? CR_INBOX : CR_PROFILE, main ? bgInbox() : prefsHTML(), bellHTML(S, S.open, ''), { inbox: main }) + panel);
};
mountTools(stdTools([['main', 'Bandeja con panel'], ['prefs', 'Preferencias /perfil']]));
injectIcons();
initTools(simulateNew);
bindStd();
window.paint();
