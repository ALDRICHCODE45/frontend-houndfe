// Shared artboard behavior: theme, notes sheet, expandable rows, single-choice chips and segments.
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
  if (e.key === 'Escape' && notes && !notes.hidden) { notes.hidden = true; notesBtn.setAttribute('aria-expanded', 'false'); notesBtn.focus(); }
});

// Expandable rows: the chevron button owns aria-expanded; clicking the row toggles too.
function toggleRow(row) {
  const btn = $('.xbtn', row);
  const panel = document.getElementById(btn.getAttribute('aria-controls'));
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  row.classList.toggle('open', open);
  if (panel) panel.hidden = !open;
}
$$('tr.row').forEach((row) => {
  row.addEventListener('click', (e) => {
    if (e.target.closest('a, .btn, .chip')) return;
    if ($('.xbtn', row)) toggleRow(row);
  });
});
$$('[data-toggle-card]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    if (panel) panel.hidden = !open;
    const lbl = btn.querySelector('[data-lbl]');
    if (lbl) lbl.textContent = open ? lbl.dataset.open : lbl.dataset.closed;
  });
});

// Single-choice chip groups and segmented controls (visual only; the data stays as drawn).
$$('[data-single]').forEach((group) => {
  group.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !group.contains(b)) return;
    $$('button', group).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const target = group.dataset.single && document.getElementById(group.dataset.single);
    if (target && b.dataset.show) {
      $$('[data-view]', target).forEach((v) => { v.hidden = v.dataset.view !== b.dataset.show; });
    }
  });
});
