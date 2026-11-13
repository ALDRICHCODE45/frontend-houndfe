import { describe, expect, it } from 'vitest'
import { createSseParser, type SseMessage } from '../sse-parser'

function collect() {
  const messages: SseMessage[] = []
  const retries: number[] = []
  const parser = createSseParser({
    onMessage: (m) => messages.push(m),
    onRetry: (ms) => retries.push(ms),
  })
  return { parser, messages, retries }
}

describe('createSseParser', () => {
  it('parses id, event and data', () => {
    const { parser, messages } = collect()
    parser.feed('id: 902118\nevent: request.claimed\ndata: {"a":1}\n\n')
    expect(messages).toEqual([{ id: '902118', event: 'request.claimed', data: '{"a":1}' }])
  })

  it('joins multi-line data with a newline', () => {
    const { parser, messages } = collect()
    parser.feed('event: x\ndata: one\ndata: two\n\n')
    expect(messages[0]?.data).toBe('one\ntwo')
  })

  it('defaults the event name to "message" and the id to null', () => {
    const { parser, messages } = collect()
    parser.feed('data: hi\n\n')
    expect(messages).toEqual([{ id: null, event: 'message', data: 'hi' }])
  })

  it('ignores comment lines and emits nothing for comment-only blocks', () => {
    const { parser, messages } = collect()
    parser.feed(': keep-alive\n\n')
    parser.feed(': note\nevent: heartbeat\ndata: {}\n\n')
    expect(messages).toEqual([{ id: null, event: 'heartbeat', data: '{}' }])
  })

  it('handles chunks split anywhere, including mid-line and mid-CRLF', () => {
    const { parser, messages } = collect()
    const raw = 'id: 5\r\nevent: heartbeat\r\ndata: {"t":1}\r\n\r\nid: 6\nevent: a\ndata: b\n\n'
    for (const ch of raw) parser.feed(ch)
    expect(messages).toEqual([
      { id: '5', event: 'heartbeat', data: '{"t":1}' },
      { id: '6', event: 'a', data: 'b' },
    ])
  })

  it('strips only one leading space after the colon', () => {
    const { parser, messages } = collect()
    parser.feed('event:  spaced\ndata:  two\n\n')
    expect(messages[0]).toMatchObject({ event: ' spaced', data: ' two' })
  })

  it('reports the retry field (digits only) and emits no message for it', () => {
    const { parser, messages, retries } = collect()
    parser.feed('retry: 3000\n\nretry: abc\n\n')
    expect(retries).toEqual([3000])
    expect(messages).toEqual([])
  })

  it('does not carry the id of one message into the next', () => {
    const { parser, messages } = collect()
    parser.feed('id: 1\nevent: a\ndata: x\n\nevent: b\ndata: y\n\n')
    expect(messages.map((m) => m.id)).toEqual(['1', null])
  })

  it('treats a field line without colon as a field with empty value and ignores unknown fields', () => {
    const { parser, messages } = collect()
    parser.feed('foo: bar\ndata\n\n')
    expect(messages).toEqual([{ id: null, event: 'message', data: '' }])
  })
})
