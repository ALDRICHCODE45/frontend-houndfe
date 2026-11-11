// Diagnosis probe: dark colour-mode leaking into the light catalog.
// node odd/evidence/public-catalog-v0-design/diag/probe.mjs
import { chromium, firefox } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5199'
const DETAIL = '/catalogo/centro/p/0b2f0000-0000-4000-8000-000000000001'
const LIST = '/catalogo/centro'
const VARS = ['--ui-bg', '--ui-bg-elevated', '--ui-bg-accented', '--ui-text-highlighted', '--hf-surface', '--background-color-default', '--background-color-elevated']
mkdirSync(join(OUT, 'shots'), { recursive: true })
const report = []
const log = (s) => { report.push(s); console.log(s) }

function walker(selector) {
  return ({ selector, VARS }) => {
    const el = document.querySelector(selector)
    if (!el) return { missing: true }
    const chain = []
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      const v = {}
      for (const k of VARS) v[k] = cs.getPropertyValue(k).trim()
      chain.push({
        tag: n.tagName.toLowerCase(), cls: (n.getAttribute('class') || '').slice(0, 70),
        attrs: [...n.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-v-app').map((a) => `${a.name}=${a.value}`).join(' ') + (n.id ? ` #${n.id}` : ''),
        bg: cs.backgroundColor, color: cs.color, scheme: cs.colorScheme, v,
      })
    }
    return { chain }
  }
}

const lum = (rgb) => { const m = rgb.match(/[\d.]+/g)?.map(Number); return m ? (m[0] + m[1] + m[2]) / 3 : 255 }

async function run(engineName, engine, storage, scheme) {
  const tag = `${engineName}-${storage}-${scheme}`
  const browser = await engine.launch()
  const ctx = await browser.newContext({ viewport: { width: 1848, height: 950 }, colorScheme: scheme })
  await ctx.addInitScript((s) => { try { localStorage.setItem('vueuse-color-scheme', s) } catch {} }, storage)
  const page = await ctx.newPage()
  await page.route('**/public/catalog/centro/products/0b2f*', async (route) => {
    await new Promise((r) => setTimeout(r, 3500))
    await route.continue()
  })
  log(`\n######## ${tag}`)

  // Listing
  await page.goto(BASE + LIST, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.catalog-product-card', { timeout: 20000 })
  await page.waitForTimeout(600)
  log(`html class="${await page.evaluate(() => document.documentElement.className)}" body class="${await page.evaluate(() => document.body.className)}"`)
  await page.screenshot({ path: join(OUT, 'shots', `${tag}-list.png`) })
  const card = await page.evaluate(walker('.catalog-product-card'), { selector: '.catalog-product-card', VARS })
  const cardBody = await page.evaluate(walker('.catalog-product-body'), { selector: '.catalog-product-body', VARS })
  const cs = await page.evaluate(() => {
    const c = document.querySelector('.catalog-product-card'); const b = document.querySelector('.catalog-product-body'); const h = document.querySelector('.catalog-product-name')
    return { card: getComputedStyle(c).backgroundColor, body: getComputedStyle(b).backgroundColor, title: getComputedStyle(h).color }
  })
  log(`listing card computed: ${JSON.stringify(cs)}`)
  report.push(JSON.stringify({ tag, kind: 'list-card', chain: card.chain }, null, 1))
  report.push(JSON.stringify({ tag, kind: 'list-body', chain: cardBody.chain }, null, 1))

  // Detail during loading
  await page.goto(BASE + DETAIL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.catalog-pdp-skeleton-main', { timeout: 20000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, 'shots', `${tag}-detail-loading.png`) })
  const sk = await page.evaluate(walker('.catalog-pdp-skeleton-main'), { selector: '.catalog-pdp-skeleton-main', VARS })
  const sk2 = await page.evaluate(() => [...document.querySelectorAll('.catalog-pdp-skeleton [aria-busy], .catalog-pdp-skeleton-main')].map((e) => ({ cls: e.className.slice(0, 90), bg: getComputedStyle(e).backgroundColor })))
  log(`detail skeletons: ${JSON.stringify(sk2.slice(0, 4))}`)
  report.push(JSON.stringify({ tag, kind: 'detail-skeleton', chain: sk.chain }, null, 1))
  // first dark ancestor for --ui-bg-elevated
  const first = sk.chain.find((n) => n.v['--ui-bg-elevated'] && n.v['--ui-bg-elevated'].startsWith('#') && lum(`rgb(${parseInt(n.v['--ui-bg-elevated'].slice(1, 3), 16)},${parseInt(n.v['--ui-bg-elevated'].slice(3, 5), 16)},${parseInt(n.v['--ui-bg-elevated'].slice(5, 7), 16)})`) < 100)
  log(`first dark --ui-bg-elevated ancestor (inner->outer): ${first ? `${first.tag}.${first.cls} ${first.attrs}` : 'none (all light/non-hex)'}`)
  for (const n of sk.chain) log(`  ${n.tag}.${n.cls.slice(0, 40)} [${n.attrs}] elev=${n.v['--ui-bg-elevated']} bg=${n.v['--ui-bg']} acc=${n.v['--ui-bg-accented']} hl=${n.v['--ui-text-highlighted']} hfsurf=${n.v['--hf-surface']} cbg=${n.bg} scheme=${n.scheme}`)
  await browser.close()
}

for (const [name, eng] of [['firefox', firefox], ['chromium', chromium]])
  for (const storage of ['dark', 'auto'])
    for (const scheme of ['dark'])
      await run(name, eng, storage, scheme).catch((e) => log(`FAILED ${name}/${storage}: ${e.message.split('\n')[0]}`))
writeFileSync(join(OUT, 'probe-output.txt'), report.join('\n'))
