import { describe, it, expect } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import DashboardHomeView from '../views/DashboardHomeView.vue'

/**
 * DSC-REQ-012 — TDD anchor for DashboardHomeView Coco token binding.
 *
 * Pins:
 * - Dashboard icon (i-lucide-layout-dashboard) renders with `text-coco-gold-500`
 * - UCard body surface renders with `bg-coco-neutral-50 dark:bg-coco-neutral-950`
 * - No `text-primary` survives on the dashboard chrome
 *
 * These assertions guard against regressions in SDD-9 and future Nuxt UI
 * upgrades that might re-introduce default primary tokens.
 */
describe('DashboardHomeView — Coco token binding (DSC-REQ-012)', () => {
  it('renders the dashboard icon with text-coco-gold-500 and not text-primary', () => {
    const wrapper = mountWithUApp(DashboardHomeView)

    const icon = wrapper.find('.size-5')
    expect(icon.exists()).toBe(true)

    const classes = icon.classes()
    expect(classes).toContain('text-coco-gold-500')
    expect(classes).not.toContain('text-primary')
  })

  it('renders the UCard body with coco-neutral surface tokens (light + dark)', () => {
    const wrapper = mountWithUApp(DashboardHomeView)

    // The body host of UCard receives the `:ui.body` class string. Inspect
    // the rendered HTML for the neutral tokens — these are the only classes
    // that distinguish Coco-ized body from the Nuxt UI default.
    const html = wrapper.html()
    expect(html).toContain('bg-coco-neutral-50')
    expect(html).toContain('dark:bg-coco-neutral-950')
  })
})
