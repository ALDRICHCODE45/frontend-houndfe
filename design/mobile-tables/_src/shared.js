// Shared artboard behavior: theme, notes, selection mode, marks, chips, sort rows, switches.
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

// Selection mode per phone: [data-select-toggle] flips .selecting on its .phone; marks live inside rows/cards.
function syncCount(phone) {
  const marks = $$('.mark[data-item]', phone);
  const n = marks.filter((m) => m.getAttribute('aria-checked') === 'true').length;
  $$('[data-selcount]', phone).forEach((el) => { el.textContent = el.dataset.selcount.replace('N', n); });
  const all = $('.mark[data-all]', phone);
  if (all) all.setAttribute('aria-checked', n === 0 ? 'false' : n === marks.length ? 'true' : 'mixed');
  const dock = $('.dock', phone);
  if (dock) dock.hidden = n === 0 && !phone.classList.contains('keep-dock');
}
$$('[data-select-toggle]').forEach((btn) => btn.addEventListener('click', () => {
  const phone = btn.closest('.phone');
  const on = !phone.classList.contains('selecting');
  phone.classList.toggle('selecting', on);
  $$('[data-when-select]', phone).forEach((el) => { el.hidden = el.dataset.whenSelect !== String(on); });
  if (!on) $$('.mark[data-item]', phone).forEach((m) => { m.setAttribute('aria-checked', 'false'); m.closest('.drow, .rcard')?.classList.remove('sel-on'); });
  syncCount(phone);
}));
$$('.mark[data-item]').forEach((m) => m.addEventListener('click', (e) => {
  e.preventDefault(); e.stopPropagation();
  const on = m.getAttribute('aria-checked') !== 'true';
  m.setAttribute('aria-checked', String(on));
  m.closest('.drow, .rcard')?.classList.toggle('sel-on', on);
  syncCount(m.closest('.phone'));
}));
$$('.mark[data-all]').forEach((a) => a.addEventListener('click', () => {
  const phone = a.closest('.phone');
  const on = a.getAttribute('aria-checked') !== 'true';
  $$('.mark[data-item]', phone).forEach((m) => { m.setAttribute('aria-checked', String(on)); m.closest('.drow, .rcard')?.classList.toggle('sel-on', on); });
  syncCount(phone);
}));

// In selection mode a tap anywhere on the row or card toggles its mark instead of opening it.
$$('.drow, .rcard').forEach((item) => item.addEventListener('click', (e) => {
  const phone = item.closest('.phone');
  if (!phone?.classList.contains('selecting') || e.target.closest('.mark, .more')) return;
  e.preventDefault();
  $('.mark[data-item]', item)?.click();
}));

// Toggle chips (multi) and single-choice groups.
$$('[data-multi]').forEach((g) => g.addEventListener('click', (e) => {
  const b = e.target.closest('button.chip'); if (!b) return;
  b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
}));
$$('[data-single]').forEach((g) => g.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b || !g.contains(b)) return;
  const attr = b.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed';
  $$('button', g).forEach((x) => x.setAttribute(attr, String(x === b)));
}));
$$('.sw').forEach((s) => s.addEventListener('click', () => {
  const on = s.getAttribute('aria-checked') !== 'true';
  s.setAttribute('aria-checked', String(on));
  const st = s.parentElement.querySelector('.st');
  if (st) { st.textContent = on ? 'Activado' : 'Desactivado'; st.classList.toggle('on', on); }
}));
// Active filter chip removal (visual only).
$$('.achip button').forEach((b) => b.addEventListener('click', () => b.closest('.achip').remove()));
// Row links are mock destinations.
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
