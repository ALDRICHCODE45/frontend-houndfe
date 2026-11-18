// node report.mjs results-a.json results-b.json … — later files override earlier ones per screen×W×theme; prints console lines, focus results and the PASS/FAIL table inputs.
import { readFileSync } from 'node:fs'
const by = new Map()
for (const f of process.argv.slice(2)) for (const x of JSON.parse(readFileSync(f, 'utf8'))) by.set(`${x.screen}|${x.W}|${x.theme}`, x)
const all = [...by.values()]
console.log('CONSOLE (unique):'); console.log([...new Set(all.flatMap((x) => x.console.map((c) => `${x.screen} ${c}`)))].join('\n'))
console.log('FOCUS:'); for (const x of all) for (const s of x.states) if (s.focus) console.log(` ${x.screen} ${x.W} ${x.theme} ${s.state} ok=${s.focus.ok} ${(s.focus.el || '').replace(/\n/g, ' ').slice(0, 30)} | ${s.focus.outline ?? ''} | ${(s.focus.shadow ?? '').slice(0, 40)}`)
console.log('CHECKS:'); for (const x of all) for (const s of x.states) if (!s.focus) {
  const bad = [!s.h1 && 'noH1', s.checkboxes.length && 'cb', s.docOverflow > 0 && `ovf${s.docOverflow}`, s.offenders.length && 'offenders', s.lowContrastCount && `low${s.lowContrastCount}`, s.lightSurfaces.length && 'lightSurf'].filter(Boolean)
  console.log(` ${x.screen} ${x.W} ${x.theme} ${s.state} minC=${s.minContrast} ${bad.join(',') || 'ok'}`)
}
console.log('external:', JSON.stringify([...new Set(all.flatMap((x) => x.external))]), 'blocked:', JSON.stringify([...new Set(all.flatMap((x) => x.blocked))]), 'unmocked:', JSON.stringify([...new Set(all.flatMap((x) => x.unmocked))]), 'failed:', JSON.stringify([...new Set(all.flatMap((x) => x.failed))]).slice(0, 300))
