export const snapFn = () => {
  const u = new URL(location.href)
  const box = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } }
  return {
    search: decodeURIComponent(u.search),
    chips: [...document.querySelectorAll('.catalog-animal-chip')].map((b) => ({ name: b.querySelector('.catalog-animal-name')?.textContent, p: b.getAttribute('aria-pressed'), ...box(b) })),
    heading: document.body.innerText.match(/Mostrando [^\n]+/)?.[0],
    activeChips: [...document.querySelectorAll('button[aria-label^="Quitar"], [aria-label^="Quitar"]')].map((b) => b.getAttribute('aria-label')),
    docOverflow: document.documentElement.scrollWidth - innerWidth,
  }
}
