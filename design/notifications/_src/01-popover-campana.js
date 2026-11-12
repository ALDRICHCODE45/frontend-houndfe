/* Direction A behaviour */
window.paint = function () {
  const main = V.view === 'main';
  const bell = bellHTML(S, S.open, panelHTML(S, { close: true }));
  setHTML($('#root'), shell(main ? CR_INBOX : CR_PROFILE, main ? bgInbox() : prefsHTML(), bell, { inbox: main }));
};
mountTools(stdTools([['main', 'Bandeja con campana'], ['prefs', 'Preferencias /perfil']]));
injectIcons();
initTools(simulateNew);
bindStd();
window.paint();
