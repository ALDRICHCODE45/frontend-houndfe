/**
 * Presentation names usually repeat the product («Croquetas adulto raza mediana 2 kg»). The page
 * and the cards already say the product, so a presentation is shown by what tells it apart.
 * Pure: nothing here knows a product, a branch or a price.
 */

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es-MX')
}

const SEPARATOR = /^[\s\-–—·:/,.|]/u
const LEADING_SEPARATORS = /^[\s\-–—·:/,.|]+/u

/**
 * The remainder of `variantName` after the product name, when it starts with it at a word
 * boundary and something meaningful is left; otherwise the variant name as is (trimmed).
 */
export function presentationLabel(productName: string, variantName: string): string {
  const variant = variantName.trim()
  const product = productName.trim()
  if (product === '' || variant === '') return variant

  // Walk the variant letter by letter on folded characters, so accents never shift the cut.
  const wanted = fold(product)
  const chars = [...variant]
  let consumed = ''
  let index = 0
  for (const char of chars) {
    if (consumed.length >= wanted.length) break
    consumed += fold(char)
    index += 1
  }
  if (consumed !== wanted) return variant

  const rest = chars.slice(index).join('')
  // «Croqueta» must not cut «Croquetas»: the next character has to start a new word.
  if (rest !== '' && !SEPARATOR.test(rest)) return variant
  const remainder = rest.replace(LEADING_SEPARATORS, '').trim()
  return /[\p{L}\p{N}]/u.test(remainder) ? remainder : variant
}
