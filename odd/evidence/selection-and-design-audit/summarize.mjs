// node summarize.mjs results-*.json — prints one line per state with the generic checks.
import { readFileSync } from 'node:fs'
for (const f of process.argv.slice(2)) for (const x of JSON.parse(readFileSync(f, 'utf8'))) {
  console.log(`== ${x.screen} ${x.W} ${x.theme} ${x.error ? 'ERROR ' + x.error : ''} console=${JSON.stringify(x.console)} blocked=${x.blocked.join(',')} unmocked=${x.unmocked.join(',')}`)
  for (const s of x.states) {
    if (s.note) { console.log(`   NOTE ${s.note}`); continue }
    if (s.focus) { console.log(`   ${s.state} FOCUS ${JSON.stringify(s.focus)}`); continue }
    console.log(`   ${s.state} dark=${s.dark} cb=${s.checkboxes.length}${s.checkboxes.length ? JSON.stringify(s.checkboxes.slice(0, 3)) : ''} rows=${s.switchRows} small=${JSON.stringify(s.smallSwitches)} noState=${s.rowsNoState.length} ovf=${s.docOverflow}${s.offenders.length ? JSON.stringify(s.offenders) : ''} text=${s.textChecked} minC=${s.minContrast} low=${s.lowContrastCount}${s.lowContrastCount ? JSON.stringify(s.lowContrast.slice(0, 6)) : ''} lightSurf=${JSON.stringify(s.lightSurfaces)}`)
  }
}
