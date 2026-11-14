import { chromium } from '@playwright/test'
import { join } from 'node:path'
import { SHOTS } from './lib.mjs'
const D = '/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/design/catalog-animal-filters/'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1400 } })
await p.goto('file://' + D + '01-direccion-a-grupos-y-especies.html'); await p.waitForTimeout(600)
await p.screenshot({ path: join(SHOTS, 'design-01-top.png'), clip: { x: 0, y: 0, width: 1500, height: 1400 } })
await b.close()
