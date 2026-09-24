/**
 * Readability smoke helper for the focused promotion-capacity browser checks.
 *
 * This is a CSS contrast smoke test, NOT a WCAG audit. It forces one theme
 * class on the document root, reads the element's computed foreground colour
 * and flattens the nearest non-transparent ancestor backgrounds, then returns
 * the WCAG contrast ratio. Each spec owns the representative region and the
 * defensible minimum so a deliberately lower muted line never weakens the
 * global floor.
 */
import { expect, type Locator } from '@playwright/test'

/** The two theme classes the app's Nuxt UI dark/light variants bind to. */
export type ForcedTheme = 'light' | 'dark'

/** WCAG 2.1 AA minimum contrast ratio for normal-size text. */
export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5

export interface ContrastMeasurement {
  readonly theme: ForcedTheme
  readonly foreground: string
  readonly background: string
  readonly ratio: number
}

/** Forces one theme class on the root and waits two frames so variant styles settle. */
export async function forceTheme(locator: Locator, theme: ForcedTheme): Promise<void> {
  const page = locator.page()
  await page.evaluate((next) => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(next)
    root.style.colorScheme = next
  }, theme)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
}

/**
 * Forces `theme` and measures the WCAG contrast ratio of the element's
 * computed foreground against its effective background (nearest non-transparent
 * ancestor backgrounds flattened over a white fallback).
 */
export async function measureContrast(
  locator: Locator,
  theme: ForcedTheme,
): Promise<ContrastMeasurement> {
  await forceTheme(locator, theme)
  return locator.evaluate((element, forcedTheme) => {
    interface Rgba {
      r: number
      g: number
      b: number
      a: number
    }
    const parseColor = (value: string): Rgba | null => {
      const rgb = value.match(/rgba?\(([^)]+)\)/i)
      if (rgb) {
        const parts = rgb[1]
          .split(/[ ,/]+/)
          .filter((part) => part.length > 0)
          .map(Number)
        const [r, g, b, a] = parts
        if (r === undefined || g === undefined || b === undefined) return null
        return { r, g, b, a: a === undefined ? 1 : a }
      }
      const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i)
      if (!hex) return null
      const digits = hex[1]
      const channel = (pair: string): number => parseInt(pair.length === 1 ? pair + pair : pair, 16)
      if (digits.length === 3 || digits.length === 4) {
        return {
          r: channel(digits[0]),
          g: channel(digits[1]),
          b: channel(digits[2]),
          a: digits.length === 4 ? channel(digits[3]) / 255 : 1,
        }
      }
      return {
        r: channel(digits.slice(0, 2)),
        g: channel(digits.slice(2, 4)),
        b: channel(digits.slice(4, 6)),
        a: digits.length === 8 ? channel(digits.slice(6, 8)) / 255 : 1,
      }
    }
    const luminance = ({ r, g, b }: Rgba): number => {
      const linear = (channelValue: number): number => {
        const normalized = channelValue / 255
        return normalized <= 0.03928
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }

    const layers: Rgba[] = []
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      const background = parseColor(getComputedStyle(node).backgroundColor)
      if (background !== null && background.a > 0) {
        layers.push(background)
        if (background.a >= 0.999) break
      }
    }
    let flattened: Rgba = { r: 255, g: 255, b: 255, a: 1 }
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const top = layers[index] as Rgba
      flattened = {
        r: top.r * top.a + flattened.r * (1 - top.a),
        g: top.g * top.a + flattened.g * (1 - top.a),
        b: top.b * top.a + flattened.b * (1 - top.a),
        a: top.a + flattened.a * (1 - top.a),
      }
    }

    const foreground = parseColor(getComputedStyle(element).color)
    if (foreground === null)
      throw new Error(`readability: unparsable foreground ${getComputedStyle(element).color}`)
    const lighter = Math.max(luminance(foreground), luminance(flattened))
    const darker = Math.min(luminance(foreground), luminance(flattened))
    const ratio = (lighter + 0.05) / (darker + 0.05)
    return {
      theme: forcedTheme,
      foreground: getComputedStyle(element).color,
      background: `rgb(${Math.round(flattened.r)}, ${Math.round(flattened.g)}, ${Math.round(flattened.b)})`,
      ratio: Math.round(ratio * 100) / 100,
    }
  }, theme)
}

export interface ReadableContrastOptions {
  readonly label: string
  /** Defaults to the WCAG AA normal-text floor (4.5). */
  readonly minRatio?: number
}

/** Asserts the representative region meets the floor in the forced theme. */
export async function assertReadableContrast(
  locator: Locator,
  theme: ForcedTheme,
  options: ReadableContrastOptions,
): Promise<ContrastMeasurement> {
  const minRatio = options.minRatio ?? WCAG_AA_NORMAL_TEXT_RATIO
  const measurement = await measureContrast(locator, theme)
  expect(
    measurement.ratio,
    `${options.label} must meet ${minRatio}:1 contrast in the ${theme} theme (measured ${measurement.ratio}:1 against ${measurement.background})`,
  ).toBeGreaterThanOrEqual(minRatio)
  return measurement
}
