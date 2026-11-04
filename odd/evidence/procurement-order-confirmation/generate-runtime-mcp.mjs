// Parent-only preparation command. Usage:
//   node generate-runtime-mcp.mjs <apiOrigin> <credentialsPath> [--check-schema] [--commit=<40-hex git sha>]
// It expands runtime-checks.mjs into one self-contained MCP function per stage under ./generated/
// (git-ignored, because the files carry the local credentials PATH, never its contents).
// By default it never opens the credentials file, evaluates the script, or contacts a backend.
// --check-schema opts in to a local, read-only shape check that prints booleans only.
// Every report carries `commit` (the git HEAD it was generated from, or --commit) and `workingTreeDirty`
// (uncommitted changes under src/ or docs/ at generation time), so evidence can be traced to the code it ran on.
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const [api, credentialsPath, ...flags] = process.argv.slice(2)
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(api ?? '') || [3000, 43179, 0].includes(Number(api.split(':').at(-1))) || Number(api.split(':').at(-1)) > 65535) {
  throw new Error('Usage: generate-runtime-mcp.mjs http://127.0.0.1:<disposable port> <absolute credentials path> [--check-schema]')
}
if (!credentialsPath?.startsWith('/') || !credentialsPath.endsWith('.json') || /[\0\n\r]/.test(credentialsPath)) throw new Error('Credentials path must be an absolute .json path')
const commitFlag = flags.filter(flag => flag.startsWith('--commit='))
if (flags.some(flag => flag !== '--check-schema' && !flag.startsWith('--commit=')) || commitFlag.length > 1) throw new Error('Unknown flag')

// Read-only git queries from the repository that holds this harness.
const here = fileURLToPath(new URL('./', import.meta.url))
const git = (...args) => execFileSync('git', args, { cwd: here, encoding: 'utf8' }).trim()
const commit = commitFlag.length ? commitFlag[0].slice('--commit='.length) : git('rev-parse', 'HEAD')
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Commit must be a full 40-character lowercase hex git sha')
const workingTreeDirty = git('status', '--porcelain', '--', ':(top)src', ':(top)docs') !== ''

const roles = ['manager', 'editor', 'confirmer', 'canceller', 'reader', 'noaccess']
if (flags.includes('--check-schema')) {
  // Contents stay in this process; only booleans are printed, and parse errors are not echoed.
  try {
    const data = JSON.parse(await readFile(credentialsPath, 'utf8'))
    console.log(JSON.stringify({
      apiOriginMatches: data.apiOrigin === undefined ? 'absent' : data.apiOrigin === api,
      roles: Object.fromEntries(roles.map(role => [role, typeof data.users?.[role]?.email === 'string'])),
      passwordAvailable: Object.fromEntries(roles.map(role => [role, typeof (data.users?.[role]?.password ?? data.password) === 'string'])),
    }))
  } catch { throw new Error('Credentials file could not be read or parsed (details withheld)') }
}

const source = await readFile(new URL('./runtime-checks.mjs', import.meta.url), 'utf8')
const marker = 'export async function run('
if (source.split(marker).length !== 2) throw new Error('Expected one canonical run export')
if (/\b(?:import|require|process)\b|node:|file:\/\/\//.test(source)) throw new Error('Module/runtime dependency in MCP source')
const placeholders = { __API_ORIGIN__: api, __CREDENTIALS_PATH__: credentialsPath, __EVIDENCE_DIR__: here.replace(/\/$/, ''), __COMMIT__: commit, __TREE_DIRTY__: workingTreeDirty }
let expanded = source
for (const [name, value] of Object.entries(placeholders)) {
  const literal = `'${name}'`
  if (expanded.split(literal).length !== 2) throw new Error(`Expected exactly one ${name} placeholder`)
  expanded = expanded.replace(literal, () => JSON.stringify(value))
}
expanded = expanded.replace(marker, 'async function run(')
await mkdir(new URL('./generated/', import.meta.url), { recursive: true })
// The manager stage also ships in parts, each under the MCP request time limit.
const parts = [['manager', null], ['permissions', null], ['transitions', null], ...['1440-light', '1440-dark', '390-light', '390-dark'].map(tour => ['manager', `tour:${tour}`]), ['manager', 'mutations']]
for (const [stage, part] of parts) {
  const output = `async (page) => {\n// Expanded from runtime-checks.mjs; no VM modules.\n${expanded}\nreturn await run(page, '${stage}', ${JSON.stringify(part)})\n}\n`
  // Parse only. Neither the function nor the VM script is evaluated/invoked.
  new vm.Script(`(${output})`)
  const filename = `mcp-runtime-${stage}${part ? '-' + part.replace(':', '-') : ''}.js`
  await writeFile(new URL(`./generated/${filename}`, import.meta.url), output)
  console.log(`generated/${filename}: expanded and parsed only; not executed (commit ${commit.slice(0, 8)}${workingTreeDirty ? ', working tree dirty' : ''})`)
}
