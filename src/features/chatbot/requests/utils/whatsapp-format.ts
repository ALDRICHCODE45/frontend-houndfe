/**
 * WhatsApp inline formatting for the conversation mirror: `*bold*`, `_italic_`, `~strike~`.
 *
 * The bot sends the mirror the same text the customer receives, and customers may type these
 * markers too, so the POS shows them as WhatsApp does. The result is plain segments rendered as
 * text by Vue — never HTML. Line breaks, leading spaces, bullets and emojis pass through untouched.
 *
 * WhatsApp-like rules: a marker opens only at the start or after a non letter/digit and must be
 * followed by a non-space; it closes on the same marker preceded by a non-space and followed by
 * the end or a non letter/digit; a span never crosses a line break and is never empty. Anything
 * else stays literal («2 * 3», «archivo_final_v2.pdf», «*sin cerrar»).
 */

export interface WhatsAppSegment {
  text: string
  bold: boolean
  italic: boolean
  strike: boolean
}

type Style = Pick<WhatsAppSegment, 'bold' | 'italic' | 'strike'>
type Marker = '*' | '_' | '~'

const STYLE_OF: Record<Marker, keyof Style> = { '*': 'bold', _: 'italic', '~': 'strike' }
const WORD = /[\p{L}\p{N}]/u
const SPACE = /\s/

function isMarker(char: string | undefined): char is Marker {
  return char === '*' || char === '_' || char === '~'
}

function canOpen(text: string, index: number): boolean {
  const before = text[index - 1]
  const after = text[index + 1]
  if (before !== undefined && WORD.test(before)) return false
  return after !== undefined && !SPACE.test(after) && after !== text[index]
}

function findClose(text: string, open: number): number {
  const marker = text[open]
  for (let index = open + 2; index < text.length; index += 1) {
    const char = text[index]
    if (char === '\n') return -1
    if (char !== marker) continue
    const before = text[index - 1]
    const after = text[index + 1]
    if (before === undefined || SPACE.test(before)) continue
    if (after !== undefined && WORD.test(after)) continue
    return index
  }
  return -1
}

function push(segments: WhatsAppSegment[], text: string, style: Style): void {
  if (text.length === 0) return
  const last = segments[segments.length - 1]
  if (
    last &&
    last.bold === style.bold &&
    last.italic === style.italic &&
    last.strike === style.strike
  ) {
    last.text += text
    return
  }
  segments.push({ text, ...style })
}

function parse(text: string, style: Style, segments: WhatsAppSegment[]): void {
  let literal = ''
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (isMarker(char) && !style[STYLE_OF[char]] && canOpen(text, index)) {
      const close = findClose(text, index)
      if (close !== -1) {
        push(segments, literal, style)
        literal = ''
        parse(text.slice(index + 1, close), { ...style, [STYLE_OF[char]]: true }, segments)
        index = close + 1
        continue
      }
    }
    literal += char
    index += 1
  }
  push(segments, literal, style)
}

/** Split `text` into styled segments; an empty string gives no segments. */
export function parseWhatsAppText(text: string): WhatsAppSegment[] {
  const segments: WhatsAppSegment[] = []
  parse(text, { bold: false, italic: false, strike: false }, segments)
  return segments
}
