// node crop.mjs <in.png> <out.png> <x> <y> <w> <h> [scale] — crops a screenshot (for close-ups of defects).
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
const [inp, out, x, y, w, h, scale = 2] = process.argv.slice(2)
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale })
const src = 'data:image/png;base64,' + readFileSync(inp).toString('base64')
await p.setContent(`<body style="margin:0;overflow:hidden"><img src="${src}" style="position:absolute;left:${-x}px;top:${-y}px"></body>`)
await p.waitForTimeout(200)
await p.screenshot({ path: out })
await b.close()
