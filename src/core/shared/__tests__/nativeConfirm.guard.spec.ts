import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { scanNativeConfirmSource } from '../utils/nativeConfirmGuard.utils'

// The browser's own confirm dialog is unthemed and blocks the page, so every confirmation goes
// through useConfirm and the app's ConfirmModal (design-system.md, Confirmación y salir sin guardar).

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.(vue|ts)$/.test(name) && !/\.(spec|test)\./.test(name) ? [path] : []
  })
}

describe('native confirm scanner', () => {
  it('flags window.confirm, globalThis.confirm and a bare global confirm()', () => {
    expect(scanNativeConfirmSource('if (window.confirm("x")) go()', 'a.ts')).toEqual(['window.confirm'])
    expect(scanNativeConfirmSource('globalThis.confirm("x")', 'a.ts')).toEqual(['globalThis.confirm'])
    expect(scanNativeConfirmSource('const ok = confirm("x")', 'a.ts')).toEqual(['confirm'])
    expect(scanNativeConfirmSource('<script setup lang="ts">\nconst ok = window.confirm("x")\n</script>\n<template><p /></template>', 'a.vue')).toEqual(['window.confirm'])
  })

  it('accepts a local confirm, a method named confirm and comments', () => {
    expect(scanNativeConfirmSource('const { confirm } = useConfirm()\nawait confirm({ description: "x" })', 'a.ts')).toEqual([])
    expect(scanNativeConfirmSource('function confirm(id: string) {}\nconfirm("o")', 'a.ts')).toEqual([])
    expect(scanNativeConfirmSource('commands.confirm("o"); api.confirm(1)\n// window.confirm("x")', 'a.ts')).toEqual([])
  })
})

const root = resolve(__dirname, '../../..')
const offenders = new Map<string, string[]>()
for (const file of sourceFiles(root)) {
  const found = scanNativeConfirmSource(readFileSync(file, 'utf8'), file)
  if (found.length > 0) offenders.set(file.slice(root.length + 1).replace(/\\/g, '/'), found)
}

describe('confirmations use the app dialog', () => {
  it('has no native window.confirm anywhere in src', () => {
    expect([...offenders]).toEqual([])
  })
})
