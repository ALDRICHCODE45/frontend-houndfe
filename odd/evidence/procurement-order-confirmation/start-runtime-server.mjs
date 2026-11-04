// Parent-only: production entry/config with generated files confined to evidence.
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import net from 'node:net'
import base from '../../../vite.config.ts'

const project = fileURLToPath(new URL('../../../', import.meta.url))
const root = fileURLToPath(new URL('./runtime-server/', import.meta.url))
// Positional argument takes precedence; no credentials or env files are read.
const api = process.argv[2] || process.env.VITE_API_BASE_URL
if (!api || !/^http:\/\/127\.0\.0\.1:\d+$/.test(api)) throw new Error('Supply the disposable loopback API origin as argument or VITE_API_BASE_URL')
const port = Number(api.split(':').at(-1))
if (port < 1 || port > 65535 || [3000, 43179].includes(port)) throw new Error('Disposable API must not use port 3000 or frontend port 43179')
process.env.VITE_API_BASE_URL = api
await new Promise((yes, no) => {
  const probe = net.createServer()
  probe.once('error', () => no(new Error('Port 43179 occupied; do not kill its owner')))
  probe.listen(43179, '127.0.0.1', () => probe.close(yes))
})
await mkdir(root, { recursive: true })
await writeFile(resolve(root, 'index.html'), await readFile(resolve(project, 'index.html')))
// @tailwindcss/vite scans from the Vite root, which here is the evidence directory, so without this
// every utility that only appears under src/ (md:flex-row, sm:max-w-sm, max-w-3xl...) is never generated
// and the screenshots show a layout the production build does not have. Point the scan back at src/.
const scanSource = { name: 'evidence-tailwind-source', enforce: 'pre', transform(code, id) {
  if (id.split('?')[0].endsWith('/src/assets/main.css')) return { code: `${code}\n@source "../";\n`, map: null }
} }
const server = await createServer({
  ...base,
  plugins: [scanSource, ...(base.plugins ?? [])],
  configFile: false,
  envDir: false,
  root,
  publicDir: resolve(project, 'public'),
  cacheDir: resolve(root, '.vite'),
  resolve: { ...base.resolve, alias: { ...base.resolve.alias, '/src': resolve(project, 'src') } },
  server: { host: '127.0.0.1', port: 43179, strictPort: true, hmr: false, fs: { allow: [project] } },
})
await server.listen()
console.log(JSON.stringify({ pid: process.pid, frontend: 'http://127.0.0.1:43179', api, generatedRoot: root, coverage: 'production entry/full router; evidence-only Vite root' }))
