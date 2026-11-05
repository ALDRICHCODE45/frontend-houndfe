import { es } from '@nuxt/ui/locale'

/**
 * The UApp locale: Nuxt UI's Spanish copy with the Mexican number code. Reka's
 * NumberField (UInputNumber) formats and parses with this code, so a dot is the
 * decimal separator (`1.5` is 1.5). Plain `es` reads a dot as thousands.
 */
export const appLocale = { ...es, code: 'es-MX' }
