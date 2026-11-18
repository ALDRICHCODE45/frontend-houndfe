// node summarize.mjs results-*.json — one line per state with the generic checks (same columns as ../selection-and-design-audit).
import { readFileSync } from 'node:fs'
for (const f of process.argv.slice(2)) for (const x of JSON.parse(readFileSync(f, 'utf8'))) {
  console.log(`== ${x.screen} ${x.W} ${x.theme} ${x.error ? 'ERROR ' + x.error : ''} console=${JSON.stringify(x.console)} blocked=${x.blocked.join(',')} unmocked=${x.unmocked.join(',')} external=${JSON.stringify(x.external)} failed=${JSON.stringify(x.failed)}`)
  for (const s of x.states) {
    if (s.focus) { console.log(`   ${s.state} FOCUS ${JSON.stringify(s.focus)}`); continue }
    console.log(`   ${s.state} url=${s.url} h1=${JSON.stringify(s.h1)} dark=${s.dark} cb=${s.checkboxes.length}${s.checkboxes.length ? JSON.stringify(s.checkboxes.slice(0, 3)) : ''} ovf=${s.docOverflow}${s.offenders.length ? JSON.stringify(s.offenders) : ''} text=${s.textChecked} minC=${s.minContrast} low=${s.lowContrastCount}${s.lowContrastCount ? JSON.stringify(s.lowContrast.slice(0, 6)) : ''} lightSurf=${JSON.stringify(s.lightSurfaces)}`)
  }
}
