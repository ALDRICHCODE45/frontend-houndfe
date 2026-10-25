import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const configUrl = new URL('../../playwright.responsive.config.ts', import.meta.url).href
const inspectConfig = `
  const { default: config, RESPONSIVE_WEB_SERVER_PORT: port } = await import(${JSON.stringify(configUrl)});
  console.log(JSON.stringify({ port, server: config.webServer }));
`

function loadConfig(value) {
  const env = { ...process.env }
  delete env.RESPONSIVE_WEB_SERVER_PORT
  if (value !== undefined) env.RESPONSIVE_WEB_SERVER_PORT = value
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', inspectConfig],
    {
      env,
      encoding: 'utf8',
    },
  )
}

for (const [value, expected] of [
  [undefined, 4173],
  ['', 4173],
  ['   ', 4173],
  ['4174', 4174],
  ['1', 1],
  ['65535', 65535],
]) {
  test(`public config resolves ${JSON.stringify(value)} to ${expected} without starting Vite`, () => {
    const result = loadConfig(value)
    assert.equal(result.status, 0, result.stderr)
    const { port, server } = JSON.parse(result.stdout)
    assert.equal(port, expected)
    assert.equal(server.url, `http://127.0.0.1:${expected}/login`)
    assert.equal(server.command, `pnpm exec vite --host 127.0.0.1 --port ${expected} --strictPort`)
    assert.equal(server.reuseExistingServer, false)
    assert.equal(server.env.VITE_API_BASE_URL, '/__e2e-api')
  })
}

for (const value of [
  '0',
  '65536',
  '-1',
  '1.5',
  '4e3',
  '0x104d',
  '+4174',
  ' 4174 ',
  '4174x',
  '4174; echo injected',
  'Infinity',
  'NaN',
]) {
  test(`public config rejects ${JSON.stringify(value)} before starting Vite`, () => {
    const result = loadConfig(value)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /RESPONSIVE_WEB_SERVER_PORT must be an integer from 1 to 65535/)
    assert.equal(result.stdout, '')
  })
}
