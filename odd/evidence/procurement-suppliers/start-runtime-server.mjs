// Evidence-only Vite root: production entry/config, generated files confined here.
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import net from 'node:net'
import base from '../../../vite.config.ts'

const project = fileURLToPath(new URL('../../../', import.meta.url))
const root = fileURLToPath(new URL('./runtime-server/', import.meta.url))
// No .env reads. This is a disposable-origin override, not a persisted setting.
process.env.VITE_API_BASE_URL = 'http://127.0.0.1:45581'
await new Promise((yes, no) => {
  const probe = net.createServer()
  probe.once('error', () => no(new Error('Port 43179 occupied; do not kill its owner')))
  probe.listen(43179, '127.0.0.1', () => probe.close(yes))
})
await mkdir(root, { recursive: true })
await writeFile(resolve(root, 'index.html'), await readFile(resolve(project, 'index.html')))
const server = await createServer({
  ...base,
  configFile: false,
  envDir: false,
  root,
  publicDir: resolve(project, 'public'),
  cacheDir: resolve(root, '.vite'),
  resolve: { ...base.resolve, alias: { ...base.resolve.alias, '/src': resolve(project, 'src') } },
  server: { host: '127.0.0.1', port: 43179, strictPort: true, hmr: false,
    fs: { allow: [project] } },
})
await server.listen()
console.log(JSON.stringify({ pid: process.pid, frontend: 'http://127.0.0.1:43179', api: process.env.VITE_API_BASE_URL, generatedRoot: root, coverage: 'production entry and full router; evidence-only Vite root' }))
