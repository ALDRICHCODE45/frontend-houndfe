/**
 * Incremental Server-Sent Events parser (WHATWG "event stream" format).
 * Feed it decoded text in chunks of any size; it emits one message per
 * blank-line-terminated block that carried `data`, and reports `retry:` hints.
 */

export interface SseMessage {
  /** The `id:` of this block, `null` when the block had none (never inherited). */
  id: string | null
  event: string
  data: string
}

export interface SseParserOptions {
  onMessage: (message: SseMessage) => void
  onRetry?: (milliseconds: number) => void
}

export interface SseParser {
  feed(chunk: string): void
}

export function createSseParser(options: SseParserOptions): SseParser {
  let buffer = ''
  let sawCarriageReturn = false
  let id: string | null = null
  let event = ''
  let data: string[] = []
  let hasData = false

  function dispatch() {
    if (hasData) {
      options.onMessage({ id, event: event || 'message', data: data.join('\n') })
    }
    id = null
    event = ''
    data = []
    hasData = false
  }

  function processLine(line: string) {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return // comment
    const colon = line.indexOf(':')
    let field: string
    let value: string
    if (colon === -1) {
      field = line
      value = ''
    } else {
      field = line.slice(0, colon)
      value = line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
    }
    switch (field) {
      case 'event':
        event = value
        break
      case 'data':
        data.push(value)
        hasData = true
        break
      case 'id':
        if (!value.includes('\0')) id = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) options.onRetry?.(Number(value))
        break
      default:
        break
    }
  }

  return {
    feed(chunk: string) {
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i]!
        if (sawCarriageReturn) {
          sawCarriageReturn = false
          if (ch === '\n') continue // second half of CRLF, line already processed
        }
        if (ch === '\r') {
          sawCarriageReturn = true
          processLine(buffer)
          buffer = ''
        } else if (ch === '\n') {
          processLine(buffer)
          buffer = ''
        } else {
          buffer += ch
        }
      }
    },
  }
}
