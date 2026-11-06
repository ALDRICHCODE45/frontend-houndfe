#!/usr/bin/env node
// T2 write flow on dev data: create zone 01010 (Con cargo $45.00, 2 días), deactivate it,
// then try to save 06600 (pending validation) and expect the 409 to open that validation.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login } from '../../design-pass-2/t4/lib.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const safeUrl = (raw) => { try { return new URL(raw) } catch { return null } }
const BASE = 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX', reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.setViewportSize({ width: 1440, height: 900 })
const puts = []
p.on('request', (r) => { if (r.method() === 'PUT' || r.method() === 'DELETE') puts.push(`${r.method()} ${safeUrl(r.url())?.pathname ?? '?'} ${r.postData() ?? ''}`) })
await p.goto(`${BASE}/sistema/envios?tab=zonas`)
await p.waitForLoadState('networkidle')
await p.getByTestId('zone-create').click()
await p.locator('#zone-zip').fill('01010')
await p.getByRole('radio', { name: 'Con cargo' }).click()
await p.locator('#zone-surcharge').fill('45')
await p.locator('#zone-surcharge').blur()
await p.locator('#zone-eta').fill('2')
await p.locator('#zone-neighborhood').fill('Zona de prueba T2')
await p.getByTestId('zone-submit').click()
await p.waitForTimeout(1500)
console.log('notice:', await p.locator('[role=status].zone-notice').innerText().catch(() => '(none)'))
const { token } = await login('manager@houndfe.com', 'manager')
const z = await call('GET', '/delivery-zones/01010', token)
console.log('saved:', JSON.stringify({ type: z.type, surchargeCents: z.surchargeCents, etaDays: z.etaDays, neighborhood: z.neighborhood, state: z.state, isActive: z.isActive }))
await p.getByPlaceholder('Buscar por código postal o colonia...').fill('01010')
await p.waitForTimeout(1200)
await p.locator('tbody button[aria-haspopup="menu"]').first().click()
await p.getByRole('menuitem', { name: /Desactivar/ }).click()
await p.getByTestId('zone-deactivate-confirm').click()
await p.waitForTimeout(1200)
console.log('after deactivate:', (await call('GET', '/delivery-zones/01010', token)).isActive)
await p.getByPlaceholder('Buscar por código postal o colonia...').fill('')
await p.getByTestId('zone-create').click()
await p.locator('#zone-zip').fill('06600')
await p.locator('#zone-eta').fill('1')
await p.getByTestId('zone-submit').click()
await p.waitForURL((u) => u.pathname === '/sistema/envios/validaciones', { timeout: 10000 }).catch(() => {})
await p.waitForTimeout(1500)
const url = safeUrl(p.url())
console.log('409 →', url?.pathname, 'validation param present:', Boolean(url?.searchParams.get('validation')))
console.log('drawer:', (await p.locator('[role=dialog]').innerText().catch(() => '(none)')).split('\n').slice(0, 3).join(' | '))
await p.screenshot({ path: join(HERE, 'shots', 't2__flow-409__1440__light.png') })
console.log(puts.join('\n'))
await browser.close()
