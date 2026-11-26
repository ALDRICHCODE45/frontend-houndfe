
// Exploded filter spec: clone the sheet's sections into three columns (ids stripped, all open).
const spec = document.getElementById('spec');
const secs = $$('#fsections > details.fsec');
const cols = [[0, 2], [1], [3, 4]];
cols.forEach((idx) => {
  const col = document.createElement('div');
  col.className = 'panel';
  col.style.padding = '4px 12px';
  idx.forEach((i) => {
    const c = secs[i].cloneNode(true);
    c.open = true;
    c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    col.appendChild(c);
  });
  spec.appendChild(col);
});
$$('#spec .sw').forEach((s) => s.addEventListener('click', () => s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'))));
$$('#spec [data-multi] .chip').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));

// Keep the scrim in step with the sheet's own close buttons.
const sheet = document.getElementById('filters');
const scrim = $('.scrim');
new MutationObserver(() => { scrim.hidden = sheet.hidden; }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });

// «Selección» state: three rows marked and the bulk bar shown.
$$('[data-state^="tabla:"]').forEach((btn) => btn.addEventListener('click', () => {
  const on = btn.dataset.state === 'tabla:sel';
  const rows = $$('tbody[data-when="tabla:datos tabla:sel"] tr');
  [0, 2, 6].forEach((i) => {
    const m = $('.mark', rows[i]);
    m.setAttribute('aria-checked', String(on));
    rows[i].classList.toggle('selected', on);
  });
}));
