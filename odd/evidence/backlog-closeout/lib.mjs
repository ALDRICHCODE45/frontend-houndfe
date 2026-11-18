// Generic in-page checks, copied verbatim from ../selection-and-design-audit/run.mjs (audit + focusCheck) so both audits measure the same way.
export async function audit(page) {
  return page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
    const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const alpha = (c) => { const m = c.match(/\/\s*([\d.]+%?)\s*\)$/) || c.match(/rgba\([^)]*,\s*([\d.]+)\)$/); if (c === 'transparent') return 0; if (!m) return 1; return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]) }
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05 }
    const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (alpha(c) > 0.5) return rgba(c) } return document.documentElement.classList.contains('dark') ? [0, 0, 0] : [255, 255, 255] }
    const label = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}«${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}»`
    const out = { dark: document.documentElement.classList.contains('dark') }
    // checkboxes
    const boxes = [...document.querySelectorAll('input[type=checkbox], [role=checkbox]')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 })
    out.checkboxes = boxes.map((e) => label(e) + ` r=${getComputedStyle(e).borderRadius}`)
    // switches
    const sw = [...document.querySelectorAll('[role=switch]')].filter(vis)
    out.switchRows = sw.filter((e) => e.classList.contains('hf-switch-row__button')).length
    out.smallSwitches = sw.filter((e) => !e.classList.contains('hf-switch-row__button')).map((e) => label(e.closest('label,div') || e) + ` w=${Math.round(e.getBoundingClientRect().width)}`)
    out.rowsNoState = sw.filter((e) => e.classList.contains('hf-switch-row__button') && !e.querySelector('.hf-switch-row__state')).map(label)
    // overflow
    const vw = document.documentElement.clientWidth
    out.docOverflow = document.documentElement.scrollWidth - vw
    const clipped = (e) => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.overflowX !== 'visible' && n.getBoundingClientRect().right <= vw + 1) return true } return false }
    out.offenders = [...document.querySelectorAll('body *')].filter(vis).filter((e) => e.getBoundingClientRect().right > vw + 1 && !clipped(e)).slice(0, 6).map((e) => label(e) + ` right=${Math.round(e.getBoundingClientRect().right)}`)
    // contrast of text
    const low = []; let checked = 0, minC = 99
    for (const e of document.querySelectorAll('body *')) {
      if (!vis(e) || e.closest('[aria-hidden=true]')) continue
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight * 3) continue
      const s = getComputedStyle(e); const fg = rgba(s.color); const bg = bgOf(e)
      const fgm = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
      const c = ratio(fgm, bg); const big = parseFloat(s.fontSize) >= 18.6 || (parseFloat(s.fontSize) >= 14 && parseInt(s.fontWeight) >= 700)
      const disabled = e.closest('[disabled],[aria-disabled=true],[data-disabled]')
      if (!disabled) { checked++; minC = Math.min(minC, c) }
      if (!disabled && c < (big ? 3 : 4.5)) low.push(`${label(e)} ${c.toFixed(2)}`)
    }
    out.lowContrast = low.slice(0, 12); out.lowContrastCount = low.length; out.textChecked = checked; out.minContrast = +minC.toFixed(2)
    // white surfaces in dark
    out.lightSurfaces = out.dark ? [...document.querySelectorAll('body *')].filter(vis).filter((e) => { const c = getComputedStyle(e).backgroundColor; if (alpha(c) < 0.6) return false; const r = e.getBoundingClientRect(); return r.width * r.height > 12000 && lum(rgba(c)) > 0.6 }).slice(0, 6).map(label) : []
    return out
  })
}
export async function focusCheck(page, presses = 1, sel = null) {
  // keyboard modality first, then put focus on the first focusable of the screen (open dialog, else the main panel), then Tab.
  await page.keyboard.press('Tab')
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role=dialog]')].pop(); const h1 = document.querySelector('h1')
    const f = [...(dlg || document).querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('header,aside,nav') && (dlg || !h1 || (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) })
    f[0]?.focus()
  })
  if (sel) { await page.evaluate((q) => { const r = [...document.querySelectorAll('[role=dialog]')].pop() || document; const el = [...r.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0); el?.focus(); el?.scrollIntoView({ block: 'center' }) }, sel); presses = 0 }
  for (let i = 0; i < presses; i++) await page.keyboard.press('Tab')
  await page.waitForTimeout(150)
  return page.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return { ok: false, el: 'body' }
    const s = getComputedStyle(e); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
    return { ok: !!ring, el: `${e.tagName.toLowerCase()}«${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}»`, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow.slice(0, 60), visible: e.matches(':focus-visible') }
  })
}

