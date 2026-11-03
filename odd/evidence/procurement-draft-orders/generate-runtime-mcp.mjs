// Parent-only preparation command; no backend, credentials, or browser access.
import { readFile, writeFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('./runtime-checks.mjs', import.meta.url), 'utf8')
const marker = 'export async function run('
if (source.split(marker).length !== 2) throw new Error('Expected one canonical run export')
if (/\b(?:import|require|process)\b|node:|file:\/\/\//.test(source)) throw new Error('Module/runtime dependency in MCP source')
for (const stage of ['manager', 'permissions']) {
  const output = `async (page) => {\n// Expanded from runtime-checks.mjs; no VM modules.\n${source.replace(marker, 'async function run(')}\nreturn await run(page, '${stage}')\n}\n`
  // Parse only. Neither the function nor the VM script is evaluated/invoked.
  new vm.Script(`(${output})`)
  const filename = `mcp-runtime-${stage}.js`
  await writeFile(new URL(`./${filename}`, import.meta.url), output)
  console.log(`${filename}: expanded and parsed only; not executed`)
}
// Deletion is deliberately integrated into manager, not a repeatable third stage.
const deletion = await readFile(new URL('./mcp-runtime-delete.js', import.meta.url), 'utf8')
new vm.Script(`(${deletion})`)
console.log('mcp-runtime-delete.js: non-executing compatibility notice parsed')
