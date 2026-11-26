// Shared artboard behavior: theme, notes, single-choice groups, state switches, overlays, row marks.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const themeBtn = $('#t-theme');
function paintTheme() {
  const dark = document.documentElement.classList.contains('dark');
  themeBtn.setAttribute('aria-pressed', String(dark));
  themeBtn.lastChild.textContent = dark ? 'Tema oscuro' : 'Tema claro';
}
themeBtn?.addEventListener('click', () => { document.documentElement.classList.toggle('dark'); paintTheme(); });
if (themeBtn) paintTheme();

const notesBtn = $('#t-notes');
const notes = $('#notes');
notesBtn?.addEventListener('click', () => {
  const open = notes.hidden;
  notes.hidden = !open;
  notesBtn.setAttribute('aria-expanded', String(open));
  if (open) notes.focus();
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (notes && !notes.hidden) { notes.hidden = true; notesBtn.setAttribute('aria-expanded', 'false'); notesBtn.focus(); return; }
  $$('[data-overlay]:not([hidden])').forEach((o) => { o.hidden = true; });
});

// Expandable sale rows (same behavior as the implemented history): the chevron owns aria-expanded.
$$('tr.row').forEach((row) => {
  row.addEventListener('click', (e) => {
    if (e.target.closest('a, .btn, .chip')) return;
    const btn = $('.xbtn', row);
    if (!btn) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    row.classList.toggle('open', open);
    const panel = btn.getAttribute('aria-controls') && document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.hidden = !open;
  });
});

// Single-choice chip groups, segmented controls and tab lists (visual only).
$$('[data-single]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !group.contains(b)) return;
    const attr = b.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-pressed';
    $$('button', group).forEach((x) => x.setAttribute(attr, String(x === b)));
  });
});
// Multi-select toggle chips.
$$('[data-multi]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button.chip');
    if (!b) return;
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  });
});
// Switches.
$$('.sw').forEach((s) => s.addEventListener('click', (e) => { e.stopPropagation(); s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true')); }));
// Row marks (selection).
$$('.mark').forEach((m) => m.addEventListener('click', (e) => {
  e.stopPropagation();
  const on = m.getAttribute('aria-checked') !== 'true';
  m.setAttribute('aria-checked', String(on));
  m.closest('tr')?.classList.toggle('selected', on);
}));

// Artboard state switcher: buttons with data-state="group:value" show [data-when~="group:value"].
$$('[data-state]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const [group] = btn.dataset.state.split(':');
    $$(`[data-state^="${group}:"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$(`[data-when*="${group}:"]`).forEach((el) => {
      el.hidden = !el.dataset.when.split(' ').includes(btn.dataset.state);
    });
  });
});
// Overlay toggles: [data-toggle="id"].
$$('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const el = document.getElementById(btn.dataset.toggle);
    if (!el) return;
    el.hidden = !el.hidden;
    btn.setAttribute('aria-expanded', String(!el.hidden));
  });
});
